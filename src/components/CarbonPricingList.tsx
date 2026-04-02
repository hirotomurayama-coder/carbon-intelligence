"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { TabGroup } from "@/components/ui/TabGroup";
import { Badge } from "@/components/ui/Badge";

// ── 型 ────────────────────────────────────────────────────────────
type Instrument = {
  id: string;
  name: string | null;
  type: string | null;
  status: string | null;
  jurisdiction: string | null;
  emissionsShare: string | null;
  priceLabel: string | null;
  price2020: number | null;
  price2021: number | null;
  price2022: number | null;
  price2023: number | null;
  price2024: number | null;
  price2025: number | null;
  region: string | null;
  incomeGroup: string | null;
};

type Props = { instruments: Instrument[] };

// ── 定数 ──────────────────────────────────────────────────────────
const STATUS_TABS = ["すべて", "実施中", "検討中・準備中", "廃止"];
const TYPE_OPTIONS = ["すべて", "ETS", "Carbon tax"];
const REGION_OPTIONS = [
  "すべて",
  "Europe & Central Asia",
  "East Asia & Pacific",
  "North America",
  "Latin America & Caribbean",
  "Middle East & North Africa",
  "Sub-Saharan Africa",
];
const REGION_LABEL: Record<string, string> = {
  "Europe & Central Asia": "欧州・中央アジア",
  "East Asia & Pacific": "東アジア・太平洋",
  "North America": "北米",
  "Latin America & Caribbean": "中南米",
  "Middle East & North Africa": "中東・北アフリカ",
  "Sub-Saharan Africa": "サブサハラアフリカ",
};

function statusBadge(status: string | null) {
  switch (status) {
    case "Implemented":   return <Badge variant="emerald">実施中</Badge>;
    case "Under consideration": return <Badge variant="blue">検討中</Badge>;
    case "Under development":   return <Badge variant="indigo">準備中</Badge>;
    case "Abolished":     return <Badge variant="gray">廃止</Badge>;
    default:              return <Badge variant="gray">{status ?? "—"}</Badge>;
  }
}

function typeBadge(type: string | null) {
  if (type === "ETS")          return <Badge variant="indigo">ETS</Badge>;
  if (type === "Carbon tax")   return <Badge variant="amber">炭素税</Badge>;
  return <Badge variant="gray">{type ?? "—"}</Badge>;
}

function priceArrow(p2024: number | null, p2025: number | null) {
  if (!p2024 || !p2025) return null;
  const diff = ((p2025 - p2024) / p2024) * 100;
  if (diff > 0.5)  return <span className="text-emerald-500 text-xs font-bold">▲{diff.toFixed(1)}%</span>;
  if (diff < -0.5) return <span className="text-red-400 text-xs font-bold">▼{Math.abs(diff).toFixed(1)}%</span>;
  return <span className="text-gray-400 text-xs">—</span>;
}

// ── ミニスパークライン ─────────────────────────────────────────────
function Sparkline({ inst }: { inst: Instrument }) {
  const pts = [inst.price2020, inst.price2021, inst.price2022, inst.price2023, inst.price2024, inst.price2025]
    .filter((v): v is number => v !== null);
  if (pts.length < 2) return <span className="text-xs text-gray-300">—</span>;
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  const W = 56, H = 20;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = inst.price2024, prev = inst.price2023;
  const color = last && prev && last > prev ? "#10b981" : last && prev && last < prev ? "#f87171" : "#94a3b8";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-80">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── メインコンポーネント ────────────────────────────────────────────
export function CarbonPricingList({ instruments }: Props) {
  const [statusTab, setStatusTab] = useState("すべて");
  const [typeFilter, setTypeFilter] = useState("すべて");
  const [regionFilter, setRegionFilter] = useState("すべて");
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "price2025" | "jurisdiction">("price2025");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    return instruments.filter((inst) => {
      // ステータスフィルタ
      if (statusTab === "実施中" && inst.status !== "Implemented") return false;
      if (statusTab === "検討中・準備中" && inst.status !== "Under consideration" && inst.status !== "Under development") return false;
      if (statusTab === "廃止" && inst.status !== "Abolished") return false;
      // 種別
      if (typeFilter !== "すべて" && inst.type !== typeFilter) return false;
      // 地域
      if (regionFilter !== "すべて" && inst.region !== regionFilter) return false;
      // キーワード
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (
          !inst.name?.toLowerCase().includes(kw) &&
          !inst.jurisdiction?.toLowerCase().includes(kw)
        ) return false;
      }
      return true;
    }).sort((a, b) => {
      let va: number | string | null, vb: number | string | null;
      if (sortBy === "price2025") { va = a.price2025; vb = b.price2025; }
      else if (sortBy === "jurisdiction") { va = a.jurisdiction; vb = b.jurisdiction; }
      else { va = a.name; vb = b.name; }
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
      return sortAsc
        ? String(va).localeCompare(String(vb), "ja")
        : String(vb).localeCompare(String(va), "ja");
    });
  }, [instruments, statusTab, typeFilter, regionFilter, keyword, sortBy, sortAsc]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(col !== "price2025"); }
  }
  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-gray-300">↕</span>;
    return <span className="text-emerald-500">{sortAsc ? "↑" : "↓"}</span>;
  }

  return (
    <div className="space-y-4">
      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-3">
        <TabGroup tabs={STATUS_TABS} activeTab={statusTab} onChange={setStatusTab} />
        <div className="flex gap-2 ml-auto flex-wrap">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-sm focus:outline-none"
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o} value={o}>{o === "すべて" ? "種別: すべて" : o === "ETS" ? "ETS" : "炭素税"}</option>
            ))}
          </select>
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-sm focus:outline-none"
          >
            <option value="すべて">地域: すべて</option>
            {REGION_OPTIONS.slice(1).map(o => (
              <option key={o} value={o}>{REGION_LABEL[o] ?? o}</option>
            ))}
          </select>
          <div className="w-56">
            <SearchInput value={keyword} onChange={setKeyword} placeholder="制度名・管轄を検索..." />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">{filtered.length} 件 / 全{instruments.length}件</p>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th
                className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                onClick={() => toggleSort("name")}
              >
                制度名 <SortIcon col="name" />
              </th>
              <th
                className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                onClick={() => toggleSort("jurisdiction")}
              >
                管轄 <SortIcon col="jurisdiction" />
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500">種別</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500">ステータス</th>
              <th
                className="cursor-pointer whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                onClick={() => toggleSort("price2025")}
              >
                2025価格(US$) <SortIcon col="price2025" />
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-gray-500">前年比</th>
              <th className="whitespace-nowrap px-4 py-3 text-center text-[11px] font-semibold text-gray-500">推移</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  該当する制度が見つかりません
                </td>
              </tr>
            ) : filtered.map((inst) => (
              <tr key={inst.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 leading-tight">{inst.name ?? "—"}</div>
                  {inst.emissionsShare && (
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-xs">{inst.emissionsShare}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{inst.jurisdiction ?? "—"}</td>
                <td className="px-4 py-3">{typeBadge(inst.type)}</td>
                <td className="px-4 py-3">{statusBadge(inst.status)}</td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-900">
                  {inst.price2025 != null ? `$${inst.price2025.toFixed(2)}` : inst.priceLabel ? (
                    <span className="text-xs text-gray-400">{inst.priceLabel.slice(0, 15)}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right">{priceArrow(inst.price2024, inst.price2025)}</td>
                <td className="px-4 py-3 flex justify-center">
                  <Sparkline inst={inst} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-300 mt-2">
        出典: World Bank Carbon Pricing Dashboard, {" "}
        <a href="https://carbonpricingdashboard.worldbank.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">
          carbonpricingdashboard.worldbank.org
        </a>{" "}
        — Data last updated August 28, 2025
      </p>
    </div>
  );
}
