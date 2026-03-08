import { getArticles, getGlossaryTerms } from "@/lib/wordpress";
import type { ArticleCategory } from "@/types";

/** カテゴリーに応じたバッジ色を返す */
function categoryColor(category: ArticleCategory): string {
  switch (category) {
    case "国内ニュース":
      return "bg-blue-100 text-blue-800";
    case "海外ニュース":
      return "bg-emerald-100 text-emerald-800";
    case "コラム":
      return "bg-indigo-100 text-indigo-800";
    case "オフセット事例":
      return "bg-amber-100 text-amber-800";
    case "用語解説":
      return "bg-cyan-100 text-cyan-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default async function Home() {
  const [articles, glossaryTerms] = await Promise.all([
    getArticles(),
    getGlossaryTerms(),
  ]);

  // カテゴリー別の記事数を集計
  const domesticCount = articles.filter((a) => a.category === "国内ニュース").length;
  const globalCount = articles.filter((a) => a.category === "海外ニュース").length;

  return (
    <div className="space-y-8">
      {/* ── KPI サマリーカード ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "総記事数", value: articles.length, unit: "件" },
          { label: "国内ニュース", value: domesticCount, unit: "件" },
          { label: "海外ニュース", value: globalCount, unit: "件" },
          { label: "用語集", value: glossaryTerms.length, unit: "語" },
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

      {/* ── 最新ニュース ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          最新ニュース
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {articles.slice(0, 6).map((article) => (
            <div
              key={article.id}
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColor(article.category)}`}
                  >
                    {article.category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {article.date}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {article.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  {article.excerpt.length > 120
                    ? article.excerpt.slice(0, 120) + "..."
                    : article.excerpt}
                </p>
              </div>
              {article.link && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    記事を読む &rarr;
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 用語集（最新） ── */}
      {glossaryTerms.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            用語集
          </h2>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {glossaryTerms.slice(0, 8).map((term) => (
              <div key={term.id} className="p-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  {term.term}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  {term.description.length > 150
                    ? term.description.slice(0, 150) + "..."
                    : term.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
