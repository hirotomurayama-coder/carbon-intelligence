"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import rawData from "@/data/article6-pipeline.json";

// ──────────────────────────────────────────────────────────
// 型
// ──────────────────────────────────────────────────────────
type Agreement = {
  title: string | null;
  hostCountry: string | null;
  region: string | null;
  buyingCountry: string | null;
  date: string | null;
  status: string | null;
  link: string | null;
  associatedProjects: number;
};

type JcmProject = {
  number: number;
  id: string;
  title: string | null;
  titleJa?: string | null;
  hostCountry: string | null;
  type: string | null;
  subType: string | null;
  ktCo2ePerYear: number | null;
  implementer: string | null;
  website: string | null;
  status: string | null;
  registrationDate: string | null;
};

type PriorItem = {
  hostParty: string;
  sector: string | null;
  category: string | null;
  activityType: string | null;
  type: string | null;
  region: string | null;
  tCo2ePerYear: number;
};

// ──────────────────────────────────────────────────────────
// カラーパレット
// ──────────────────────────────────────────────────────────
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316", "#84cc16"];

// ──────────────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-gray-500">{sub}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────────────────
export function Article6Dashboard() {
  const { summary, analytics, bilateralAgreements, jcmProjects, priorConsideration } = rawData as {
    summary: Record<string, number | string>;
    analytics: {
      regionAgreements: { region: string; count: number }[];
      topBuyers: { country: string; count: number }[];
      pacmSectors: { sector: string; count: number }[];
      pacmRegions: { region: string; count: number }[];
      jcmTypes: { type: string; count: number }[];
      topJcmHosts: { country: string; count: number }[];
    };
    bilateralAgreements: Agreement[];
    jcmProjects: JcmProject[];
    priorConsideration: PriorItem[];
  };

  const [tab, setTab] = useState<"overview" | "agreements" | "jcm" | "pacm">("overview");

  // ── 展開行 ──
  const [expandedAg, setExpandedAg] = useState<number | null>(null);
  const [expandedJcm, setExpandedJcm] = useState<string | null>(null);
  const [expandedPacm, setExpandedPacm] = useState<number | null>(null);

  // ── Agreements フィルタ ──
  const [agBuyer, setAgBuyer] = useState("");
  const [agHost, setAgHost] = useState("");

  const filteredAgreements = useMemo(() =>
    bilateralAgreements.filter((a) => {
      const matchBuyer = !agBuyer || a.buyingCountry?.toLowerCase().includes(agBuyer.toLowerCase());
      const matchHost = !agHost || a.hostCountry?.toLowerCase().includes(agHost.toLowerCase());
      return matchBuyer && matchHost;
    }),
    [bilateralAgreements, agBuyer, agHost]
  );

  // ── JCM フィルタ ──
  const [jcmType, setJcmType] = useState("");
  const [jcmHost, setJcmHost] = useState("");

  const filteredJcm = useMemo(() =>
    jcmProjects.filter((j) => {
      const matchType = !jcmType || j.type?.toLowerCase().includes(jcmType.toLowerCase());
      const matchHost = !jcmHost || j.hostCountry?.toLowerCase().includes(jcmHost.toLowerCase());
      return matchType && matchHost;
    }),
    [jcmProjects, jcmType, jcmHost]
  );

  // ── PACM フィルタ ──
  const [pcSector, setPcSector] = useState("");
  const [pcRegion, setPcRegion] = useState("");

  const filteredPacm = useMemo(() =>
    priorConsideration.filter((p) => {
      const matchSector = !pcSector || p.sector?.toLowerCase().includes(pcSector.toLowerCase());
      const matchRegion = !pcRegion || p.region?.toLowerCase().includes(pcRegion.toLowerCase());
      return matchSector && matchRegion;
    }),
    [priorConsideration, pcSector, pcRegion]
  );

  const pacmSectorsFiltered = useMemo(() => {
    const m: Record<string, number> = {};
    filteredPacm.forEach((p) => { const k = p.sector || "Other"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([sector, count]) => ({ sector, count }));
  }, [filteredPacm]);

  const tabs = [
    { id: "overview", label: "概要" },
    { id: "agreements", label: `二国間協定 (${bilateralAgreements.length})` },
    { id: "jcm", label: `JCM (${jcmProjects.length})` },
    { id: "pacm", label: `PACM通知 (${priorConsideration.length})` },
  ] as const;

  // KPIカードクリック設定
  const kpiCards = [
    {
      label: "二国間協定",
      value: Number(summary.bilateralAgreements),
      sub: "国際炭素市場協定",
      tab: "agreements" as const,
      color: "emerald",
      desc: "パリ協定6条2項に基づく二国間協定。クレジットの国際移転（ITMO）を可能にする政府間合意。日本はJCMを通じて29か国と締結。",
    },
    {
      label: "JCMプロジェクト",
      value: Number(summary.jcmProjects),
      sub: "二国間クレジット制度",
      tab: "jcm" as const,
      color: "blue",
      desc: "日本政府が推進するJCM（Joint Crediting Mechanism）に基づく排出削減・吸収プロジェクト。省エネ・再エネ・森林保全などが対象。",
    },
    {
      label: "PACM通知",
      value: Number(summary.priorConsiderationTotal),
      sub: "PA + PoA",
      tab: "pacm" as const,
      color: "purple",
      desc: "Article 6.4メカニズムへの先行考慮（Prior Consideration）通知。CDM移行プロジェクトおよび新規プロジェクトの両方を含む。",
    },
    {
      label: "CDM移行申請",
      value: Number(summary.cdmTransitionRequests),
      sub: "Article 6.4へ",
      tab: null,
      color: "amber",
      desc: "京都議定書CDMから新しいパリ協定6.4条メカニズムへの移行を申請したプロジェクト数。",
    },
    {
      label: "承認済（HP）",
      value: Number(summary.cdmApprovedByHostParty),
      sub: "ホスト国承認",
      tab: null,
      color: "gray",
      desc: "ホスト国（排出削減活動の実施国）が承認したCDMプロジェクト数。",
    },
    {
      label: "DNA登録国",
      value: Number(summary.dna),
      sub: "Designated National Authorities",
      tab: null,
      color: "gray",
      desc: "Article 6.4メカニズムに参加するための国内承認機関（DNA）を登録した国の数。",
    },
  ];

  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">パリ協定6条 パイプライン</h1>
          <p className="mt-1 text-sm text-gray-500">国際炭素市場活動のトラッキング（UNEP-CCC データ）</p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <p>データ基準日</p>
          <p className="font-medium text-gray-600">{String(summary.updatedAt)}</p>
        </div>
      </div>

      {/* KPIグリッド（クリックで説明展開 / タブ切替） */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((card) => {
          const isOpen = expandedKpi === card.label;
          const colorMap: Record<string, string> = {
            emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
            blue:    "border-blue-200 bg-blue-50 text-blue-700",
            purple:  "border-purple-200 bg-purple-50 text-purple-700",
            amber:   "border-amber-200 bg-amber-50 text-amber-700",
            gray:    "border-gray-200 bg-white text-gray-700",
          };
          const cls = colorMap[card.color] ?? colorMap.gray;
          return (
            <div key={card.label} className="col-span-1">
              <button
                onClick={() => {
                  if (card.tab) { setTab(card.tab); setExpandedKpi(null); }
                  else { setExpandedKpi(isOpen ? null : card.label); }
                }}
                className={`w-full rounded-xl border p-4 text-left transition hover:shadow-md ${cls} ${card.tab ? "cursor-pointer" : ""}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{card.label}</p>
                <p className="mt-1 text-2xl font-bold">{card.value.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] opacity-60">{card.sub}</p>
                {card.tab && (
                  <p className="mt-1.5 text-[10px] font-medium opacity-70">→ 詳細を見る</p>
                )}
              </button>
              {/* 非tabカードの説明展開 */}
              {!card.tab && isOpen && (
                <div className="mt-1 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-sm">
                  {card.desc}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* タブナビ */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium transition border-b-2 ${
                tab === t.id
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: 概要 ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 買い手国別協定数 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <SectionHeader title="買い手国別 二国間協定数" sub="クレジット購入側の国" />
              <ResponsiveContainer width="100%" height={analytics.topBuyers.length * 30 + 20}>
                <BarChart data={analytics.topBuyers} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="country" width={110} tick={{ fontSize: 11 }} interval={0} />
                  <Tooltip formatter={(v) => [`${v}件`, "協定数"]} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 地域別協定数 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <SectionHeader title="ホスト国地域別 二国間協定数" sub="クレジット供給側の地域分布" />
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.regionAgreements}
                    cx="50%" cy="50%" outerRadius={100}
                    dataKey="count" nameKey="region" name="region"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {analytics.regionAgreements.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}件`, "協定数"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* JCM ホスト国 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <SectionHeader title="JCMプロジェクト ホスト国" sub="日本のJCM実施先" />
              <ResponsiveContainer width="100%" height={analytics.topJcmHosts.length * 30 + 20}>
                <BarChart data={analytics.topJcmHosts} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="country" width={110} tick={{ fontSize: 11 }} interval={0} />
                  <Tooltip formatter={(v) => [`${v}件`, "プロジェクト数"]} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* PACM セクター別 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <SectionHeader title="PACM通知 セクター別内訳" sub="Article 6.4 先行通知" />
              <ResponsiveContainer width="100%" height={analytics.pacmSectors.slice(0, 10).length * 30 + 20}>
                <BarChart data={analytics.pacmSectors.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="sector" width={100} tick={{ fontSize: 11 }} interval={0} />
                  <Tooltip formatter={(v) => [`${v}件`, "通知数"]} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* JCM タイプ別 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <SectionHeader title="JCMプロジェクト タイプ別分布" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.jcmTypes} margin={{ left: 8, right: 16, bottom: 60 }}>
                <XAxis dataKey="type" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}件`, "プロジェクト数"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {analytics.jcmTypes.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-xs text-gray-400">
            本ページは{" "}
            <a href="https://article6pipeline.unepccc.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
              UNEP Copenhagen Climate Centre — Article 6 Pipeline Database
            </a>{" "}
            の公開データを独自に集計・加工・可視化したものです。表示内容は当社分析であり、UNEP-CCCの公式見解ではありません。データ基準日: {String(summary.updatedAt)}
          </p>
        </div>
      )}

      {/* ── Tab: 二国間協定 ── */}
      {tab === "agreements" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input type="text" value={agBuyer} onChange={(e) => setAgBuyer(e.target.value)}
              placeholder="買い手国で絞り込み（例: Japan）"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-56" />
            <input type="text" value={agHost} onChange={(e) => setAgHost(e.target.value)}
              placeholder="ホスト国で絞り込み"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-56" />
            <span className="self-center text-sm text-gray-400">{filteredAgreements.length} 件</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-500">ホスト国</th>
                    <th className="px-4 py-3 font-medium text-gray-500">買い手国</th>
                    <th className="px-4 py-3 font-medium text-gray-500">締結日</th>
                    <th className="px-4 py-3 font-medium text-gray-500">ステータス</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-center">PJ数</th>
                    <th className="px-4 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAgreements.map((a, i) => (
                    <>
                      <tr
                        key={i}
                        onClick={() => setExpandedAg(expandedAg === i ? null : i)}
                        className={`cursor-pointer transition ${
                          expandedAg === i ? "bg-emerald-50/40" : a.buyingCountry === "Japan" ? "bg-blue-50/20 hover:bg-blue-50/40" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{a.hostCountry || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {a.buyingCountry === "Japan" ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">JCM</span>
                              {a.buyingCountry}
                            </span>
                          ) : a.buyingCountry || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{a.date?.slice(0, 10) || "—"}</td>
                        <td className="px-4 py-3">
                          {a.status && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              a.status === "MoU" ? "bg-amber-100 text-amber-700" :
                              a.status === "Binding" ? "bg-emerald-100 text-emerald-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>{a.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{a.associatedProjects || "—"}</td>
                        <td className="px-4 py-3 text-gray-300 text-xs">
                          {expandedAg === i ? "▲" : "▼"}
                        </td>
                      </tr>
                      {expandedAg === i && (
                        <tr key={`exp-${i}`} className="bg-emerald-50/30">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                              {a.title && (
                                <div className="sm:col-span-3">
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase">協定名称</p>
                                  <p className="text-sm text-gray-700 mt-0.5">{a.title}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">地域</p>
                                <p className="text-sm text-gray-700 mt-0.5">{a.region || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">ステータス</p>
                                <p className="text-sm text-gray-700 mt-0.5">{a.status || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">関連PJ数</p>
                                <p className="text-sm font-bold text-gray-900 mt-0.5">{a.associatedProjects || "0"}件</p>
                              </div>
                              {a.link && (
                                <div className="sm:col-span-3">
                                  <a href={a.link} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-emerald-600 underline hover:text-emerald-800">
                                    公式ドキュメントを確認 →
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: JCM ── */}
      {tab === "jcm" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            JCM（二国間クレジット制度）は日本政府が推進する途上国向けの技術移転・排出削減メカニズム。全プロジェクトの買い手国は日本。
          </div>
          <div className="flex flex-wrap gap-3">
            <input type="text" value={jcmHost} onChange={(e) => setJcmHost(e.target.value)}
              placeholder="ホスト国で絞り込み"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56" />
            <input type="text" value={jcmType} onChange={(e) => setJcmType(e.target.value)}
              placeholder="タイプで絞り込み（例: Solar）"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56" />
            <span className="self-center text-sm text-gray-400">{filteredJcm.length} 件</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-500 w-12">ID</th>
                    <th className="px-4 py-3 font-medium text-gray-500">プロジェクト名</th>
                    <th className="px-4 py-3 font-medium text-gray-500">ホスト国</th>
                    <th className="px-4 py-3 font-medium text-gray-500">タイプ</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-right">ktCO₂e/yr</th>
                    <th className="px-4 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredJcm.map((j) => (
                    <>
                      <tr
                        key={j.id}
                        onClick={() => setExpandedJcm(expandedJcm === j.id ? null : j.id)}
                        className={`cursor-pointer transition ${expandedJcm === j.id ? "bg-blue-50/40" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{j.id}</td>
                        <td className="px-4 py-3">
                          {/* 日本語タイトル（あれば優先表示） */}
                          <div className="font-medium text-gray-900 leading-snug">
                            {j.titleJa
                              ? <>{j.titleJa}</>
                              : j.title
                                ? (j.title.length > 60 ? j.title.slice(0, 60) + "…" : j.title)
                                : "—"}
                          </div>
                          {j.titleJa && j.title && (
                            <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{j.title}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{j.hostCountry || "—"}</td>
                        <td className="px-4 py-3">
                          {j.type && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{j.type}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                          {j.ktCo2ePerYear != null ? j.ktCo2ePerYear.toFixed(3) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs">
                          {expandedJcm === j.id ? "▲" : "▼"}
                        </td>
                      </tr>
                      {expandedJcm === j.id && (
                        <tr key={`exp-${j.id}`} className="bg-blue-50/30">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                              <div className="sm:col-span-3">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">英語プロジェクト名</p>
                                <p className="text-xs text-gray-600 mt-0.5">{j.title || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">プロジェクトタイプ</p>
                                <p className="text-sm text-gray-700 mt-0.5">{j.type || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">サブタイプ</p>
                                <p className="text-sm text-gray-700 mt-0.5">{j.subType || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">ステータス</p>
                                <p className="text-sm text-gray-700 mt-0.5">{j.status || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">年間削減量</p>
                                <p className="text-sm font-bold text-blue-700 mt-0.5">
                                  {j.ktCo2ePerYear != null ? `${j.ktCo2ePerYear.toFixed(3)} ktCO₂e/yr` : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">登録日</p>
                                <p className="text-sm text-gray-700 mt-0.5">{j.registrationDate?.slice(0, 10) || "—"}</p>
                              </div>
                              {j.implementer && (
                                <div className="sm:col-span-3">
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase">実施機関</p>
                                  <p className="text-xs text-gray-600 mt-0.5">{j.implementer}</p>
                                </div>
                              )}
                              {j.website && (
                                <div className="sm:col-span-3">
                                  <a href={j.website} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-600 underline hover:text-blue-800">
                                    プロジェクトサイト →
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: PACM ── */}
      {tab === "pacm" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input type="text" value={pcSector} onChange={(e) => setPcSector(e.target.value)}
              placeholder="セクターで絞り込み（例: Energy）"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-56" />
            <input type="text" value={pcRegion} onChange={(e) => setPcRegion(e.target.value)}
              placeholder="地域で絞り込み（例: Asia）"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-48" />
            <span className="self-center text-sm text-gray-400">{filteredPacm.length} 件</span>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <SectionHeader title="セクター別分布" sub="フィルタ結果に連動" />
            <ResponsiveContainer width="100%" height={pacmSectorsFiltered.slice(0, 10).length * 30 + 20}>
              <BarChart data={pacmSectorsFiltered.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="sector" width={100} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip formatter={(v) => [`${v}件`, "通知数"]} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-500">ホスト国</th>
                    <th className="px-4 py-3 font-medium text-gray-500">地域</th>
                    <th className="px-4 py-3 font-medium text-gray-500">種別</th>
                    <th className="px-4 py-3 font-medium text-gray-500">セクター</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-right">tCO₂e/yr</th>
                    <th className="px-4 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPacm.slice(0, 200).map((p, i) => (
                    <>
                      <tr
                        key={i}
                        onClick={() => setExpandedPacm(expandedPacm === i ? null : i)}
                        className={`cursor-pointer transition ${expandedPacm === i ? "bg-purple-50/40" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{p.hostParty}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{p.region || "—"}</td>
                        <td className="px-4 py-3">
                          {p.type && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              p.type === "PA" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                            }`}>{p.type}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.sector || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                          {p.tCo2ePerYear > 0 ? p.tCo2ePerYear.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs">
                          {expandedPacm === i ? "▲" : "▼"}
                        </td>
                      </tr>
                      {expandedPacm === i && (
                        <tr key={`exp-${i}`} className="bg-purple-50/30">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">カテゴリ</p>
                                <p className="text-sm text-gray-700 mt-0.5">{p.category || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">活動タイプ</p>
                                <p className="text-sm text-gray-700 mt-0.5">{p.activityType || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">種別</p>
                                <p className="text-sm text-gray-700 mt-0.5">{p.type || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">年間削減量</p>
                                <p className="text-sm font-bold text-purple-700 mt-0.5">
                                  {p.tCo2ePerYear > 0 ? `${p.tCo2ePerYear.toLocaleString()} tCO₂e/yr` : "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredPacm.length > 200 && (
              <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
                残り {filteredPacm.length - 200} 件 — 絞り込みで件数を減らしてください
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
