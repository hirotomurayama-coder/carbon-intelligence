import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getInsightById,
  getInsights,
  getMethodologies,
  getCompanies,
} from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { InsightCategory, Company } from "@/types";

type Props = {
  params: Promise<{ id: string }>;
};

// ============================================================
// SEO: generateMetadata
// ============================================================

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const insight = await getInsightById(id);

  if (!insight) {
    return { title: "記事が見つかりません" };
  }

  return {
    title: `${insight.title} | カーボンクレジット市場インテリジェンス`,
    description: insight.summary || insight.title,
    openGraph: {
      title: insight.title,
      description: insight.summary || insight.title,
      type: "article",
      publishedTime: insight.date,
      ...(insight.featuredImageUrl
        ? { images: [insight.featuredImageUrl] }
        : {}),
    },
  };
}

// ============================================================
// ヘルパー
// ============================================================

function categoryBadgeVariant(cat: InsightCategory) {
  switch (cat) {
    case "政策":
      return "blue" as const;
    case "市場":
      return "emerald" as const;
    case "技術":
      return "indigo" as const;
    case "特別記事":
      return "amber" as const;
    case "メルマガ":
      return "slate" as const;
    case "週次ブリーフ":
      return "emerald" as const;
    default:
      return "gray" as const;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * 記事本文中に登場する企業名を検出し、リンクカードとして挿入する。
 * 3社以上マッチした企業名を返す（ノイズ防止）。
 */
function findMentionedCompanies(
  htmlContent: string,
  companies: Company[]
): Company[] {
  const plainText = htmlContent
    .replace(/<[^>]*>/g, " ")
    .replace(/&[^;]+;/g, " ");
  const mentioned: Company[] = [];

  for (const c of companies) {
    if (c.name.length < 2) continue;
    // 企業名が本文に含まれるか
    if (plainText.includes(c.name)) {
      mentioned.push(c);
    }
  }

  return mentioned.slice(0, 8); // 最大8社
}

// ============================================================
// ページコンポーネント
// ============================================================

export default async function InsightDetailPage({ params }: Props) {
  const { id } = await params;

  const [insight, allInsights, allMethodologies, allCompanies] =
    await Promise.all([
      getInsightById(id),
      getInsights(),
      getMethodologies(),
      getCompanies(),
    ]);

  if (!insight) {
    notFound();
  }

  // シリーズ記事（同一シリーズの前後記事）
  const seriesInsights = insight.series
    ? allInsights
        .filter((i) => i.series === insight.series && i.id !== insight.id)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  // 最新インサイト（自身を除く、最大5件）
  const latestInsights = allInsights
    .filter((i) => i.id !== insight.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // 関連メソドロジー
  const titleWords = insight.title
    .replace(/[【】（）()[\]「」]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const relatedMethodologies = allMethodologies
    .filter((m) => {
      const text =
        `${m.title} ${m.titleJa ?? ""} ${m.aiSummary ?? ""} ${m.subCategory ?? ""}`.toLowerCase();
      return titleWords.some((w) => text.includes(w.toLowerCase()));
    })
    .slice(0, 3);

  // 記事内に登場する企業
  const mentionedCompanies = findMentionedCompanies(
    insight.content,
    allCompanies
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* パンくず */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/" className="hover:text-emerald-600">
          ホーム
        </Link>
        <span>/</span>
        <Link href="/insights" className="hover:text-emerald-600">
          インサイト
        </Link>
        <span>/</span>
        <span className="truncate text-gray-600">{insight.title}</span>
      </nav>

      {/* 記事ヘッダー */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {insight.category && (
            <Badge variant={categoryBadgeVariant(insight.category)}>
              {insight.category}
            </Badge>
          )}
          {insight.series && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {insight.series}
            </span>
          )}
          <time className="text-sm text-gray-400" dateTime={insight.date}>
            {formatDate(insight.date)}
          </time>
          {insight.readingTime && (
            <span className="flex items-center gap-1 text-sm text-gray-400">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {insight.readingTime}分で読めます
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
          {insight.title}
        </h1>
      </header>

      {/* シリーズナビゲーション */}
      {seriesInsights.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            {insight.series} シリーズ
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {seriesInsights.map((si) => (
              <Link
                key={si.id}
                href={`/insights/${si.id}`}
                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-800 transition hover:bg-amber-100"
              >
                {si.title.slice(0, 40)}
                {si.title.length > 40 ? "..." : ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* アイキャッチ画像 */}
      {insight.featuredImageUrl && (
        <div className="overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={insight.featuredImageUrl}
            alt={insight.title}
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      {/* 記事本文 */}
      <article
        className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-p:leading-relaxed prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
        dangerouslySetInnerHTML={{ __html: insight.content }}
      />

      {/* 記事内に登場する企業 */}
      {mentionedCompanies.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            この記事に登場する企業
          </h3>
          <div className="flex flex-wrap gap-2">
            {mentionedCompanies.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-emerald-700">
                  {c.name[0]}
                </span>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <hr className="border-gray-200" />

      {/* 回遊性向上セクション */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {latestInsights.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              最新のインサイト
            </h3>
            <ul className="space-y-3">
              {latestInsights.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/insights/${i.id}`}
                    className="group flex items-start gap-3"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-700 group-hover:text-emerald-600">
                        {i.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(i.date)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {relatedMethodologies.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              関連するメソドロジー
            </h3>
            <ul className="space-y-3">
              {relatedMethodologies.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/methodologies/${m.id}`}
                    className="group flex items-start gap-3"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-700 group-hover:text-emerald-600">
                        {m.titleJa ?? m.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {m.registry && (
                          <Badge variant="gray">{m.registry}</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 戻るリンク */}
      <div>
        <Link
          href="/insights"
          className="inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-emerald-600"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          インサイト一覧に戻る
        </Link>
      </div>
    </div>
  );
}
