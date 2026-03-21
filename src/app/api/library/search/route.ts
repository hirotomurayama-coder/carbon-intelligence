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

  // ── スコアリング: 全戦略のスコアを加算 ──
  // 同一ファイルが複数戦略でヒット → スコア加算（関連性が高い）
  const scoreMap = new Map<string, { file: DriveFile; score: number; matches: Set<string> }>();

  function addScore(file: DriveFile, points: number, matchType: string) {
    if (file.mimeType === "application/vnd.google-apps.folder") return;
    const existing = scoreMap.get(file.id);
    if (existing) {
      existing.score += points;
      existing.matches.add(matchType);
    } else {
      scoreMap.set(file.id, { file, score: points, matches: new Set([matchType]) });
    }
  }

  // 戦略A: フォルダ名マッチ（+50点）
  for (const f of folderResults) {
    addScore(f, 50, "folder");
  }

  // 戦略B: fullText検索（Google の関連度順、上位ほど高スコア）
  for (let i = 0; i < fullTextResults.length; i++) {
    addScore(fullTextResults[i], 40 - i, "fulltext");
  }

  // 戦略C: ファイル名キーワードマッチ（キーワード数×15点）
  for (const f of allFiles) {
    if (f.mimeType === "application/vnd.google-apps.folder") continue;
    const name = f.name.toLowerCase();
    let kwHits = 0;
    for (const kw of expandedKeywords) {
      if (name.includes(kw.toLowerCase())) kwHits++;
    }
    if (kwHits > 0) {
      addScore(f, kwHits * 15, "filename");
    }
  }

  // 最終マッチタイプを決定（最もスコアが高い戦略）
  const results: RecommendedFile[] = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(({ file, score, matches }) => ({
      ...file,
      matchType: matches.has("folder")
        ? "folder"
        : matches.has("fulltext")
          ? "fulltext"
          : "filename",
      relevanceScore: score,
    }));

  console.log(`[Search] 結果: ${results.length}件 (フォルダ: ${folderResults.length}, 全文: ${fullTextResults.length}, 合計候補: ${scoreMap.size})`);

  return NextResponse.json({ results });
}
