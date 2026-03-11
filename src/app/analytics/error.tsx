"use client";

/**
 * Next.js ルートレベルエラーバウンダリ。
 * /analytics 配下で予期しないエラーが発生した場合、
 * このコンポーネントがエラー内容を画面に表示する。
 */
export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-bold text-gray-900">
        クレジット価格動向 — エラー
      </h1>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="font-semibold text-red-700">ページエラー</p>
        <p className="mt-2 text-sm text-red-600 break-all font-mono">
          {error.message}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-red-400">
            digest: {error.digest}
          </p>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-red-500">
            スタックトレース
          </summary>
          <pre className="mt-1 max-h-60 overflow-auto rounded bg-red-100 p-2 text-[10px] text-red-500 whitespace-pre-wrap">
            {error.stack}
          </pre>
        </details>
      </div>

      <button
        type="button"
        onClick={() => reset()}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
      >
        再試行
      </button>
    </div>
  );
}
