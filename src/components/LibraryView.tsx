"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// 型定義
// ============================================================

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string | null;
  webViewLink: string | null;
};

type SourceFile = { name: string; id: string };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceFile[];
  isStreaming?: boolean;
};

// ============================================================
// MIME アイコン
// ============================================================

function mimeIcon(mimeType: string): string {
  if (mimeType.includes("pdf")) return "\uD83D\uDCC4";
  if (mimeType.includes("document") || mimeType.includes("word"))
    return "\uD83D\uDDD2\uFE0F";
  if (mimeType.includes("spreadsheet") || mimeType.includes("sheet"))
    return "\uD83D\uDCCA";
  if (mimeType.includes("presentation") || mimeType.includes("slide"))
    return "\uD83D\uDCBB";
  if (mimeType.includes("image")) return "\uD83D\uDDBC\uFE0F";
  return "\uD83D\uDCC1";
}

function formatFileSize(size: string | null): string {
  if (!size) return "";
  const bytes = parseInt(size, 10);
  if (isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "たった今";
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}日前`;
    return `${Math.floor(days / 30)}ヶ月前`;
  } catch {
    return "";
  }
}

// ============================================================
// メインコンポーネント
// ============================================================

export function LibraryView() {
  // ── ファイル一覧 ──
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── チャット ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── ファイル一覧を取得 ──
  useEffect(() => {
    async function fetchFiles() {
      try {
        const res = await fetch("/api/library/files");
        const data = await res.json();
        if (data.files) {
          setFiles(data.files);
        } else if (data.error) {
          setFilesError(data.error);
        }
      } catch (e) {
        setFilesError(String(e));
      } finally {
        setFilesLoading(false);
      }
    }
    fetchFiles();
  }, []);

  // ── 自動スクロール ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── メッセージ送信 ──
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    // 会話履歴（直近10ターン）
    const history = messages
      .filter((m) => !m.isStreaming)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const errMsg = errBody?.error ?? `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("ストリームを取得できません");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);

          if (payload === "[DONE]") break;

          try {
            const data = JSON.parse(payload);

            if (data.type === "sources") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: data.files } : m
                )
              );
            } else if (data.type === "text") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.content }
                    : m
                )
              );
            } else if (data.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: data.message, isStreaming: false }
                    : m
                )
              );
            }
          } catch {
            // JSON パースエラーは無視
          }
        }
      }

      // ストリーミング完了
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `エラーが発生しました: ${e instanceof Error ? e.message : String(e)}`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  // ── Enter で送信 ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ── フィルタリング ──
  const filteredFiles = fileSearch
    ? files.filter((f) =>
        f.name.toLowerCase().includes(fileSearch.toLowerCase())
      )
    : files;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* ── サイドバー: ファイル一覧 ── */}
      {sidebarOpen && (
        <div className="w-72 flex-shrink-0 rounded-xl border border-gray-200 bg-white flex flex-col overflow-hidden">
          {/* ヘッダー */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-700">
                ドキュメント
              </h2>
              <span className="text-[10px] text-gray-400">
                {files.length} 件
              </span>
            </div>
            <input
              type="text"
              placeholder="ファイルを検索..."
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          {/* ファイルリスト */}
          <div className="flex-1 overflow-y-auto p-2">
            {filesLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            )}
            {filesError && (
              <div className="p-3 text-xs text-red-600 bg-red-50 rounded-lg">
                {filesError}
              </div>
            )}
            {!filesLoading && !filesError && filteredFiles.length === 0 && (
              <p className="p-3 text-xs text-gray-400 text-center">
                ファイルがありません
              </p>
            )}
            {filteredFiles.map((f) => (
              <a
                key={f.id}
                href={f.webViewLink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition group"
              >
                <span className="text-base mt-0.5 flex-shrink-0">
                  {mimeIcon(f.mimeType)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-700 truncate group-hover:text-emerald-700">
                    {f.name}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {relativeTime(f.modifiedTime)}
                    {f.size ? ` · ${formatFileSize(f.size)}` : ""}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── メインエリア: チャット ── */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* チャットヘッダー */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400"
            title={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              AI ドキュメントチャット
            </h2>
            <p className="text-[10px] text-gray-400">
              Google Drive の資料をもとに回答します
            </p>
          </div>
        </div>

        {/* メッセージ領域 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-700 mb-1">
                ドキュメントについて質問してみましょう
              </h3>
              <p className="text-xs text-gray-400 max-w-sm">
                Google Drive にある資料の内容をAIが検索・分析して回答します。
                カーボンクレジットに関する質問をどうぞ。
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  "J-Creditの概要を教えて",
                  "最新の政策動向は？",
                  "ボランタリークレジットの種類は？",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white rounded-2xl rounded-br-md px-4 py-2.5"
                    : "bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-2.5"
                }`}
              >
                {/* メッセージ本文 */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>

                {/* 参考ドキュメント */}
                {msg.role === "assistant" &&
                  msg.sources &&
                  msg.sources.length > 0 &&
                  !msg.isStreaming && (
                    <div className="mt-2 pt-2 border-t border-gray-200/50">
                      <p className="text-[10px] text-gray-400 mb-1">
                        参考ドキュメント:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-gray-600 border border-gray-200/50"
                          >
                            {mimeIcon("")} {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ))}

          <div ref={chatEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="質問を入力してください（Shift+Enter で改行）"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              style={{ maxHeight: "120px" }}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 rounded-xl bg-emerald-600 p-2.5 text-white transition hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
