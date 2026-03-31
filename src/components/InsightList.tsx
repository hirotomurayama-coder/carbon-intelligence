"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { TabGroup } from "@/components/ui/TabGroup";
import { Badge } from "@/components/ui/Badge";
import type { Insight, InsightCategory } from "@/types";

// ============================================================
// 定数
// ============================================================

const ALL_TAB = "すべて";
const TABS: string[] = [
  ALL_TAB,
  "特別記事",
  "メルマガ",
  "週次ブリーフ",
  "政策",
  "市場",
  "技術",
];

function categoryBadgeVariant(cat: InsightCategory) {
  switch (cat) {
    case "政策":
      return "blue" as const;
    case "市場":
      return "emerald" as const;
    case "技術":
      return "indigo" as const;
    case "特別記事":
      return "amber" as const;
    case "メルマガ":
      return "slate" as const;
    case "週次ブリーフ":
      return "emerald" as const;
    default:
      return "gray" as const;
  }
}

function categoryIcon(cat: InsightCategory | null): string {
  switch (cat) {
    case "特別記事":
      return "\u2b50";
    case "メルマガ":
      return "\u2709\ufe0f";
    case "週次ブリーフ":
      return "\ud83d\udcca";
    case "政策":
      return "\ud83c\udfdb\ufe0f";
    case "市場":
      return "\ud83d\udcc8";
    case "技術":
      return "\ud83d\udd2c";
    default:
      return "\ud83d\udcdd";
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

// ============================================================
// コンポーネント
// ============================================================

type Props = { data: Insight[] };

export function InsightList({ data }: Props) {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as InsightCategory | null;
  const [activeTab, setActiveTab] = useState<InsightCategory | typeof ALL_TAB>(initialCategory ?? ALL_TAB);
  const [keyword, setKeyword] = useState("");
  const [groupBySeries, setGroupBySeries] = useState(false);

  // シリーズ一覧
  const seriesList = useMemo(() => {
    const set = new Set<string>();
    for (const i of data) {
      if (i.series) set.add(i.series);
    }
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((i) => {
      const matchesTab =
        activeTab === ALL_TAB || i.category === activeTab;
      const kw = keyword.toLowerCase();
      const matchesKeyword =
        keyword === "" ||
        i.title.toLowerCase().includes(kw) ||
        i.summary.toLowerCase().includes(kw) ||
        (i.series?.toLowerCase().includes(kw) ?? false);
      return matchesTab && matchesKeyword;
    });
  }, [data, activeTab, keyword]);

  // シリーズでグループ化
  const grouped = useMemo(() => {
    if (!groupBySeries) return null;
    const map = new Map<string, Insight[]>();
    const noSeries: Insight[] = [];
    for (const i of filtered) {
      if (i.series) {
        const list = map.get(i.series) ?? [];
        list.push(i);
        map.set(i.series, list);
      } else {
        noSeries.push(i);
      }
    }
    return { series: Array.from(map.entries()), noSeries };
  }, [filtered, groupBySeries]);

  return (
    <div className="space-y-6">
      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-4">
        <TabGroup tabs={TABS} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as InsightCategory | typeof ALL_TAB)} />
        <div className="w-full sm:ml-auto sm:w-72">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="タイトル・内容を検索..."
          />
        </div>
      </div>

      {/* サブフィルタ */}
      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-400">{filtered.length} 件</p>
        {seriesList.length > 0 && (
          <button
            onClick={() => setGroupBySeries(!groupBySeries)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              groupBySeries
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {groupBySeries ? "\u2713 " : ""}シリーズ別表示
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-gray-400">
          該当するインサイトが見つかりません
        </p>
      ) : grouped ? (
        // シリーズグループ表示
        <div className="space-y-8">
          {grouped.series.map(([seriesName, items]) => (
            <section key={seriesName}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-700">
                <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">
                  {seriesName}
                </span>
                <span className="text-gray-400">{items.length}件</span>
              </h3>
              <div className="space-y-3">
                {items.map((i) => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </div>
            </section>
          ))}
          {grouped.noSeries.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-bold text-gray-500">
                その他
              </h3>
              <div className="space-y-3">
                {grouped.noSeries.map((i) => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        // フラット表示
        <div className="space-y-3">
          {filtered.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <Link
      href={`/insights/${insight.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">{categoryIcon(insight.category)}</span>
        {insight.category && (
          <Badge variant={categoryBadgeVariant(insight.category)}>
            {insight.category}
          </Badge>
        )}
        {insight.series && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            {insight.series}
          </span>
        )}
        <time className="text-xs text-gray-400" dateTime={insight.date}>
          {formatDate(insight.date)}
        </time>
        {insight.readingTime && (
          <span className="text-xs text-gray-400">
            {insight.readingTime}分で読めます
          </span>
        )}
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
  );
}
