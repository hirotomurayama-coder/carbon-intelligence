"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { CadProject } from "@/lib/cad-trust";
import type { Methodology } from "@/types";

// ============================================================
// ヘルパー
// ============================================================

function registryColor(r: string): "emerald" | "amber" | "cyan" | "blue" | "gray" {
  if (r.includes("Verra")) return "emerald";
  if (r.includes("Gold Standard")) return "amber";
  if (r.includes("CDM")) return "cyan";
  if (r.includes("ACR")) return "blue";
  return "gray";
}

function statusJa(s: string): string {
  const map: Record<string, string> = {
    "Registered": "登録済み", "Active": "運用中", "Listed": "審査中",
    "Validated": "検証済み", "Under validation": "検証中", "Under development": "開発中",
  };
  return map[s] ?? s;
}

function statusColor(s: string): "emerald" | "amber" | "gray" | "blue" {
  if (s === "Registered" || s === "Active") return "emerald";
  if (s === "Listed" || s === "Validated") return "blue";
  if (s.includes("Under")) return "amber";
  return "gray";
}

function sectorJa(s: string): string {
  const map: Record<string, string> = {
    "Agriculture; forestry and fishing": "農林水産業",
    "Waste handling and disposal": "廃棄物処理",
    "Energy Industries (renewable/non-renewable sources)": "エネルギー産業",
    "Energy industries (renewable - / non-renewable sources)": "エネルギー産業",
    "Transportation and storage": "運輸・物流",
    "Afforestation and reforestation": "植林・再植林",
    "Livestock, enteric fermentation, and manure management": "畜産・メタン",
    "Energy Demand": "エネルギー需要",
  };
  return map[s] ?? s;
}

function getCountries(p: CadProject): string[] {
  return (p.projectLocations ?? [])
    .map((l) => l.country)
    .filter((c, i, arr) => c && arr.indexOf(c) === i);
}

function calcTotalUnits(p: CadProject): number {
  return (p.estimations ?? []).reduce((sum, e) => sum + (e.unitCount ?? 0), 0);
}

// 色パレット
const BAR_COLORS = [
  "bg-emerald-500", "bg-cyan-500", "bg-blue-500", "bg-amber-500",
  "bg-indigo-500", "bg-rose-500", "bg-violet-500", "bg-teal-500",
];

const PIE_COLORS = [
  "#10b981", "#06b6d4", "#3b82f6", "#f59e0b",
  "#6366f1", "#f43f5e", "#8b5cf6", "#14b8a6",
];

// ============================================================
// コンポーネント
// ============================================================

type Props = {
  data: CadProject[];
  nameTranslations?: Record<string, string>;
  query: string;
  currentPage: number;
  totalPages: number;
  stats: {
    registries: [string, number][];
    sectors: [string, number][];
    countries: [string, number][];
    totalUnits: number;
  };
  methodologies?: Methodology[];
};

/** CAD Trustメソドロジー名 → 内部DBのメソドロジーIDを検索 */
function findLinkedMethodology(cadMethodology: string, methodologies: Methodology[]): Methodology | null {
  if (!cadMethodology || methodologies.length === 0) return null;
  // コード部分を抽出（VCS-VM0042 → VM0042, CDM - AMS-I.D. → AMS-I.D.）
  const code = cadMethodology
    .replace(/^VCS-/i, "")
    .replace(/^CDM\s*-\s*/i, "")
    .replace(/^GS\s*-\s*/i, "")
    .trim()
    .toLowerCase();

  return methodologies.find((m) => {
    const t = m.title.toLowerCase();
    return t.includes(code) || t.includes(cadMethodology.toLowerCase());
  }) ?? null;
}

export function ProjectDashboard({ data, nameTranslations = {}, query, currentPage, totalPages, stats, methodologies = [] }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(query);
  const showDashboard = !query && currentPage === 1;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    params.set("page", "1");
    router.push(`/projects?${params.toString()}`);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("page", String(p));
    router.push(`/projects?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">グローバルプロジェクト</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              CAD Trust
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Climate Action Data Trust 連携 — 世界のカーボンクレジットプロジェクトを横断検索
          </p>
        </div>
      </div>

      {/* ── 検索バー ── */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="プロジェクト名、メソドロジー、国名で検索..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700">
          検索
        </button>
      </form>

      {/* ── ダッシュボード（検索前の初期表示） ── */}
      {showDashboard && stats.registries.length > 0 && (
        <>
          {/* KPIカード */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-emerald-600">{totalPages.toLocaleString()}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">登録プロジェクト数</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-emerald-600">190+</p>
              <p className="mt-1 text-xs font-medium text-gray-500">対象国・地域</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-emerald-600">{stats.totalUnits > 0 ? `${(stats.totalUnits / 1000).toFixed(0)}万+` : "—"}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">推定削減量（tCO2e）</p>
              <p className="text-[10px] text-gray-300">サンプル100件からの推計</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-emerald-600">{stats.registries.length}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">対応レジストリ</p>
              <p className="text-[10px] text-gray-300">{stats.registries.map(([n]) => n).join(" / ")}</p>
            </div>
          </div>

          {/* 統計パネル 3カラム */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* レジストリ分布 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">レジストリ分布</h3>
              <div className="space-y-3">
                {stats.registries.map(([name, count], i) => {
                  const total = stats.registries.reduce((s, [, c]) => s + c, 0);
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium">{name}</span>
                        <span className="text-emerald-600 font-bold">{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div
                          className={`h-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* セクター分布 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">セクター分布</h3>
              <div className="space-y-2">
                {stats.sectors.map(([name, count], i) => {
                  const total = stats.sectors.reduce((s, [, c]) => s + c, 0);
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-gray-700 flex-1 truncate">{name}</span>
                      <span className="text-xs font-bold text-gray-500">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 国別分布 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">プロジェクト所在地</h3>
              <div className="space-y-1.5">
                {stats.countries.slice(0, 10).map(([name, count]) => {
                  const maxCount = stats.countries[0]?.[1] ?? 1;
                  return (
                    <Link
                      key={name}
                      href={`/projects?q=${encodeURIComponent(name)}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-emerald-50"
                    >
                      <div className="h-1.5 rounded-full bg-emerald-400 flex-shrink-0" style={{ width: `${(count / maxCount) * 60 + 20}px` }} />
                      <span className="text-xs text-gray-700 flex-1">{name}</span>
                      <span className="text-xs font-bold text-gray-400">{count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* クイック検索タグ */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-400 py-1.5">よく検索されるキーワード:</span>
            {["REDD", "Biochar", "Wind", "Solar", "Cookstoves", "Japan", "India", "Brazil", "Methane", "Afforestation"].map((q) => (
              <Link
                key={q}
                href={`/projects?q=${encodeURIComponent(q)}`}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
              >
                {q}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── 検索結果 ── */}
      {(query || currentPage > 1) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {totalPages > 0
              ? `${totalPages.toLocaleString()} 件中 ${((currentPage - 1) * 20 + 1).toLocaleString()}〜${Math.min(currentPage * 20, totalPages).toLocaleString()} 件`
              : "結果なし"}
            {query && <span className="ml-2 text-gray-500">「{query}」の検索結果</span>}
          </p>
          {query && (
            <Link href="/projects" className="text-xs text-emerald-600 hover:text-emerald-700">
              ダッシュボードに戻る
            </Link>
          )}
        </div>
      )}

      {/* プロジェクトカード一覧 */}
      <div className="space-y-3">
        {data.map((p) => {
          const countries = getCountries(p);
          const units = calcTotalUnits(p);
          return (
            <Link
              key={p.warehouseProjectId}
              href={`/projects/${p.warehouseProjectId}`}
              className="group block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition line-clamp-2">
                    {nameTranslations[p.warehouseProjectId] ?? p.projectName}
                  </h3>
                  {p.description && (
                    <p className="mt-1 text-xs text-gray-400 line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant={registryColor(p.currentRegistry)}>{p.currentRegistry}</Badge>
                    <Badge variant={statusColor(p.projectStatus)}>{statusJa(p.projectStatus)}</Badge>
                    {p.methodology && <Badge variant="gray">{p.methodology}</Badge>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right flex-shrink-0">
                  {countries.length > 0 && (
                    <span className="text-xs text-gray-500">{countries.join(", ")}</span>
                  )}
                  {units > 0 && (
                    <span className="text-sm font-bold text-emerald-700">{units.toLocaleString()} tCO2e</span>
                  )}
                  <span className="text-xs text-gray-400">{sectorJa(p.sector)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {data.length === 0 && query && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          「{query}」に一致するプロジェクトが見つかりません
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            前へ
          </button>
          <span className="text-sm text-gray-500">
            {currentPage.toLocaleString()} / {Math.min(totalPages, 500).toLocaleString()} ページ
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || currentPage >= 500}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            次へ
          </button>
        </div>
      )}

      {/* データソース */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-[10px] text-gray-400">
          データソース: Climate Action Data Trust (CAD Trust) — 分散型カーボンクレジットレジストリ |{" "}
          <a href="https://climateactiondata.org" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">
            climateactiondata.org
          </a>
          {" | "}統計はサンプル100件からの集計値です
        </p>
      </div>
    </div>
  );
}
