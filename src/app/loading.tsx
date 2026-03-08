import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";

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

      {/* メソドロジーカード */}
      <section>
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
