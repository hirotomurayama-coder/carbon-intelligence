import Link from "next/link";
import { getInsights } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { InsightCategory } from "@/types";

function categoryBadgeVariant(cat: InsightCategory) {
  switch (cat) {
    case "政策":
      return "blue" as const;
    case "市場":
      return "emerald" as const;
    case "技術":
      return "indigo" as const;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function InsightsPage() {
  const insights = await getInsights();

  // 日付降順でソート
  const sorted = [...insights].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">インサイト</h1>
        <p className="mt-1 text-sm text-gray-400">
          カーボンクレジット市場の政策・市場動向・技術分析
        </p>
      </div>

      <p className="text-sm text-gray-400">{sorted.length} 件</p>

      {sorted.length === 0 ? (
        <p className="py-12 text-center text-gray-400">
          インサイト記事はまだありません
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((insight) => (
            <Link
              key={insight.id}
              href={`/insights/${insight.id}`}
              className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
            >
              <div className="flex flex-wrap items-center gap-3">
                {insight.category && (
                  <Badge variant={categoryBadgeVariant(insight.category)}>
                    {insight.category}
                  </Badge>
                )}
                <time className="text-xs text-gray-400" dateTime={insight.date}>
                  {formatDate(insight.date)}
                </time>
              </div>
              <h2 className="mt-2 text-base font-semibold text-gray-900 group-hover:text-emerald-700">
                {insight.title}
              </h2>
              {insight.summary && (
                <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">
                  {insight.summary}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
