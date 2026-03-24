import { getProjectById, calcTotalUnits, getCountries, normalizeMethodologyCode } from "@/lib/cad-trust";
import { getMethodologies } from "@/lib/wordpress";
import { Badge } from "@/components/ui/Badge";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Methodology } from "@/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  return {
    title: project
      ? `${project.projectName} | Carbon Intelligence`
      : "プロジェクト詳細 | Carbon Intelligence",
  };
}

function registryColor(r: string) {
  if (r.includes("Verra")) return "emerald" as const;
  if (r.includes("Gold Standard")) return "amber" as const;
  if (r.includes("CDM")) return "cyan" as const;
  return "gray" as const;
}

function statusColor(s: string) {
  if (s === "Registered" || s === "Active") return "emerald" as const;
  if (s === "Listed" || s === "Validated") return "blue" as const;
  return "gray" as const;
}

function statusJa(s: string): string {
  const map: Record<string, string> = {
    "Registered": "登録済み", "Active": "運用中", "Listed": "審査中",
    "Validated": "検証済み", "Under validation": "検証中", "Under development": "開発中",
    "Completed": "完了", "Withdrawn": "取り下げ", "De-registered": "登録抹消",
  };
  return map[s] ?? s;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function projectNameJa(name: string): string {
  const replacements: [RegExp, string][] = [
    [/\bReforestation\b/gi, "再植林"], [/\bAfforestation\b/gi, "新規植林"],
    [/\bForest Management\b/gi, "森林管理"], [/\bAvoided Deforestation\b/gi, "森林減少回避"],
    [/\bImproved Forest Management\b/gi, "改良森林管理"], [/\bWind Energy\b/gi, "風力エネルギー"],
    [/\bSolar Energy\b/gi, "太陽光エネルギー"], [/\bRenewable Energy\b/gi, "再生可能エネルギー"],
    [/\bCarbon Emission Reduction\b/gi, "炭素排出削減"], [/\bImproved Cookstoves?\b/gi, "改良かまど"],
    [/\bBiochar\b/gi, "バイオ炭"], [/\bDirect Air Capture\b/gi, "直接空気回収"],
    [/\bWaste Management\b/gi, "廃棄物管理"], [/\bProject\b/gi, "プロジェクト"],
    [/\bReduction\b/gi, "削減"], [/\bGeneration\b/gi, "発電"], [/\bPower Plant\b/gi, "発電所"],
  ];
  let result = name;
  for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);
  return result;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 text-sm border-b border-gray-50 last:border-0">
      <span className="font-medium text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-right text-gray-900 ml-4">{value ?? "\u2014"}</span>
    </div>
  );
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  const countries = getCountries(project);
  const totalUnits = calcTotalUnits(project);

  // メソドロジーDBとの紐付け
  let linkedMethodology: Methodology | null = null;
  if (project.methodology) {
    const allMethods = await getMethodologies();
    const code = normalizeMethodologyCode(project.methodology);
    linkedMethodology = allMethods.find((m) => {
      const mTitle = m.title.toLowerCase();
      const mCode = code.toLowerCase();
      return mTitle.includes(mCode) || mTitle.includes(project.methodology!.toLowerCase());
    }) ?? null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* パンくず */}
      <nav className="text-sm text-gray-400">
        <Link href="/projects" className="hover:text-gray-600 transition">
          グローバルプロジェクト
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700 line-clamp-1">{project.projectName.slice(0, 50)}</span>
      </nav>

      {/* ヘッダー */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant={registryColor(project.currentRegistry)}>{project.currentRegistry}</Badge>
          <Badge variant={statusColor(project.projectStatus)}>{statusJa(project.projectStatus)}</Badge>
          {project.methodology && <Badge variant="gray">{project.methodology}</Badge>}
        </div>
        <h1 className="text-xl font-bold text-gray-900">{projectNameJa(project.projectName)}</h1>
        {project.description && (
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">{project.description}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-6">
          {countries.length > 0 && (
            <div>
              <div className="text-xs text-gray-400">国・地域</div>
              <div className="text-sm font-medium text-gray-900">{countries.join(", ")}</div>
            </div>
          )}
          {totalUnits > 0 && (
            <div>
              <div className="text-xs text-gray-400">推定発行量</div>
              <div className="text-lg font-bold text-emerald-700">{formatNumber(totalUnits)} tCO2e</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-400">セクター</div>
            <div className="text-sm text-gray-900">{project.sector}</div>
          </div>
        </div>
        {project.projectLink && (
          <a
            href={project.projectLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            レジストリで確認
          </a>
        )}
      </div>

      {/* 詳細情報 2カラム */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 基本情報 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">プロジェクト情報</h3>
          <InfoRow label="プロジェクトID" value={project.projectId} />
          <InfoRow label="レジストリ" value={project.currentRegistry} />
          <InfoRow label="開発者" value={project.projectDeveloper} />
          <InfoRow
            label="メソドロジー"
            value={
              linkedMethodology ? (
                <Link href={`/methodologies/${linkedMethodology.id}`} className="text-emerald-600 hover:underline">
                  {project.methodology}
                </Link>
              ) : (
                project.methodology
              )
            }
          />
          <InfoRow label="検証機関" value={project.validationBody} />
          <InfoRow label="検証日" value={project.validationDate?.slice(0, 10)} />
          <InfoRow label="プロジェクト種別" value={project.projectType} />
          <InfoRow label="NDC対象" value={project.coveredByNDC} />
        </div>

        {/* 発行・クレジティング情報 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">発行情報</h3>
          {project.estimations.length > 0 ? (
            <div className="space-y-3">
              {project.estimations.map((e, i) => (
                <div key={e.id ?? i} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">クレジティング期間</span>
                    <span className="text-xs font-medium text-gray-700">
                      {e.creditingPeriodStart?.slice(0, 10) ?? "?"} 〜 {e.creditingPeriodEnd?.slice(0, 10) ?? "?"}
                    </span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">
                    {formatNumber(e.unitCount)} tCO2e
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">発行情報なし</p>
          )}

          {project.issuances.length > 0 && (
            <>
              <h4 className="mt-4 mb-2 text-xs font-semibold text-gray-500">検証履歴</h4>
              {project.issuances.slice(0, 5).map((iss, i) => (
                <div key={iss.id ?? i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-600">{iss.verificationBody ?? "不明"}</span>
                  <span className="text-gray-400">
                    {iss.startDate?.slice(0, 10)} 〜 {iss.endDate?.slice(0, 10)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* メソドロジーDB連携 */}
      {linkedMethodology && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-emerald-900">メソドロジーDB連携</h3>
          <Link
            href={`/methodologies/${linkedMethodology.id}`}
            className="block rounded-lg border border-emerald-200 bg-white p-4 transition hover:shadow-md"
          >
            <p className="text-sm font-bold text-gray-900">
              {linkedMethodology.titleJa ?? linkedMethodology.title}
            </p>
            {linkedMethodology.titleJa && (
              <p className="mt-0.5 text-xs text-gray-400">{linkedMethodology.title}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {linkedMethodology.registry && (
                <Badge variant="emerald">{linkedMethodology.registry}</Badge>
              )}
              {linkedMethodology.creditType && (
                <Badge variant="blue">{linkedMethodology.creditType}</Badge>
              )}
              {linkedMethodology.subCategory && (
                <Badge variant="gray">{linkedMethodology.subCategory}</Badge>
              )}
            </div>
            {linkedMethodology.aiSummary && (
              <p className="mt-2 text-xs text-gray-500 line-clamp-2">{linkedMethodology.aiSummary}</p>
            )}
          </Link>
        </div>
      )}

      {/* ラベル・共便益 */}
      {(project.labels.length > 0 || project.coBenefits.length > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {project.labels.length > 0 && (
            <>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">ラベル・認証</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {project.labels.map((l, i) => (
                  <Badge key={l.id ?? i} variant="blue">
                    {l.label ?? l.labelType ?? "ラベル"}
                    {l.unitQuantity ? ` (${formatNumber(l.unitQuantity)} tCO2e)` : ""}
                  </Badge>
                ))}
              </div>
            </>
          )}
          {project.coBenefits.length > 0 && (
            <>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">共便益 (Co-Benefits)</h3>
              <div className="flex flex-wrap gap-2">
                {project.coBenefits.map((cb, i) => (
                  <Badge key={cb.id ?? i} variant="emerald">{cb.cobenefit}</Badge>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* データソース */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-[10px] text-gray-400">
          データソース: Climate Action Data Trust (CAD Trust) |{" "}
          <a href="https://climateactiondata.org" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">
            climateactiondata.org
          </a>{" "}
          | ID: {project.warehouseProjectId}
        </p>
      </div>

      {/* 戻る */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-emerald-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        プロジェクト一覧に戻る
      </Link>
    </div>
  );
}
