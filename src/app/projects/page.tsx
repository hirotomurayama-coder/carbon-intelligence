import { getProjects } from "@/lib/cad-trust";
import { ProjectSearchList } from "@/components/ProjectSearchList";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const metadata: Metadata = {
  title: "グローバルプロジェクト | Carbon Intelligence",
  description: "CAD Trust連携。世界16,000以上のカーボンクレジットプロジェクトを検索・閲覧。",
};

type Props = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    registry?: string;
    country?: string;
    sector?: string;
  }>;
};

export default async function ProjectsPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q ?? "";
  const page = parseInt(params.page ?? "1", 10) || 1;

  let result;
  let fetchError: string | null = null;

  try {
    result = await getProjects({
      page,
      limit: 20,
      search: query || undefined,
    });
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
    result = { page: 1, pageCount: 0, data: [] };
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">グローバルプロジェクト</h1>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            CAD Trust
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Climate Action Data Trust 連携 — 世界{result.pageCount > 0 ? ` ${result.pageCount.toLocaleString()}+` : ""}件のカーボンクレジットプロジェクトを横断検索
        </p>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">データ取得エラー</p>
          <p className="mt-1 break-all">{fetchError}</p>
        </div>
      )}

      <ProjectSearchList
        initialData={result.data}
        initialQuery={query}
        currentPage={page}
        totalPages={result.pageCount}
      />
    </div>
  );
}
