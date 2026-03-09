"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Badge } from "@/components/ui/Badge";
import type { Methodology, MethodologyType } from "@/types";

const typeOptions: { label: string; value: MethodologyType }[] = [
  { label: "ARR", value: "ARR" },
  { label: "ALM", value: "ALM" },
  { label: "マングローブ", value: "マングローブ" },
  { label: "REDD+", value: "REDD+" },
  { label: "再生可能エネルギー", value: "再生可能エネルギー" },
  { label: "省エネルギー", value: "省エネルギー" },
];

function scoreBadgeVariant(score: number) {
  if (score >= 90) return "emerald" as const;
  if (score >= 80) return "blue" as const;
  return "amber" as const;
}

type Props = {
  data: Methodology[];
};

export function MethodologyList({ data }: Props) {
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  const regionOptions = useMemo(
    () =>
      [...new Set(data.map((m) => m.region))].map((r) => ({
        label: r,
        value: r,
      })),
    [data]
  );

  const filtered = useMemo(() => {
    return data.filter((m) => {
      const matchesKeyword =
        keyword === "" ||
        m.title.toLowerCase().includes(keyword.toLowerCase()) ||
        m.summary.toLowerCase().includes(keyword.toLowerCase());
      const matchesType = typeFilter === "" || m.type === typeFilter;
      const matchesRegion = regionFilter === "" || m.region === regionFilter;
      return matchesKeyword && matchesType && matchesRegion;
    });
  }, [data, keyword, typeFilter, regionFilter]);

  return (
    <div className="space-y-6">
      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="メソドロジーを検索..."
          />
        </div>
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={typeOptions}
          placeholder="算定手法"
        />
        <FilterSelect
          value={regionFilter}
          onChange={setRegionFilter}
          options={regionOptions}
          placeholder="地域"
        />
        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} 件
        </span>
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
              <th className="px-5 py-3 text-right font-medium text-gray-500">
                信頼性
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-4">
                  <p className="font-medium text-gray-900">{m.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                    {m.summary.length > 80
                      ? m.summary.slice(0, 80) + "…"
                      : m.summary}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <Badge variant="slate">{m.type}</Badge>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                  {m.region}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                  {m.validUntil}
                </td>
                <td className="px-5 py-4 text-right">
                  <Badge variant={scoreBadgeVariant(m.reliabilityScore)}>
                    {m.reliabilityScore}点
                  </Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-gray-400"
                >
                  該当するメソドロジーが見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
