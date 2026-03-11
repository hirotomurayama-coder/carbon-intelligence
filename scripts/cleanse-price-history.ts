/**
 * price_trends の履歴データをクレンジングするスクリプト。
 *
 * 各市場について「最新の1件」のみを残し、過去の推測データをすべて削除する。
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD && npx tsx scripts/cleanse-price-history.ts
 *
 * --dry-run オプションで書き込みをスキップ:
 *   npx tsx scripts/cleanse-price-history.ts -- --dry-run
 */

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "").replace(/\/+$/, "");
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error("環境変数が未設定です: NEXT_PUBLIC_WORDPRESS_API_URL, WP_APP_USER, WP_APP_PASSWORD");
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

type WPPost = {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  acf?: Record<string, unknown> | unknown[];
};

type PriceEntry = {
  date: string;
  price: number;
  priceJpy: number;
};

function parseContentJson(html: string): Record<string, unknown> | null {
  const match = html.match(/<!-- PRICE_DATA_JSON:([\s\S]*?) -->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function getSourceData(post: WPPost): Record<string, unknown> | null {
  // ACF を優先
  if (
    post.acf &&
    !Array.isArray(post.acf) &&
    typeof post.acf === "object" &&
    Object.keys(post.acf).length > 0
  ) {
    return post.acf;
  }
  // コンテンツ JSON フォールバック
  return parseContentJson(post.content.rendered);
}

function parseHistory(source: Record<string, unknown>): PriceEntry[] {
  const raw = source.price_history;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as PriceEntry[];
    } catch { /* pass */ }
  }
  if (Array.isArray(raw)) return raw as PriceEntry[];
  return [];
}

function buildContent(title: string, data: Record<string, unknown>): string {
  const jsonStr = JSON.stringify(data);
  return `<!-- PRICE_DATA_JSON:${jsonStr} -->\n<p>${title}の価格データ</p>`;
}

async function main() {
  console.log("=== price_trends 履歴データクレンジング ===");
  console.log(`API: ${API_BASE}`);
  if (DRY_RUN) console.log("⚠️  DRY RUN モード");
  console.log("");

  // 1. 全 price_trends を取得
  const res = await fetch(`${API_BASE}/price_trends?per_page=100`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`price_trends 取得失敗: HTTP ${res.status}`);
    process.exit(1);
  }
  const posts: WPPost[] = await res.json();
  console.log(`取得: ${posts.length} 件\n`);

  let cleaned = 0;
  let skipped = 0;

  for (const post of posts) {
    const title = post.title.rendered.replace(/<[^>]*>/g, "");
    const source = getSourceData(post);

    if (!source) {
      console.log(`[SKIP] ID ${post.id} "${title}": ソースデータなし`);
      skipped++;
      continue;
    }

    const history = parseHistory(source);
    const marketId = source.market_id ?? "(不明)";

    if (history.length <= 1) {
      console.log(`[SKIP] ID ${post.id} "${title}" (${marketId}): 履歴 ${history.length} 件 → クレンジング不要`);
      skipped++;
      continue;
    }

    // 最新1件のみ残す（date でソートして最後の1件）
    const sorted = [...history].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const latest = sorted[sorted.length - 1];

    console.log(`[CLEAN] ID ${post.id} "${title}" (${marketId}): ${history.length} 件 → 1 件に削減`);
    console.log(`  最新エントリ: ${latest.date} ¥${latest.priceJpy}`);

    if (DRY_RUN) {
      console.log("  → DRY RUN: スキップ\n");
      cleaned++;
      continue;
    }

    // 更新データ構築
    const newHistory = [latest];
    const updatedAcf: Record<string, unknown> = {
      ...source,
      price_history: JSON.stringify(newHistory),
    };
    const contentData = { ...updatedAcf, price_history: newHistory };
    const content = buildContent(title, contentData);

    const updateRes = await fetch(`${API_BASE}/price_trends/${post.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({
        title,
        content,
        acf: updatedAcf,
      }),
    });

    if (!updateRes.ok) {
      const text = await updateRes.text().catch(() => "");
      console.error(`  → 更新失敗: HTTP ${updateRes.status} ${text.slice(0, 200)}`);
    } else {
      console.log(`  → 更新完了 ✅\n`);
      cleaned++;
    }

    // レート制限
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n=== クレンジング完了 ===`);
  console.log(`処理: ${cleaned} 件, スキップ: ${skipped} 件`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
