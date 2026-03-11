/**
 * AI ベースのボランタリークレジット価格抽出モジュール。
 *
 * - 複数のソース（Senken, Regreener, Carbon Herald 等）から最新ページを取得
 * - Google Generative AI (Gemini) で価格情報を抽出
 * - 「実行時点から過去1ヶ月以内」のデータのみを対象とする鮮度フィルタ付き
 *
 * 使用 API キー: GOOGLE_GENERATIVE_AI_API_KEY
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";

// ============================================================
// 型定義
// ============================================================

export type VoluntaryPriceResult = {
  /** 市場名 (例: "Biochar", "Nature-based Removal") */
  name: string;
  /** USD 建て価格（中央値 or 平均値） */
  priceUsd: number;
  /** 価格レンジ下限 */
  priceLow: number | null;
  /** 価格レンジ上限 */
  priceHigh: number | null;
  /** 情報源名 */
  sources: string[];
};

// ============================================================
// ソース定義 — 鮮度重視で複数ソースを巡回
// ============================================================

type SourceDef = {
  name: string;
  url: string;
};

/**
 * ソース URL リスト。
 * 各 URL は実行時点で最新の価格情報を含む可能性があるページ。
 */
const SOURCES: SourceDef[] = [
  {
    name: "Senken Academy",
    url: "https://www.senken.io/academy/carbon-credit-price",
  },
  {
    name: "Regreener Blog",
    url: "https://www.regreener.earth/blog/voluntary-carbon-market-update",
  },
  {
    name: "Carbon Herald",
    url: "https://carbonherald.com/category/carbon-credits/",
  },
  {
    name: "Carbon Credits (market prices)",
    url: "https://carboncredits.com/carbon-prices-today/",
  },
];

// ============================================================
// HTML テキスト抽出
// ============================================================

async function fetchPageText(url: string): Promise<string> {
  console.log(`  [AI] ページ取得: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CarbonIntelBot/1.0; +https://intelligence.carboncredits.jp)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`  [AI] ${url}: HTTP ${res.status}`);
      return "";
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 不要要素を除去
    $("script, style, nav, footer, header, iframe, noscript, aside, .ad, .advertisement").remove();

    // テキスト抽出（最初の 6000 文字に制限）
    const text = $("body").text().replace(/\s+/g, " ").trim();
    return text.slice(0, 6000);
  } catch (e) {
    console.warn(`  [AI] ${url} 取得失敗: ${e}`);
    return "";
  }
}

// ============================================================
// 日付ユーティリティ — 鮮度フィルタ
// ============================================================

/** 過去1ヶ月の日付範囲を "YYYY-MM-DD" で返す */
function getOneMonthAgoISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// Gemini による価格抽出（鮮度制約付きプロンプト）
// ============================================================

function buildExtractionPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = getOneMonthAgoISO();

  return `あなたはカーボンクレジット市場の価格アナリストです。
以下のWebページ内容から、ボランタリーカーボンクレジットの **最新** 価格情報を抽出してください。

【重要な制約】
- 今日の日付: ${today}
- 対象期間: ${oneMonthAgo} 〜 ${today}（過去1ヶ月以内のデータのみ）
- 1ヶ月より古い価格データは無視してください
- 日付が不明でも、ページの文脈から最近のデータと判断できる場合は採用してください

特に以下のクレジット種別の USD/tCO2e 価格を探してください:
1. **Biochar**（バイオ炭） — 技術ベース除去クレジット（CDR）
2. **Nature-based Removal**（自然ベース除去） — 森林再生・土壌炭素ベースの除去クレジット

以下の JSON 形式で回答してください（他のテキストは不要）:
\`\`\`json
{
  "biochar": { "low": <数値|null>, "mid": <数値|null>, "high": <数値|null>, "confidence": "<high|medium|low>" },
  "nature_removal": { "low": <数値|null>, "mid": <数値|null>, "high": <数値|null>, "confidence": "<high|medium|low>" }
}
\`\`\`

- 価格が見つからない場合は mid を null にしてください
- confidence は情報の鮮度と信頼性を示します:
  - high: 明確な日付付きの最新データ
  - medium: 最近のデータだが日付が不明確
  - low: 推定値またはやや古い可能性
- 金額は USD/tCO2e で統一

Webページ内容:
---
`;
}

export async function extractVoluntaryPrices(
  apiKey: string
): Promise<VoluntaryPriceResult[]> {
  if (!apiKey) {
    console.warn("  [AI] API キー未設定。フォールバック価格を使用します。");
    return getDefaultPrices();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // 全ソースのテキストを収集
  const pageTexts: { name: string; text: string }[] = [];
  for (const src of SOURCES) {
    const text = await fetchPageText(src.url);
    if (text.length > 100) {
      pageTexts.push({ name: src.name, text });
      console.log(`  [AI] ✓ ${src.name}: ${text.length} 文字取得`);
    } else {
      console.log(`  [AI] ✗ ${src.name}: テキスト不足（${text.length} 文字）`);
    }
    // レート制限対策
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (pageTexts.length === 0) {
    console.warn("  [AI] 有効なソースが取得できませんでした。フォールバック価格を使用します。");
    return getDefaultPrices();
  }

  // 全ソースのテキストを結合して AI に送信
  const combinedText = pageTexts
    .map((p) => `[${p.name}]\n${p.text}`)
    .join("\n\n---\n\n");

  try {
    console.log(`  [AI] Gemini で価格抽出中...（ソース: ${pageTexts.length} 件）`);
    const prompt = buildExtractionPrompt();
    const result = await model.generateContent(prompt + combinedText);
    const responseText = result.response.text();

    // JSON 部分を抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("  [AI] JSON 抽出失敗。フォールバック価格を使用します。");
      return getDefaultPrices();
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      biochar?: { low?: number | null; mid?: number | null; high?: number | null; confidence?: string };
      nature_removal?: { low?: number | null; mid?: number | null; high?: number | null; confidence?: string };
    };

    const results: VoluntaryPriceResult[] = [];
    const srcNames = pageTexts.map((p) => p.name);

    // Biochar
    const bc = parsed.biochar;
    if (bc && bc.mid != null && bc.mid > 0) {
      results.push({
        name: "Biochar",
        priceUsd: bc.mid,
        priceLow: bc.low ?? null,
        priceHigh: bc.high ?? null,
        sources: srcNames,
      });
      console.log(`  [AI] Biochar: $${bc.mid}/tCO2e (confidence: ${bc.confidence ?? "unknown"})`);
    }

    // Nature-based Removal
    const nr = parsed.nature_removal;
    if (nr && nr.mid != null && nr.mid > 0) {
      results.push({
        name: "Nature-based Removal",
        priceUsd: nr.mid,
        priceLow: nr.low ?? null,
        priceHigh: nr.high ?? null,
        sources: srcNames,
      });
      console.log(`  [AI] Nature Removal: $${nr.mid}/tCO2e (confidence: ${nr.confidence ?? "unknown"})`);
    }

    // AI が価格を見つけられなかった場合はフォールバック
    if (results.length === 0) {
      console.warn("  [AI] AI 抽出結果が空です。フォールバック価格を使用します。");
      return getDefaultPrices();
    }

    return results;
  } catch (e) {
    console.error(`  [AI] Gemini API エラー: ${e}`);
    return getDefaultPrices();
  }
}

// ============================================================
// フォールバック参考価格（AI 取得失敗時）
// ============================================================

function getDefaultPrices(): VoluntaryPriceResult[] {
  console.log("  [AI] フォールバック参考価格を使用");
  return [
    {
      name: "Biochar",
      priceUsd: 120,
      priceLow: 80,
      priceHigh: 160,
      sources: ["参考値（AI取得失敗時のフォールバック）"],
    },
    {
      name: "Nature-based Removal",
      priceUsd: 25,
      priceLow: 10,
      priceHigh: 50,
      sources: ["参考値（AI取得失敗時のフォールバック）"],
    },
  ];
}
