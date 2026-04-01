"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Treemap,
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

// ── Chord Diagram ────────────────────────────────────────────────
const CHORD_FLOWS: Record<string, number> = {
  "Asia|Japan": 19, "Africa|Japan": 5, "Americas|Japan": 3, "Oceania|Japan": 2, "Europe|Japan": 2,
  "Asia|Singapore": 11, "Africa|Singapore": 8, "Americas|Singapore": 7, "Oceania|Singapore": 2,
  "Americas|Switzerland": 5, "Africa|Switzerland": 7, "Europe|Switzerland": 4, "Asia|Switzerland": 3, "Oceania|Switzerland": 1,
  "Asia|Republic of Korea": 8, "Africa|Republic of Korea": 2, "Americas|Republic of Korea": 1,
  "Africa|Norway": 4, "Asia|Norway": 2,
  "Africa|Sweden": 4, "Asia|Sweden": 1, "Americas|Sweden": 1,
  "Oceania|Australia": 2,
  "Americas|United Arab Emirates": 1, "Africa|Kuwait": 1, "Africa|Liechtenstein": 1, "Africa|Monaco": 1,
};

const CHORD_SOURCES = ["Asia", "Africa", "Americas", "Europe", "Oceania"];
const CHORD_BUYERS = ["Japan", "Singapore", "Switzerland", "Republic of Korea", "Norway", "Sweden", "Australia"];
const CHORD_ALL = [...CHORD_SOURCES, ...CHORD_BUYERS];

const CHORD_COLORS: Record<string, string> = {
  Asia: "#10b981", Africa: "#f59e0b", Americas: "#3b82f6",
  Europe: "#8b5cf6", Oceania: "#06b6d4",
  Japan: "#ef4444", Singapore: "#f97316", Switzerland: "#7c3aed",
  "Republic of Korea": "#0891b2", Norway: "#db2777", Sweden: "#16a34a", Australia: "#ca8a04",
};

function polarToXY(angle: number, r: number): [number, number] {
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

function arcPath(r: number, a1: number, a2: number, sweep = 1): string {
  const [x1, y1] = polarToXY(a1, r);
  const [x2, y2] = polarToXY(a2, r);
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `A${r},${r} 0 ${large} ${sweep} ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

function chordPath(r: number, cs1: number, cs2: number, ct1: number, ct2: number): string {
  const [x1, y1] = polarToXY(cs1, r);
  const [x2, y2] = polarToXY(cs2, r);
  const [x3, y3] = polarToXY(ct1, r);
  const [x4, y4] = polarToXY(ct2, r);
  const la1 = cs2 - cs1 > Math.PI ? 1 : 0;
  const la2 = ct2 - ct1 > Math.PI ? 1 : 0;
  return [
    `M${x1.toFixed(2)},${y1.toFixed(2)}`,
    `A${r},${r} 0 ${la1} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
    `Q0,0 ${x4.toFixed(2)},${y4.toFixed(2)}`,
    `A${r},${r} 0 ${la2} 0 ${x3.toFixed(2)},${y3.toFixed(2)}`,
    `Q0,0 ${x1.toFixed(2)},${y1.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function ChordDiagram() {
  const R = 130, ARC_W = 18, GAP = 0.025;

  // Node totals (source + target separately)
  const nodeTotals: Record<string, number> = {};
  CHORD_ALL.forEach(n => { nodeTotals[n] = 0; });
  Object.entries(CHORD_FLOWS).forEach(([key, count]) => {
    const [src, tgt] = key.split("|");
    if (CHORD_SOURCES.includes(src) && CHORD_BUYERS.includes(tgt)) {
      nodeTotals[src] = (nodeTotals[src] || 0) + count;
      nodeTotals[tgt] = (nodeTotals[tgt] || 0) + count;
    }
  });

  const total = Object.values(nodeTotals).reduce((s, v) => s + v, 0);
  const available = 2 * Math.PI - GAP * CHORD_ALL.length;

  let angle = -Math.PI / 2;
  const nodeArcs: Record<string, { s: number; e: number }> = {};
  CHORD_ALL.forEach(node => {
    const size = (nodeTotals[node] / total) * available;
    nodeArcs[node] = { s: angle, e: angle + size };
    angle += size + GAP;
  });

  // Track chord sub-positions within each node's arc
  const srcPos: Record<string, number> = {};
  const tgtPos: Record<string, number> = {};
  CHORD_ALL.forEach(n => {
    srcPos[n] = nodeArcs[n]?.s ?? 0;
    tgtPos[n] = nodeArcs[n]?.s ?? 0;
  });

  const chords: { path: string; color: string; count: number; src: string; tgt: string }[] = [];
  // Sort flows by count descending so smaller chords render on top
  const sortedFlows = Object.entries(CHORD_FLOWS)
    .filter(([key]) => {
      const [s, t] = key.split("|");
      return CHORD_SOURCES.includes(s) && CHORD_BUYERS.includes(t);
    })
    .sort((a, b) => b[1] - a[1]);

  sortedFlows.forEach(([key, count]) => {
    const [src, tgt] = key.split("|");
    if (!nodeArcs[src] || !nodeArcs[tgt]) return;
    const srcArc = nodeArcs[src].e - nodeArcs[src].s;
    const tgtArc = nodeArcs[tgt].e - nodeArcs[tgt].s;
    const cs1 = srcPos[src];
    const cs2 = cs1 + (count / nodeTotals[src]) * srcArc;
    srcPos[src] = cs2;
    const ct1 = tgtPos[tgt];
    const ct2 = ct1 + (count / nodeTotals[tgt]) * tgtArc;
    tgtPos[tgt] = ct2;
    chords.push({ path: chordPath(R - ARC_W - 2, cs1, cs2, ct1, ct2), color: CHORD_COLORS[src] ?? "#6b7280", count, src, tgt });
  });

  const LABEL_R = R + 28;
  const SVG_SIZE = (R + LABEL_R - R + 50) * 2;

  return (
    <div className="flex flex-col items-center">
      <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`${-SVG_SIZE/2} ${-SVG_SIZE/2} ${SVG_SIZE} ${SVG_SIZE}`}>
        {/* Chords (sorted large→small so small render on top) */}
        {[...chords].reverse().map((c, i) => (
          <path key={i} d={c.path} fill={c.color} opacity={0.28} className="hover:opacity-55 cursor-pointer transition-opacity">
            <title>{`${c.src} → ${c.tgt}: ${c.count}件`}</title>
          </path>
        ))}
        {/* Node arcs */}
        {CHORD_ALL.map(node => {
          const arc = nodeArcs[node];
          if (!arc) return null;
          const [sx, sy] = polarToXY(arc.s, R);
          const pathD = `M${sx.toFixed(2)},${sy.toFixed(2)} ${arcPath(R, arc.s, arc.e)} L${polarToXY(arc.e, R - ARC_W)[0].toFixed(2)},${polarToXY(arc.e, R - ARC_W)[1].toFixed(2)} ${arcPath(R - ARC_W, arc.e, arc.s, 0)} Z`;
          const color = CHORD_COLORS[node] ?? "#6b7280";
          const midAngle = (arc.s + arc.e) / 2;
          const [lx, ly] = polarToXY(midAngle, LABEL_R);
          const isRight = lx > 5;
          const isLeft = lx < -5;
          const anchor = isRight ? "start" : isLeft ? "end" : "middle";
          const isSource = CHORD_SOURCES.includes(node);
          const shortName: Record<string, string> = {
            "Republic of Korea": "Korea",
            "United Arab Emirates": "UAE",
          };
          return (
            <g key={node}>
              <path d={pathD} fill={color} stroke="white" strokeWidth={0.5} opacity={0.9} />
              <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
                fontSize={isSource ? 11 : 10} fontWeight={isSource ? 600 : 400}
                fill={isSource ? "#1f2937" : "#4b5563"} fontFamily="system-ui,sans-serif">
                {shortName[node] ?? node}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {CHORD_SOURCES.map(s => (
          <div key={s} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: CHORD_COLORS[s] }} />
            <span className="text-[10px] text-gray-500">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── JCM Bubble Chart ─────────────────────────────────────────────
const JCM_BUBBLE_DATA = [
  { type: "EE industry",        count: 49, avgKt: 5.56,  totalKt: 272.5,  color: "#10b981" },
  { type: "Solar",              count: 60, avgKt: 3.24,  totalKt: 194.5,  color: "#f59e0b" },
  { type: "EE service",         count: 14, avgKt: 0.40,  totalKt: 5.6,    color: "#3b82f6" },
  { type: "Energy distribution",count: 7,  avgKt: 4.50,  totalKt: 31.5,   color: "#8b5cf6" },
  { type: "Hydro",              count: 5,  avgKt: 18.43, totalKt: 92.1,   color: "#06b6d4" },
  { type: "Agriculture",        count: 3,  avgKt: 162.5, totalKt: 487.4,  color: "#f97316" },
  { type: "EE supply side",     count: 3,  avgKt: 2.47,  totalKt: 7.4,    color: "#84cc16" },
  { type: "Forestry",           count: 2,  avgKt: 177.7, totalKt: 355.4,  color: "#14b8a6" },
  { type: "Landfill gas",       count: 1,  avgKt: 4.07,  totalKt: 4.1,    color: "#ef4444" },
  { type: "Bioenergy",          count: 1,  avgKt: 7.13,  totalKt: 7.1,    color: "#ec4899" },
  { type: "Transport",          count: 2,  avgKt: 0.68,  totalKt: 1.4,    color: "#a78bfa" },
];

// ── PACM Treemap data ─────────────────────────────────────────────
const PACM_TREEMAP_DATA = [
  { name: "Energy",    size: 592,  fill: "#10b981" },
  { name: "Buildings", size: 254,  fill: "#3b82f6" },
  { name: "AFOLU",     size: 136,  fill: "#f59e0b" },
  { name: "Waste",     size: 58,   fill: "#8b5cf6" },
  { name: "Transport", size: 49,   fill: "#06b6d4" },
  { name: "Industry",  size: 33,   fill: "#ef4444" },
];

// ──────────────────────────────────────────────────────────
// リンク正規化
// ──────────────────────────────────────────────────────────
/** jcm.go.jp の URL を安全なページに正規化する。
 *  - /mn-jp/about → /mn-jp/  （about ページは存在しないことが多い）
 *  - /id-jp/projects/1 → /id-jp/projects/  （連番個別ページは不安定）
 *  - /projects/4 → /projects/  （同上）
 */
function normalizeJcmUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("jcm.go.jp")) return url;
    // 末尾の /about を除去
    let path = u.pathname.replace(/\/about\/?$/, "/");
    // 末尾の /projects/{数字} を除去して一覧ページへ
    path = path.replace(/\/projects\/\d+\/?$/, "/projects/");
    // 末尾スラッシュを確保
    if (!path.endsWith("/")) path += "/";
    return u.origin + path;
  } catch {
    return url;
  }
}

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

          {/* 地域間 協力フロー（コードダイアグラム） */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <SectionHeader
              title="地域間 協力フロー"
              sub="ホスト地域 → バイヤー国への二国間協定の流れ（ホバーで詳細）"
            />
            <div className="flex justify-center py-2">
              <ChordDiagram />
            </div>
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
                    <React.Fragment key={i}>
                      <tr
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
                        <tr className="bg-emerald-50/30">
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
                              {normalizeJcmUrl(a.link) && (
                                <div className="sm:col-span-3">
                                  <a href={normalizeJcmUrl(a.link)!} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-emerald-600 underline hover:text-emerald-800">
                                    JCM二国間協定ページ →
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
          {/* JCM プロジェクト分布 バブルチャート */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <SectionHeader
              title="JCMプロジェクト タイプ別分布（年間削減量）"
              sub="バブルサイズ = プロジェクト数 / Y軸 = 平均年間削減量 ktCO₂e"
            />
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={[...JCM_BUBBLE_DATA].sort((a, b) => b.avgKt - a.avgKt)}
                layout="vertical"
                margin={{ left: 16, right: 60, top: 4, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} unit=" kt" />
                <YAxis type="category" dataKey="type" width={130} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as typeof JCM_BUBBLE_DATA[0] | undefined;
                    if (!d) return null;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
                        <p className="font-semibold text-gray-800">{d.type}</p>
                        <p className="text-gray-600">プロジェクト数: <span className="font-bold">{d.count}件</span></p>
                        <p className="text-gray-600">平均年間削減量: <span className="font-bold">{d.avgKt?.toFixed(2) ?? "—"} ktCO₂e/yr</span></p>
                        <p className="text-gray-600">合計年間削減量: <span className="font-bold">{d.totalKt?.toFixed(1) ?? "—"} ktCO₂e/yr</span></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="avgKt" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, formatter: (v: unknown) => typeof v === "number" && isFinite(v) ? `${v.toFixed(1)}kt` : "" }}>
                  {[...JCM_BUBBLE_DATA].sort((a, b) => b.avgKt - a.avgKt).map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
                    <React.Fragment key={j.id}>
                      <tr
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
                        <tr className="bg-blue-50/30">
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
                              {normalizeJcmUrl(j.website) && (
                                <div className="sm:col-span-3">
<a href={normalizeJcmUrl(j.website)!} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-600 underline hover:text-blue-800">
                                    JCMプロジェクト一覧（ホスト国） →
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
          {/* PACM セクター トレーマップ */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <SectionHeader
              title="PACM通知 セクター構成"
              sub={`総通知数 ${priorConsideration.length.toLocaleString()}件 の内訳`}
            />
            <ResponsiveContainer width="100%" height={260}>
              <Treemap
                data={PACM_TREEMAP_DATA}
                dataKey="size"
                aspectRatio={4 / 3}
                content={({ x, y, width, height, name, value, fill }: { x?: number; y?: number; width?: number; height?: number; name?: string; value?: number; fill?: string }) => {
                  const w = width ?? 0;
                  const h = height ?? 0;
                  const showLabel = w > 50 && h > 30;
                  const total = PACM_TREEMAP_DATA.reduce((s, d) => s + d.size, 0);
                  const pct = value ? ((value / total) * 100).toFixed(1) : "0";
                  return (
                    <g>
                      <rect x={x} y={y} width={w} height={h} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
                      {showLabel && (
                        <>
                          <text x={(x ?? 0) + w / 2} y={(y ?? 0) + h / 2 - 6} textAnchor="middle" fill="#fff" fontSize={Math.min(13, w / 7)} fontWeight={600} fontFamily="system-ui">
                            {name}
                          </text>
                          <text x={(x ?? 0) + w / 2} y={(y ?? 0) + h / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={Math.min(11, w / 9)} fontFamily="system-ui">
                            {value?.toLocaleString()}件 ({pct}%)
                          </text>
                        </>
                      )}
                    </g>
                  );
                }}
              >
                {PACM_TREEMAP_DATA.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Treemap>
            </ResponsiveContainer>
          </div>
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
                    <React.Fragment key={i}>
                      <tr
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
                        <tr className="bg-purple-50/30">
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
                    </React.Fragment>
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
