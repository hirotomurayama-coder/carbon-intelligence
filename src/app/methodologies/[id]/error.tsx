"use client";

import Link from "next/link";

export default function MethodologyDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-12 text-center">
      <div className="text-5xl text-gray-300">!</div>
      <h2 className="text-lg font-semibold text-gray-700">
        メソドロジーの読み込みに失敗しました
      </h2>
      <p className="text-sm text-gray-400">
        {error.message || "データの取得中にエラーが発生しました。"}
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          再読み込み
        </button>
        <Link
          href="/methodologies"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          一覧に戻る
        </Link>
      </div>
    </div>
  );
}
