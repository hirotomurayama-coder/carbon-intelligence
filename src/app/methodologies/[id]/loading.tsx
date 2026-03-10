/** メソドロジー詳細ページのローディングスケルトン */
export default function MethodologyDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-pulse">
      {/* パンくず */}
      <div className="h-4 w-48 rounded bg-gray-200" />

      {/* ヘッダー */}
      <div className="space-y-3">
        <div className="h-8 w-96 rounded bg-gray-200" />
        <div className="h-4 w-64 rounded bg-gray-100" />
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded-full bg-gray-200" />
          <div className="h-6 w-20 rounded-full bg-gray-200" />
          <div className="h-6 w-16 rounded-full bg-gray-200" />
        </div>
      </div>

      {/* AI 要約 */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 space-y-2">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-3/4 rounded bg-gray-200" />
      </div>

      {/* 情報カード */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div className="h-4 w-24 rounded bg-gray-200" />
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="flex justify-between">
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-24 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
