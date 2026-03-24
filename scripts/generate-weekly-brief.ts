/**
 * 週次マーケットブリーフ自動生成スクリプト。
 *
 * 処理:
 *   1. WordPress から全14市場の PriceTrend データを取得
 *   2. 週次の価格変動を計算
 *   3. Gemini AI で「今週のハイライト」「注目ポイント」を生成
 *   4. WordPress insights CPT に「週次ブリーフ」として投稿
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD GOOGLE_GENERATIVE_AI_API_KEY && npm run generate-weekly-brief
 *
 * オプション:
 *   --dry-run    WordPress 書き込みなし
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "").replace(/\/+$/, "");
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error("環境変数が未設定: NEXT_PUBLIC_WORDPRESS_API_URL, WP_APP_USER, WP_APP_PASSWORD");
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

// ============================================================
// 型定義
// ============================================================

type PriceTrendData = {
  marketId: string;
  title: string;
  latestPriceJpy: number | null;
  trendDirection: string | null;
  trendPercentage: number | null;
  sourceCurrency: string | null;
  latestPrice: number | null;
  lastSynced: string | null;
};

type ContentJson = {
  market_id?: string;
  latest_price_jpy?: number;
  trend_direction?: string;
  trend_percentage?: number;
  source_currency?: string;
  latest_price?: number;
  last_synced?: string;
};

// ============================================================
// データ取得
// ============================================================

async function fetchPriceTrends(): Promise<PriceTrendData[]> {
  const results: PriceTrendData[] = [];

  const res = await fetch(`${API_BASE}/price_trends?per_page=100`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    console.error(`price_trends 取得失敗: ${res.status}`);
    return [];
  }

  type WPPost = {
    id: number;
    title: { rendered: string };
    content: { rendered: string };
    acf?: Record<string, unknown> | unknown[];
  };

  const posts: WPPost[] = await res.json();

  for (const post of posts) {
    const title = post.title.rendered.replace(/<[^>]*>/g, "").trim();

    // Content JSON からデータを取得
    const match = post.content.rendered.match(/<!-- PRICE_DATA_JSON:([\s\S]*?) -->/);
    if (!match) continue;

    try {
      const data = JSON.parse(match[1]) as ContentJson;
      results.push({
        marketId: data.market_id ?? "",
        title,
        latestPriceJpy: Number(data.latest_price_jpy) || null,
        trendDirection: data.trend_direction ?? null,
        trendPercentage: Number(data.trend_percentage) || null,
        sourceCurrency: data.source_currency ?? null,
        latestPrice: Number(data.latest_price) || null,
        lastSynced: data.last_synced ?? null,
      });
    } catch {
      // pass
    }
  }

  return results;
}

// ============================================================
// ブリーフ生成
// ============================================================

function buildBriefWithoutAI(trends: PriceTrendData[]): string {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);
  const dateRange = `${weekStart.toISOString().slice(0, 10)} 〜 ${today.toISOString().slice(0, 10)}`;

  // 価格変動TOP3
  const movers = [...trends]
    .filter((t) => t.trendPercentage !== null)
    .sort((a, b) => Math.abs(b.trendPercentage!) - Math.abs(a.trendPercentage!))
    .slice(0, 5);

  let html = `<h2>期間: ${dateRange}</h2>\n`;
  html += `<h3>価格変動ハイライト</h3>\n<ul>\n`;

  for (const m of movers) {
    const dir = m.trendDirection === "up" ? "↑" : m.trendDirection === "down" ? "↓" : "→";
    const pct = m.trendPercentage ? `${m.trendPercentage > 0 ? "+" : ""}${m.trendPercentage.toFixed(1)}%` : "0%";
    const price = m.latestPriceJpy ? `¥${Math.round(m.latestPriceJpy).toLocaleString()}` : "—";
    html += `<li><strong>${m.title}</strong>: ${price}/tCO2e (${dir} ${pct})</li>\n`;
  }

  html += `</ul>\n`;

  // 市場概況テーブル
  html += `<h3>全市場サマリー</h3>\n`;
  html += `<table><thead><tr><th>市場</th><th>価格 (JPY)</th><th>変動</th></tr></thead><tbody>\n`;

  for (const t of trends) {
    const price = t.latestPriceJpy ? `¥${Math.round(t.latestPriceJpy).toLocaleString()}` : "—";
    const pct = t.trendPercentage ? `${t.trendPercentage > 0 ? "+" : ""}${t.trendPercentage.toFixed(1)}%` : "—";
    html += `<tr><td>${t.title}</td><td>${price}</td><td>${pct}</td></tr>\n`;
  }

  html += `</tbody></table>\n`;

  return html;
}

async function generateBriefWithAI(trends: PriceTrendData[]): Promise<string> {
  if (!GEMINI_KEY) {
    console.warn("[AI] Gemini APIキー未設定。テンプレートのみで生成します。");
    return buildBriefWithoutAI(trends);
  }

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const today = new Date().toISOString().slice(0, 10);
  const marketSummary = trends
    .map((t) => {
      const price = t.latestPriceJpy ? `¥${Math.round(t.latestPriceJpy)}` : "不明";
      const pct = t.trendPercentage ? `${t.trendPercentage > 0 ? "+" : ""}${t.trendPercentage.toFixed(1)}%` : "0%";
      return `- ${t.title}: ${price}/tCO2e (${pct})`;
    })
    .join("\n");

  const prompt = `あなたはカーボンクレジット市場の週次レポートを作成する専門アナリストです。

以下の市場データに基づき、日本語で週次マーケットブリーフを作成してください。

## 市場データ（${today}時点）
${marketSummary}

## 出力形式（HTML）
以下の構成で HTML を出力してください:
1. <h2>今週のハイライト</h2> — 3〜4文の概要
2. <h3>注目の動き</h3> — 価格変動が大きい市場の分析（箇条書き、3項目）
3. <h3>市場トレンド</h3> — コンプライアンス市場とボランタリー市場の全体的な傾向
4. <h3>来週の注目ポイント</h3> — 2〜3項目

注意:
- 日本語で記述
- 推測ではなくデータに基づく分析
- HTMLタグのみ（Markdown不可）
- 全体で500〜800文字
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // HTML部分を抽出
    const htmlContent = text.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();

    // テーブル付きの完全版を構築
    return htmlContent + "\n\n" + buildBriefWithoutAI(trends);
  } catch (e) {
    console.error(`[AI] Gemini エラー: ${e}`);
    return buildBriefWithoutAI(trends);
  }
}

// ============================================================
// WordPress 投稿
// ============================================================

async function publishBrief(title: string, content: string): Promise<void> {
  const acfData: Record<string, unknown> = {
    insight_category: "週次ブリーフ",
  };

  const res = await fetch(`${API_BASE}/insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({
      title,
      content,
      // 下書きとして投稿 → WordPress管理画面でレビュー後に公開
      status: "draft",
      acf: acfData,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WordPress 投稿失敗: ${res.status} ${text.slice(0, 200)}`);
  }

  const created = (await res.json()) as { id: number; link: string };
  console.log(`✓ 下書き投稿完了: ID ${created.id}`);
  console.log(`  レビューURL: https://carboncreditsjp.wpcomstaging.com/wp-admin/post.php?post=${created.id}&action=edit`);
  console.log(`  → WordPress管理画面で内容を確認し「公開」に変更してください`);
}

// ============================================================
// メイン
// ============================================================

async function main() {
  console.log("=== 週次マーケットブリーフ生成 ===");
  console.log(`API: ${API_BASE}`);
  console.log(`Gemini: ${GEMINI_KEY ? "設定済み" : "未設定"}`);
  if (DRY_RUN) console.log("DRY RUN モード");
  console.log("");

  // 1. 価格データ取得
  const trends = await fetchPriceTrends();
  console.log(`市場データ: ${trends.length} 件`);

  if (trends.length === 0) {
    console.error("価格データがありません。先に npm run sync-prices を実行してください。");
    process.exit(1);
  }

  // 2. ブリーフ生成
  console.log("\nブリーフ生成中...");
  const content = await generateBriefWithAI(trends);

  // 3. タイトル生成
  const today = new Date();
  const weekNum = Math.ceil(
    ((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  );
  const title = `週次マーケットブリーフ ${today.getFullYear()}年 第${weekNum}週`;

  console.log(`\nタイトル: ${title}`);
  console.log(`コンテンツ長: ${content.length} 文字`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] WordPress 投稿をスキップ");
    console.log("\n--- プレビュー ---");
    console.log(content.slice(0, 500));
    return;
  }

  // 4. WordPress に投稿
  await publishBrief(title, content);
  console.log("\n=== 完了 ===");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
