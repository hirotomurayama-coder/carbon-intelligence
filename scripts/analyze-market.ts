/**
 * マーケット分析スクリプト — AI によるカーボンクレジット市場の背景分析を生成。
 *
 * 処理:
 *   1. 各市場の直近1ヶ月のニュースを Google 検索で収集
 *   2. 収集した情報を Gemini に渡して分析テキストを生成
 *   3. 結果を WordPress price_trends CPT の market_analysis フィールドに保存
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD GOOGLE_GENERATIVE_AI_API_KEY && npm run analyze-market
 *
 * オプション:
 *   --dry-run    WordPress 書き込みなし
 *   --market=ID  特定の市場のみ分析（例: --market=eu-ets）
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "").replace(/\/+$/, "");
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
const DRY_RUN = process.argv.includes("--dry-run");
const MARKET_FILTER = process.argv.find((a) => a.startsWith("--market="))?.split("=")[1] ?? null;

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error("環境変数が未設定です: NEXT_PUBLIC_WORDPRESS_API_URL, WP_APP_USER, WP_APP_PASSWORD");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("環境変数が未設定です: GOOGLE_GENERATIVE_AI_API_KEY");
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

// ============================================================
// 型定義
// ============================================================

type MarketDef = {
  id: string;
  name: string;
  searchQueries: string[];
  context: string;
};

type WPPost = {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  acf?: Record<string, unknown> | unknown[];
};

type AnalysisResult = {
  summary: string;
  factors: string[];
  monthly_range_low: number | null;
  monthly_range_high: number | null;
  outlook: string;
  analysis_sources: string[];
  analyzed_at: string;
};

// ============================================================
// 市場定義
// ============================================================

const MARKETS: MarketDef[] = [
  // ── コンプライアンス市場 ──
  {
    id: "jcredit-energy-saving",
    name: "J-Credit（省エネルギー）",
    searchQueries: [
      "J-クレジット 省エネ 価格 2026",
      "J-Credit energy saving price JPX",
      "Jクレジット市場 最新動向",
    ],
    context: "JPX カーボン・クレジット市場で取引される省エネルギー由来の J-クレジット。日本国内の排出量取引制度（GX-ETS）の動向に影響を受ける。",
  },
  {
    id: "jcredit-forest",
    name: "J-Credit（森林）",
    searchQueries: [
      "J-クレジット 森林 価格 2026",
      "J-Credit forest carbon price",
      "森林クレジット 市場動向",
    ],
    context: "森林管理由来の J-クレジット。間伐等による CO2 吸収量を認証。自然ベースの除去クレジットとして需要が拡大中。",
  },
  {
    id: "jcredit-agri-midseason",
    name: "J-Credit（農業・中干し）",
    searchQueries: [
      "J-クレジット 水稲 中干し延長 価格",
      "農業 カーボンクレジット 日本",
      "J-Credit agriculture methane reduction",
    ],
    context: "水稲栽培の中干し延長によるメタン排出削減の J-クレジット。農業分野の脱炭素として注目。",
  },
  {
    id: "jcredit-agri-biochar",
    name: "J-Credit（農業・バイオ炭）",
    searchQueries: [
      "J-クレジット バイオ炭 農業 価格",
      "biochar J-Credit Japan",
      "バイオ炭 炭素固定 カーボンクレジット",
    ],
    context: "バイオ炭の農地施用による炭素固定 J-クレジット。高い永続性と農業改善の副次的効果で需要増。",
  },
  {
    id: "eu-ets",
    name: "EU ETS (EUA)",
    searchQueries: [
      "EU ETS EUA price 2026",
      "EU emissions trading carbon price",
      "EU ETS 価格 最新",
    ],
    context: "EU 域内排出量取引制度の排出枠（EUA）。世界最大の炭素市場。マクロ経済、エネルギー価格、EU 気候政策に大きく影響される。",
  },
  // ── ボランタリー：炭素除去（Removal） ──
  {
    id: "vol-biochar",
    name: "Biochar（バイオ炭除去）",
    searchQueries: [
      "biochar carbon credit price 2026",
      "biochar CDR voluntary carbon market",
      "バイオ炭 除去クレジット 価格",
    ],
    context: "技術ベース炭素除去（CDR）のバイオ炭クレジット。Puro.earth 等で取引。高い永続性（100年以上）が特徴。",
  },
  {
    id: "vol-dac",
    name: "DAC（Direct Air Capture）",
    searchQueries: [
      "direct air capture carbon credit price 2026",
      "DAC CDR carbon removal market Climeworks",
      "DAC 直接空気回収 カーボンクレジット 価格",
    ],
    context: "大気中のCO2を直接回収するDAC技術による除去クレジット。Climeworks、Carbon Engineering等が主要プレイヤー。最も高価だが永続性が最高（1000年以上）。$400-1200/tCO2e の価格帯。",
  },
  {
    id: "vol-erw",
    name: "ERW（Enhanced Rock Weathering）",
    searchQueries: [
      "enhanced rock weathering carbon credit price 2026",
      "ERW carbon removal credit Isometric Puro",
      "風化促進 岩石風化 カーボンクレジット",
    ],
    context: "玄武岩等の岩石粉砕物を農地に散布し、風化反応でCO2を固定する技術。UNDO、Lithos等が展開。Puro.earth、Isometric等で認証。新興CDR技術として注目。",
  },
  {
    id: "vol-blue-carbon",
    name: "Blue Carbon（マングローブ・海草）",
    searchQueries: [
      "blue carbon credit mangrove price 2026",
      "blue carbon seagrass wetland credit market",
      "ブルーカーボン マングローブ カーボンクレジット 価格",
    ],
    context: "マングローブ・海草藻場・塩性湿地等の沿岸生態系による炭素吸収・固定クレジット。Verra VCS、Plan Vivo等で認証。生物多様性の共便益が高い。",
  },
  {
    id: "vol-soil-carbon",
    name: "Soil Carbon（土壌炭素貯留）",
    searchQueries: [
      "soil carbon credit price 2026 regenerative agriculture",
      "soil carbon sequestration voluntary market",
      "土壌炭素 再生型農業 カーボンクレジット",
    ],
    context: "再生型農業（不耕起栽培、被覆作物等）による土壌への炭素貯留クレジット。Verra、Gold Standard等で認証。永続性の課題から価格は比較的低い。",
  },
  // ── ボランタリー：回避・削減（Avoidance） ──
  {
    id: "vol-redd-plus",
    name: "REDD+（森林減少回避）",
    searchQueries: [
      "REDD+ carbon credit price 2026 voluntary market",
      "REDD avoided deforestation credit Verra",
      "REDD+ 森林減少回避 カーボンクレジット 価格",
    ],
    context: "途上国の森林減少・劣化を防止することで排出を回避するREDD+クレジット。Verra VCSが最大の発行プラットフォーム。近年は品質議論（過大なベースライン問題）で価格が低迷。",
  },
  {
    id: "vol-cookstoves",
    name: "Clean Cookstoves（改良かまど）",
    searchQueries: [
      "clean cookstoves carbon credit price 2026",
      "improved cookstove carbon credit Gold Standard",
      "改良かまど クリーンクックストーブ カーボンクレジット",
    ],
    context: "途上国で効率的な調理用ストーブを普及させ、薪・炭の使用量を削減するプロジェクト。Gold Standard認証が主流。SDGs共便益（健康改善、女性の負担軽減）が高い。",
  },
  {
    id: "vol-methane",
    name: "Methane Capture（メタン回収）",
    searchQueries: [
      "methane capture carbon credit price 2026",
      "landfill gas methane avoidance credit voluntary",
      "メタン回収 埋立地ガス カーボンクレジット 価格",
    ],
    context: "埋立地ガス・農業排水・炭鉱等からのメタン排出を回収・利用するプロジェクト。メタンのGWP（温暖化係数）が高いためCO2e換算で大量のクレジットを発行可能。",
  },
  // ── レガシー ──
  {
    id: "vol-nature-removal",
    name: "Nature-based Removal",
    searchQueries: [
      "nature based carbon removal credit price",
      "afforestation reforestation carbon credit voluntary",
      "自然ベース 除去クレジット 価格 ボランタリー",
    ],
    context: "森林再生・土壌炭素固定等の自然ベース除去クレジット。Verra, Gold Standard 等で認証。",
  },
];

// ============================================================
// ニュース収集（Web スクレイピング）
// ============================================================

/**
 * Google 検索結果からニューステキストを収集する。
 * 直接 Google を叩くとブロックされるため、複数の代替手段を試す。
 */
async function searchNews(query: string): Promise<string[]> {
  const results: string[] = [];

  // DuckDuckGo HTML Lite (ブロックされにくい)
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encoded}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CarbonIntelBot/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      // 検索結果のスニペットを取得
      $(".result-snippet, .result__snippet, td.result-snippet").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 30) results.push(text);
      });
      // リンクテキストも取得
      $("a.result-link, a.result__a").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 10) results.push(text);
      });
    }
  } catch (e) {
    console.warn(`  [検索] DuckDuckGo 失敗: ${e}`);
  }

  return results.slice(0, 10);
}

/**
 * 特定のニュースサイトからテキストを直接収集する。
 */
async function fetchDirectSource(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CarbonIntelBot/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return "";

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, iframe, noscript, aside").remove();
    return $("body").text().replace(/\s+/g, " ").trim().slice(0, 4000);
  } catch {
    return "";
  }
}

/**
 * 各市場について検索+直接ソースからニュース情報を収集。
 */
async function collectMarketNews(market: MarketDef): Promise<string> {
  console.log(`\n[${market.id}] ニュース収集中...`);
  const allTexts: string[] = [];

  // 検索クエリから情報収集
  for (const query of market.searchQueries) {
    console.log(`  検索: "${query}"`);
    const snippets = await searchNews(query);
    allTexts.push(...snippets);
    await new Promise((r) => setTimeout(r, 2000)); // レート制限
  }

  // 直接ソースから追加情報
  const directSources: Record<string, string[]> = {
    "eu-ets": [
      "https://carbonherald.com/category/eu-ets/",
    ],
    "jcredit-energy-saving": [
      "https://carbon-markets.env.go.jp/",
    ],
    "vol-dac": [
      "https://carbonherald.com/category/direct-air-capture/",
    ],
    "vol-redd-plus": [
      "https://carbonherald.com/category/redd/",
    ],
    "vol-biochar": [
      "https://carbonherald.com/category/biochar/",
    ],
    "vol-blue-carbon": [
      "https://carbonherald.com/category/blue-carbon/",
    ],
  };

  const sources = directSources[market.id] ?? [];
  for (const url of sources) {
    console.log(`  直接: ${url}`);
    const text = await fetchDirectSource(url);
    if (text.length > 100) {
      allTexts.push(text);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  const combined = allTexts.join("\n\n").slice(0, 12000);
  console.log(`  収集: ${allTexts.length} 件, ${combined.length} 文字`);
  return combined;
}

// ============================================================
// Gemini AI 分析
// ============================================================

async function analyzeWithGemini(
  market: MarketDef,
  newsText: string,
  currentPriceJpy: number | null,
): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const prompt = `あなたはカーボンクレジット市場の専門アナリストです。
以下の市場について、収集したニュース情報に基づき分析を行ってください。

## 対象市場
- 市場名: ${market.name}
- 市場ID: ${market.id}
- 概要: ${market.context}
- 現在価格: ${currentPriceJpy ? `¥${currentPriceJpy}/tCO2e` : "不明"}
- 分析期間: ${oneMonthAgo} 〜 ${today}

## 収集されたニュース・情報
${newsText || "（情報が収集できませんでした。一般的な市場知識に基づいて分析してください。）"}

## 出力形式（JSON のみ、他のテキストは不要）
\`\`\`json
{
  "summary": "1〜2文の簡潔な市場サマリー（日本語）",
  "factors": [
    "価格変動の要因1（マクロ経済、規制動向、需給等）",
    "要因2",
    "要因3"
  ],
  "monthly_range_low": <数値|null>,
  "monthly_range_high": <数値|null>,
  "outlook": "今後1〜3ヶ月の短期見通し（日本語、2〜3文）"
}
\`\`\`

注意:
- monthly_range_low/high は JPY/tCO2e の数値（過去1ヶ月の実績レンジ）
- 確実なデータがない場合は null にする
- 推測は避け、収集した情報に基づく事実ベースの分析を行う
- factors は最低2つ、最大5つ
- 日本語で回答すること
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON 抽出失敗");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary?: string;
      factors?: string[];
      monthly_range_low?: number | null;
      monthly_range_high?: number | null;
      outlook?: string;
    };

    return {
      summary: parsed.summary ?? "分析データを生成できませんでした。",
      factors: Array.isArray(parsed.factors) ? parsed.factors.slice(0, 5) : [],
      monthly_range_low: parsed.monthly_range_low ?? null,
      monthly_range_high: parsed.monthly_range_high ?? null,
      outlook: parsed.outlook ?? null,
      analysis_sources: market.searchQueries.map((q) => `検索: "${q}"`),
      analyzed_at: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`  [AI] Gemini 分析エラー: ${e}`);
    return {
      summary: `${market.name}の分析を生成できませんでした。次回の更新で再試行します。`,
      factors: [],
      monthly_range_low: null,
      monthly_range_high: null,
      outlook: null,
      analysis_sources: [],
      analyzed_at: new Date().toISOString(),
    };
  }
}

// ============================================================
// WordPress 更新
// ============================================================

function parseContentJson(html: string): Record<string, unknown> | null {
  const match = html.match(/<!-- PRICE_DATA_JSON:([\s\S]*?) -->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function findPriceTrendPost(marketId: string): Promise<{ wpId: number; source: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`${API_BASE}/price_trends?per_page=100`, { cache: "no-store" });
    if (!res.ok) return null;
    const posts: WPPost[] = await res.json();

    for (const p of posts) {
      const acf = p.acf && !Array.isArray(p.acf) && typeof p.acf === "object" && Object.keys(p.acf).length > 0
        ? p.acf
        : null;

      if (acf && acf.market_id === marketId) {
        return { wpId: p.id, source: acf };
      }

      const contentData = parseContentJson(p.content.rendered);
      if (contentData && contentData.market_id === marketId) {
        return { wpId: p.id, source: contentData };
      }
    }
    return null;
  } catch (e) {
    console.error(`  [findPriceTrendPost] エラー: ${e}`);
    return null;
  }
}

async function updateMarketAnalysis(
  wpId: number,
  title: string,
  existingSource: Record<string, unknown>,
  analysis: AnalysisResult,
): Promise<void> {
  const updatedAcf = {
    ...existingSource,
    market_analysis: JSON.stringify(analysis),
  };

  const contentData = { ...updatedAcf, market_analysis: analysis };
  const content = `<!-- PRICE_DATA_JSON:${JSON.stringify(contentData)} -->\n<p>${title}の価格データ</p>`;

  const res = await fetch(`${API_BASE}/price_trends/${wpId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ content, acf: updatedAcf }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WordPress 更新失敗: ${res.status} ${text.slice(0, 200)}`);
  }
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log("=== マーケット分析スクリプト ===");
  console.log(`API: ${API_BASE}`);
  console.log(`Gemini: ${GEMINI_KEY ? "設定済み" : "未設定"}`);
  if (DRY_RUN) console.log("DRY RUN モード");
  if (MARKET_FILTER) console.log(`対象市場: ${MARKET_FILTER}`);
  console.log("");

  const markets = MARKET_FILTER
    ? MARKETS.filter((m) => m.id === MARKET_FILTER)
    : MARKETS;

  if (markets.length === 0) {
    console.error(`市場 "${MARKET_FILTER}" が見つかりません`);
    process.exit(1);
  }

  let success = 0;
  let errors = 0;

  for (const market of markets) {
    try {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`[${market.id}] ${market.name}`);
      console.log("=".repeat(60));

      // 1. WordPress からレコードを取得
      const post = await findPriceTrendPost(market.id);
      if (!post) {
        console.warn(`  WordPress レコードが見つかりません。スキップします。`);
        continue;
      }

      const currentPriceJpy = Number(post.source.latest_price_jpy) || null;
      console.log(`  WordPress ID: ${post.wpId}, 現在価格: ${currentPriceJpy ? `¥${currentPriceJpy}` : "不明"}`);

      // 2. ニュース収集
      const newsText = await collectMarketNews(market);

      // 3. AI 分析
      console.log(`\n  [AI] Gemini 分析中...`);
      const analysis = await analyzeWithGemini(market, newsText, currentPriceJpy);
      console.log(`  サマリー: ${analysis.summary}`);
      console.log(`  要因: ${analysis.factors.length} 件`);
      console.log(`  レンジ: ${analysis.monthly_range_low ?? "?"} 〜 ${analysis.monthly_range_high ?? "?"}`);

      // 4. WordPress 更新
      if (DRY_RUN) {
        console.log(`\n  [DRY RUN] WordPress 更新をスキップ`);
      } else {
        console.log(`\n  WordPress 更新中...`);
        await updateMarketAnalysis(post.wpId, market.name, post.source, analysis);
        console.log(`  更新完了`);
      }

      success++;

      // レート制限（Gemini + Web）
      await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      console.error(`\n  [エラー] ${market.name}: ${e}`);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`=== 完了 ===`);
  console.log(`成功: ${success}, エラー: ${errors}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
