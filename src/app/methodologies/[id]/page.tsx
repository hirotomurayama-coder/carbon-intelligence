import { notFound } from "next/navigation";
import Link from "next/link";
import { getMethodologyById, getMethodologies, getInsights } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import type { Methodology, RegistryName, Insight } from "@/types";
import allMethodsData from "@/data/all-methodologies.json";

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

/** 情報行コンポーネント */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 text-sm">
      <span className="font-medium text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{value ?? "\u2014"}</span>
    </div>
  );
}

// ============================================================
// 外部メソドロジー（VROD / CAD Trust）の詳細ページ
// ============================================================

type ExtEntry = {
  name: string;
  registry: string;
  projectsVrod: number;
  creditsVrod: number;
  projectsCad: number;
  totalProjects: number;
  source: string[];
};

const REGISTRY_ALIAS: Record<string, RegistryName> = {
  Verra: "Verra", VCS: "Verra", "Gold Standard": "Gold Standard", GS: "Gold Standard",
  CDM: "CDM", ARB: "ARB", CAR: "CAR", ACR: "ACR", ART: "ART",
  "Puro.earth": "Puro.earth", Isometric: "Isometric", "J-Credit": "J-Credit",
};

function inferCreditType(name: string): string | null {
  const n = name.toUpperCase();
  if (/AR-ACM|AR-AMS|AR-AM|VMR0006|VM0042|VM0047|VM0015|IFM|FOREST|REDD|REFORESTATION|WETLAND|MANGROVE|SOIL|SEAGRASS|BLUE CARBON|DAC|BIOCHAR|ERW|MINERALI|ENHANCED ROCK|REMOVAL/.test(n)) return "除去系";
  return "回避・削減系";
}
function inferBaseType(name: string): string | null {
  const n = name.toUpperCase();
  if (/AMS-I\.|ACM000[12]|SOLAR|RENEWABLE|WIND|HYDRO|GEOTHERMAL|BIOMASS ENERGY/.test(n)) return "再エネ";
  if (/FOREST|AR-|IFM|MANGROVE|SOIL|REDD|VM0047|VM0042|VM0015|WETLAND|SEAGRASS|GRASSLAND|AFFORESTATION|REFORESTATION/.test(n)) return "自然ベース";
  if (/DAC|BIOCHAR|MINERALI|ENHANCED ROCK|DIRECT AIR/.test(n)) return "技術ベース";
  return null;
}

function extIdToKey(id: string): string {
  return id.slice(4); // "ext-" を除去
}

function findExternalEntry(id: string): ExtEntry | null {
  const key = extIdToKey(id);
  return (allMethodsData.methodologies as ExtEntry[]).find(
    (m) => m.name.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 60) === key
  ) ?? null;
}

/** 外部エントリ（VROD/CAD Trust）を Methodology 型に変換 */
function extEntryToMethodology(entry: ExtEntry): Methodology & { _extEntry: ExtEntry } {
  const registry = REGISTRY_ALIAS[entry.registry] ?? null;
  return {
    id: `ext-${entry.name.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 60)}`,
    title: entry.name,
    titleJa: null,
    type: null,
    region: null,
    validUntil: null,
    summary: "",
    reliabilityScore: null,
    registry,
    sourceUrl: null,
    dataHash: null,
    externalLastUpdated: null,
    syncedAt: null,
    aiSummary: null,
    creditType: inferCreditType(entry.name),
    baseType: inferBaseType(entry.name),
    subCategory: null,
    operationalStatus: null,
    certificationBody: entry.registry,
    version: null,
    source: "vrod",
    projectCount: entry.totalProjects > 0 ? entry.totalProjects : null,
    creditCount: entry.creditsVrod > 0 ? entry.creditsVrod : null,
    _extEntry: entry,
  };
}

// ============================================================
// メインページコンポーネント（WP・外部共通）
// ============================================================

export default async function MethodologyDetailPage({ params }: Props) {
  const { id } = await params;

  // 外部エントリ（ext- プレフィックス）の場合は Methodology 型に変換して共通パスへ
  let methodology: (Methodology & { _extEntry?: ExtEntry }) | null = null;
  if (id.startsWith("ext-")) {
    const entry = findExternalEntry(id);
    if (!entry) notFound();
    methodology = extEntryToMethodology(entry);
  } else {
    methodology = await getMethodologyById(id);
    if (!methodology) notFound();
  }

  const isExternal = !!methodology._extEntry;
  const extEntry = methodology._extEntry;
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

      {/* AI 要約 / 外部データソースバナー */}
      {isExternal ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6">
          <div className="mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            <h2 className="text-sm font-semibold text-blue-700">外部データソース</h2>
          </div>
          <ul className="mb-3 space-y-1">
            {extEntry!.source.map((s) => {
              const sourceLabels: Record<string, string> = {
                vrod: "VROD（UC Berkeley 自発的炭素市場レジストリデータベース）",
              };
              return (
                <li key={s} className="flex items-center gap-2 text-sm text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {sourceLabels[s] ?? s}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-blue-500">このメソドロジーは外部DBから自動収録されました。概要文は登録されていません。</p>
        </div>
      ) : (
        <>
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
          {!methodology.aiSummary && methodology.summary && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
              <h2 className="mb-2 text-sm font-semibold text-gray-500">概要</h2>
              <p className="text-sm leading-relaxed text-gray-700">
                {methodology.summary}
              </p>
            </div>
          )}
        </>
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
            <InfoRow label="発行機関（認証）" value={methodology.certificationBody} />
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

      {/* 同期情報 / 登録統計 */}
      {isExternal ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">登録統計</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {extEntry!.totalProjects > 0 ? extEntry!.totalProjects.toLocaleString() : "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500">総プロジェクト数</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {extEntry!.projectsVrod > 0 ? extEntry!.projectsVrod.toLocaleString() : "—"}
              </p>
              <p className="mt-1 text-xs text-blue-500">VRODプロジェクト</p>
            </div>
            <div className="rounded-lg bg-cyan-50 p-4 text-center">
              <p className="text-2xl font-bold text-cyan-700">
                {extEntry!.projectsCad > 0 ? extEntry!.projectsCad.toLocaleString() : "—"}
              </p>
              <p className="mt-1 text-xs text-cyan-500">CAD Trustプロジェクト</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">
                {extEntry!.creditsVrod > 0
                  ? extEntry!.creditsVrod >= 1_000_000
                    ? `${(extEntry!.creditsVrod / 1_000_000).toFixed(1)}M`
                    : extEntry!.creditsVrod.toLocaleString()
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-emerald-500">VROD発行クレジット (tCO2e)</p>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* 関連インサイト */}
      <RelatedInsights methodology={methodology} />

      {/* 類似メソドロジー */}
      <SimilarMethodologies current={methodology} />

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

      {/* データ帰属 */}
      {!isExternal ? null : (
        <p className="text-[11px] text-gray-300 border-t border-gray-100 pt-4">
          外部メソドロジーデータ: Barbara K Haya et al., <em>Voluntary Registry Offsets Database</em>, Berkeley Carbon Trading Project, University of California Berkeley.{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">CC BY 4.0</a>
        </p>
      )}
    </div>
  );
}

/** 類似メソドロジー — 詳細分類（subCategory）を最重要基準として類似度スコアリング */
async function SimilarMethodologies({ current }: { current: Methodology }) {
  const all = await getMethodologies();

  // スコアリング: subCategory が最重要、次に creditType・baseType
  const scored = all
    .filter((m) => m.id !== current.id)
    .map((m) => {
      let score = 0;
      // 最重要: 詳細分類（ACF sub_category）が一致 → +10
      if (m.subCategory && current.subCategory && m.subCategory === current.subCategory) score += 10;
      // 重要: creditType（回避・削減系 / 除去系）一致 → +3
      if (m.creditType && m.creditType === current.creditType) score += 3;
      // 重要: baseType（自然ベース / 技術ベース / 再エネ）一致 → +3
      if (m.baseType && m.baseType === current.baseType) score += 3;
      // 補助: 同一レジストリ → +1
      if (m.registry && m.registry === current.registry) score += 1;
      return { ...m, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">類似メソドロジー</h3>
      <div className="space-y-3">
        {scored.map((m) => (
          <Link
            key={m.id}
            href={`/methodologies/${m.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {m.titleJa ?? m.title}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.subCategory && (
                  <Badge variant="emerald">{m.subCategory}</Badge>
                )}
                {m.registry && (
                  <Badge variant={registryBadgeVariant(m.registry)}>{m.registry}</Badge>
                )}
                {m.creditType && (
                  <Badge variant={m.creditType === "除去系" ? "indigo" : "blue"}>{m.creditType}</Badge>
                )}
              </div>
            </div>
            <svg className="h-4 w-4 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}


/** 関連インサイト — 固有のメソドロジーコードや専門用語でマッチング */
async function RelatedInsights({ methodology }: { methodology: Methodology }) {
  const allInsights = await getInsights().catch(() => []);

  // ── キーワード選定方針 ──────────────────────────────────────
  // 1. メソドロジーコード（英数字の固有コード、例: "VM0047", "AG-005NEW"）のみを優先
  // 2. subCategory は日本語特定用語（6文字以上）のみ使用
  // 3. レジストリ名（J-Credit, Verra 等）は使用しない（汎用すぎてノイズになる）
  // 4. 複数キーワードがある場合は OR、ただし短すぎるキーワードは除外
  // ────────────────────────────────────────────────────────────

  const specificKeywords: string[] = [];

  // メソドロジーコード: 先頭の英数字ハイフン区切りトークン（例: "VM0047", "AG-005NEW", "ACM0002"）
  const codeMatch = methodology.title.match(/^([A-Z]{1,4}[-\d][A-Z0-9\-\.]+)/i);
  if (codeMatch && codeMatch[1].length >= 4) {
    specificKeywords.push(codeMatch[1].toLowerCase());
  }

  // 日本語タイトルから専門的な固有フレーズ（8文字以上の連続語）
  if (methodology.titleJa) {
    // 括弧・助詞を除いた日本語部分で8文字以上のスライスを抽出
    const jaWords = methodology.titleJa
      .replace(/[（）()【】「」\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 8);
    jaWords.slice(0, 2).forEach((w) => specificKeywords.push(w.toLowerCase()));
  }

  // subCategory: 意味のある専門用語のみ（6文字以上、汎用ワードを除外）
  const genericCategories = new Set(["農業", "再エネ", "森林", "工業", "廃棄物", "交通"]);
  if (
    methodology.subCategory &&
    methodology.subCategory.length >= 6 &&
    !genericCategories.has(methodology.subCategory)
  ) {
    specificKeywords.push(methodology.subCategory.toLowerCase());
  }

  // キーワードが全く取れない場合は表示しない
  if (specificKeywords.length === 0) return null;

  const matched = allInsights.filter((ins: Insight) => {
    const text = `${ins.title} ${ins.summary}`.toLowerCase();
    return specificKeywords.some((kw) => text.includes(kw));
  }).slice(0, 4);

  if (matched.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">関連インサイト</h3>
      <div className="space-y-3">
        {matched.map((ins: Insight) => (
          <Link
            key={ins.id}
            href={`/insights/${ins.id}`}
            className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{ins.title}</p>
              <p className="mt-0.5 text-xs text-gray-400">{ins.date} {ins.category && `| ${ins.category}`}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
