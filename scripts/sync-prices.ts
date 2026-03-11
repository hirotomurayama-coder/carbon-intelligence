/**
 * カーボンクレジット価格データを WordPress price_trends CPT に同期するスクリプト。
 *
 * データソース:
 *   1. J-Credit (省エネルギー, 森林, 農業中干し, 農業バイオ炭) — JPX PDF
 *   2. EU ETS (EUA) — homaio.com
 *   3. ボランタリークレジット (Biochar, Nature-based Removal) — AI 集約
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD GOOGLE_GENERATIVE_AI_API_KEY && npm run sync-prices
 *
 * --dry-run オプションで WordPress 書き込みをスキップ:
 *   npm run sync-prices -- --dry-run
 */

import * as cheerio from "cheerio";
import { extractVoluntaryPrices } from "./ai-enricher.js";

/** pdf-parse v2 (class-based API) で PDF テキストを抽出 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse v2 は PDFParse クラスベースの API
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (opts: { data: Uint8Array }) => {
      load: () => Promise<void>;
      getText: () => Promise<string>;
      destroy: () => void;
    };
  };

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  const result = await parser.getText();
  parser.destroy();
  // v2 getText() は { pages, text, total } オブジェクトを返す
  return typeof result === "string" ? result : (result as { text: string }).text;
}

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "").replace(/\/+$/, "");
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error("環境変数が未設定です: NEXT_PUBLIC_WORDPRESS_API_URL, WP_APP_USER, WP_APP_PASSWORD");
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

// ============================================================
// 型定義
// ============================================================

type MarketResult = {
  marketId: string;
  title: string;
  creditType: "回避・削減系" | "除去系";
  sourceCurrency: "EUR" | "USD" | "JPY";
  price: number;
  sourceName: string;
  sourceUrl: string;
  note?: string; // 市場停止中の注記等
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
// 1. FX レート取得（Frankfurter API）
// ============================================================

async function fetchFxRates(): Promise<FxRates> {
  console.log("[FX] Frankfurter API から EUR/JPY, USD/JPY を取得中...");
  const [eurRes, usdRes] = await Promise.all([
    fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=JPY"),
    fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY"),
  ]);

  if (!eurRes.ok || !usdRes.ok) {
    throw new Error(`FX レート取得失敗: EUR=${eurRes.status}, USD=${usdRes.status}`);
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
// 2. J-Credit 価格取得（JPX PDF 解析）
//    ※ 最新の日報 PDF 1件のみを取得し、当日の価格を抽出する。
//    ※ 過去データのバックフィルは行わない。
// ============================================================

const JPX_DAILY_URL = "https://www.jpx.co.jp/equities/carbon-credit/daily/index.html";

/** JPX 日次データページから最新の PDF リンク1件のみを取得 */
async function findLatestJpxPdfUrl(): Promise<string | null> {
  console.log("[JPX] 日次データページを取得中...");
  const res = await fetch(JPX_DAILY_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CarbonIntelBot/1.0)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`[JPX] ページ取得失敗: HTTP ${res.status}`);
    return null;
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // PDF リンクを探す（.pdf で終わるリンク）
  const pdfLinks: { href: string; text: string }[] = [];
  $("a[href$='.pdf']").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (href) {
      // 相対パスを絶対パスに変換
      const fullUrl = href.startsWith("http")
        ? href
        : `https://www.jpx.co.jp${href.startsWith("/") ? "" : "/"}${href}`;
      pdfLinks.push({ href: fullUrl, text });
    }
  });

  if (pdfLinks.length === 0) {
    console.warn("[JPX] PDF リンクが見つかりません");
    return null;
  }

  // 日付が含まれるリンクをソートして最新を取得
  // ファイル名パターン例: "cc_daily_20260307.pdf"
  const sorted = pdfLinks.sort((a, b) => b.href.localeCompare(a.href));
  console.log(`[JPX] PDF リンク ${pdfLinks.length} 件発見。最新: ${sorted[0].href}`);
  return sorted[0].href;
}

/** J-Credit の約定値段を行名で抽出 */
type JCreditCategory = "省エネルギー" | "森林" | "農業（中干し延長）" | "農業（バイオ炭）";

type JCreditPrice = {
  category: JCreditCategory;
  yakujoPrice: number | null; // 約定値段（円/tCO2e）
};

/**
 * PDF テキストから J-Credit 基準値段（または約定値段）を抽出。
 *
 * 実際の PDF テキスト形式:
 *   Ｊ－クレジット 省エネルギー （指定なし） 1001000 4,700 2026/03/06 ...
 *   Ｊ－クレジット 森林 （指定なし） 1011000 ... 約定 5,200 ...
 *
 * 各行の構造: 制度名 分類名 方法論名 銘柄コード 基準値段 基準日付 ... 始値/高値/安値/終値 ...
 * 基準値段 = 銘柄コード直後のカンマ付き数値
 */
function parseJCreditPdf(text: string): JCreditPrice[] {
  console.log("[JPX] PDF テキストを解析中...");
  console.log(`  [JPX] テキスト長: ${text.length} 文字`);

  const categories: { key: JCreditCategory; pattern: RegExp }[] = [
    { key: "省エネルギー", pattern: /省エネルギー/ },
    { key: "森林", pattern: /森林/ },
    { key: "農業（中干し延長）", pattern: /中干[しし]/ },
    { key: "農業（バイオ炭）", pattern: /バイオ炭/ },
  ];

  const results: JCreditPrice[] = [];
  // テキストを行に分割
  const lines = text.split(/\n/);

  for (const cat of categories) {
    let found = false;

    for (const line of lines) {
      if (!cat.pattern.test(line)) continue;

      // この行からカンマ付き数値を全て抽出
      // 例: "1001000 4,700 2026/03/06" → ["1001000", "4,700", "2026", "03", "06"]
      // 基準値段は 銘柄コード（7桁数字）の直後にある
      const numbers = line.match(/[\d,]+/g);
      if (!numbers) continue;

      for (let i = 0; i < numbers.length; i++) {
        const raw = numbers[i].replace(/,/g, "");
        const val = parseInt(raw, 10);

        // 銘柄コードは 7桁（例: 1001000）→ その次がカンマ付き価格
        if (raw.length === 7 && val >= 1000000) {
          // 次のカンマ付き数値が基準値段
          if (i + 1 < numbers.length) {
            const priceRaw = numbers[i + 1].replace(/,/g, "");
            const price = parseInt(priceRaw, 10);
            if (price >= 100 && price <= 100000) {
              results.push({ category: cat.key, yakujoPrice: price });
              console.log(`  [JPX] ${cat.key}: ¥${price}/tCO2e（基準値段）`);
              found = true;
              break;
            }
          }
        }
      }

      if (!found) {
        // フォールバック: 行内の最初の妥当な価格値を取得
        const allNums = line.match(/[\d,]+/g) ?? [];
        for (const n of allNums) {
          const val = parseInt(n.replace(/,/g, ""), 10);
          if (val >= 500 && val <= 50000) {
            results.push({ category: cat.key, yakujoPrice: val });
            console.log(`  [JPX] ${cat.key}: ¥${val}/tCO2e（行内最初の妥当値）`);
            found = true;
            break;
          }
        }
      }

      break; // 最初にマッチした行のみ使用
    }

    if (!found) {
      console.log(`  [JPX] ${cat.key}: データなし（売買停止中の可能性）`);
      results.push({ category: cat.key, yakujoPrice: null });
    }
  }

  return results;
}

/** JPX PDF をダウンロードして解析 */
async function fetchJCreditPrices(): Promise<JCreditPrice[]> {
  try {
    const pdfUrl = await findLatestJpxPdfUrl();
    if (!pdfUrl) {
      console.warn("[JPX] PDF URL が取得できません。市場停止の可能性があります。");
      return defaultJCreditPrices();
    }

    console.log(`[JPX] PDF ダウンロード: ${pdfUrl}`);
    const res = await fetch(pdfUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CarbonIntelBot/1.0)" },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`[JPX] PDF ダウンロード失敗: HTTP ${res.status}`);
      return defaultJCreditPrices();
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const text = await extractPdfText(buffer);

    if (!text || text.length < 50) {
      console.warn("[JPX] PDF テキストが短すぎます");
      return defaultJCreditPrices();
    }

    return parseJCreditPdf(text);
  } catch (e) {
    console.error(`[JPX] J-Credit 取得エラー: ${e}`);
    return defaultJCreditPrices();
  }
}

function defaultJCreditPrices(): JCreditPrice[] {
  console.log("[JPX] フォールバック参考価格を使用（市場停止中または取得失敗）");
  return [
    { category: "省エネルギー", yakujoPrice: null },
    { category: "森林", yakujoPrice: null },
    { category: "農業（中干し延長）", yakujoPrice: null },
    { category: "農業（バイオ炭）", yakujoPrice: null },
  ];
}

// ============================================================
// 3. EUA 価格取得（homaio.com）
// ============================================================

async function fetchEuaPrice(): Promise<number | null> {
  console.log("[EUA] 複数ソースから EUA 価格を取得中...");

  // ソース1: homaio.com
  const priceFromHomaio = await tryFetchEuaFromHomaio();
  if (priceFromHomaio) return priceFromHomaio;

  // ソース2: Ember Climate (オープンデータ)
  const priceFromEmber = await tryFetchEuaFromEmber();
  if (priceFromEmber) return priceFromEmber;

  console.warn("[EUA] すべてのソースから価格を取得できませんでした。フォールバック値を使用します。");
  return null;
}

async function tryFetchEuaFromHomaio(): Promise<number | null> {
  try {
    const res = await fetch("https://www.homaio.com/performance", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`  [EUA/homaio] HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // __NEXT_DATA__ 内のデータをチェック（Next.js SPA）
    const nextData = $("script#__NEXT_DATA__").html();
    if (nextData) {
      try {
        const json = JSON.parse(nextData);
        const jsonStr = JSON.stringify(json);
        // price パターンを検索
        const priceMatches = jsonStr.match(/"(?:price|value|currentPrice|euaPrice)":\s*([\d.]+)/g);
        if (priceMatches) {
          for (const m of priceMatches) {
            const val = parseFloat(m.replace(/.*:\s*/, ""));
            if (val > 10 && val < 500) {
              console.log(`  [EUA/homaio] __NEXT_DATA__ から価格: €${val}`);
              return val;
            }
          }
        }
      } catch { /* JSON parse failed */ }
    }

    // bodyText 内の価格パターン
    const bodyText = $("body").text();
    const euroPatterns = [
      /(?:Current\s+EUA\s+Price|EUA\s+Price|Prix\s+EUA)[:\s]*€?\s*([\d,.]+)/i,
      /€\s*([\d,.]+)\s*(?:\/\s*t(?:CO2|CO₂))/i,
      /(\d{2,3}[.,]\d{2})\s*€/,
    ];

    for (const pattern of euroPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        const price = parseFloat(match[1].replace(",", "."));
        if (price > 10 && price < 500) {
          console.log(`  [EUA/homaio] テキストから価格: €${price}`);
          return price;
        }
      }
    }

    console.warn("  [EUA/homaio] 価格抽出失敗");
    return null;
  } catch (e) {
    console.warn(`  [EUA/homaio] エラー: ${e}`);
    return null;
  }
}

async function tryFetchEuaFromEmber(): Promise<number | null> {
  try {
    // Ember Climate の ETS ページ
    const res = await fetch("https://ember-climate.org/data/data-tools/carbon-price-viewer/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    // EU ETS 価格パターンを検索
    const priceMatch = html.match(/EU\s*ETS[^}]*?"price"[:\s]*([\d.]+)/i)
      ?? html.match(/(\d{2,3}\.\d{1,2})\s*(?:EUR|€)/);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      if (price > 10 && price < 500) {
        console.log(`  [EUA/ember] 価格: €${price}`);
        return price;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// 市場停止期間チェック
// ============================================================

function getMarketSuspensionNote(): string | undefined {
  const today = new Date();
  const start = new Date("2026-03-09");
  const end = new Date("2026-03-17");
  if (today >= start && today <= end) {
    return "※現在市場停止中（3/17まで）";
  }
  return undefined;
}

// ============================================================
// 全市場データ収集
// ============================================================

async function collectAllPrices(fx: FxRates): Promise<MarketResult[]> {
  const results: MarketResult[] = [];
  const suspensionNote = getMarketSuspensionNote();

  // ── 1. J-Credit（JPX PDF） ──
  console.log("\n=== J-Credit (JPX PDF) ===");
  const jcreditPrices = await fetchJCreditPrices();

  const jcreditMap: {
    marketId: string;
    title: string;
    creditType: "回避・削減系" | "除去系";
    category: JCreditCategory;
  }[] = [
    { marketId: "jcredit-energy-saving", title: "J-Credit（省エネルギー）", creditType: "回避・削減系", category: "省エネルギー" },
    { marketId: "jcredit-forest", title: "J-Credit（森林）", creditType: "除去系", category: "森林" },
    { marketId: "jcredit-agri-midseason", title: "J-Credit（農業・中干し）", creditType: "回避・削減系", category: "農業（中干し延長）" },
    { marketId: "jcredit-agri-biochar", title: "J-Credit（農業・バイオ炭）", creditType: "除去系", category: "農業（バイオ炭）" },
  ];

  for (const jm of jcreditMap) {
    const found = jcreditPrices.find((p) => p.category === jm.category);
    // 約定値段がない場合はフォールバック参考価格を使用
    const price = found?.yakujoPrice ?? getJCreditFallback(jm.marketId);
    results.push({
      marketId: jm.marketId,
      title: jm.title,
      creditType: jm.creditType,
      sourceCurrency: "JPY",
      price,
      sourceName: "JPX カーボン・クレジット市場",
      sourceUrl: JPX_DAILY_URL,
      note: suspensionNote ?? (found?.yakujoPrice == null ? "※約定なし（参考価格を表示中）" : undefined),
    });
  }

  // ── 2. EU ETS (EUA) ──
  console.log("\n=== EU ETS (EUA) ===");
  const euaPrice = await fetchEuaPrice();
  const euaFallback = 65.0; // フォールバック参考価格

  results.push({
    marketId: "eu-ets",
    title: "EU ETS (EUA)",
    creditType: "回避・削減系",
    sourceCurrency: "EUR",
    price: euaPrice ?? euaFallback,
    sourceName: "Homaio",
    sourceUrl: "https://www.homaio.com/performance",
    note: euaPrice == null ? "※参考価格（取得失敗時のフォールバック）" : undefined,
  });

  // ── 3. ボランタリークレジット（AI集約） ──
  console.log("\n=== ボランタリークレジット (AI 集約) ===");
  if (!GEMINI_KEY) {
    console.warn("[AI] GOOGLE_GENERATIVE_AI_API_KEY が未設定。フォールバック値を使用します。");
  }

  const volPrices = GEMINI_KEY
    ? await extractVoluntaryPrices(GEMINI_KEY)
    : (await import("./ai-enricher.js")).extractVoluntaryPrices("").catch(() => []);

  const volMap: {
    marketId: string;
    title: string;
    name: string;
    fallbackPrice: number;
  }[] = [
    { marketId: "vol-biochar", title: "Biochar（バイオ炭除去）", name: "Biochar", fallbackPrice: 120 },
    { marketId: "vol-nature-removal", title: "Nature-based Removal", name: "Nature-based Removal", fallbackPrice: 25 },
  ];

  for (const vm of volMap) {
    const found = volPrices.find((p) => p.name === vm.name);
    const price = found?.priceUsd ?? vm.fallbackPrice;
    const sourceNames = found?.sources?.join(", ") ?? "AI 集約";

    results.push({
      marketId: vm.marketId,
      title: vm.title,
      creditType: "除去系",
      sourceCurrency: "USD",
      price,
      sourceName: sourceNames,
      sourceUrl: "https://www.senken.io/academy/carbon-credit-price",
      note: found ? undefined : "※参考価格（AI取得失敗時のフォールバック）",
    });
  }

  return results;
}

/** J-Credit のフォールバック参考価格 */
function getJCreditFallback(marketId: string): number {
  switch (marketId) {
    case "jcredit-energy-saving": return 1800;
    case "jcredit-forest": return 10000;
    case "jcredit-agri-midseason": return 5000;
    case "jcredit-agri-biochar": return 12000;
    default: return 3000;
  }
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
  const prev = history[history.length - 1];
  if (prev.priceJpy === 0) {
    return { direction: "stable", percentage: 0 };
  }
  const change = ((currentPriceJpy - prev.priceJpy) / prev.priceJpy) * 100;
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
// WordPress upsert（コンテンツ JSON フォールバック方式維持）
// ============================================================

type WPSearchResult = {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  acf?: Record<string, unknown> | unknown[];
};

function parseContentJson(contentHtml: string): Record<string, unknown> | null {
  const match = contentHtml.match(/<!-- PRICE_DATA_JSON:([\s\S]*?) -->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

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
        p.acf && !Array.isArray(p.acf) && typeof p.acf === "object" && Object.keys(p.acf).length > 0
          ? p.acf
          : null;

      let foundMarketId: string | null = null;
      let existingHistory: PriceHistoryEntry[] = [];

      if (acf && acf.market_id === marketId) {
        foundMarketId = marketId;
        if (typeof acf.price_history === "string" && (acf.price_history as string).trim()) {
          try {
            const parsed = JSON.parse(acf.price_history as string);
            if (Array.isArray(parsed)) existingHistory = parsed;
          } catch { /* pass */ }
        }
      }

      if (!foundMarketId) {
        const contentData = parseContentJson(p.content.rendered);
        if (contentData && contentData.market_id === marketId) {
          foundMarketId = marketId;
          if (typeof contentData.price_history === "string") {
            try {
              const parsed = JSON.parse(contentData.price_history as string);
              if (Array.isArray(parsed)) existingHistory = parsed;
            } catch { /* pass */ }
          } else if (Array.isArray(contentData.price_history)) {
            existingHistory = contentData.price_history as PriceHistoryEntry[];
          }
        }
      }

      if (foundMarketId) {
        return { wpId: p.id, existingHistory };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** 旧市場 ID のレコードを削除 */
async function deleteOldRecords(): Promise<void> {
  const oldMarketIds = ["jcredit-renewable", "vcs-geo", "vcs-ngeo"];
  console.log(`\n[クリーンアップ] 旧市場レコードを検索...`);

  try {
    const url = `${API_BASE}/price_trends?per_page=100`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const posts: WPSearchResult[] = await res.json();

    for (const p of posts) {
      const contentData = parseContentJson(p.content.rendered);
      const mid = contentData?.market_id;

      if (typeof mid === "string" && oldMarketIds.includes(mid)) {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] ID ${p.id} (${mid}) を削除予定`);
          continue;
        }
        console.log(`  [削除] ID ${p.id} (${mid})`);
        await fetch(`${API_BASE}/price_trends/${p.id}?force=true`, {
          method: "DELETE",
          headers: { Authorization: getAuthHeader() },
        });
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } catch (e) {
    console.warn(`[クリーンアップ] エラー: ${e}`);
  }
}

function buildContent(title: string, priceData: Record<string, unknown>): string {
  const jsonStr = JSON.stringify(priceData);
  return `<!-- PRICE_DATA_JSON:${jsonStr} -->\n<p>${title}の価格データ</p>`;
}

async function upsertPriceTrend(
  market: MarketResult,
  priceJpy: number,
  fxRate: number,
  history: PriceHistoryEntry[],
  trend: { direction: string; percentage: number },
  now: string
): Promise<void> {
  const acfData: Record<string, unknown> = {
    market_id: market.marketId,
    credit_type: market.creditType,
    source_currency: market.sourceCurrency,
    latest_price: market.price,
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
  if (market.note) {
    acfData.note = market.note;
  }

  const contentData = { ...acfData, price_history: history };
  const content = buildContent(market.title, contentData);
  const existing = await findExistingPriceTrend(market.marketId);

  if (existing) {
    console.log(`  [更新] ${market.title} (ID ${existing.wpId})`);
    if (DRY_RUN) {
      console.log("    → DRY RUN: スキップ");
      return;
    }
    const res = await fetch(`${API_BASE}/price_trends/${existing.wpId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: getAuthHeader() },
      body: JSON.stringify({ title: market.title, content, acf: acfData }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`更新失敗 ${market.title}: ${res.status} ${text.slice(0, 300)}`);
    }
  } else {
    console.log(`  [新規] ${market.title}`);
    if (DRY_RUN) {
      console.log("    → DRY RUN: スキップ");
      return;
    }
    const res = await fetch(`${API_BASE}/price_trends`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: getAuthHeader() },
      body: JSON.stringify({ title: market.title, content, status: "publish", acf: acfData }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`作成失敗 ${market.title}: ${res.status} ${text.slice(0, 300)}`);
    }
    const created = (await res.json()) as { id: number };
    console.log(`    → ID ${created.id} で作成完了`);
  }
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log("=== カーボンクレジット価格同期スクリプト（v2） ===");
  console.log(`API: ${API_BASE}`);
  console.log(`Gemini API Key: ${GEMINI_KEY ? "設定済み" : "未設定"}`);
  if (DRY_RUN) console.log("⚠️  DRY RUN モード（WordPress 書き込みなし）");
  console.log("");

  // 0. 旧市場レコードを削除
  await deleteOldRecords();

  // 1. FX レート取得
  const fx = await fetchFxRates();

  // 2. 全市場の価格を収集
  const markets = await collectAllPrices(fx);

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  let created = 0;
  let updated = 0;
  let errors = 0;

  // 3. 各市場を WordPress に同期
  console.log("\n=== WordPress 同期 ===");
  for (const market of markets) {
    try {
      console.log(`\n[${market.marketId}] ${market.title}`);

      const { priceJpy, fxRate } = convertToJpy(market.price, market.sourceCurrency, fx);
      console.log(`  価格: ${market.price} ${market.sourceCurrency} → ¥${priceJpy} (FX: ${fxRate})`);
      if (market.note) console.log(`  注記: ${market.note}`);

      const existing = await findExistingPriceTrend(market.marketId);
      const existingHistory = existing?.existingHistory ?? [];

      const filteredHistory = existingHistory.filter((e) => e.date !== today);
      const newEntry: PriceHistoryEntry = { date: today, price: market.price, priceJpy };
      const updatedHistory = [...filteredHistory, newEntry];

      const trend = calculateTrend(filteredHistory, priceJpy);
      console.log(`  トレンド: ${trend.direction} (${trend.percentage > 0 ? "+" : ""}${trend.percentage}%)`);

      await upsertPriceTrend(market, priceJpy, fxRate, updatedHistory, trend, now);

      if (existing) updated++;
      else created++;
    } catch (e) {
      console.error(`  [エラー] ${market.title}: ${e}`);
      errors++;
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n=== 完了 ===`);
  console.log(`対象市場: ${markets.length}, 新規: ${created}, 更新: ${updated}, エラー: ${errors}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
