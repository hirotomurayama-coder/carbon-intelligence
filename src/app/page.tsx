export const dynamic = "force-dynamic";
export const maxDuration = 30;

import Link from "next/link";
import {
  getMethodologies,
  getCompanies,
  getInsights,
  getPriceTrends,
} from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { InsightCategory, RegistryName } from "@/types";

function registryBadge(registry: RegistryName) {
  switch (registry) {
    case "Verra": return "emerald" as const;
    case "Gold Standard": return "amber" as const;
    case "Puro.earth": return "cyan" as const;
    default: return "gray" as const;
  }
}

function insightBadge(cat: InsightCategory | null) {
  if (cat === null) return "gray" as const;
  switch (cat) {
    case "政策": return "indigo" as const;
    case "市場": return "emerald" as const;
    case "技術": return "blue" as const;
    case "特別記事": return "amber" as const;
    case "メルマガ": return "slate" as const;
    case "週次ブリーフ": return "emerald" as const;
    default: return "gray" as const;
  }
}

function formatJpy(v: number | null): string {
  if (v === null) return "—";
  return `\u00a5${Math.round(v).toLocaleString()}`;
}

export default async function Home() {
  const [methodologies, companies, insights, priceTrends] = await Promise.all([
    getMethodologies(),
    getCompanies(),
    getInsights(),
    getPriceTrends(),
  ]);

  // KPI
  const scoredItems = methodologies.filter(
    (m): m is typeof m & { reliabilityScore: number } => m.reliabilityScore !== null
  );
  const avgScore = scoredItems.length > 0
    ? Math.round(scoredItems.reduce((sum, m) => sum + m.reliabilityScore, 0) / scoredItems.length)
    : null;
  const articlesTotal = companies.reduce((sum, c) => sum + c.relatedArticles.length, 0);

  // データ
  const sortedInsights = [...insights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const featuredCompanies = [...companies]
    .filter((c) => c.relatedArticles.length > 0)
    .sort((a, b) => b.relatedArticles.length - a.relatedArticles.length)
    .slice(0, 5);
  const recentMethodologies = [...methodologies]
    .filter((m) => m.syncedAt)
    .sort((a, b) => (b.syncedAt ?? "").localeCompare(a.syncedAt ?? ""))
    .slice(0, 4);

  // 主要市場の価格
  const keyMarkets = ["jcredit-energy-saving", "jcredit-forest", "eu-ets", "vol-biochar"];
  const marketPrices = keyMarkets
    .map((id) => priceTrends.find((t) => t.marketId === id))
    .filter(Boolean);

  return (
    <div className="space-y-8">
      {/* ── KPI サマリーカード ── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="メソドロジー" value={methodologies.length} unit="件" href="/methodologies" />
        <KpiCard label="登録企業" value={companies.length} unit="社" href="/companies" />
        <KpiCard label="インサイト" value={insights.length} unit="件" href="/insights" />
        <KpiCard label="関連記事" value={articlesTotal} unit="件" href="/companies" />
        <KpiCard label="信頼性スコア" value={avgScore ?? "—"} unit={avgScore ? "点" : ""} href="/methodologies" />
      </section>

      {/* ── 主要市場の価格 ── */}
      {marketPrices.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">主要市場の価格</h2>
            <Link href="/analysis" className="text-sm text-emerald-600 hover:text-emerald-700">
              全市場を見る →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {marketPrices.map((t) => t && (
              <Link
                key={t.id}
                href={`/analysis/${t.marketId}`}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200"
              >
                <p className="text-xs text-gray-400 truncate">{t.title}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{formatJpy(t.latestPriceJpy)}</p>
                <p className="text-xs text-gray-400">/{t.priceUnit ?? "tCO2e"}</p>
                {t.trendPercentage !== null && (
                  <span className={`mt-1 inline-block text-xs font-medium ${
                    t.trendDirection === "up" ? "text-emerald-600" : t.trendDirection === "down" ? "text-red-500" : "text-gray-400"
                  }`}>
                    {t.trendDirection === "up" ? "+" : ""}{t.trendPercentage.toFixed(1)}%
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 2カラム: インサイト + 注目企業 ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 最新インサイト */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">最新インサイト</h2>
            <Link href="/insights" className="text-sm text-emerald-600 hover:text-emerald-700">
              すべて見る →
            </Link>
          </div>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {sortedInsights.map((ins) => (
              <Link
                key={ins.id}
                href={`/insights/${ins.id}`}
                className="block p-4 transition hover:bg-gray-50"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={insightBadge(ins.category)}>
                    {ins.category ?? "未分類"}
                  </Badge>
                  <span className="text-[10px] text-gray-400">{ins.date}</span>
                  {ins.readingTime && (
                    <span className="text-[10px] text-gray-300">{ins.readingTime}分</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 line-clamp-1">{ins.title}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* 注目企業 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">注目企業</h2>
            <Link href="/companies" className="text-sm text-emerald-600 hover:text-emerald-700">
              全{companies.length}社 →
            </Link>
          </div>
          <div className="space-y-2">
            {featuredCompanies.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-emerald-200"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
                  {c.name?.[0] ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">{c.headquarters ?? "—"}</span>
                    {c.relatedArticles.length > 0 && (
                      <Badge variant="slate">{c.relatedArticles.length}記事</Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ── 最近追加されたメソドロジー ── */}
      {recentMethodologies.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">最近追加されたメソドロジー</h2>
            <Link href="/methodologies" className="text-sm text-emerald-600 hover:text-emerald-700">
              全{methodologies.length}件 →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentMethodologies.map((m) => (
              <Link
                key={m.id}
                href={`/methodologies/${m.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200"
              >
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {m.registry && <Badge variant={registryBadge(m.registry)}>{m.registry}</Badge>}
                  {m.creditType && (
                    <Badge variant={m.creditType === "除去系" ? "indigo" : "blue"}>{m.creditType}</Badge>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 line-clamp-2">
                  {m.titleJa ?? m.title}
                </p>
                {m.aiSummary && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-2">{m.aiSummary}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({ label, value, unit, href }: { label: string; value: number | string; unit: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
    >
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-gray-400">{unit}</span>}
      </p>
    </Link>
  );
}
