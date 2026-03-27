"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Badge } from "@/components/ui/Badge";
import { useCompare } from "@/components/CompareContext";
import type { Methodology, RegistryName } from "@/types";

const registryOptions: { label: string; value: string }[] = [
  { label: "Verra", value: "Verra" },
  { label: "Gold Standard", value: "Gold Standard" },
  { label: "Puro.earth", value: "Puro.earth" },
  { label: "Isometric", value: "Isometric" },
  { label: "J-Credit", value: "J-Credit" },
  { label: "CDM", value: "CDM" },
  { label: "ARB", value: "ARB" },
  { label: "ACR", value: "ACR" },
  { label: "CAR", value: "CAR" },
];

const creditTypeOptions: { label: string; value: string }[] = [
  { label: "回避・削減系", value: "回避・削減系" },
  { label: "除去系", value: "除去系" },
];

const baseTypeOptions: { label: string; value: string }[] = [
  { label: "自然ベース", value: "自然ベース" },
  { label: "技術ベース", value: "技術ベース" },
  { label: "再エネ", value: "再エネ" },
];

const sortOptions: { label: string; value: string }[] = [
  { label: "更新日（新しい順）", value: "date_desc" },
  { label: "更新日（古い順）", value: "date_asc" },
  { label: "タイトル順（A→Z）", value: "title_asc" },
  { label: "タイトル順（Z→A）", value: "title_desc" },
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

// ============================================================
// CSVエクスポート
// ============================================================

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCsv(items: Methodology[]) {
  const headers = [
    "タイトル（日本語）", "タイトル（英語）", "レジストリ", "認証機関",
    "クレジット種別", "基本分類", "詳細分類", "ステータス",
    "バージョン", "AI要約", "外部更新日", "ソースURL",
  ];
  const rows = items.map((m) => [
    escapeCsv(m.titleJa), escapeCsv(m.title), escapeCsv(m.registry),
    escapeCsv(m.certificationBody), escapeCsv(m.creditType), escapeCsv(m.baseType),
    escapeCsv(m.subCategory), escapeCsv(m.operationalStatus),
    escapeCsv(m.version), escapeCsv(m.aiSummary),
    escapeCsv(m.externalLastUpdated), escapeCsv(m.sourceUrl),
  ]);

  const bom = "\uFEFF"; // Excel で日本語文字化け防止
  const csv = bom + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `methodologies_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  data: Methodology[];
};

export function MethodologyList({ data }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const compare = useCompare();

  // URLパラメータから初期値を読み込み
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [registryFilter, setRegistryFilter] = useState(searchParams.get("registry") ?? "");
  const [creditTypeFilter, setCreditTypeFilter] = useState(searchParams.get("creditType") ?? "");
  const [baseTypeFilter, setBaseTypeFilter] = useState(searchParams.get("baseType") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") ?? "date_desc");

  // フィルタ変更時にURLを同期（ブックマーク・共有可能に）
  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);
    if (registryFilter) params.set("registry", registryFilter);
    if (creditTypeFilter) params.set("creditType", creditTypeFilter);
    if (baseTypeFilter) params.set("baseType", baseTypeFilter);
    if (sortBy && sortBy !== "date_desc") params.set("sort", sortBy);
    const qs = params.toString();
    const newUrl = qs ? `/methodologies?${qs}` : "/methodologies";
    window.history.replaceState(null, "", newUrl);
  }, [keyword, registryFilter, creditTypeFilter, baseTypeFilter, sortBy]);

  useEffect(() => { syncUrl(); }, [syncUrl]);

  // フィルタバーの高さを動的計測（thead の sticky top に使用）
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(0);

  useEffect(() => {
    const el = filterRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setFilterHeight(
        entry.borderBoxSize?.[0]?.blockSize
          ?? entry.target.getBoundingClientRect().height
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const result = data.filter((m) => {
      const searchTarget = [
        m.title,
        m.titleJa ?? "",
        m.summary,
        m.aiSummary ?? "",
        m.certificationBody ?? "",
        m.subCategory ?? "",
        m.type ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesKeyword =
        keyword === "" || searchTarget.includes(keyword.toLowerCase());
      const matchesRegistry =
        registryFilter === "" || m.registry === registryFilter;
      const matchesCreditType =
        creditTypeFilter === "" || m.creditType === creditTypeFilter;
      const matchesBaseType =
        baseTypeFilter === "" || m.baseType === baseTypeFilter;
      return matchesKeyword && matchesRegistry && matchesCreditType && matchesBaseType;
    });

    // ソート
    const effectiveSort = sortBy || "date_desc";
    result.sort((a, b) => {
      if (effectiveSort === "title_asc" || effectiveSort === "title_desc") {
        const titleA = (a.titleJa ?? a.title).toLowerCase();
        const titleB = (b.titleJa ?? b.title).toLowerCase();
        const cmp = titleA.localeCompare(titleB, "ja");
        return effectiveSort === "title_desc" ? -cmp : cmp;
      }
      // 日付順
      const dateA = a.externalLastUpdated ?? "";
      const dateB = b.externalLastUpdated ?? "";
      const cmp =
        dateA && dateB
          ? dateB.localeCompare(dateA)
          : dateA
            ? -1
            : dateB
              ? 1
              : 0;
      return effectiveSort === "date_asc" ? -cmp : cmp;
    });

    return result;
  }, [data, keyword, registryFilter, creditTypeFilter, baseTypeFilter, sortBy]);

  return (
    <div>
      {/* フィルタバー（Sticky） */}
      <div ref={filterRef} className="sticky top-0 z-30 -mx-6 bg-white px-6 py-4 shadow-[0_-50px_0_0_white,0_1px_0_0_#e5e7eb]">
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
            value={baseTypeFilter}
            onChange={setBaseTypeFilter}
            options={baseTypeOptions}
            placeholder="種類"
          />
          <FilterSelect
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
            placeholder="並べ替え"
          />
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {filtered.length} 件
            </span>
            <button
              onClick={() => exportCsv(filtered)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
              title="表示中のデータをCSVでダウンロード"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead
            className="sticky z-20 bg-gray-50"
            style={{ top: `${filterHeight}px` }}
          >
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
              <th className="w-20 px-3 py-3 font-medium text-gray-500 text-center">
                比較
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

                {/* 比較ボタン */}
                <td className="px-3 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (compare.has(m.id)) {
                        compare.remove(m.id);
                      } else {
                        compare.add(m);
                      }
                    }}
                    disabled={compare.isFull && !compare.has(m.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      compare.has(m.id)
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                        : compare.isFull
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100"
                          : "bg-white text-gray-500 border border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300"
                    }`}
                    title={compare.has(m.id) ? "比較から削除" : "比較に追加（最大5件）"}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {compare.has(m.id) ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      )}
                    </svg>
                    {compare.has(m.id) ? "追加済" : "比較"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
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
