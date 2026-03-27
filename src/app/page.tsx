export const dynamic = "force-dynamic";
export const maxDuration = 30;

import Link from "next/link";
import {
  getMethodologies,
  getCompanies,
  getInsights,
  getPriceTrends,
} from "@/lib/wordpress";
import { getProjectStats } from "@/lib/cad-trust";
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
  const [methodologies, companies, insights, priceTrends, projectStats] = await Promise.all([
    getMethodologies(),
    getCompanies(),
    getInsights(),
    getPriceTrends(),
    getProjectStats().catch(() => ({ totalProjects: 0 })),
  ]);

  const scoredItems = methodologies.filter(
    (m): m is typeof m & { reliabilityScore: number } => m.reliabilityScore !== null
  );
  const avgScore = scoredItems.length > 0
    ? Math.round(scoredItems.reduce((sum, m) => sum + m.reliabilityScore, 0) / scoredItems.length)
    : null;
  const articlesTotal = companies.reduce((sum, c) => sum + c.relatedArticles.length, 0);

  const sortedInsights = [...insights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const featuredCompanies = [...companies]
    .filter((c) => c.relatedArticles.length > 0)
    .sort((a, b) => b.relatedArticles.length - a.relatedArticles.length)
    .slice(0, 6);
  const recentMethodologies = [...methodologies]
    .filter((m) => m.syncedAt)
    .sort((a, b) => (b.syncedAt ?? "").localeCompare(a.syncedAt ?? ""))
    .slice(0, 4);

  // 主要市場
  const keyMarkets = ["jcredit-energy-saving", "jcredit-forest", "jcredit-agri-biochar", "eu-ets", "vol-biochar", "vol-dac"];
  const marketPrices = keyMarkets
    .map((id) => priceTrends.find((t) => t.marketId === id))
    .filter(Boolean);

  // レジストリ分布
  const registryCounts: Record<string, number> = {};
  for (const m of methodologies) {
    const r = m.registry ?? "その他";
    registryCounts[r] = (registryCounts[r] ?? 0) + 1;
  }
  const topRegistries = Object.entries(registryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxRegistryCount = topRegistries[0]?.[1] ?? 1;

  // カテゴリ分布
  const companyCats: Record<string, number> = {};
  for (const c of companies) {
    const cat = c.category ?? "未分類";
    companyCats[cat] = (companyCats[cat] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* ── KPI サマリー ── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="メソドロジー" value={methodologies.length} unit="件" href="/methodologies" color="emerald" />
        <KpiCard label="登録企業" value={companies.length} unit="社" href="/companies" color="blue" />
        <KpiCard label="グローバルPJ" value={projectStats.totalProjects > 0 ? projectStats.totalProjects.toLocaleString() : "—"} unit="件" href="/projects" color="cyan" />
        <KpiCard label="インサイト" value={insights.length} unit="件" href="/insights" color="indigo" />
        <KpiCard label="関連記事" value={articlesTotal} unit="件" href="/companies" color="amber" />
        <KpiCard label="信頼性スコア" value={avgScore ?? "—"} unit={avgScore ? "/100" : ""} href="/methodologies" color="emerald" />
      </section>

      {/* ── クイックナビゲーション ── */}
      <section className="grid grid-cols-3 gap-3">
        <Link href="/statistics" className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700">クレジット統計</p>
            <p className="text-xs text-gray-400">VROD 10,975PJ</p>
          </div>
        </Link>
        <Link href="/roadmap" className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700">政策ロードマップ</p>
            <p className="text-xs text-gray-400">規制・政策タイムライン</p>
          </div>
        </Link>
        <Link href="/analysis" className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700">マーケット分析</p>
            <p className="text-xs text-gray-400">14市場のAI分析</p>
          </div>
        </Link>
      </section>

      {/* ── 市場価格パネル ── */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">市場価格モニター</h2>
          <Link href="/analysis" className="text-xs text-emerald-600 hover:text-emerald-700">
            全{priceTrends.length}市場を表示 →
          </Link>
        </div>
        <div className="grid grid-cols-2 divide-x divide-gray-100 lg:grid-cols-6">
          {marketPrices.map((t) => t && (
            <Link
              key={t.id}
              href={`/analysis/${t.marketId}`}
              className="p-4 transition hover:bg-gray-50"
            >
              <p className="text-[10px] font-medium text-gray-400 truncate uppercase tracking-wider">{t.title}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{formatJpy(t.latestPriceJpy)}</p>
              <div className="mt-0.5 flex items-center gap-1">
                {t.trendPercentage !== null && (
                  <>
                    <span className={`text-xs font-semibold ${
                      t.trendDirection === "up" ? "text-emerald-600" : t.trendDirection === "down" ? "text-red-500" : "text-gray-400"
                    }`}>
                      {t.trendDirection === "up" ? "\u2191" : t.trendDirection === "down" ? "\u2193" : "\u2192"}
                      {Math.abs(t.trendPercentage).toFixed(1)}%
                    </span>
                  </>
                )}
                <span className="text-[9px] text-gray-300">/{t.priceUnit ?? "tCO2e"}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 2カラム: インサイト + 企業 ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* インサイト（3列幅） */}
        <section className="lg:col-span-3">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">最新インサイト</h2>
              <Link href="/insights" className="text-xs text-emerald-600 hover:text-emerald-700">すべて →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {sortedInsights.map((ins) => (
                <Link
                  key={ins.id}
                  href={`/insights/${ins.id}`}
                  className="flex items-start gap-3 px-5 py-3 transition hover:bg-gray-50"
                >
                  <div className="mt-0.5 shrink-0">
                    <Badge variant={insightBadge(ins.category)}>
                      {ins.category ?? "—"}
                    </Badge>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{ins.title}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{ins.date}</span>
                      {ins.readingTime && (
                        <span className="text-[10px] text-gray-300">{ins.readingTime}分</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 注目企業（2列幅） */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">注目企業</h2>
              <Link href="/companies" className="text-xs text-emerald-600 hover:text-emerald-700">{companies.length}社 →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {featuredCompanies.map((c) => (
                <Link
                  key={c.id}
                  href={`/companies/${c.id}`}
                  className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-700">
                    {c.name?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-400">{c.headquarters ?? "—"}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-gray-400">
                    {c.relatedArticles.length}記事
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── 3カラム: レジストリ分布 + 企業カテゴリ + メソドロジー ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* レジストリ分布（横棒グラフ風） */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">レジストリ分布</h2>
          <div className="space-y-3">
            {topRegistries.map(([name, count]) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">{name}</span>
                  <span className="text-xs text-gray-400">{count}件</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${(count / maxRegistryCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Link href="/methodologies" className="mt-4 block text-xs text-emerald-600 hover:text-emerald-700">
            メソドロジー一覧 →
          </Link>
        </section>

        {/* 企業カテゴリ分布 */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">企業カテゴリ</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(companyCats).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-[10px] text-gray-500">{cat}</p>
              </div>
            ))}
          </div>
          <Link href="/companies" className="mt-4 block text-xs text-emerald-600 hover:text-emerald-700">
            企業一覧 →
          </Link>
        </section>

        {/* 最近のメソドロジー */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">最新メソドロジー</h2>
          <div className="space-y-3">
            {recentMethodologies.map((m) => (
              <Link
                key={m.id}
                href={`/methodologies/${m.id}`}
                className="block rounded-lg border border-gray-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30"
              >
                <div className="flex gap-1.5 mb-1">
                  {m.registry && <Badge variant={registryBadge(m.registry)}>{m.registry}</Badge>}
                </div>
                <p className="text-xs font-medium text-gray-900 line-clamp-2">
                  {m.titleJa ?? m.title}
                </p>
              </Link>
            ))}
          </div>
          <Link href="/methodologies" className="mt-4 block text-xs text-emerald-600 hover:text-emerald-700">
            全{methodologies.length}件 →
          </Link>
        </section>
      </div>

      {/* ── グローバルプロジェクト統計 ── */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">グローバルプロジェクト統計</h2>
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">CAD Trust</span>
          </div>
          <Link href="/projects" className="text-xs text-emerald-600 hover:text-emerald-700">
            プロジェクト検索 →
          </Link>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* 総数 */}
            <div className="text-center">
              <p className="text-3xl font-bold text-cyan-600">
                {projectStats.totalProjects > 0 ? `${projectStats.totalProjects.toLocaleString()}+` : "—"}
              </p>
              <p className="mt-1 text-xs text-gray-400">登録プロジェクト数</p>
              <p className="mt-0.5 text-[10px] text-gray-300">Verra / Gold Standard / CDM / ACR</p>
            </div>
            {/* クイックリンク */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">クイック検索</p>
              {["REDD", "Biochar", "Japan", "Renewable Energy", "Methane"].map((q) => (
                <Link
                  key={q}
                  href={`/projects?q=${encodeURIComponent(q)}`}
                  className="block rounded-lg border border-gray-100 px-3 py-1.5 text-xs text-gray-600 transition hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
                >
                  {q}
                </Link>
              ))}
            </div>
            {/* データ特徴 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">データ概要</p>
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>対応レジストリ</span>
                  <span className="font-semibold text-gray-900">Verra / GS / CDM / ACR</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>カバー国数</span>
                  <span className="font-semibold text-gray-900">190+</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>データ基盤</span>
                  <span className="font-semibold text-gray-900">Chia Blockchain</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>更新頻度</span>
                  <span className="font-semibold text-gray-900">リアルタイム</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, unit, href, color }: {
  label: string; value: number | string; unit: string; href: string; color: string;
}) {
  const borderHover = color === "blue" ? "hover:border-blue-300" : color === "indigo" ? "hover:border-indigo-300" : color === "amber" ? "hover:border-amber-300" : color === "cyan" ? "hover:border-cyan-300" : "hover:border-emerald-300";
  const accent = color === "blue" ? "text-blue-600" : color === "indigo" ? "text-indigo-600" : color === "amber" ? "text-amber-600" : color === "cyan" ? "text-cyan-600" : "text-emerald-600";

  return (
    <Link
      href={href}
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md ${borderHover}`}
    >
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-gray-400">{unit}</span>}
      </p>
    </Link>
  );
}
