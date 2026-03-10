/**
 * カーボンクレジット価格データを WordPress price_trends CPT に同期するスクリプト。
 *
 * - Frankfurter API で最新 FX レート (EUR/JPY, USD/JPY) を取得
 * - 5市場の参考価格を JPY 換算して WordPress に upsert
 * - price_history に追記し、トレンドを計算
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD && npm run sync-prices
 *
 * --dry-run オプションで WordPress 書き込みをスキップ:
 *   npm run sync-prices -- --dry-run
 */

const API_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error(
    "環境変数が未設定です: NEXT_PUBLIC_WORDPRESS_API_URL, WP_APP_USER, WP_APP_PASSWORD"
  );
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

// ============================================================
// 型定義
// ============================================================

type MarketDefinition = {
  marketId: string;
  title: string;
  /** ACF select: "回避・削減系" | "除去系" — WordPress の許可値に準拠 */
  creditType: "回避・削減系" | "除去系";
  sourceCurrency: "EUR" | "USD" | "JPY";
  referencePrice: number;
  sourceName: string;
  sourceUrl: string;
};

type PriceHistoryEntry = {
  date: string;
  price: number;
  priceJpy: number;
};

type FxRates = {
  eurJpy: number;
  usdJpy: number;
};

// ============================================================
// 5市場の定義（参考価格 + データソース情報）
// ============================================================

const MARKETS: MarketDefinition[] = [
  {
    marketId: "eu-ets",
    title: "EU ETS (EUA)",
    creditType: "回避・削減系",
    sourceCurrency: "EUR",
    referencePrice: 65.0,
    sourceName: "ICAP",
    sourceUrl: "https://icapcarbonaction.com/en/ets-prices",
  },
  {
    marketId: "jcredit-renewable",
    title: "J-Credit（再エネ）",
    creditType: "回避・削減系",
    sourceCurrency: "JPY",
    referencePrice: 3200,
    sourceName: "JPX",
    sourceUrl: "https://www.jpx.co.jp/equities/products/carbon-credit/index.html",
  },
  {
    marketId: "jcredit-energy-saving",
    title: "J-Credit（省エネ）",
    creditType: "回避・削減系",
    sourceCurrency: "JPY",
    referencePrice: 1800,
    sourceName: "JPX",
    sourceUrl: "https://www.jpx.co.jp/equities/products/carbon-credit/index.html",
  },
  {
    marketId: "vcs-geo",
    title: "ボランタリー GEO (Xpansiv CBL)",
    creditType: "回避・削減系",
    sourceCurrency: "USD",
    referencePrice: 1.5,
    sourceName: "Xpansiv CBL",
    sourceUrl: "https://xpansiv.com/cbl/",
  },
  {
    marketId: "vcs-ngeo",
    title: "ボランタリー N-GEO (Xpansiv CBL)",
    creditType: "除去系",
    sourceCurrency: "USD",
    referencePrice: 5.0,
    sourceName: "Xpansiv CBL",
    sourceUrl: "https://xpansiv.com/cbl/",
  },
];

// ============================================================
// FX レート取得（Frankfurter API — ECB データ、無料・認証不要）
// ============================================================

async function fetchFxRates(): Promise<FxRates> {
  console.log("[FX] Frankfurter API から EUR/JPY, USD/JPY を取得中...");
  const [eurRes, usdRes] = await Promise.all([
    fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=JPY"),
    fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY"),
  ]);

  if (!eurRes.ok || !usdRes.ok) {
    throw new Error(
      `FX レート取得失敗: EUR=${eurRes.status}, USD=${usdRes.status}`
    );
  }

  const eurData = (await eurRes.json()) as { rates: { JPY: number } };
  const usdData = (await usdRes.json()) as { rates: { JPY: number } };

  const rates: FxRates = {
    eurJpy: eurData.rates.JPY,
    usdJpy: usdData.rates.JPY,
  };

  console.log(`[FX] EUR/JPY = ${rates.eurJpy}, USD/JPY = ${rates.usdJpy}`);
  return rates;
}

// ============================================================
// 価格取得（将来の API 統合に備えた拡張ポイント）
// ============================================================

/**
 * 市場ごとの価格を取得する。
 * 現時点では参考価格をそのまま返す。
 * 将来的に API 統合する場合はこの関数を差し替える。
 */
function fetchPrice(market: MarketDefinition): number {
  // TODO: EU ETS → ICAP API、J-Credit → JPX API 等に差し替え
  return market.referencePrice;
}

// ============================================================
// JPY 換算
// ============================================================

function convertToJpy(
  price: number,
  currency: "EUR" | "USD" | "JPY",
  fx: FxRates
): { priceJpy: number; fxRate: number } {
  switch (currency) {
    case "JPY":
      return { priceJpy: price, fxRate: 1 };
    case "EUR":
      return {
        priceJpy: Math.round(price * fx.eurJpy * 100) / 100,
        fxRate: fx.eurJpy,
      };
    case "USD":
      return {
        priceJpy: Math.round(price * fx.usdJpy * 100) / 100,
        fxRate: fx.usdJpy,
      };
  }
}

// ============================================================
// トレンド計算
// ============================================================

function calculateTrend(
  history: PriceHistoryEntry[],
  currentPriceJpy: number
): { direction: "up" | "down" | "stable"; percentage: number } {
  if (history.length === 0) {
    return { direction: "stable", percentage: 0 };
  }
  // 直前エントリと比較
  const prev = history[history.length - 1];
  if (prev.priceJpy === 0) {
    return { direction: "stable", percentage: 0 };
  }
  const change =
    ((currentPriceJpy - prev.priceJpy) / prev.priceJpy) * 100;
  const percentage = Math.round(change * 100) / 100;
  if (Math.abs(percentage) < 0.5) {
    return { direction: "stable", percentage };
  }
  return {
    direction: percentage > 0 ? "up" : "down",
    percentage,
  };
}

// ============================================================
// WordPress upsert
// ============================================================

type WPSearchResult = {
  id: number;
  title: { rendered: string };
  acf?: Record<string, unknown> | unknown[];
};

async function findExistingPriceTrend(
  marketId: string
): Promise<{ wpId: number; existingHistory: PriceHistoryEntry[] } | null> {
  try {
    const url = `${API_BASE}/price_trends?per_page=100`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const posts: WPSearchResult[] = await res.json();

    for (const p of posts) {
      const acf =
        p.acf &&
        !Array.isArray(p.acf) &&
        typeof p.acf === "object" &&
        Object.keys(p.acf).length > 0
          ? p.acf
          : null;
      if (acf && acf.market_id === marketId) {
        // 既存の price_history を取得
        let existingHistory: PriceHistoryEntry[] = [];
        if (typeof acf.price_history === "string" && acf.price_history.trim()) {
          try {
            const parsed = JSON.parse(acf.price_history as string);
            if (Array.isArray(parsed)) {
              existingHistory = parsed;
            }
          } catch {
            // パース失敗 → 空履歴
          }
        }
        return { wpId: p.id, existingHistory };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function upsertPriceTrend(
  market: MarketDefinition,
  price: number,
  priceJpy: number,
  fxRate: number,
  history: PriceHistoryEntry[],
  trend: { direction: string; percentage: number },
  now: string
): Promise<void> {
  const acf = {
    market_id: market.marketId,
    credit_type: market.creditType,
    source_currency: market.sourceCurrency,
    latest_price: price,
    latest_price_jpy: priceJpy,
    fx_rate: fxRate,
    price_unit: "tCO2e",
    source_name: market.sourceName,
    source_url: market.sourceUrl,
    price_history: JSON.stringify(history),
    trend_direction: trend.direction,
    trend_percentage: trend.percentage,
    last_synced: now,
  };

  const existing = await findExistingPriceTrend(market.marketId);

  if (existing) {
    console.log(
      `  [更新] ${market.title} (ID ${existing.wpId})`
    );
    if (DRY_RUN) {
      console.log("    → DRY RUN: スキップ");
      return;
    }
    const res = await fetch(`${API_BASE}/price_trends/${existing.wpId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({
        title: market.title,
        acf,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `更新失敗 ${market.title}: ${res.status} ${text.slice(0, 300)}`
      );
    }
  } else {
    console.log(`  [新規] ${market.title}`);
    if (DRY_RUN) {
      console.log("    → DRY RUN: スキップ");
      return;
    }
    const res = await fetch(`${API_BASE}/price_trends`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({
        title: market.title,
        content: `<p>${market.title}の価格データ</p>`,
        status: "publish",
        acf,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `作成失敗 ${market.title}: ${res.status} ${text.slice(0, 300)}`
      );
    }
    const created = (await res.json()) as { id: number };
    console.log(`    → ID ${created.id} で作成完了`);
  }
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log("=== クレジット価格同期スクリプト ===");
  console.log(`API: ${API_BASE}`);
  console.log(`対象市場数: ${MARKETS.length}`);
  if (DRY_RUN) console.log("⚠️  DRY RUN モード（WordPress 書き込みなし）");
  console.log("");

  // 1. FX レート取得
  const fx = await fetchFxRates();

  const now = new Date().toISOString();
  const today = now.slice(0, 10); // "YYYY-MM-DD"
  let created = 0;
  let updated = 0;
  let errors = 0;

  // 2. 各市場を処理
  for (const market of MARKETS) {
    try {
      console.log(`\n[${market.marketId}] ${market.title}`);

      // 価格取得
      const price = fetchPrice(market);
      const { priceJpy, fxRate } = convertToJpy(
        price,
        market.sourceCurrency,
        fx
      );

      console.log(
        `  価格: ${price} ${market.sourceCurrency} → ¥${priceJpy} (FX: ${fxRate})`
      );

      // 既存データの price_history を取得
      const existing = await findExistingPriceTrend(market.marketId);
      const existingHistory = existing?.existingHistory ?? [];

      // 同日のエントリがあれば上書き、なければ追記
      const filteredHistory = existingHistory.filter(
        (e) => e.date !== today
      );
      const newEntry: PriceHistoryEntry = {
        date: today,
        price,
        priceJpy,
      };
      const updatedHistory = [...filteredHistory, newEntry];

      // トレンド計算（新しいエントリ追加前の最新エントリと比較）
      const trend = calculateTrend(filteredHistory, priceJpy);
      console.log(
        `  トレンド: ${trend.direction} (${trend.percentage > 0 ? "+" : ""}${trend.percentage}%)`
      );

      // WordPress upsert
      await upsertPriceTrend(
        market,
        price,
        priceJpy,
        fxRate,
        updatedHistory,
        trend,
        now
      );

      if (existing) updated++;
      else created++;
    } catch (e) {
      console.error(`  [エラー] ${market.title}: ${e}`);
      errors++;
    }

    // API レート制限対策
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n=== 完了 ===`);
  console.log(
    `新規作成: ${created}, 更新: ${updated}, エラー: ${errors}`
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
