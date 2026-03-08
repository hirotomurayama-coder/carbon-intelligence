"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { TabGroup } from "@/components/ui/TabGroup";
import { Badge } from "@/components/ui/Badge";
import type { Article, ArticleCategory } from "@/types";

const ALL_TAB = "すべて";
const TABS: string[] = [
  ALL_TAB,
  "国内ニュース",
  "海外ニュース",
  "コラム",
  "オフセット事例",
  "用語解説",
];

function categoryVariant(cat: ArticleCategory) {
  switch (cat) {
    case "国内ニュース":
      return "blue" as const;
    case "海外ニュース":
      return "emerald" as const;
    case "コラム":
      return "indigo" as const;
    case "オフセット事例":
      return "amber" as const;
    case "用語解説":
      return "slate" as const;
    default:
      return "slate" as const;
  }
}

type Props = {
  data: Article[];
  initialCategory?: string;
};

export function ArticleList({ data, initialCategory }: Props) {
  const [activeTab, setActiveTab] = useState(
    initialCategory && TABS.includes(initialCategory)
      ? initialCategory
      : ALL_TAB
  );
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    return data.filter((a) => {
      const matchesTab = activeTab === ALL_TAB || a.category === activeTab;
      const matchesKeyword =
        keyword === "" ||
        a.title.toLowerCase().includes(keyword.toLowerCase()) ||
        a.excerpt.toLowerCase().includes(keyword.toLowerCase());
      return matchesTab && matchesKeyword;
    });
  }, [data, activeTab, keyword]);

  return (
    <div className="space-y-6">
      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-4">
        <TabGroup tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="w-full sm:ml-auto sm:w-72">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="記事を検索..."
          />
        </div>
      </div>

      <p className="text-sm text-gray-400">{filtered.length} 件</p>

      {/* カード一覧 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((article) => (
          <div
            key={article.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={categoryVariant(article.category)}>
                {article.category}
              </Badge>
              <span className="text-xs text-gray-400">{article.date}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">
              {article.title}
            </h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-gray-500">
              {article.excerpt.length > 120
                ? article.excerpt.slice(0, 120) + "..."
                : article.excerpt}
            </p>
            {article.link && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  記事を読む &rarr;
                </a>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-gray-400">
            該当する記事が見つかりません
          </p>
        )}
      </div>
    </div>
  );
}
