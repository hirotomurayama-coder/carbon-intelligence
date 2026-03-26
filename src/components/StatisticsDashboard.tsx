"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, Area, AreaChart,
} from "recharts";
import statsData from "@/data/vrod-stats.json";

// ============================================================
// 定数
// ============================================================

const COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1",
];

const REGISTRY_COLORS: Record<string, string> = {
  "Verra": "#10b981",
  "Gold Standard": "#f59e0b",
  "ACR": "#3b82f6",
  "CAR": "#8b5cf6",
  "ART": "#06b6d4",
};

// ============================================================
// ヘルパー
// ============================================================

function formatNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatFull(n: number): string {
  return n.toLocaleString();
}

// ============================================================
// KPI カード
// ============================================================

function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================

type Tab = "overview" | "issuance" | "retirement" | "methodology";

const ALL_REGISTRIES = Object.keys(statsData.registryProjects);
const YEAR_RANGE = { min: 2005, max: 2025 };

// 国名の日本語マッピング
const COUNTRY_JA: Record<string, string> = {
  "US": "アメリカ", "MX": "メキシコ", "CA": "カナダ", "India": "インド", "China": "中国",
  "Brazil": "ブラジル", "Indonesia": "インドネシア", "Peru": "ペルー", "Colombia": "コロンビア",
  "Vietnam": "ベトナム", "Thailand": "タイ", "Kenya": "ケニア", "Turkey": "トルコ",
  "Chile": "チリ", "Argentina": "アルゼンチン", "Bangladesh": "バングラデシュ",
  "Cambodia": "カンボジア", "Philippines": "フィリピン", "Myanmar": "ミャンマー",
  "South Africa": "南アフリカ", "Japan": "日本", "FR": "フランス", "TH": "タイ",
};

export function StatisticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedRegistries, setSelectedRegistries] = useState<Set<string>>(new Set(ALL_REGISTRIES));
  const [yearFrom, setYearFrom] = useState(YEAR_RANGE.min);
  const [yearTo, setYearTo] = useState(YEAR_RANGE.max);
  const [searchQuery, setSearchQuery] = useState("");

  const data = statsData;

  // 年別データ（フィルタ適用）
  const yearlyFiltered = useMemo(
    () => data.yearlyData.filter((y) => y.year >= yearFrom && y.year <= yearTo),
    [data, yearFrom, yearTo]
  );

  // レジストリフィルタ適用のKPI
  const filteredKpi = useMemo(() => {
    let issued = 0;
    let retired = 0;
    for (const y of yearlyFiltered) {
      const ibr = y.issued_by_registry as Record<string, number>;
      const rbr = y.retired_by_registry as Record<string, number>;
      for (const r of selectedRegistries) {
        issued += ibr[r] ?? 0;
        retired += rbr[r] ?? 0;
      }
    }
    return { issued, retired };
  }, [yearlyFiltered, selectedRegistries]);

  // レジストリ別プロジェクト（フィルタ適用）
  const registryPieData = useMemo(
    () => Object.entries(data.registryProjects)
      .filter(([name]) => selectedRegistries.has(name))
      .map(([name, value]) => ({ name, value })),
    [data, selectedRegistries]
  );

  // リタイア理由（円グラフ用）
  const retirementPieData = useMemo(
    () => Object.entries(data.retirementReasons).map(([name, value]) => ({ name, value: value as number })),
    [data]
  );

  // メソドロジー検索
  const filteredMethodologies = useMemo(() => {
    if (!searchQuery) return data.topMethodologies;
    const q = searchQuery.toLowerCase();
    return data.topMethodologies.filter(
      (m) => m.name.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // リタイアー検索
  const filteredRetirees = useMemo(() => {
    if (!searchQuery) return data.topRetirees;
    const q = searchQuery.toLowerCase();
    return data.topRetirees.filter(
      (r) => r.name.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // レジストリトグル
  const toggleRegistry = (r: string) => {
    setSelectedRegistries((prev) => {
      const next = new Set(prev);
      if (next.has(r)) { if (next.size > 1) next.delete(r); }
      else next.add(r);
      return next;
    });
  };

  const resetFilters = () => {
    setSelectedRegistries(new Set(ALL_REGISTRIES));
    setYearFrom(YEAR_RANGE.min);
    setYearTo(YEAR_RANGE.max);
    setSearchQuery("");
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "概要" },
    { key: "issuance", label: "発行分析" },
    { key: "retirement", label: "リタイア分析" },
    { key: "methodology", label: "メソドロジー" },
  ];

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">クレジット統計</h1>
        <p className="mt-1 text-sm text-gray-400">
          UC Berkeley VROD データに基づくボランタリーカーボンクレジット市場の統計分析
        </p>
      </div>

      {/* フィルタバー */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* レジストリフィルタ */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-400 mr-1">レジストリ:</span>
            {ALL_REGISTRIES.map((r) => (
              <button
                key={r}
                onClick={() => toggleRegistry(r)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  selectedRegistries.has(r)
                    ? "text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
                style={selectedRegistries.has(r) ? { backgroundColor: REGISTRY_COLORS[r] ?? "#6b7280" } : {}}
              >
                {r}
              </button>
            ))}
          </div>

          {/* 期間フィルタ */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400">期間:</span>
            <select
              value={yearFrom}
              onChange={(e) => setYearFrom(Number(e.target.value))}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
            >
              {Array.from({ length: 21 }, (_, i) => 2005 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400">〜</span>
            <select
              value={yearTo}
              onChange={(e) => setYearTo(Number(e.target.value))}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
            >
              {Array.from({ length: 21 }, (_, i) => 2005 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* 検索 */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="メソドロジー・企業名を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 placeholder:text-gray-300 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
            />
          </div>

          {/* リセット */}
          <button
            onClick={resetFilters}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition"
          >
            リセット
          </button>
        </div>
      </div>

      {/* KPI（フィルタ反映） */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="プロジェクト総数"
          value={formatFull(data.totalProjects)}
          color="text-emerald-700"
        />
        <KpiCard
          label={`発行量 (${yearFrom}-${yearTo})`}
          value={formatNum(filteredKpi.issued)}
          sub="tCO2e"
          color="text-blue-700"
        />
        <KpiCard
          label={`リタイア (${yearFrom}-${yearTo})`}
          value={formatNum(filteredKpi.retired)}
          sub="tCO2e"
          color="text-amber-700"
        />
        <KpiCard
          label="メソドロジー数"
          value={formatFull(filteredMethodologies.length)}
          sub={searchQuery ? `"${searchQuery}" で絞込` : `全410種類`}
          color="text-purple-700"
        />
      </div>

      {/* タブ */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      {activeTab === "overview" && <OverviewTab data={data} yearlyData={yearlyFiltered} registryPie={registryPieData} />}
      {activeTab === "issuance" && <IssuanceTab data={data} yearlyData={yearlyFiltered} />}
      {activeTab === "retirement" && <RetirementTab data={data} yearlyData={yearlyFiltered} retirementPie={retirementPieData} filteredRetirees={filteredRetirees} searchQuery={searchQuery} />}
      {activeTab === "methodology" && <MethodologyTab data={data} filteredMethodologies={filteredMethodologies} searchQuery={searchQuery} />}

      {/* データソース */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-[10px] text-gray-400">
          データソース: {data.dataSource} ({data.dataDate}) |{" "}
          <a href="https://gspp.berkeley.edu/research-and-impact/centers/cepp/projects/berkeley-carbon-trading-project/offsets-database"
            target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">
            UC Berkeley Carbon Trading Project
          </a>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// 概要タブ
// ============================================================

function OverviewTab({ data, yearlyData, registryPie }: {
  data: typeof statsData;
  yearlyData: typeof statsData.yearlyData;
  registryPie: { name: string; value: number }[];
}) {
  return (
    <div className="space-y-6">
      {/* 年別発行量・リタイア量 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">年別クレジット発行量 / リタイア量</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNum(v)} />
              <Tooltip formatter={(v: unknown) => [formatFull(Number(v)) + " tCO2e"]} />
              <Legend />
              <Area type="monotone" dataKey="issued" name="発行量" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
              <Area type="monotone" dataKey="retired" name="リタイア" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* レジストリ別プロジェクト数 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">レジストリ別プロジェクト数</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={registryPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {registryPie.map((_, i) => (
                    <Cell key={i} fill={Object.values(REGISTRY_COLORS)[i] ?? COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => formatFull(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* プロジェクトタイプ TOP10 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">プロジェクトタイプ TOP10</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProjectTypes.slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={115} />
                <Tooltip formatter={(v: unknown) => formatFull(Number(v))} />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 国別プロジェクト TOP15 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">プロジェクト実施国 TOP15</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.topCountries.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => formatFull(Number(v))} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 発行分析タブ
// ============================================================

function IssuanceTab({ data, yearlyData }: {
  data: typeof statsData;
  yearlyData: typeof statsData.yearlyData;
}) {
  const registries = Object.keys(data.registryIssuances);

  return (
    <div className="space-y-6">
      {/* レジストリ別累計発行量 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {registries.map((r) => (
          <KpiCard
            key={r}
            label={r}
            value={formatNum((data.registryIssuances as Record<string, number>)[r])}
            sub="tCO2e 発行"
            color="text-blue-700"
          />
        ))}
      </div>

      {/* 年別レジストリ別発行量 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">年別レジストリ別発行量</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNum(v)} />
              <Tooltip formatter={(v: unknown) => [formatFull(Number(v)) + " tCO2e"]} />
              <Legend />
              {registries.map((r, i) => (
                <Bar
                  key={r}
                  dataKey={`issued_by_registry.${r}`}
                  name={r}
                  stackId="a"
                  fill={REGISTRY_COLORS[r] ?? COLORS[i]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 発行量 vs リタイア量（需給ギャップ） */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">発行量 vs リタイア量（需給ギャップ）</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNum(v)} />
              <Tooltip formatter={(v: unknown) => [formatFull(Number(v)) + " tCO2e"]} />
              <Legend />
              <Line type="monotone" dataKey="issued" name="発行量" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="retired" name="リタイア" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// リタイア分析タブ
// ============================================================

function RetirementTab({ data, yearlyData, retirementPie, filteredRetirees, searchQuery }: {
  data: typeof statsData;
  yearlyData: typeof statsData.yearlyData;
  retirementPie: { name: string; value: number }[];
  filteredRetirees: typeof statsData.topRetirees;
  searchQuery: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* リタイア理由 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">リタイア理由の内訳</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={retirementPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {retirementPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => formatFull(Number(v)) + " tCO2e"} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* レジストリ別リタイア量 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">レジストリ別累計リタイア</h3>
          <div className="space-y-3">
            {Object.entries(data.registryRetirements).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([name, val]) => {
              const v = val as number;
              const maxVal = Math.max(...Object.values(data.registryRetirements).map(x => x as number));
              return (
                <div key={name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{name}</span>
                    <span className="font-medium text-gray-900">{formatNum(v)} tCO2e</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(v / maxVal) * 100}%`,
                        backgroundColor: REGISTRY_COLORS[name] ?? "#6b7280",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* トップリタイアー（企業ランキング） */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            クレジット無効化（リタイア）企業ランキング
            {searchQuery && <span className="ml-2 text-xs font-normal text-gray-400">「{searchQuery}」で絞込中</span>}
          </h3>
          <span className="text-xs text-gray-400">{filteredRetirees.length} 件</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-left text-xs font-medium text-gray-400">#</th>
                <th className="py-2 text-left text-xs font-medium text-gray-400">企業・組織</th>
                <th className="py-2 text-right text-xs font-medium text-gray-400">リタイア量 (tCO2e)</th>
                <th className="py-2 text-right text-xs font-medium text-gray-400">シェア</th>
              </tr>
            </thead>
            <tbody>
              {filteredRetirees.slice(0, 20).map((r, i) => (
                <tr key={r.name} className="border-b border-gray-50">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="py-2 text-right text-gray-700">{formatFull(r.credits)}</td>
                  <td className="py-2 text-right text-gray-400">
                    {((r.credits / data.totalRetired) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// メソドロジータブ
// ============================================================

function MethodologyTab({ data, filteredMethodologies, searchQuery }: {
  data: typeof statsData;
  filteredMethodologies: typeof statsData.topMethodologies;
  searchQuery: string;
}) {
  return (
    <div className="space-y-6">
      {/* メソドロジー TOP20 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            メソドロジー別プロジェクト数
            {searchQuery && <span className="ml-2 text-xs font-normal text-gray-400">「{searchQuery}」で絞込中</span>}
          </h3>
          <span className="text-xs text-gray-400">{filteredMethodologies.length} 件</span>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredMethodologies.slice(0, 20)} layout="vertical" margin={{ left: 200 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={195} />
              <Tooltip formatter={(v: unknown) => formatFull(Number(v))} />
              <Bar dataKey="projects" name="プロジェクト数" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* メソドロジー一覧テーブル */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">メソドロジー一覧（プロジェクト数順）</h3>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200">
                <th className="py-2 text-left text-xs font-medium text-gray-400">#</th>
                <th className="py-2 text-left text-xs font-medium text-gray-400">メソドロジー</th>
                <th className="py-2 text-right text-xs font-medium text-gray-400">プロジェクト数</th>
                <th className="py-2 text-right text-xs font-medium text-gray-400">累計クレジット</th>
              </tr>
            </thead>
            <tbody>
              {filteredMethodologies.map((m, i) => (
                <tr key={m.name} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 font-medium text-gray-900">{m.name}</td>
                  <td className="py-2 text-right text-gray-700">{formatFull(m.projects)}</td>
                  <td className="py-2 text-right text-gray-400">{m.credits > 0 ? formatNum(m.credits) : "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
