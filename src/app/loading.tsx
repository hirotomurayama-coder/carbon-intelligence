import { Skeleton, CardSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";

/** ダッシュボードのローディング表示 */
export default function Loading() {
  return (
    <div className="space-y-8">
      {/* KPI */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </section>

      {/* メソドロジーテーブル */}
      <section>
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-5 py-3 font-medium text-gray-500">タイトル</th>
                <th className="px-5 py-3 font-medium text-gray-500">算定手法</th>
                <th className="px-5 py-3 font-medium text-gray-500">地域</th>
                <th className="px-5 py-3 font-medium text-gray-500">有効期限</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">信頼性</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={5} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 企業 / インサイト */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section>
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
        <section>
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
