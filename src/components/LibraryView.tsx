"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

type RecommendedFile = DriveFile & {
  matchType: "folder" | "fulltext" | "filename";
  relevanceScore: number;
};

// ============================================================
// ヘルパー
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

function matchBadge(type: "folder" | "fulltext" | "filename") {
  switch (type) {
    case "folder":
      return (
        <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">
          フォルダ一致
        </span>
      );
    case "fulltext":
      return (
        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-medium">
          本文一致
        </span>
      );
    case "filename":
      return (
        <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">
          ファイル名一致
        </span>
      );
  }
}

// ============================================================
// メインコンポーネント
// ============================================================

export function LibraryView() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 検索
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecommendedFile[] | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── ファイル一覧を取得 ──
  useEffect(() => {
    async function fetchFiles() {
      try {
        const res = await fetch("/api/library/files");
        const data = await res.json();
        if (data.files) setFiles(data.files);
        else if (data.error) setFilesError(data.error);
      } catch (e) {
        setFilesError(String(e));
      } finally {
        setFilesLoading(false);
      }
    }
    fetchFiles();
  }, []);

  // ── 検索実行 ──
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || isSearching) return;

    setIsSearching(true);
    setSearchResults(null);

    try {
      const res = await fetch("/api/library/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, isSearching]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  // サイドバーフィルタ
  const filteredFiles = fileSearch
    ? files.filter((f) =>
        f.name.toLowerCase().includes(fileSearch.toLowerCase())
      )
    : files;

  const nonFolderFiles = filteredFiles.filter(
    (f) => f.mimeType !== "application/vnd.google-apps.folder"
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* ── サイドバー: 全ファイル一覧 ── */}
      {sidebarOpen && (
        <div className="w-72 flex-shrink-0 rounded-xl border border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-700">
                ドキュメント
              </h2>
              <span className="text-[10px] text-gray-400">
                {nonFolderFiles.length} 件
              </span>
            </div>
            <input
              type="text"
              placeholder="ファイル名で絞り込み..."
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

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
            {!filesLoading && nonFolderFiles.length === 0 && (
              <p className="p-3 text-xs text-gray-400 text-center">
                ファイルがありません
              </p>
            )}
            {nonFolderFiles.slice(0, 200).map((f) => (
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

      {/* ── メインエリア ── */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* ヘッダー + 検索バー */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">
                ドキュメント検索
              </h2>
              <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Beta
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Google Drive の {files.length} 件以上の資料から関連ドキュメントを検索
            </p>
          </div>

          {/* Beta 注記 + Gemini Tips */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-3 text-[11px] text-gray-600 leading-relaxed">
            <span className="font-bold text-amber-700">Beta：</span>
            検索精度は今後改善予定です。より正確な情報を得るには、検索結果のファイルを Google Drive で開き、右側の{" "}
            <span className="font-semibold text-blue-600">Gemini</span>{" "}
            に同じ質問を入力してください。ドキュメントの内容に基づいた回答が得られます。
          </div>

          {/* 検索フォーム */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="調べたいキーワードやテーマを入力（例: GX-ETS 制度設計、J-Credit 認証基準）"
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                disabled={isSearching}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="flex-shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "検索"
              )}
            </button>
          </div>

          {/* クイック検索タグ */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "GX-ETS 制度設計",
              "J-Credit 認証基準",
              "カーボンオフセット",
              "REDD+ 森林",
              "SBTi ネットゼロ",
              "排出量取引",
            ].map((q) => (
              <button
                key={q}
                onClick={() => {
                  setSearchQuery(q);
                  setTimeout(() => handleSearch(), 0);
                }}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* 検索結果 */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchResults === null && !isSearching && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-700 mb-1">
                ドキュメントを検索
              </h3>
              <p className="text-xs text-gray-400 max-w-sm">
                キーワードやテーマを入力すると、Google Drive
                内の関連ドキュメントを検索して表示します。
                <br />
                フォルダ名・ファイル名・本文の内容から横断検索します。
              </p>
            </div>
          )}

          {isSearching && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
              <p className="text-sm text-gray-500">
                {files.length} 件のドキュメントを検索中...
              </p>
            </div>
          )}

          {searchResults !== null && !isSearching && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700">
                  検索結果
                  <span className="ml-2 text-emerald-600">
                    {searchResults.length} 件
                  </span>
                </h3>
                <button
                  onClick={() => {
                    setSearchResults(null);
                    setSearchQuery("");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  クリア
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">
                    該当するドキュメントが見つかりませんでした
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    別のキーワードで検索してみてください
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {searchResults.map((f, i) => (
                      <a
                        key={f.id}
                        href={f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition group"
                      >
                        <span className="text-xl mt-0.5 flex-shrink-0">
                          {mimeIcon(f.mimeType)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] text-gray-400 font-mono">
                              #{i + 1}
                            </span>
                            {matchBadge(f.matchType)}
                          </div>
                          <p className="text-sm font-medium text-gray-800 group-hover:text-emerald-700 transition leading-snug">
                            {f.name}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {relativeTime(f.modifiedTime)}
                            {f.size ? ` · ${formatFileSize(f.size)}` : ""}
                          </p>
                        </div>
                        <svg
                          className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 mt-1 flex-shrink-0 transition"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                          />
                        </svg>
                      </a>
                    ))}
                  </div>

                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
