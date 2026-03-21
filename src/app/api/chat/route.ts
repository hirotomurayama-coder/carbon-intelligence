/**
 * チャット API — Google Drive の全ドキュメントを検索し、Claude でストリーミング応答を生成。
 *
 * 検索戦略（3段階）:
 *   1. キーワード展開（同義語・表記ゆれ対応）
 *   2. フォルダ名マッチ（フォルダ名にキーワードを含むフォルダ内のファイルを取得）
 *   3. Google Drive fullText 検索（全ファイルの中身をインデックス検索）
 *   4. ファイル名マッチ（全ファイル名からキーワードマッチ）
 *
 * POST /api/chat
 * Body: { message: string, history: Array<{role, content}> }
 * Response: text/event-stream (SSE)
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  searchFiles,
  searchByFolderName,
  extractFileText,
  listFiles,
  type DriveFile,
} from "@/lib/google-drive";

export const maxDuration = 60;

type ChatRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

// ============================================================
// キーワード抽出 + 同義語展開
// ============================================================

const STOP_WORDS = new Set([
  "の", "に", "は", "を", "で", "が", "と", "も", "から", "まで",
  "より", "ため", "こと", "もの", "する", "ある", "いる", "なる",
  "できる", "れる", "られる", "ない", "です", "ます", "した",
  "について", "として", "における", "に関する", "とは", "って",
  "教えて", "教えて下さい", "教えてください", "ください", "知りたい",
  "what", "how", "the", "is", "are", "about",
]);

/** 略語・表記ゆれの同義語マップ */
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

function extractKeywords(message: string): string[] {
  const cleaned = message
    .replace(/[、。！？「」『』（）\(\)・\s　]+/g, " ")
    .trim();

  const tokens = cleaned
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  return tokens.slice(0, 8);
}

/** キーワードから同義語を含む検索語リストを生成 */
function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>();

  for (const kw of keywords) {
    expanded.add(kw);
    const lower = kw.toLowerCase();
    const synonyms = SYNONYMS[lower];
    if (synonyms) {
      for (const s of synonyms) expanded.add(s);
    }
  }

  return Array.from(expanded);
}

// ============================================================
// ファイル名スコアリング
// ============================================================

function scoreFileByName(file: DriveFile, keywords: string[]): number {
  const name = file.name.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (name.includes(kw.toLowerCase())) {
      score += 10;
    }
  }
  return score;
}

// ============================================================
// 全ファイルキャッシュ
// ============================================================

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

// ============================================================
// POST ハンドラー
// ============================================================

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY が未設定です。Vercel ダッシュボードで環境変数を設定してください。",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "不正なリクエストボディ" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { message, history = [] } = body;
  if (!message || typeof message !== "string") {
    return new Response(
      JSON.stringify({ error: "message は必須です" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 1. キーワード抽出 + 同義語展開 ──
  const rawKeywords = extractKeywords(message);
  const expandedKeywords = expandKeywords(rawKeywords);
  const searchQuery = rawKeywords.join(" ");

  console.log(`[Chat] 質問: "${message}"`);
  console.log(`[Chat] キーワード: ${rawKeywords.join(", ")}`);
  console.log(`[Chat] 展開後: ${expandedKeywords.join(", ")}`);

  // ── 2. 3つの検索戦略を並列実行 ──
  const [folderResults, fullTextResults, allFiles] = await Promise.all([
    // 戦略A: フォルダ名検索（最重要！フォルダ名にキーワードを含む→中のファイルを取得）
    searchByFolderName(expandedKeywords).catch(() => [] as DriveFile[]),
    // 戦略B: Google Drive 全文検索（ファイル本文のインデックス検索）
    searchQuery
      ? searchFiles(searchQuery).catch(() => [] as DriveFile[])
      : ([] as DriveFile[]),
    // 戦略C: 全ファイル一覧
    getAllFiles(),
  ]);

  console.log(
    `[Chat] フォルダ検索: ${folderResults.length}件, 全文検索: ${fullTextResults.length}件, 全ファイル: ${allFiles.length}件`
  );

  // ── 3. ファイル名スコアリング（展開後キーワードで） ──
  const nameScored = allFiles
    .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
    .map((f) => ({ file: f, score: scoreFileByName(f, expandedKeywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // ── 4. 結果を統合・重複排除（フォルダ検索を最優先） ──
  const fileMap = new Map<string, DriveFile>();

  // 優先度1: フォルダ名マッチ（最も関連性が高い）
  for (const f of folderResults) {
    fileMap.set(f.id, f);
  }
  // 優先度2: ファイル名マッチ
  for (const item of nameScored) {
    if (!fileMap.has(item.file.id)) {
      fileMap.set(item.file.id, item.file);
    }
  }
  // 優先度3: 全文検索結果
  for (const f of fullTextResults) {
    if (!fileMap.has(f.id)) {
      fileMap.set(f.id, f);
    }
  }

  const relevantFiles = Array.from(fileMap.values());

  console.log(
    `[Chat] 統合結果: ${relevantFiles.length}件 (上位: ${relevantFiles
      .slice(0, 5)
      .map((f) => f.name)
      .join(", ")})`
  );

  // 上位10件のテキストを抽出
  const topFiles = relevantFiles.slice(0, 10);

  // ── 5. テキスト抽出（並列） ──
  const extractionResults = await Promise.allSettled(
    topFiles.map(async (f) => ({
      name: f.name,
      id: f.id,
      text: await extractFileText(f.id, f.mimeType),
    }))
  );

  const documents = extractionResults
    .filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        name: string;
        id: string;
        text: string;
      }> =>
        r.status === "fulfilled" &&
        r.value.text.length > 50 &&
        !r.value.text.startsWith("[") &&
        !r.value.text.includes("テキスト抽出に失敗")
    )
    .map((r) => r.value);

  console.log(
    `[Chat] テキスト抽出成功: ${documents.length}/${topFiles.length}件`
  );

  // ── 6. 全ファイル名一覧 ──
  const fileIndex = allFiles
    .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
    .map((f) => f.name)
    .slice(0, 500);

  // ── 7. システムプロンプト構築 ──
  const documentContext =
    documents.length > 0
      ? documents
          .map(
            (d, i) => `--- ドキュメント${i + 1}: ${d.name} ---\n${d.text}\n`
          )
          .join("\n")
      : "（テキスト抽出に成功したドキュメントはありません）";

  const systemPrompt = `あなたはカーボンクレジット市場の専門アシスタントです。
社内の Google Drive に保管された${allFiles.length}件以上のドキュメントを参照して回答します。

【最重要ルール】
1. 下記の「参照ドキュメント」にテキストが含まれている場合、**その内容を根拠として回答を作成**してください
2. ドキュメントから得られた具体的な情報（制度の仕組み、数値、定義、プロセス等）を**引用・要約して**回答に含めてください
3. 各回答の末尾に「📄 参考ドキュメント：○○.pdf」のように出典を明記してください
4. ドキュメントのテキストが読み取れていて情報がある場合に「情報がありません」と答えるのは**禁止**です
5. 「ファイル一覧」に関連ドキュメントがあれば「○○に詳細情報がある可能性があります」と追加で案内してください
6. 日本語で回答してください

【参照ドキュメント（本文テキスト）— 質問に関連するファイルから抽出】
${documentContext}

【ファイル一覧（Google Drive 内の全ドキュメント名 — ${fileIndex.length}件）】
${fileIndex.join("\n")}`;

  // ── 8. ファイルメタデータ ──
  const fileMetadata = documents.map((d) => ({ name: d.name, id: d.id }));

  // ── 9. Claude ストリーミング ──
  const client = new Anthropic({ apiKey });

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const h of history) {
    if (h.role === "user" || h.role === "assistant") {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: "user", content: message });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "sources", files: fileMetadata })}\n\n`
          )
        );

        const stream = client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            "delta" in event &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", content: event.delta.text })}\n\n`
              )
            );
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        console.error("[Chat API] ストリーミングエラー:", e);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: "応答の生成中にエラーが発生しました" })}\n\n`
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
