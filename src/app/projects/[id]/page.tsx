import { getProjectById, calcTotalUnits, getCountries } from "@/lib/cad-trust";
import { Badge } from "@/components/ui/Badge";
import { notFound } from "next/navigation";
import Link from "next/link";
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

function formatNumber(n: number): string {
  return n.toLocaleString();
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
          <Badge variant={statusColor(project.projectStatus)}>{project.projectStatus}</Badge>
          {project.methodology && <Badge variant="gray">{project.methodology}</Badge>}
        </div>
        <h1 className="text-xl font-bold text-gray-900">{project.projectName}</h1>
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
          <InfoRow label="メソドロジー" value={project.methodology} />
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
