"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { CadProject } from "@/lib/cad-trust";

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

function statusColor(s: string): "emerald" | "amber" | "gray" | "blue" {
  if (s === "Registered" || s === "Active") return "emerald";
  if (s === "Listed" || s === "Validated") return "blue";
  if (s === "Under validation" || s === "Under development") return "amber";
  return "gray";
}

/** 英語ステータスを日本語に変換 */
function statusJa(s: string): string {
  const map: Record<string, string> = {
    "Registered": "登録済み",
    "Active": "運用中",
    "Listed": "審査中",
    "Validated": "検証済み",
    "Under validation": "検証中",
    "Under development": "開発中",
    "Completed": "完了",
    "Withdrawn": "取り下げ",
    "De-registered": "登録抹消",
  };
  return map[s] ?? s;
}

/** 英語セクターを日本語に変換 */
function sectorJa(s: string): string {
  const map: Record<string, string> = {
    "Agriculture; forestry and fishing": "農林水産業",
    "Waste handling and disposal": "廃棄物処理",
    "Energy Industries (renewable/non-renewable sources)": "エネルギー産業",
    "Energy industries (renewable - / non-renewable sources)": "エネルギー産業",
    "Transportation and storage": "運輸・物流",
    "Afforestation and reforestation": "植林・再植林",
    "Livestock, enteric fermentation, and manure management": "畜産・メタン管理",
    "Energy Demand": "エネルギー需要",
    "Fugitive emissions from fuel (solid, oil and gas)": "燃料からの漏出",
    "Mining and quarrying": "鉱業・採石",
    "Manufacturing industries": "製造業",
    "Chemical industry": "化学産業",
    "Metal production": "金属生産",
    "Construction": "建設",
  };
  return map[s] ?? s;
}

function calcTotalUnits(p: CadProject): number {
  return p.estimations?.reduce((sum, e) => sum + (e.unitCount ?? 0), 0) ?? 0;
}

function getCountries(p: CadProject): string[] {
  return (p.projectLocations ?? [])
    .map((l) => l.country)
    .filter((c, i, arr) => c && arr.indexOf(c) === i);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** プロジェクト名の主要英語キーワードを日本語に変換 */
function projectNameJa(name: string): string {
  const replacements: [RegExp, string][] = [
    [/\bReforestation\b/gi, "再植林"],
    [/\bAfforestation\b/gi, "新規植林"],
    [/\bForest Management\b/gi, "森林管理"],
    [/\bAvoided Deforestation\b/gi, "森林減少回避"],
    [/\bImproved Forest Management\b/gi, "改良森林管理"],
    [/\bWind Energy\b/gi, "風力エネルギー"],
    [/\bSolar Energy\b/gi, "太陽光エネルギー"],
    [/\bRenewable Energy\b/gi, "再生可能エネルギー"],
    [/\bCarbon Emission Reduction\b/gi, "炭素排出削減"],
    [/\bImproved Cookstoves?\b/gi, "改良かまど"],
    [/\bClean Cookstoves?\b/gi, "改良かまど"],
    [/\bMethane\b/gi, "メタン"],
    [/\bLandfill Gas\b/gi, "埋立地ガス"],
    [/\bBiochar\b/gi, "バイオ炭"],
    [/\bDirect Air Capture\b/gi, "直接空気回収"],
    [/\bSoil Carbon\b/gi, "土壌炭素"],
    [/\bWaste Management\b/gi, "廃棄物管理"],
    [/\bWastewater\b/gi, "排水処理"],
    [/\bProject\b/gi, "プロジェクト"],
    [/\bReduction\b/gi, "削減"],
    [/\bGeneration\b/gi, "発電"],
    [/\bPower Plant\b/gi, "発電所"],
    [/\bthrough\b/gi, "による"],
  ];
  let result = name;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ============================================================
// コンポーネント
// ============================================================

type Props = {
  initialData: CadProject[];
  initialQuery: string;
  currentPage: number;
  totalPages: number;
};

export function ProjectSearchList({ initialData, initialQuery, currentPage, totalPages }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("page", "1");
    router.push(`/projects?${params.toString()}`);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams();
    if (initialQuery) params.set("q", initialQuery);
    params.set("page", String(p));
    router.push(`/projects?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* 検索バー */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="プロジェクト名、メソドロジー、国名で検索..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          検索
        </button>
      </form>

      {/* 結果情報 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {totalPages > 0
            ? `${totalPages.toLocaleString()} 件中 ${((currentPage - 1) * 20 + 1).toLocaleString()}〜${Math.min(currentPage * 20, totalPages).toLocaleString()} 件を表示`
            : "結果なし"}
          {initialQuery && <span className="ml-2 text-gray-500">「{initialQuery}」の検索結果</span>}
        </p>
      </div>

      {/* プロジェクトカード一覧 */}
      <div className="space-y-3">
        {initialData.map((p) => {
          const countries = getCountries(p);
          const totalUnits = calcTotalUnits(p);

          return (
            <Link
              key={p.warehouseProjectId}
              href={`/projects/${p.warehouseProjectId}`}
              className="group block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition line-clamp-2">
                    {projectNameJa(p.projectName)}
                  </h3>
                  {p.description && (
                    <p className="mt-1 text-xs text-gray-400 line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant={registryColor(p.currentRegistry)}>
                      {p.currentRegistry}
                    </Badge>
                    <Badge variant={statusColor(p.projectStatus)}>
                      {statusJa(p.projectStatus)}
                    </Badge>
                    {p.methodology && (
                      <Badge variant="gray">{p.methodology}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right flex-shrink-0">
                  {countries.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {countries.join(", ")}
                    </span>
                  )}
                  {totalUnits > 0 && (
                    <span className="text-sm font-bold text-emerald-700">
                      {formatNumber(totalUnits)} tCO2e
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{sectorJa(p.sector)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {initialData.length === 0 && !initialQuery && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          検索キーワードを入力してプロジェクトを検索してください
        </div>
      )}

      {initialData.length === 0 && initialQuery && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          「{initialQuery}」に一致するプロジェクトが見つかりません
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

      {/* データソース表記 */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-[10px] text-gray-400">
          データソース: Climate Action Data Trust (CAD Trust) — Chia Blockchain ベースの分散型カーボンクレジットレジストリ |{" "}
          <a href="https://climateactiondata.org" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">
            climateactiondata.org
          </a>
        </p>
      </div>
    </div>
  );
}
