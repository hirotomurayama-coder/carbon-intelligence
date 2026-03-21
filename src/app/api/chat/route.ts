/**
 * チャット API — Google Drive ドキュメントを検索し、Claude でストリーミング応答を生成。
 *
 * POST /api/chat
 * Body: { message: string, history: Array<{role, content}> }
 * Response: text/event-stream (SSE)
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { searchFiles, extractFileText, listFiles } from "@/lib/google-drive";

export const maxDuration = 60; // Vercel Pro: 60秒タイムアウト

type ChatRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

// ============================================================
// キーワード抽出（簡易）
// ============================================================

function extractKeywords(message: string): string[] {
  // 助詞・記号を除去し、2文字以上のトークンを抽出
  const cleaned = message
    .replace(/[、。！？「」『』（）\(\)・\s]+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter((t) => t.length >= 2);
  // 最大5キーワード
  return tokens.slice(0, 5);
}

// ============================================================
// POST ハンドラー
// ============================================================

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY が未設定です。Vercel ダッシュボードで環境変数を設定してください。" }),
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

  // ── 1. Google Drive からドキュメント検索 ──
  const keywords = extractKeywords(message);
  const searchQuery = keywords.join(" ");

  let relevantFiles = searchQuery
    ? await searchFiles(searchQuery).catch(() => [] as Awaited<ReturnType<typeof searchFiles>>)
    : [];

  // 検索結果が少なければ最新ファイルを補完
  if (relevantFiles.length < 2) {
    const recent = await listFiles().catch(() => [] as Awaited<ReturnType<typeof listFiles>>);
    const existingIds = new Set(relevantFiles.map((f) => f.id));
    for (const f of recent) {
      if (!existingIds.has(f.id)) {
        relevantFiles.push(f);
        if (relevantFiles.length >= 5) break;
      }
    }
  }

  // 上位3件に絞る
  const topFiles = relevantFiles.slice(0, 3);

  // ── 2. テキスト抽出（並列） ──
  const extractionResults = await Promise.allSettled(
    topFiles.map(async (f) => ({
      name: f.name,
      id: f.id,
      text: await extractFileText(f.id, f.mimeType),
    }))
  );

  const documents = extractionResults
    .filter(
      (r): r is PromiseFulfilledResult<{ name: string; id: string; text: string }> =>
        r.status === "fulfilled" && r.value.text.length > 10
    )
    .map((r) => r.value);

  // ── 3. システムプロンプト構築 ──
  const documentContext =
    documents.length > 0
      ? documents
          .map(
            (d, i) =>
              `--- ドキュメント${i + 1}: ${d.name} ---\n${d.text}\n`
          )
          .join("\n")
      : "（参照可能なドキュメントはありません）";

  const systemPrompt = `あなたはカーボンクレジット市場の専門アシスタントです。
以下の社内ドキュメントを参考にして、ユーザーの質問に正確に回答してください。

【回答ルール】
- 日本語で回答してください
- ドキュメントに記載がある情報は、出典ドキュメント名を示してください
- ドキュメントに記載がない情報は「ドキュメントに記載がありません」と明記してください
- 専門用語は必要に応じて説明を添えてください

【参考ドキュメント】
${documentContext}`;

  // ── 4. ファイルメタデータ ──
  const fileMetadata = documents.map((d) => ({ name: d.name, id: d.id }));

  // ── 5. Claude ストリーミング ──
  const client = new Anthropic({ apiKey });

  // 会話履歴を構築（交互ルール: user → assistant → user ...）
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
