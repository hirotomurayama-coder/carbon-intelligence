export const dynamic = "force-dynamic";
export const maxDuration = 30;

import Link from "next/link";
import { getInsights, getPriceTrends } from "@/lib/wordpress";
import type { InsightCategory, PriceTrend } from "@/types";
import a6Raw from "@/data/article6-pipeline.json";
import vrodRaw from "@/data/vrod-stats.json";  // imported for attribution only

// ── Static data ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const a6Summary = (a6Raw as any).summary as Record<string, number>;
// vrodRaw is imported but only used for attribution — tree-shake unused
void vrodRaw;

// ── 直近価格推移 折れ線チャート (server-side SVG) ───────────────
interface PricePoint { date: string; priceJpy: number }

function buildNormalizedPts(history: PricePoint[], W: number, H: number, daysBack = 90): string {
  if (!history || history.length < 2) return "";
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const filtered = history
    .filter((h) => h.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  // Fall back to last 12 points if not enough in window
  const pts = filtered.length >= 3 ? filtered : history.slice(-12).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return "";
  const prices = pts.map((h) => h.priceJpy);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  return pts.map((h, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - ((h.priceJpy - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

interface RecentChartProps {
  markets: (PriceTrend & { priceHistory?: PricePoint[] })[];
}

function RecentPriceTrendChart({ markets }: RecentChartProps) {
  const W = 300, H = 32;
  // Show 4 key markets with distinct colors
  const KEY_IDS = ["eu-ets", "jcredit-forest", "vol-redd-plus", "vol-blue-carbon"];
  const LINE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a78bfa"];
  const LINE_LABELS = ["EU ETS", "J-クレ", "REDD+", "ブルーC"];

  const selected = KEY_IDS
    .map((id, ci) => ({ m: markets.find((t) => t.marketId === id), color: LINE_COLORS[ci], label: LINE_LABELS[ci] }))
    .filter((x): x is { m: PriceTrend & { priceHistory?: PricePoint[] }; color: string; label: string } => !!x.m);

  const hasData = selected.some((x) => (x.m.priceHistory ?? []).length >= 2);

  if (!hasData) return null;

  return (
    <div className="flex items-end gap-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
        {/* Zero line */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#374151" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />
        {selected.map(({ m, color }) => {
          const pts = buildNormalizedPts(m.priceHistory ?? [], W, H);
          if (!pts) return null;
          return (
            <polyline
              key={m.id}
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex flex-col gap-1 pb-1 flex-shrink-0">
        {selected.map(({ color, label, m }) => {
          const h = m.priceHistory ?? [];
          const recent = h.slice(-1)[0];
          const prev = h.slice(-2, -1)[0];
          const pct = recent && prev && prev.priceJpy
            ? ((recent.priceJpy - prev.priceJpy) / prev.priceJpy * 100).toFixed(1)
            : null;
          return (
            <div key={label} className="flex items-center gap-1">
              <span className="h-px w-3 flex-shrink-0" style={{ background: color, height: "2px" }} />
              <span className="text-[9px] text-gray-400 whitespace-nowrap">{label}</span>
              {pct && (
                <span className={`text-[9px] font-semibold ${parseFloat(pct) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {parseFloat(pct) >= 0 ? "+" : ""}{pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Category config ──────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  InsightCategory,
  { color: string; bg: string; dot: string }
> = {
  政策:         { color: "text-indigo-700",  bg: "bg-indigo-50",  dot: "bg-indigo-400" },
  市場:         { color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-400" },
  技術:         { color: "text-blue-700",    bg: "bg-blue-50",    dot: "bg-blue-400" },
  特別記事:     { color: "text-amber-700",   bg: "bg-amber-50",   dot: "bg-amber-400" },
  メルマガ:     { color: "text-gray-600",    bg: "bg-gray-100",   dot: "bg-gray-400" },
  週次ブリーフ: { color: "text-teal-700",   bg: "bg-teal-50",    dot: "bg-teal-400" },
};
const DEFAULT_CAT = { color: "text-gray-500", bg: "bg-gray-100", dot: "bg-gray-300" };
function getCat(cat: InsightCategory | null) {
  return cat ? (CATEGORY_CONFIG[cat] ?? DEFAULT_CAT) : DEFAULT_CAT;
}

// ── Market helpers ───────────────────────────────────────────────
const MARKET_LABELS: Record<string, string> = {
  "eu-ets":                "EU ETS",
  "jcredit-forest":        "J-クレジット（森林）",
  "jcredit-energy-saving": "J-クレジット（省エネ）",
  "jcredit-agri-biochar":  "J-クレジット（農業）",
  "vol-redd-plus":         "REDD+（VCS）",
  "vol-biochar":           "バイオ炭（VCS）",
  "vol-dac":               "DAC（直接空気回収）",
  "vol-blue-carbon":       "ブルーカーボン",
};
const KEY_MARKETS = [
  "eu-ets", "jcredit-forest", "jcredit-energy-saving", "jcredit-agri-biochar",
  "vol-redd-plus", "vol-biochar", "vol-dac", "vol-blue-carbon",
];

function trendColor(dir: string | null) {
  if (dir === "up")   return "text-emerald-400";
  if (dir === "down") return "text-red-400";
  return "text-gray-500";
}
function trendArrow(dir: string | null) {
  if (dir === "up")   return "▲";
  if (dir === "down") return "▼";
  return "—";
}
function formatJpy(v: number | null): string {
  if (v === null) return "—";
  return `¥${Math.round(v).toLocaleString()}`;
}

// ── SVG Sparkline ────────────────────────────────────────────────
function buildSparklinePts(history: { date: string; priceJpy: number }[]): string {
  if (!history || history.length < 2) return "";
  const prices = history.map((h) => h.priceJpy);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 64, H = 24;
  return prices.map((v, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

// ── Page ────────────────────────────────────────────────────────
export default async function Home() {
  const [insights, priceTrends] = await Promise.all([
    getInsights(),
    getPriceTrends(),
  ]);

  const sorted    = [...insights].sort((a, b) => b.date.localeCompare(a.date));
  const recent    = sorted.slice(0, 9);
  const latestDate = sorted[0]?.date ?? null;

  const marketPrices = KEY_MARKETS
    .map((id) => priceTrends.find((t) => t.marketId === id))
    .filter((t): t is PriceTrend => !!t);

  const catCounts: Partial<Record<InsightCategory, number>> = {};
  for (const ins of insights) {
    if (ins.category) catCounts[ins.category] = (catCounts[ins.category] ?? 0) + 1;
  }

  const a6Stats = [
    { label: "二国間協定",     value: a6Summary.bilateralAgreements ?? 108, unit: "カ国", color: "text-sky-500",    bg: "bg-sky-950/50",    href: "/article6" },
    { label: "JCMプロジェクト", value: a6Summary.jcmProjects ?? 147,       unit: "件",   color: "text-indigo-400", bg: "bg-indigo-950/50", href: "/article6?tab=jcm" },
    { label: "PACM通知",       value: a6Summary.cooperativeApproaches ?? 41, unit: "件", color: "text-violet-400", bg: "bg-violet-950/50", href: "/article6?tab=pacm" },
    { label: "DNA登録国",      value: a6Summary.dna ?? 121,               unit: "カ国", color: "text-teal-400",   bg: "bg-teal-950/50",   href: "/article6" },
  ];

  return (
    <div className="flex h-full flex-col gap-3 min-h-0">

      {/* ══════════════════════════════════════════
          STATUS BAR — dark, with VROD mini chart
      ══════════════════════════════════════════ */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-gray-900 px-4 py-3 lg:flex-nowrap lg:px-5">

        {/* Brand + LIVE */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Platform</p>
            <p className="text-sm font-bold text-white leading-tight">Carbon Intelligence</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold tracking-widest text-emerald-400">LIVE</span>
          </div>
        </div>

        <div className="hidden h-8 w-px flex-shrink-0 bg-gray-700 lg:block" />

        {/* Recent price trend chart */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="flex-shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">
              直近価格推移（3ヶ月）
            </p>
            <div className="mt-1">
              <RecentPriceTrendChart markets={marketPrices as (PriceTrend & { priceHistory?: PricePoint[] })[]} />
            </div>
          </div>
        </div>

        <div className="hidden h-8 w-px flex-shrink-0 bg-gray-700 lg:block" />

        {/* Last update */}
        {latestDate && (
          <div className="flex-shrink-0 text-right">
            <p className="text-[9px] font-medium uppercase tracking-wide text-gray-600">最終更新</p>
            <p className="text-xs font-semibold text-gray-300">{latestDate}</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          MAIN GRID
      ══════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col gap-3 overflow-auto lg:flex-row lg:overflow-hidden">

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-3 lg:w-[54%] lg:flex-shrink-0">

          {/* ── 市場価格モニター ── */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-emerald-500">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.94" />
                  </svg>
                </div>
                <h2 className="text-[11px] font-bold tracking-wide text-gray-800">カーボン市場価格モニター</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold text-gray-500">{marketPrices.length}市場</span>
              </div>
              <Link href="/analysis" className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 transition hover:bg-emerald-100">
                全市場 →
              </Link>
            </div>

            <div className="grid grid-cols-1 divide-y divide-gray-50 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:[&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-gray-50">
              {marketPrices.length > 0 ? marketPrices.map((t) => {
                const pts = buildSparklinePts(
                  (t as PriceTrend & { priceHistory?: { date: string; priceJpy: number }[] }).priceHistory ?? []
                );
                const isUp = t.trendDirection === "up";
                const isDn = t.trendDirection === "down";
                const sparkColor = isUp ? "#10b981" : isDn ? "#f87171" : "#94a3b8";
                const label = (t.marketId ? MARKET_LABELS[t.marketId] : null) ?? t.title;

                return (
                  <Link
                    key={t.id}
                    href={`/analysis/${t.marketId}`}
                    className="group flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50/70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-medium leading-tight text-gray-400">{label}</p>
                      <p className="mt-0.5 text-sm font-bold text-gray-900">{formatJpy(t.latestPriceJpy)}</p>
                      {t.trendPercentage !== null && (
                        <p className={`text-[11px] font-bold ${trendColor(t.trendDirection)}`}>
                          {trendArrow(t.trendDirection)} {Math.abs(t.trendPercentage).toFixed(1)}%
                        </p>
                      )}
                    </div>
                    {pts ? (
                      <svg width={64} height={24} viewBox="0 0 64 24" className="flex-shrink-0 opacity-70 transition group-hover:opacity-100">
                        <defs>
                          <linearGradient id={`sg-${t.marketId}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={sparkColor} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={sparkColor} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <polygon points={`0,24 ${pts} 64,24`} fill={`url(#sg-${t.marketId})`} />
                        <polyline points={pts} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <div className="h-6 w-16 flex-shrink-0 rounded bg-gray-50" />
                    )}
                  </Link>
                );
              }) : (
                <div className="col-span-2 py-10 text-center text-xs text-gray-400">価格データ未登録</div>
              )}
            </div>
          </div>

          {/* ── パリ協定6条トラッカー ── */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-700/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-blue-600">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </div>
                <h2 className="text-[11px] font-bold tracking-wide text-gray-200">パリ協定6条トラッカー</h2>
              </div>
              <Link href="/article6" className="rounded-full bg-blue-900/50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300 transition hover:bg-blue-900">
                詳細 →
              </Link>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-gray-700/40 sm:grid-cols-4 sm:divide-y-0">
              {a6Stats.map(({ label, value, unit, color, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="group flex flex-col items-center justify-center py-5 transition hover:bg-gray-800/60"
                >
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-500">{unit}</p>
                  <p className="mt-1.5 text-[10px] font-medium text-gray-400 text-center leading-tight px-2">{label}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 lg:overflow-hidden">

          {/* ── 最新インサイト（compact） ── */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:flex-1">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-rose-500">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h2 className="text-[11px] font-bold tracking-wide text-gray-800">最新インサイト</h2>
              </div>
              <div className="flex items-center gap-3">
                {(["政策", "市場", "技術"] as InsightCategory[]).map((cat) => {
                  const cfg = getCat(cat);
                  return (
                    <span key={cat} className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      <span className="text-[10px] font-medium text-gray-400">{cat} {catCounts[cat] ?? 0}</span>
                    </span>
                  );
                })}
                <Link href="/insights" className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-100">
                  全件 →
                </Link>
              </div>
            </div>

            <div className="divide-y divide-gray-50 overflow-y-auto">
              {recent.map((ins, idx) => {
                const cfg = getCat(ins.category);
                return (
                  <Link
                    key={ins.id}
                    href={`/insights/${ins.id}`}
                    className="group flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-gray-50/70"
                  >
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.dot}`} />
                    <p className="flex-1 truncate text-xs font-medium leading-snug text-gray-800 transition-colors group-hover:text-emerald-700">
                      {ins.title}
                    </p>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {idx < 2 && (
                        <span className="rounded bg-rose-500 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white">
                          NEW
                        </span>
                      )}
                      {ins.category && (
                        <span className={`hidden rounded px-1.5 py-px text-[10px] font-semibold sm:inline ${cfg.color} ${cfg.bg}`}>
                          {ins.category}
                        </span>
                      )}
                      <span className="hidden text-[10px] text-gray-300 sm:inline">{ins.date}</span>
                    </div>
                  </Link>
                );
              })}
              {recent.length === 0 && (
                <p className="py-10 text-center text-xs text-gray-400">インサイトがまだ登録されていません</p>
              )}
            </div>
          </div>

          {/* ── クイックアクセス ── */}
          <div className="flex-shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <h3 className="text-[11px] font-bold tracking-wide text-gray-700">クイックアクセス</h3>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-gray-50">
              {([
                {
                  href: "/methodologies", label: "メソドロジー", sub: "算定方法論 DB", accent: "emerald",
                  icon: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
                },
                {
                  href: "/companies", label: "企業データベース", sub: "市場参加企業一覧", accent: "blue",
                  icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
                },
                {
                  href: "/statistics", label: "ボランタリー統計", sub: "VROD 市場統計", accent: "purple",
                  icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
                },
                {
                  href: "/roadmap", label: "政策ロードマップ", sub: "規制・政策動向", accent: "amber",
                  icon: "M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z",
                },
              ] as const).map(({ href, label, sub, accent, icon }) => {
                const iconColors: Record<string, string> = {
                  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
                  blue:    "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
                  purple:  "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
                  amber:   "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
                };
                return (
                  <Link key={href} href={href} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50/70">
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition ${iconColors[accent]}`}>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">{label}</p>
                      <p className="text-[10px] text-gray-400">{sub}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
