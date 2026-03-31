export const dynamic = "force-dynamic";
export const maxDuration = 30;

import Link from "next/link";
import { getInsights, getPriceTrends } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { InsightCategory } from "@/types";

function insightBadge(cat: InsightCategory | null) {
  switch (cat) {
    case "政策": return "indigo" as const;
    case "市場": return "emerald" as const;
    case "技術": return "blue" as const;
    case "特別記事": return "amber" as const;
    case "メルマガ": return "slate" as const;
    case "週次ブリーフ": return "emerald" as const;
    default: return "gray" as const;
  }
}

function formatJpy(v: number | null): string {
  if (v === null) return "—";
  return `¥${Math.round(v).toLocaleString()}`;
}

const CATEGORY_FILTERS: { label: string; category: InsightCategory }[] = [
  { label: "政策", category: "政策" },
  { label: "市場", category: "市場" },
  { label: "技術", category: "技術" },
  { label: "週次ブリーフ", category: "週次ブリーフ" },
  { label: "特別記事", category: "特別記事" },
];

const KEY_MARKETS = [
  "jcredit-forest",
  "jcredit-energy-saving",
  "jcredit-agri-biochar",
  "eu-ets",
  "vol-redd-plus",
  "vol-biochar",
  "vol-dac",
  "vol-blue-carbon",
];

export default async function Home() {
  const [insights, priceTrends] = await Promise.all([
    getInsights(),
    getPriceTrends(),
  ]);

  const sortedInsights = [...insights]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  const marketPrices = KEY_MARKETS
    .map((id) => priceTrends.find((t) => t.marketId === id))
    .filter(Boolean);

  return (
    <div className="flex gap-6 items-start">

      {/* ── メイン: インサイトフィード ── */}
      <div className="min-w-0 flex-1">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">インサイト</h1>
          <Link
            href="/insights"
            className="text-xs text-emerald-600 hover:text-emerald-700"
          >
            すべて見る →
          </Link>
        </div>

        {/* カテゴリクイックフィルター */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map(({ label, category }) => (
            <Link
              key={category}
              href={`/insights?category=${encodeURIComponent(category)}`}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* インサイト一覧 */}
        {sortedInsights.length > 0 ? (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {sortedInsights.map((ins) => (
              <Link
                key={ins.id}
                href={`/insights/${ins.id}`}
                className="flex items-start gap-3 px-5 py-4 transition hover:bg-gray-50/70"
              >
                {/* カテゴリバッジ（縦に揃える） */}
                <div className="mt-0.5 w-16 flex-shrink-0">
                  <Badge variant={insightBadge(ins.category)}>
                    {ins.category ?? "—"}
                  </Badge>
                </div>

                {/* 本文 */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {ins.title}
                  </p>
                  {ins.summary && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {ins.summary}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{ins.date}</span>
                    {ins.readingTime && <span>· {ins.readingTime}分</span>}
                  </div>
                </div>

                {/* 矢印 */}
                <svg
                  className="mt-1 h-4 w-4 flex-shrink-0 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400 shadow-sm">
            インサイトがまだ登録されていません
          </div>
        )}
      </div>

      {/* ── 右パネル: 価格モニター ── */}
      <div className="w-60 flex-shrink-0">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-xs font-semibold text-gray-900">カーボンクレジット価格</h2>
            <Link href="/analysis" className="text-[10px] text-emerald-600 hover:text-emerald-700">
              詳細 →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {marketPrices.length > 0 ? marketPrices.map((t) => t && (
              <Link
                key={t.id}
                href={`/analysis/${t.marketId}`}
                className="block px-4 py-3 transition hover:bg-gray-50"
              >
                <p className="text-[10px] font-medium text-gray-400 truncate">{t.title}</p>
                <div className="mt-0.5 flex items-baseline justify-between gap-1">
                  <p className="text-sm font-bold text-gray-900">{formatJpy(t.latestPriceJpy)}</p>
                  {t.trendPercentage !== null && (
                    <span
                      className={`text-[10px] font-semibold ${
                        t.trendDirection === "up"
                          ? "text-emerald-600"
                          : t.trendDirection === "down"
                            ? "text-red-500"
                            : "text-gray-400"
                      }`}
                    >
                      {t.trendDirection === "up" ? "↑" : t.trendDirection === "down" ? "↓" : "→"}
                      {Math.abs(t.trendPercentage).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-gray-300">/{t.priceUnit ?? "tCO2e"}</p>
              </Link>
            )) : (
              <p className="px-4 py-6 text-center text-xs text-gray-400">価格データ未登録</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
