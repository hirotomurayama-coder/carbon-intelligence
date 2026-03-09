import { getMethodologies, getCompanies, getInsights } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import { UpdateTimeline } from "@/components/UpdateTimeline";
import type { InsightCategory, MethodologyType } from "@/types";

/** メソドロジー種別のバッジ色（null 対応） */
function methodTypeBadge(type: MethodologyType | null) {
  if (type === null) return "gray" as const;
  switch (type) {
    case "ARR":
      return "emerald" as const;
    case "ALM":
      return "blue" as const;
    case "REDD+":
      return "amber" as const;
    case "マングローブ":
      return "cyan" as const;
    case "再生可能エネルギー":
      return "indigo" as const;
    case "省エネルギー":
      return "slate" as const;
  }
}

/** 信頼性スコアのバッジ色 */
function scoreBadge(score: number) {
  if (score >= 90) return "emerald" as const;
  if (score >= 80) return "blue" as const;
  return "amber" as const;
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
  const [methodologies, companies, insights] = await Promise.all([
    getMethodologies(),
    getCompanies(),
    getInsights(),
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
                  <th className="px-5 py-3 font-medium text-gray-500">算定手法</th>
                  <th className="px-5 py-3 font-medium text-gray-500">地域</th>
                  <th className="px-5 py-3 font-medium text-gray-500">有効期限</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">
                    信頼性
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {methodologies.slice(0, 5).map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{m.title}</p>
                      {m.summary && (
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                          {m.summary.length > 60
                            ? m.summary.slice(0, 60) + "..."
                            : m.summary}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={methodTypeBadge(m.type)}>
                        {m.type ?? "\u672A\u5206\u985E"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {m.region ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {m.validUntil ?? "\u2014"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {m.reliabilityScore !== null ? (
                        <Badge variant={scoreBadge(m.reliabilityScore)}>
                          {m.reliabilityScore}点
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-300">\u2014</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                            : c.category === "創出事業者"
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

        {/* 最近の更新タイムライン */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            レジストリ更新
          </h2>
          <UpdateTimeline />
        </section>
      </div>
    </div>
  );
}
