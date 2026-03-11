/**
 * AI ベースのボランタリークレジット価格抽出モジュール。
 *
 * - 指定 URL からページ内容を取得
 * - Google Generative AI (Gemini) で価格情報を抽出
 * - 複数ソースの平均値を算出
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
    $("script, style, nav, footer, header, iframe, noscript").remove();

    // テキスト抽出（最初の 8000 文字に制限）
    const text = $("body").text().replace(/\s+/g, " ").trim();
    return text.slice(0, 8000);
  } catch (e) {
    console.warn(`  [AI] ${url} 取得失敗: ${e}`);
    return "";
  }
}

// ============================================================
// Gemini による価格抽出
// ============================================================

const EXTRACTION_PROMPT = `あなたはカーボンクレジット市場の価格アナリストです。
以下のWebページ内容から、ボランタリーカーボンクレジットの価格情報を抽出してください。

特に以下のクレジット種別の USD/tCO2e 価格を探してください:
1. **Biochar**（バイオ炭） — 技術ベース除去クレジット
2. **Nature-based Removal**（自然ベース除去） — 森林・土壌ベースの除去クレジット

以下の JSON 形式で回答してください（他のテキストは不要）:
\`\`\`json
{
  "biochar": { "low": <数値|null>, "mid": <数値|null>, "high": <数値|null> },
  "nature_removal": { "low": <数値|null>, "mid": <数値|null>, "high": <数値|null> }
}
\`\`\`

- 価格が見つからない場合は mid を null にしてください
- 金額は USD/tCO2e で統一
- レンジが見つかった場合は low/high にも入れてください

Webページ内容:
---
`;

export async function extractVoluntaryPrices(
  apiKey: string
): Promise<VoluntaryPriceResult[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // ソース URL リスト
  const sources = [
    {
      name: "Senken Academy",
      url: "https://www.senken.io/academy/carbon-credit-price",
    },
    {
      name: "Regreener",
      url: "https://www.regreener.earth/blog/voluntary-carbon-market-update",
    },
  ];

  // 全ソースのテキストを収集
  const pageTexts: { name: string; text: string }[] = [];
  for (const src of sources) {
    const text = await fetchPageText(src.url);
    if (text.length > 100) {
      pageTexts.push({ name: src.name, text });
    }
    // レート制限対策
    await new Promise((r) => setTimeout(r, 1000));
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
    console.log("  [AI] Gemini で価格抽出中...");
    const result = await model.generateContent(
      EXTRACTION_PROMPT + combinedText
    );
    const responseText = result.response.text();

    // JSON 部分を抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("  [AI] JSON 抽出失敗。フォールバック価格を使用します。");
      return getDefaultPrices();
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      biochar?: { low?: number | null; mid?: number | null; high?: number | null };
      nature_removal?: { low?: number | null; mid?: number | null; high?: number | null };
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
    }

    // AI が価格を見つけられなかった場合はフォールバック
    if (results.length === 0) {
      console.warn("  [AI] AI 抽出結果が空です。フォールバック価格を使用します。");
      return getDefaultPrices();
    }

    for (const r of results) {
      console.log(
        `  [AI] ${r.name}: $${r.priceUsd}/tCO2e (${r.priceLow ?? "?"} - ${r.priceHigh ?? "?"})`
      );
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
