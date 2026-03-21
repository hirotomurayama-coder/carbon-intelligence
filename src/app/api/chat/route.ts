/**
 * チャット API — Google Drive の全ドキュメントを検索し、Claude でストリーミング応答を生成。
 *
 * 検索戦略:
 *   1. Google Drive fullText 検索（全ファイルの中身をGoogleインデックスで検索）
 *   2. ファイル名検索（サブフォルダ含む全ファイル名からキーワードマッチ）
 *   3. 全ファイル名一覧を Claude に渡し、存在するドキュメントを把握させる
 *
 * POST /api/chat
 * Body: { message: string, history: Array<{role, content}> }
 * Response: text/event-stream (SSE)
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  searchFiles,
  extractFileText,
  listFiles,
  type DriveFile,
} from "@/lib/google-drive";

export const maxDuration = 60; // Vercel Pro: 60秒タイムアウト

type ChatRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

// ============================================================
// キーワード抽出（改良版）
// ============================================================

/** 日本語の助詞・接続詞を除外 */
const STOP_WORDS = new Set([
  "の", "に", "は", "を", "で", "が", "と", "も", "から", "まで",
  "より", "ため", "こと", "もの", "する", "ある", "いる", "なる",
  "できる", "れる", "られる", "ない", "です", "ます", "した",
  "について", "として", "における", "に関する", "とは", "って",
  "教えて", "教えて下さい", "教えてください", "ください", "知りたい",
  "what", "how", "the", "is", "are", "about",
]);

function extractKeywords(message: string): string[] {
  const cleaned = message
    .replace(/[、。！？「」『』（）\(\)・\s　]+/g, " ")
    .trim();

  const tokens = cleaned
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  return tokens.slice(0, 8);
}

// ============================================================
// ファイル名からキーワードマッチ
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
// 全ファイルキャッシュ（リクエスト間で共有）
// ============================================================

let cachedFileList: DriveFile[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分

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

  // ── 1. キーワード抽出 ──
  const keywords = extractKeywords(message);
  const searchQuery = keywords.join(" ");

  // ── 2. 複数の検索戦略を並列実行 ──
  const [fullTextResults, allFiles] = await Promise.all([
    // 戦略A: Google Drive 全文検索（Google のインデックスで全ファイルを検索）
    searchQuery
      ? searchFiles(searchQuery).catch(() => [] as DriveFile[])
      : ([] as DriveFile[]),
    // 戦略B: 全ファイル一覧（ファイル名マッチ + Claude への一覧提供用）
    getAllFiles(),
  ]);

  // ── 3. ファイル名スコアリング ──
  const nameScored = allFiles
    .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
    .map((f) => ({ file: f, score: scoreFileByName(f, keywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // ── 4. 結果を統合・重複排除 ──
  const fileMap = new Map<string, DriveFile>();
  // 全文検索結果を優先
  for (const f of fullTextResults) {
    fileMap.set(f.id, f);
  }
  // ファイル名マッチを追加
  for (const item of nameScored) {
    if (!fileMap.has(item.file.id)) {
      fileMap.set(item.file.id, item.file);
    }
  }

  let relevantFiles = Array.from(fileMap.values());

  // 検索結果が少なければ最新ファイルを補完
  if (relevantFiles.length < 3) {
    const existingIds = new Set(relevantFiles.map((f) => f.id));
    for (const f of allFiles) {
      if (
        !existingIds.has(f.id) &&
        f.mimeType !== "application/vnd.google-apps.folder"
      ) {
        relevantFiles.push(f);
        if (relevantFiles.length >= 10) break;
      }
    }
  }

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

  // ── 6. 全ファイル名一覧を構築（Claude に「何が存在するか」を伝える） ──
  const fileIndex = allFiles
    .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
    .map((f) => f.name)
    .slice(0, 500); // 最大500件のファイル名

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
        // ソース情報を送信
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "sources", files: fileMetadata })}\n\n`
          )
        );

        // Claude ストリーミング
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
