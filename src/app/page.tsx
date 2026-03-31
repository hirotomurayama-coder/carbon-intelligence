export const dynamic = "force-dynamic";
export const maxDuration = 30;

import Link from "next/link";
import { getInsights, getPriceTrends } from "@/lib/wordpress";
import type { InsightCategory, PriceTrend } from "@/types";

// ─── カテゴリ定義 ───────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  InsightCategory,
  { color: string; border: string; bg: string; dot: string }
> = {
  政策:     { color: "text-indigo-700",  border: "border-indigo-400",  bg: "bg-indigo-50",  dot: "bg-indigo-400"  },
  市場:     { color: "text-emerald-700", border: "border-emerald-400", bg: "bg-emerald-50", dot: "bg-emerald-400" },
  技術:     { color: "text-blue-700",    border: "border-blue-400",    bg: "bg-blue-50",    dot: "bg-blue-400"    },
  特別記事: { color: "text-amber-700",   border: "border-amber-400",   bg: "bg-amber-50",   dot: "bg-amber-400"   },
  メルマガ: { color: "text-gray-600",    border: "border-gray-300",    bg: "bg-gray-50",    dot: "bg-gray-400"    },
  週次ブリーフ: { color: "text-teal-700", border: "border-teal-400",  bg: "bg-teal-50",    dot: "bg-teal-400"    },
};
const DEFAULT_CATEGORY_CONFIG = { color: "text-gray-500", border: "border-gray-200", bg: "bg-gray-50", dot: "bg-gray-300" };

function getCategoryConfig(cat: InsightCategory | null) {
  return cat ? (CATEGORY_CONFIG[cat] ?? DEFAULT_CATEGORY_CONFIG) : DEFAULT_CATEGORY_CONFIG;
}

// ─── 価格トレンドカラー ──────────────────────────────────────
function trendColor(dir: string | null) {
  if (dir === "up")   return "text-emerald-500";
  if (dir === "down") return "text-red-400";
  return "text-gray-400";
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

// ─── 表示する市場 ────────────────────────────────────────────
const KEY_MARKETS = [
  "eu-ets",
  "jcredit-forest",
  "jcredit-energy-saving",
  "jcredit-agri-biochar",
  "vol-redd-plus",
  "vol-biochar",
  "vol-dac",
  "vol-blue-carbon",
];

// ─── ページ本体 ──────────────────────────────────────────────
export default async function Home() {
  const [insights, priceTrends] = await Promise.all([
    getInsights(),
    getPriceTrends(),
  ]);

  const sorted = [...insights].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.slice(0, 12);
  const latestDate = sorted[0]?.date ?? null;

  const marketPrices = KEY_MARKETS
    .map((id) => priceTrends.find((t) => t.marketId === id))
    .filter((t): t is PriceTrend => !!t);

  // カテゴリ別件数
  const catCounts: Partial<Record<InsightCategory, number>> = {};
  for (const ins of insights) {
    if (ins.category) catCounts[ins.category] = (catCounts[ins.category] ?? 0) + 1;
  }

  return (
    <div className="flex h-full flex-col gap-0">

      {/* ── ステータスバー ── */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Intelligence Feed</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">Carbon Intelligence</p>
          </div>
          <div className="h-8 w-px bg-gray-100" />
          {/* カテゴリ別統計 */}
          {(["政策", "市場", "技術", "週次ブリーフ"] as InsightCategory[]).map((cat) => {
            const cfg = getCategoryConfig(cat);
            return (
              <Link
                key={cat}
                href={`/insights?category=${encodeURIComponent(cat)}`}
                className="group flex items-center gap-1.5"
              >
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <span className="text-xs font-medium text-gray-500 group-hover:text-gray-800">{cat}</span>
                <span className={`text-xs font-bold ${cfg.color}`}>{catCounts[cat] ?? 0}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {latestDate && (
            <div className="text-right">
              <p className="text-[10px] text-gray-400">最終更新</p>
              <p className="text-xs font-semibold text-gray-700">{latestDate}</p>
            </div>
          )}
          <Link
            href="/insights"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            すべて見る
          </Link>
        </div>
      </div>

      {/* ── メインコンテンツ ── */}
      <div className="flex gap-5 items-start">

        {/* ── 左: インサイトフィード ── */}
        <div className="min-w-0 flex-1">
          {/* セクションヘッダー */}
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold text-gray-900 tracking-wide">最新インサイト</h2>
          </div>

          {recent.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {recent.map((ins, idx) => {
                const cfg = getCategoryConfig(ins.category);
                const isNew = idx < 3;
                return (
                  <Link
                    key={ins.id}
                    href={`/insights/${ins.id}`}
                    className={`group flex items-stretch gap-0 transition hover:bg-gray-50/80 ${
                      idx !== 0 ? "border-t border-gray-100" : ""
                    }`}
                  >
                    {/* カテゴリカラーバー */}
                    <span className={`w-1 flex-shrink-0 ${cfg.border} border-l-4 rounded-l-sm`} />

                    <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5">
                      {/* カテゴリ + NEW */}
                      <div className="flex w-20 flex-shrink-0 flex-col items-start gap-1 pt-0.5">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}
                        >
                          {ins.category ?? "—"}
                        </span>
                        {isNew && (
                          <span className="inline-block rounded bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                            NEW
                          </span>
                        )}
                      </div>

                      {/* テキスト */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-1 leading-snug group-hover:text-emerald-700 transition-colors">
                          {ins.title}
                        </p>
                        {ins.summary && (
                          <p className="mt-0.5 text-xs text-gray-400 line-clamp-1 leading-relaxed">
                            {ins.summary}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-300">
                          <span>{ins.date}</span>
                          {ins.readingTime && <><span>·</span><span>{ins.readingTime} min</span></>}
                          {ins.series && <><span>·</span><span className="text-gray-400">{ins.series}</span></>}
                        </div>
                      </div>
                    </div>

                    {/* 矢印 */}
                    <div className="flex items-center pr-4 text-gray-200 group-hover:text-emerald-400 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-16 text-center">
              <p className="text-sm text-gray-400">インサイトがまだ登録されていません</p>
            </div>
          )}
        </div>

        {/* ── 右: パネル群 ── */}
        <div className="w-64 flex-shrink-0 space-y-4">

          {/* 価格モニター */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <h3 className="text-xs font-bold text-gray-700 tracking-wide">カーボンクレジット価格</h3>
              </div>
              <Link href="/analysis" className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700">
                詳細 →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {marketPrices.length > 0 ? (
                marketPrices.map((t) => (
                  <Link
                    key={t.id}
                    href={`/analysis/${t.marketId}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-gray-50"
                  >
                    <p className="text-[10px] font-medium text-gray-500 leading-tight line-clamp-2 flex-1">{t.title}</p>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-bold text-gray-900">{formatJpy(t.latestPriceJpy)}</p>
                      {t.trendPercentage !== null && (
                        <p className={`text-[10px] font-semibold ${trendColor(t.trendDirection)}`}>
                          {trendArrow(t.trendDirection)} {Math.abs(t.trendPercentage).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <p className="px-4 py-5 text-center text-xs text-gray-400">価格データ未登録</p>
              )}
            </div>
          </div>

          {/* クイックアクセス */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
              <h3 className="text-xs font-bold text-gray-700 tracking-wide">データベース</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { href: "/methodologies", label: "メソドロジー", sub: "算定方法論データベース", icon: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" },
                { href: "/companies", label: "企業データベース", sub: "市場参加企業一覧", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
                { href: "/article6", label: "パリ協定6条", sub: "二国間協定・JCMパイプライン", icon: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" },
                { href: "/statistics", label: "統計データ", sub: "VROD市場統計・分析", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
              ].map(({ href, label, sub, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-gray-50"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 group-hover:text-emerald-700">{label}</p>
                    <p className="text-[10px] text-gray-400">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
