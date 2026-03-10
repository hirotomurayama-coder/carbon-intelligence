import Link from "next/link";
import { getMethodologies, getCompanies, getInsights, getRecentUpdates } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { InsightCategory, RegistryName } from "@/types";

/** レジストリ名に応じたバッジ色 */
function registryBadge(registry: RegistryName) {
  switch (registry) {
    case "Verra":
      return "emerald" as const;
    case "Gold Standard":
      return "amber" as const;
    case "Puro.earth":
      return "cyan" as const;
    default:
      return "gray" as const;
  }
}

/** インサイトカテゴリーのバッジ色（null 対応） */
function insightBadge(cat: InsightCategory | null) {
  if (cat === null) return "gray" as const;
  switch (cat) {
    case "政策":
      return "indigo" as const;
    case "市場":
      return "emerald" as const;
    case "技術":
      return "blue" as const;
  }
}

export default async function Home() {
  const [methodologies, companies, insights, recentUpdates] = await Promise.all([
    getMethodologies(),
    getCompanies(),
    getInsights(),
    getRecentUpdates(10),
  ]);

  // KPI 計算 — null スコアは分母から除外
  const scoredItems = methodologies.filter(
    (m): m is typeof m & { reliabilityScore: number } =>
      m.reliabilityScore !== null
  );
  const avgScore =
    scoredItems.length > 0
      ? Math.round(
          scoredItems.reduce((sum, m) => sum + m.reliabilityScore, 0) /
            scoredItems.length
        )
      : null;

  return (
    <div className="space-y-8">
      {/* ── KPI サマリーカード ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "登録メソドロジー", value: methodologies.length, unit: "件" },
          { label: "登録企業数", value: companies.length, unit: "社" },
          { label: "最新インサイト", value: insights.length, unit: "件" },
          {
            label: "平均信頼性スコア",
            value: avgScore !== null ? avgScore : "\u2014",
            unit: avgScore !== null ? "点" : "",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {kpi.value}
              {kpi.unit && (
                <span className="ml-1 text-sm font-normal text-gray-400">
                  {kpi.unit}
                </span>
              )}
            </p>
          </div>
        ))}
      </section>

      {/* ── メソドロジーテーブル ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          メソドロジー
        </h2>
        {methodologies.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 font-medium text-gray-500">タイトル</th>
                  <th className="px-5 py-3 font-medium text-gray-500">レジストリ</th>
                  <th className="hidden px-5 py-3 font-medium text-gray-500 md:table-cell">認証機関</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {methodologies.slice(0, 8).map((m) => (
                  <tr key={m.id} className="hover:bg-emerald-50/40">
                    <td className="px-5 py-4">
                      <Link href={`/methodologies/${m.id}`} className="block">
                        <p className="font-medium text-gray-900 hover:text-emerald-700">
                          {m.titleJa ?? m.title}
                        </p>
                        {m.summary && (
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                            {m.summary.length > 80
                              ? m.summary.slice(0, 80) + "..."
                              : m.summary}
                          </p>
                        )}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      {m.registry ? (
                        <Badge variant={registryBadge(m.registry)}>
                          {m.registry}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-300">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-4 text-gray-600 md:table-cell">
                      {m.certificationBody ?? "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-5 py-3 text-center">
              <Link
                href="/methodologies"
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                すべてのメソドロジーを見る →
              </Link>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
            メソドロジーが登録されていません
          </p>
        )}
      </section>

      {/* ── 企業 / インサイト / 更新 3カラム ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* 企業カード */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            企業情報
          </h2>
          {companies.length > 0 ? (
            <div className="space-y-3">
              {companies.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
                    {c.name?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {c.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {c.headquarters ?? "\u2014"}
                    </p>
                    <div className="mt-1.5">
                      <Badge
                        variant={
                          c.category === null
                            ? "gray"
                            : c.category === "創出"
                              ? "emerald"
                              : c.category === "仲介"
                                ? "blue"
                                : c.category === "コンサル"
                                  ? "indigo"
                                  : "amber"
                        }
                      >
                        {c.category ?? "\u672A\u5206\u985E"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
              企業が登録されていません
            </p>
          )}
        </section>

        {/* インサイトリスト */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            インサイト
          </h2>
          {insights.length > 0 ? (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
              {insights.slice(0, 5).map((ins) => (
                <div key={ins.id} className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant={insightBadge(ins.category)}>
                      {ins.category ?? "\u672A\u5206\u985E"}
                    </Badge>
                    <span className="text-xs text-gray-400">{ins.date}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {ins.title}
                  </h3>
                  {ins.summary && (
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      {ins.summary.length > 100
                        ? ins.summary.slice(0, 100) + "..."
                        : ins.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
              インサイトが登録されていません
            </p>
          )}
        </section>

        {/* 最近の更新（methodologies の更新日時ベース） */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            レジストリ更新
          </h2>
          {recentUpdates.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  最近の更新
                </h3>
                <Badge variant="emerald">{recentUpdates.length}件</Badge>
              </div>
              <div className="space-y-3">
                {recentUpdates.map((u) => (
                  <div
                    key={u.id}
                    className="relative border-l-2 border-emerald-200 pl-4"
                  >
                    <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-emerald-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {u.registry && (
                          <Badge variant={registryBadge(u.registry)}>
                            {u.registry}
                          </Badge>
                        )}
                      </div>
                      <Link href={`/methodologies/${u.id}`}>
                        <p className="mt-1 text-xs font-medium text-gray-800 line-clamp-2 hover:text-emerald-700">
                          {u.title}
                        </p>
                      </Link>
                      <span className="text-[10px] text-gray-400">
                        {u.externalLastUpdated
                          ? u.externalLastUpdated.slice(0, 10)
                          : "日付不明"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
              更新情報はまだありません
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
