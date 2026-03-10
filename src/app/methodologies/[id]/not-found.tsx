import Link from "next/link";

export default function MethodologyNotFound() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-12 text-center">
      <div className="text-5xl text-gray-300">404</div>
      <h2 className="text-lg font-semibold text-gray-700">
        メソドロジーが見つかりません
      </h2>
      <p className="text-sm text-gray-400">
        指定されたメソドロジーは存在しないか、削除された可能性があります。
      </p>
      <Link
        href="/methodologies"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        メソドロジー一覧に戻る
      </Link>
    </div>
  );
}
