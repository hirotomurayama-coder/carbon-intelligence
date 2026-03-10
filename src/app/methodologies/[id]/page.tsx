import { notFound } from "next/navigation";
import Link from "next/link";
import { getMethodologyById } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { RegistryName } from "@/types";

type Props = {
  params: Promise<{ id: string }>;
};

/** レジストリ名に応じたバッジ色 */
function registryBadgeVariant(registry: RegistryName) {
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

function scoreBadgeVariant(score: number) {
  if (score >= 90) return "emerald" as const;
  if (score >= 80) return "blue" as const;
  return "amber" as const;
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

export default async function MethodologyDetailPage({ params }: Props) {
  const { id } = await params;
  const methodology = await getMethodologyById(id);

  if (!methodology) {
    notFound();
  }

  const displayTitle = methodology.titleJa ?? methodology.title;
  const showOriginalTitle = methodology.titleJa && methodology.titleJa !== methodology.title;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* パンくず */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/methodologies" className="hover:text-emerald-600">
          メソドロジー
        </Link>
        <span>/</span>
        <span className="text-gray-600">{displayTitle}</span>
      </nav>

      {/* ヘッダー */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{displayTitle}</h1>
          {showOriginalTitle && (
            <p className="text-sm text-gray-400">{methodology.title}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {methodology.registry && (
              <Badge variant={registryBadgeVariant(methodology.registry)}>
                {methodology.registry}
              </Badge>
            )}
            {methodology.creditType && (
              <Badge variant={methodology.creditType === "除去系" ? "indigo" : "blue"}>
                {methodology.creditType}
              </Badge>
            )}
            {methodology.baseType && (
              <Badge
                variant={
                  methodology.baseType === "自然ベース"
                    ? "emerald"
                    : methodology.baseType === "技術ベース"
                      ? "slate"
                      : "amber"
                }
              >
                {methodology.baseType}
              </Badge>
            )}
            {methodology.operationalStatus && (
              <Badge variant={methodology.operationalStatus === "運用中" ? "emerald" : "gray"}>
                {methodology.operationalStatus}
              </Badge>
            )}
          </div>
        </div>
        {methodology.sourceUrl && (
          <a
            href={methodology.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            元サイトで詳細を見る
          </a>
        )}
      </div>

      {/* AI 要約 */}
      {methodology.aiSummary && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-6">
          <div className="mb-2 flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <h2 className="text-sm font-semibold text-emerald-700">AI 要約</h2>
          </div>
          <p className="text-sm leading-relaxed text-gray-700">
            {methodology.aiSummary}
          </p>
        </div>
      )}

      {/* 概要（AI 要約がない場合） */}
      {!methodology.aiSummary && methodology.summary && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">概要</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            {methodology.summary}
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
              label="レジストリ"
              value={
                methodology.registry ? (
                  <Badge variant={registryBadgeVariant(methodology.registry)}>
                    {methodology.registry}
                  </Badge>
                ) : null
              }
            />
            <InfoRow
              label="算定手法"
              value={
                methodology.type ? (
                  <Badge variant="slate">{methodology.type}</Badge>
                ) : null
              }
            />
            <InfoRow label="地域" value={methodology.region} />
            <InfoRow label="有効期限" value={methodology.validUntil} />
            <InfoRow
              label="信頼性スコア"
              value={
                methodology.reliabilityScore !== null ? (
                  <Badge variant={scoreBadgeVariant(methodology.reliabilityScore)}>
                    {methodology.reliabilityScore}点
                  </Badge>
                ) : null
              }
            />
            <InfoRow label="バージョン" value={methodology.version} />
          </div>
        </div>

        {/* 分類情報 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">分類・認証情報</h3>
          <div className="divide-y divide-gray-100">
            <InfoRow
              label="クレジット種別"
              value={
                methodology.creditType ? (
                  <Badge variant={methodology.creditType === "除去系" ? "indigo" : "blue"}>
                    {methodology.creditType}
                  </Badge>
                ) : null
              }
            />
            <InfoRow
              label="基本分類"
              value={
                methodology.baseType ? (
                  <Badge
                    variant={
                      methodology.baseType === "自然ベース"
                        ? "emerald"
                        : methodology.baseType === "技術ベース"
                          ? "slate"
                          : "amber"
                    }
                  >
                    {methodology.baseType}
                  </Badge>
                ) : null
              }
            />
            <InfoRow label="詳細分類" value={methodology.subCategory} />
            <InfoRow label="認証機関" value={methodology.certificationBody} />
            <InfoRow
              label="運用ステータス"
              value={
                methodology.operationalStatus ? (
                  <Badge variant={methodology.operationalStatus === "運用中" ? "emerald" : "gray"}>
                    {methodology.operationalStatus}
                  </Badge>
                ) : null
              }
            />
          </div>
        </div>
      </div>

      {/* 同期情報 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">同期情報</h3>
        <div className="grid grid-cols-1 gap-x-8 divide-y divide-gray-100 sm:grid-cols-3 sm:divide-y-0">
          <div className="py-2 sm:py-0">
            <p className="text-xs text-gray-400">最終同期</p>
            <p className="mt-1 text-sm text-gray-700">
              {methodology.syncedAt
                ? new Date(methodology.syncedAt).toLocaleString("ja-JP", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "\u2014"}
            </p>
          </div>
          <div className="py-2 sm:py-0">
            <p className="text-xs text-gray-400">外部更新日</p>
            <p className="mt-1 text-sm text-gray-700">
              {methodology.externalLastUpdated ?? "\u2014"}
            </p>
          </div>
          <div className="py-2 sm:py-0">
            <p className="text-xs text-gray-400">データハッシュ</p>
            <p className="mt-1 font-mono text-xs text-gray-400">
              {methodology.dataHash
                ? methodology.dataHash.slice(0, 16) + "…"
                : "\u2014"}
            </p>
          </div>
        </div>
      </div>

      {/* 戻るリンク */}
      <div>
        <Link
          href="/methodologies"
          className="inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-emerald-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          メソドロジー一覧に戻る
        </Link>
      </div>
    </div>
  );
}
