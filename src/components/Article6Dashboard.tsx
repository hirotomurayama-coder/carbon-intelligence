"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
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
function KpiCard({ label, value, sub, accent = false }: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-emerald-700" : "text-gray-900"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

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

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Article 6 パイプライン</h1>
            <p className="mt-1 text-sm text-gray-500">
              パリ協定第6条に基づく国際炭素市場活動のトラッキング
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>データ: UNEP-CCC</span>
            <span>·</span>
            <span>更新: {String(summary.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* KPI グリッド */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="二国間協定" value={Number(summary.bilateralAgreements)} accent />
        <KpiCard label="JCMプロジェクト" value={Number(summary.jcmProjects)} accent />
        <KpiCard label="PACM通知" value={Number(summary.priorConsiderationTotal)} sub="PA + PoA" />
        <KpiCard label="CDM移行申請" value={Number(summary.cdmTransitionRequests)} sub="Article 6.4へ" />
        <KpiCard label="承認済（HP）" value={Number(summary.cdmApprovedByHostParty)} sub="ホスト国承認" />
        <KpiCard label="DNA登録国" value={Number(summary.dna)} sub="Designated National Authorities" />
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
          {/* 上段: 買い手国 + 地域別協定 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 買い手国別協定数 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <SectionHeader title="買い手国別 二国間協定数" sub="クレジット購入側の国" />
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.topBuyers} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="country" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}件`, "協定数"]} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 地域別協定数 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <SectionHeader title="ホスト国地域別 二国間協定数" sub="クレジット供給側の地域分布" />
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={analytics.regionAgreements}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="count"
                    nameKey="region"
                    name="region"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
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

          {/* 下段: JCM ホスト国 + PACM セクター */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* JCM ホスト国 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <SectionHeader title="JCMプロジェクト ホスト国 Top15" sub="日本のJCM実施先" />
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.topJcmHosts} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="country" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}件`, "プロジェクト数"]} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* PACM セクター別 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <SectionHeader title="PACM通知 セクター別内訳" sub="Article 6.4 先行通知" />
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.pacmSectors.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="sector" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}件`, "通知数"]} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* JCM タイプ別 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <SectionHeader title="JCMプロジェクト タイプ別分布" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.jcmTypes} margin={{ left: 8, right: 16 }}>
                <XAxis dataKey="type" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
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

          {/* 注記 */}
          <p className="text-xs text-gray-400">
            本ページは <a href="https://article6pipeline.unepccc.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">UNEP Copenhagen Climate Centre — Article 6 Pipeline Database</a> の公開データを独自に集計・加工・可視化したものです。表示内容は当社分析であり、UNEP-CCCの公式見解ではありません。データ基準日: {String(summary.updatedAt)}
          </p>
        </div>
      )}

      {/* ── Tab: 二国間協定 ── */}
      {tab === "agreements" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={agBuyer}
              onChange={(e) => setAgBuyer(e.target.value)}
              placeholder="買い手国で絞り込み（例: Japan）"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-56"
            />
            <input
              type="text"
              value={agHost}
              onChange={(e) => setAgHost(e.target.value)}
              placeholder="ホスト国で絞り込み"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-56"
            />
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
                    <th className="px-4 py-3 font-medium text-gray-500 text-center">プロジェクト数</th>
                    <th className="px-4 py-3 font-medium text-gray-500">リンク</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAgreements.map((a, i) => (
                    <tr key={i} className={`hover:bg-gray-50 ${a.buyingCountry === "Japan" ? "bg-blue-50/30" : ""}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.hostCountry || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.buyingCountry === "Japan" ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">JCM</span>
                            {a.buyingCountry}
                          </span>
                        ) : a.buyingCountry || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.date?.slice(0, 10) || "—"}</td>
                      <td className="px-4 py-3">
                        {a.status && (
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                            a.status === "MoU" ? "bg-amber-100 text-amber-700" :
                            a.status === "Binding" ? "bg-emerald-100 text-emerald-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>{a.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{a.associatedProjects || "—"}</td>
                      <td className="px-4 py-3">
                        {a.link ? (
                          <a href={a.link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-emerald-600 underline hover:text-emerald-800">
                            詳細
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
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
            JCM（二国間クレジット制度）は日本政府が推進する途上国向けの技術移転・排出削減メカニズム。
            全プロジェクトの買い手国は日本。
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={jcmHost}
              onChange={(e) => setJcmHost(e.target.value)}
              placeholder="ホスト国で絞り込み"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56"
            />
            <input
              type="text"
              value={jcmType}
              onChange={(e) => setJcmType(e.target.value)}
              placeholder="タイプで絞り込み（例: Solar）"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56"
            />
            <span className="self-center text-sm text-gray-400">{filteredJcm.length} 件</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-500 w-12">#</th>
                    <th className="px-4 py-3 font-medium text-gray-500">プロジェクト名</th>
                    <th className="px-4 py-3 font-medium text-gray-500">ホスト国</th>
                    <th className="px-4 py-3 font-medium text-gray-500">タイプ</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-right">ktCO₂e/yr</th>
                    <th className="px-4 py-3 font-medium text-gray-500">ステータス</th>
                    <th className="px-4 py-3 font-medium text-gray-500">登録日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredJcm.map((j) => (
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{j.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 leading-snug">
                          {j.title ? (j.title.length > 60 ? j.title.slice(0, 60) + "…" : j.title) : "—"}
                        </div>
                        {j.implementer && (
                          <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{j.implementer}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{j.hostCountry || "—"}</td>
                      <td className="px-4 py-3">
                        {j.type && (
                          <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {j.type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                        {j.ktCo2ePerYear != null ? j.ktCo2ePerYear.toFixed(3) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {j.status && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            j.status.includes("registered") ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                          }`}>{j.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{j.registrationDate?.slice(0, 10) || "—"}</td>
                    </tr>
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
            <input
              type="text"
              value={pcSector}
              onChange={(e) => setPcSector(e.target.value)}
              placeholder="セクターで絞り込み（例: Energy）"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-56"
            />
            <input
              type="text"
              value={pcRegion}
              onChange={(e) => setPcRegion(e.target.value)}
              placeholder="地域で絞り込み（例: Asia）"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-48"
            />
            <span className="self-center text-sm text-gray-400">{filteredPacm.length} 件</span>
          </div>

          {/* セクター別グラフ（フィルタ連動） */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <SectionHeader title="セクター別分布" sub="フィルタ結果に連動" />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pacmSectorsFiltered.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="sector" width={90} tick={{ fontSize: 11 }} />
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
                    <th className="px-4 py-3 font-medium text-gray-500">活動タイプ</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-right">tCO₂e/yr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPacm.slice(0, 200).map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.hostParty}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.region || "—"}</td>
                      <td className="px-4 py-3">
                        {p.type && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.type === "PA" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          }`}>{p.type}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.sector || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.activityType || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                        {p.tCo2ePerYear > 0 ? p.tCo2ePerYear.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredPacm.length > 200 && (
              <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
                {filteredPacm.length - 200} 件以上を絞り込みで絞り込んでください
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
