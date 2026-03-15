"use client";

export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <h2 className="text-lg font-semibold">エラーが発生しました</h2>
      <p className="mt-2">{error.message}</p>
      {error.digest && (
        <p className="mt-1 text-xs text-red-400">Digest: {error.digest}</p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-red-400">
          スタックトレース
        </summary>
        <pre className="mt-2 overflow-x-auto text-[10px] text-red-300 whitespace-pre-wrap">
          {error.stack}
        </pre>
      </details>
      <button
        onClick={reset}
        className="mt-4 rounded bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700"
      >
        再試行
      </button>
    </div>
  );
}
