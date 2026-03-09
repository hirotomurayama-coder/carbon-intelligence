import { Skeleton, TableRowSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* テーブル */}
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
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} cols={5} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
