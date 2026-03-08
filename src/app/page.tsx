import { getMethodologies, getCompanies, getInsights } from "@/lib/wordpress";

/** 信頼性スコアに応じたバッジ色を返す */
function scoreColor(score: number): string {
  if (score >= 90) return "bg-emerald-100 text-emerald-800";
  if (score >= 80) return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

/** インサイトカテゴリーに応じたバッジ色を返す */
function categoryColor(category: string): string {
  switch (category) {
    case "政策":
      return "bg-indigo-100 text-indigo-800";
    case "市場":
      return "bg-emerald-100 text-emerald-800";
    case "技術":
      return "bg-cyan-100 text-cyan-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default async function Home() {
  const [methodologies, companies, insights] = await Promise.all([
    getMethodologies(),
    getCompanies(),
    getInsights(),
  ]);

  const avgScore =
    methodologies.length > 0
      ? Math.round(
          methodologies.reduce((s, m) => s + m.reliabilityScore, 0) /
            methodologies.length
        )
      : 0;

  return (
    <div className="space-y-8">
      {/* ── KPI サマリーカード ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "登録メソドロジー", value: methodologies.length, unit: "件" },
          { label: "登録企業", value: companies.length, unit: "社" },
          { label: "最新インサイト", value: insights.length, unit: "件" },
          { label: "平均信頼性スコア", value: avgScore, unit: "/ 100" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {kpi.value}
              <span className="ml-1 text-sm font-normal text-gray-400">
                {kpi.unit}
              </span>
            </p>
          </div>
        ))}
      </section>

      {/* ── 最新のメソドロジー ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          最新のメソドロジー
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {methodologies.slice(0, 3).map((m) => (
            <div
              key={m.id}
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {m.type}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    {m.region}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {m.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  {m.summary}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-400">
                  有効期限: {m.validUntil}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreColor(m.reliabilityScore)}`}
                >
                  {m.reliabilityScore}点
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ── 注目企業 ── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            注目企業
          </h2>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {companies.map((c) => (
              <div key={c.id} className="flex items-start gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
                  {c.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {c.name}
                    </p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {c.category}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {c.headquarters}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.mainProjects.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-500"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 最新インサイト ── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            最新インサイト
          </h2>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {insights.slice(0, 4).map((ins) => (
              <div key={ins.id} className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor(ins.category)}`}
                  >
                    {ins.category}
                  </span>
                  <span className="text-xs text-gray-400">{ins.date}</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {ins.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  {ins.summary}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
