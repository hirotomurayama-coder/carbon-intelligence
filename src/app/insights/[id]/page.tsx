import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getInsightById, getInsights, getMethodologies } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { InsightCategory } from "@/types";

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
      ...(insight.featuredImageUrl ? { images: [insight.featuredImageUrl] } : {}),
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

// ============================================================
// ページコンポーネント
// ============================================================

export default async function InsightDetailPage({ params }: Props) {
  const { id } = await params;

  // 記事データ、最新インサイト一覧、メソドロジー一覧を並行取得
  const [insight, allInsights, allMethodologies] = await Promise.all([
    getInsightById(id),
    getInsights(),
    getMethodologies(),
  ]);

  if (!insight) {
    notFound();
  }

  // 最新インサイト（自身を除く、最大5件）
  const latestInsights = allInsights
    .filter((i) => i.id !== insight.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // 関連メソドロジー（タイトル・サマリーにキーワードマッチ、最大3件）
  const titleWords = insight.title
    .replace(/[【】（）()[\]「」]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const relatedMethodologies = allMethodologies
    .filter((m) => {
      const text = `${m.title} ${m.titleJa ?? ""} ${m.aiSummary ?? ""} ${m.subCategory ?? ""}`.toLowerCase();
      return titleWords.some((w) => text.includes(w.toLowerCase()));
    })
    .slice(0, 3);

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
          <time className="text-sm text-gray-400" dateTime={insight.date}>
            {formatDate(insight.date)}
          </time>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
          {insight.title}
        </h1>
      </header>

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

      {/* 記事本文 — Tailwind Typography で読みやすくレンダリング */}
      <article
        className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-p:leading-relaxed prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
        dangerouslySetInnerHTML={{ __html: insight.content }}
      />

      {/* 区切り線 */}
      <hr className="border-gray-200" />

      {/* 回遊性向上セクション */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 最新インサイト */}
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
                        {i.category && (
                          <span className="ml-2">
                            <Badge variant={categoryBadgeVariant(i.category)}>
                              {i.category}
                            </Badge>
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/insights"
              className="mt-4 inline-block text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              すべてのインサイトを見る →
            </Link>
          </div>
        )}

        {/* 関連メソドロジー */}
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
                        {m.creditType && (
                          <Badge variant="gray">{m.creditType}</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/methodologies"
              className="mt-4 inline-block text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              すべてのメソドロジーを見る →
            </Link>
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
