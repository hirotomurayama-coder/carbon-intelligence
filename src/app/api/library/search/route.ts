/**
 * ライブラリ検索 API — キーワードから関連ドキュメントをレコメンド
 *
 * POST /api/library/search
 * Body: { query: string }
 * Response: { results: RecommendedFile[] }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  searchFiles,
  searchByFolderName,
  listFiles,
  type DriveFile,
} from "@/lib/google-drive";

export const maxDuration = 30;

type RecommendedFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string | null;
  webViewLink: string | null;
  matchType: "folder" | "fulltext" | "filename";
  relevanceScore: number;
};

// ── 同義語マップ ──
const SYNONYMS: Record<string, string[]> = {
  gxets: ["GX-ETS", "GXリーグ", "GX排出量取引", "GXETS"],
  "gx-ets": ["GX-ETS", "GXリーグ", "GX排出量取引", "GXETS"],
  gxリーグ: ["GX-ETS", "GXリーグ", "GX排出量取引"],
  jcredit: ["J-クレジット", "Jクレジット", "J-Credit"],
  "j-credit": ["J-クレジット", "Jクレジット", "J-Credit"],
  "j-クレジット": ["J-クレジット", "Jクレジット", "J-Credit"],
  jクレジット: ["J-クレジット", "Jクレジット", "J-Credit"],
  euets: ["EU-ETS", "EU ETS", "EUA"],
  "eu-ets": ["EU-ETS", "EU ETS", "EUA"],
  redd: ["REDD+", "REDD", "森林減少"],
  "redd+": ["REDD+", "REDD", "森林減少"],
  sbti: ["SBTi", "SBT", "Science Based Targets"],
  sbt: ["SBTi", "SBT", "Science Based Targets"],
  vcm: ["VCM", "ボランタリー", "自主的炭素市場"],
  カーボンオフセット: ["カーボン・オフセット", "カーボンオフセット", "オフセット"],
  カーボンニュートラル: ["カーボンニュートラル", "CN", "脱炭素"],
  jcm: ["JCM", "二国間クレジット"],
  tcfd: ["TCFD", "気候関連財務情報開示"],
};

const STOP_WORDS = new Set([
  "の", "に", "は", "を", "で", "が", "と", "も", "から", "まで",
  "より", "ため", "こと", "もの", "する", "ある", "いる", "なる",
  "できる", "れる", "られる", "ない", "です", "ます", "した",
  "について", "として", "における", "に関する", "とは", "って",
  "教えて", "教えてください", "ください", "知りたい", "探して",
  "what", "how", "the", "is", "are", "about",
]);

function extractKeywords(message: string): string[] {
  const cleaned = message
    .replace(/[、。！？「」『』（）\(\)・\s　]+/g, " ")
    .trim();
  return cleaned
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
    .slice(0, 8);
}

function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>();
  for (const kw of keywords) {
    expanded.add(kw);
    const synonyms = SYNONYMS[kw.toLowerCase()];
    if (synonyms) {
      for (const s of synonyms) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

// ── ファイルキャッシュ ──
let cachedFileList: DriveFile[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getAllFiles(): Promise<DriveFile[]> {
  const now = Date.now();
  if (cachedFileList && now - cacheTimestamp < CACHE_TTL) {
    return cachedFileList;
  }
  cachedFileList = await listFiles().catch(() => []);
  cacheTimestamp = now;
  return cachedFileList;
}

export async function POST(request: NextRequest) {
  let query: string;
  try {
    const body = await request.json();
    query = body.query;
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const rawKeywords = extractKeywords(query);
  const expandedKeywords = expandKeywords(rawKeywords);

  console.log(`[Search] クエリ: "${query}" → キーワード: ${expandedKeywords.join(", ")}`);

  // ── 3つの検索戦略を並列実行 ──
  const [folderResults, fullTextResults, allFiles] = await Promise.all([
    searchByFolderName(expandedKeywords).catch(() => [] as DriveFile[]),
    searchFiles(rawKeywords.join(" ")).catch(() => [] as DriveFile[]),
    getAllFiles(),
  ]);

  // ── ファイル名スコアリング ──
  const nameMatches: { file: DriveFile; score: number }[] = [];
  for (const f of allFiles) {
    if (f.mimeType === "application/vnd.google-apps.folder") continue;
    const name = f.name.toLowerCase();
    let score = 0;
    for (const kw of expandedKeywords) {
      if (name.includes(kw.toLowerCase())) score += 10;
    }
    if (score > 0) nameMatches.push({ file: f, score });
  }
  nameMatches.sort((a, b) => b.score - a.score);

  // ── 統合・スコアリング ──
  const resultMap = new Map<string, RecommendedFile>();

  // フォルダ検索（最高スコア）
  for (const f of folderResults) {
    if (!resultMap.has(f.id)) {
      resultMap.set(f.id, {
        ...f,
        matchType: "folder",
        relevanceScore: 100,
      });
    }
  }

  // ファイル名マッチ
  for (const { file, score } of nameMatches.slice(0, 30)) {
    if (!resultMap.has(file.id)) {
      resultMap.set(file.id, {
        ...file,
        matchType: "filename",
        relevanceScore: 50 + score,
      });
    }
  }

  // fullText検索
  for (let i = 0; i < fullTextResults.length; i++) {
    const f = fullTextResults[i];
    if (!resultMap.has(f.id)) {
      resultMap.set(f.id, {
        ...f,
        matchType: "fulltext",
        relevanceScore: 40 - i, // 検索順位で減衰
      });
    }
  }

  const results = Array.from(resultMap.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 30);

  console.log(`[Search] 結果: ${results.length}件 (フォルダ: ${folderResults.length}, 全文: ${fullTextResults.length}, ファイル名: ${nameMatches.length})`);

  return NextResponse.json({ results });
}
