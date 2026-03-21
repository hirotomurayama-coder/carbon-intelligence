import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyById, getCompanies } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { Company, CompanyCategory } from "@/types";

type Props = {
  params: Promise<{ id: string }>;
};

/** カテゴリに応じたバッジ色 */
function categoryBadgeVariant(cat: CompanyCategory) {
  switch (cat) {
    case "創出":
      return "emerald" as const;
    case "仲介":
      return "blue" as const;
    case "コンサル":
      return "indigo" as const;
    case "検証機関":
      return "amber" as const;
  }
}

/** 情報行コンポーネント */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 text-sm">
      <span className="font-medium text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{value ?? "\u2014"}</span>
    </div>
  );
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const company = await getCompanyById(id);

  if (!company) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* パンくず */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/companies" className="hover:text-emerald-600">
          企業データベース
        </Link>
        <span>/</span>
        <span className="text-gray-600">{company.name}</span>
      </nav>

      {/* ヘッダー */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl font-bold text-emerald-700">
              {company.name?.[0] ?? "?"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              {company.headquarters && (
                <p className="mt-0.5 text-sm text-gray-400">{company.headquarters}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {company.category && (
              <Badge variant={categoryBadgeVariant(company.category)}>
                {company.category}
              </Badge>
            )}
          </div>
        </div>
        {company.homepageUrl && (
          <a
            href={company.homepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            外部サイトで詳しく見る
          </a>
        )}
      </div>

      {/* 企業概要 */}
      {company.description && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">企業概要</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            {company.description}
          </p>
        </div>
      )}

      {/* 情報カード: 2カラムグリッド */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 基本情報 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">基本情報</h3>
          <div className="divide-y divide-gray-100">
            <InfoRow
              label="カテゴリ"
              value={
                company.category ? (
                  <Badge variant={categoryBadgeVariant(company.category)}>
                    {company.category}
                  </Badge>
                ) : null
              }
            />
            <InfoRow label="本社所在地" value={company.headquarters} />
            {company.homepageUrl && (
              <InfoRow
                label="ウェブサイト"
                value={
                  <a
                    href={company.homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    {company.homepageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                }
              />
            )}
          </div>
        </div>

        {/* 主要プロジェクト */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">主要プロジェクト</h3>
          {company.mainProjects.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {company.mainProjects.map((p) => (
                <span
                  key={p}
                  className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{"\u2014"}</p>
          )}
        </div>
      </div>

      {/* 関連記事（carboncredits.jp） */}
      {company.relatedArticles.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">関連記事</h3>
            <Badge variant="slate">{company.relatedArticles.length}件</Badge>
          </div>
          <div className="divide-y divide-gray-100">
            {company.relatedArticles.slice(0, 20).map((article, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-3">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-700 hover:text-emerald-600 transition line-clamp-2"
                >
                  {article.title}
                </a>
                {article.date && (
                  <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
                    {article.date}
                  </span>
                )}
              </div>
            ))}
          </div>
          {company.relatedArticles.length > 20 && (
            <p className="mt-3 text-xs text-gray-400">
              他 {company.relatedArticles.length - 20} 件の記事
            </p>
          )}
        </div>
      )}

      {/* 同じカテゴリの企業 */}
      <SimilarCompanies current={company} />

      {/* 戻るリンク */}
      <div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-emerald-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          企業一覧に戻る
        </Link>
      </div>
    </div>
  );
}

/** 同じカテゴリの企業を最大4件表示 */
async function SimilarCompanies({ current }: { current: Company }) {
  if (!current.category) return null;

  const all = await getCompanies();
  const similar = all
    .filter((c) => c.category === current.category && c.id !== current.id)
    .slice(0, 4);

  if (similar.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">
        同じカテゴリの企業（{current.category}）
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {similar.map((c) => (
          <Link
            key={c.id}
            href={`/companies/${c.id}`}
            className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
              {c.name?.[0] ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
              <p className="text-xs text-gray-400">{c.headquarters ?? "\u2014"}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
