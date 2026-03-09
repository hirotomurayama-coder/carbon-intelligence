"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { TabGroup } from "@/components/ui/TabGroup";
import { Badge } from "@/components/ui/Badge";
import type { Company, CompanyCategory } from "@/types";

const ALL_TAB = "すべて";
const TABS: string[] = [ALL_TAB, "創出事業者", "仲介", "コンサル", "検証機関"];

function categoryVariant(cat: CompanyCategory | null) {
  if (cat === null) return "gray" as const;
  switch (cat) {
    case "創出事業者":
      return "emerald" as const;
    case "仲介":
      return "blue" as const;
    case "コンサル":
      return "indigo" as const;
    case "検証機関":
      return "amber" as const;
  }
}

type Props = {
  data: Company[];
};

export function CompanyList({ data }: Props) {
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    return data.filter((c) => {
      const matchesTab = activeTab === ALL_TAB || c.category === activeTab;
      const matchesKeyword =
        keyword === "" ||
        c.name.toLowerCase().includes(keyword.toLowerCase()) ||
        c.mainProjects.some((p) =>
          p.toLowerCase().includes(keyword.toLowerCase())
        );
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
            placeholder="企業名・プロジェクトを検索..."
          />
        </div>
      </div>

      <p className="text-sm text-gray-400">{filtered.length} 社</p>

      {/* カード一覧 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
                {c.name?.[0] ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {c.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {c.headquarters ?? "\u2014"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Badge variant={categoryVariant(c.category)}>
                {c.category ?? "\u672A\u5206\u985E"}
              </Badge>
            </div>
            {c.mainProjects.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="mb-1.5 text-xs font-medium text-gray-500">
                  主要プロジェクト
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.mainProjects.map((p) => (
                    <span
                      key={p}
                      className="rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-gray-400">
            該当する企業が見つかりません
          </p>
        )}
      </div>
    </div>
  );
}
