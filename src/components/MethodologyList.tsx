"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Badge } from "@/components/ui/Badge";
import type { Methodology, RegistryName } from "@/types";

const registryOptions: { label: string; value: RegistryName }[] = [
  { label: "Verra", value: "Verra" },
  { label: "Gold Standard", value: "Gold Standard" },
  { label: "Puro.earth", value: "Puro.earth" },
  { label: "J-Credit", value: "J-Credit" },
];

const creditTypeOptions: { label: string; value: string }[] = [
  { label: "回避・削減系", value: "回避・削減系" },
  { label: "除去系", value: "除去系" },
];

const sortOptions: { label: string; value: string }[] = [
  { label: "更新日（新しい順）", value: "date_desc" },
  { label: "タイトル順", value: "title_asc" },
];

/** レジストリ名に応じたバッジ色 */
function registryBadgeVariant(registry: RegistryName) {
  switch (registry) {
    case "Verra":
      return "emerald" as const;
    case "Gold Standard":
      return "amber" as const;
    case "Puro.earth":
      return "cyan" as const;
    default:
      return "gray" as const;
  }
}

/** 分類バッジ色 */
function creditTypeBadgeVariant(v: string) {
  return v === "除去系" ? ("indigo" as const) : ("blue" as const);
}

function baseTypeBadgeVariant(v: string) {
  if (v === "自然ベース") return "emerald" as const;
  if (v === "技術ベース") return "slate" as const;
  return "amber" as const; // 再エネ
}

type Props = {
  data: Methodology[];
};

export function MethodologyList({ data }: Props) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [registryFilter, setRegistryFilter] = useState("");
  const [creditTypeFilter, setCreditTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  const filtered = useMemo(() => {
    const result = data.filter((m) => {
      const searchTarget = [
        m.title,
        m.titleJa ?? "",
        m.summary,
        m.aiSummary ?? "",
        m.certificationBody ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesKeyword =
        keyword === "" || searchTarget.includes(keyword.toLowerCase());
      const matchesRegistry =
        registryFilter === "" || m.registry === registryFilter;
      const matchesCreditType =
        creditTypeFilter === "" || m.creditType === creditTypeFilter;
      return matchesKeyword && matchesRegistry && matchesCreditType;
    });

    // ソート
    const effectiveSort = sortBy || "date_desc";
    result.sort((a, b) => {
      if (effectiveSort === "title_asc") {
        const titleA = (a.titleJa ?? a.title).toLowerCase();
        const titleB = (b.titleJa ?? b.title).toLowerCase();
        return titleA.localeCompare(titleB, "ja");
      }
      // デフォルト: 外部更新日（新しい順）
      const dateA = a.externalLastUpdated ?? "";
      const dateB = b.externalLastUpdated ?? "";
      if (dateA && dateB) return dateB.localeCompare(dateA);
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return 0;
    });

    return result;
  }, [data, keyword, registryFilter, creditTypeFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* フィルタバー（Sticky） */}
      <div className="sticky top-0 z-20 bg-white/95 pb-4 pt-1 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-72">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="メソドロジーを検索..."
            />
          </div>
          <FilterSelect
            value={registryFilter}
            onChange={setRegistryFilter}
            options={registryOptions}
            placeholder="レジストリ"
          />
          <FilterSelect
            value={creditTypeFilter}
            onChange={setCreditTypeFilter}
            options={creditTypeOptions}
            placeholder="クレジット種別"
          />
          <FilterSelect
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
            placeholder="更新日（新しい順）"
          />
          <span className="ml-auto text-sm text-gray-400">
            {filtered.length} 件
          </span>
        </div>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-[52px] z-10">
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 font-medium text-gray-500">
                タイトル
              </th>
              <th className="px-5 py-3 font-medium text-gray-500">
                レジストリ
              </th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 md:table-cell">
                認証機関
              </th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 lg:table-cell">
                分類
              </th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 lg:table-cell">
                ステータス
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((m) => (
              <tr
                key={m.id}
                className="group cursor-pointer transition-colors hover:bg-emerald-50/40"
                onClick={() => router.push(`/methodologies/${m.id}`)}
              >
                {/* タイトル */}
                <td className="px-5 py-4">
                  <Link
                    href={`/methodologies/${m.id}`}
                    className="block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 日本語翻訳がある場合: 日本語メイン + 英語サブ */}
                    {m.titleJa ? (
                      <>
                        <p className="font-medium text-gray-900 group-hover:text-emerald-700">
                          {m.titleJa}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {m.title.length > 80
                            ? m.title.slice(0, 80) + "…"
                            : m.title}
                        </p>
                      </>
                    ) : (
                      /* 日本語翻訳がない場合: 英語タイトルを大きく表示 */
                      <>
                        <p className="font-medium text-gray-900 group-hover:text-emerald-700">
                          {m.title}
                        </p>
                        {m.summary && (
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                            {m.summary.length > 100
                              ? m.summary.slice(0, 100) + "…"
                              : m.summary}
                          </p>
                        )}
                      </>
                    )}
                  </Link>
                </td>

                {/* レジストリ */}
                <td className="px-5 py-4">
                  {m.registry ? (
                    <Badge variant={registryBadgeVariant(m.registry)}>
                      {m.registry}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-300">{"\u2014"}</span>
                  )}
                </td>

                {/* 認証機関 */}
                <td className="hidden px-5 py-4 text-gray-600 md:table-cell">
                  {m.certificationBody ?? "\u2014"}
                </td>

                {/* 分類 */}
                <td className="hidden px-5 py-4 lg:table-cell">
                  <div className="flex flex-col gap-1">
                    {m.creditType && (
                      <Badge variant={creditTypeBadgeVariant(m.creditType)}>
                        {m.creditType}
                      </Badge>
                    )}
                    {m.baseType && (
                      <Badge variant={baseTypeBadgeVariant(m.baseType)}>
                        {m.baseType}
                      </Badge>
                    )}
                    {!m.creditType && !m.baseType && (
                      <span className="text-xs text-gray-300">{"\u2014"}</span>
                    )}
                  </div>
                </td>

                {/* ステータス */}
                <td className="hidden px-5 py-4 lg:table-cell">
                  {m.operationalStatus ? (
                    <Badge
                      variant={
                        m.operationalStatus === "運用中" ? "emerald" : "gray"
                      }
                    >
                      {m.operationalStatus}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-300">{"\u2014"}</span>
                  )}
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
