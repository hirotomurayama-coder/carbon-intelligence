import { getProjects, translateProjects } from "@/lib/cad-trust";
import type { CadProject } from "@/lib/cad-trust";
import { getMethodologies } from "@/lib/wordpress";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const metadata: Metadata = {
  title: "グローバルプロジェクト | Carbon Intelligence",
  description: "CAD Trust連携。世界16,000以上のカーボンクレジットプロジェクトを検索・閲覧。",
};

type Props = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

/** セクター名を日本語化 */
function sectorJa(s: string): string {
  const map: Record<string, string> = {
    "Agriculture; forestry and fishing": "農林水産業",
    "Waste handling and disposal": "廃棄物処理",
    "Energy Industries (renewable/non-renewable sources)": "エネルギー産業",
    "Energy industries (renewable - / non-renewable sources)": "エネルギー産業",
    "Transportation and storage": "運輸・物流",
    "Afforestation and reforestation": "植林・再植林",
    "Livestock, enteric fermentation, and manure management": "畜産・メタン",
    "Energy Demand": "エネルギー需要",
    "Fugitive emissions from fuel (solid, oil and gas)": "燃料漏出",
    "Mining and quarrying": "鉱業",
    "Manufacturing industries": "製造業",
    "Chemical industry": "化学産業",
    "Metal production": "金属生産",
    "Construction": "建設",
  };
  return map[s] ?? s;
}

/** 国名を日本語化 */
function countryJa(s: string): string {
  const map: Record<string, string> = {
    "India": "インド", "China": "中国", "Brazil": "ブラジル",
    "United States of America": "アメリカ", "Indonesia": "インドネシア",
    "South Africa": "南アフリカ", "Peru": "ペルー", "Colombia": "コロンビア",
    "Argentina": "アルゼンチン", "Malawi": "マラウイ", "Kenya": "ケニア",
    "Vietnam": "ベトナム", "Thailand": "タイ", "Mexico": "メキシコ",
    "Philippines": "フィリピン", "Myanmar": "ミャンマー", "Cambodia": "カンボジア",
    "Japan": "日本", "Bangladesh": "バングラデシュ", "Nepal": "ネパール",
    "Turkey": "トルコ", "Egypt": "エジプト", "Pakistan": "パキスタン",
    "Chile": "チリ", "Guatemala": "グアテマラ", "Ethiopia": "エチオピア",
    "Nigeria": "ナイジェリア", "Tanzania, United Republic of": "タンザニア",
    "Uganda": "ウガンダ", "Honduras": "ホンジュラス", "Ghana": "ガーナ",
    "Malaysia": "マレーシア", "Sri Lanka": "スリランカ", "Bolivia (Plurinational State of)": "ボリビア",
    "Congo, Democratic Republic of the": "コンゴ民主共和国", "Mozambique": "モザンビーク",
    "Madagascar": "マダガスカル", "Dominican Republic": "ドミニカ共和国",
    "Costa Rica": "コスタリカ", "Panama": "パナマ", "Ecuador": "エクアドル",
    "Rwanda": "ルワンダ", "Zambia": "ザンビア",
    "Lao People's Democratic Republic": "ラオス",
  };
  return map[s] ?? s;
}

/** サンプルからの統計集計 */
function computeStats(projects: CadProject[]) {
  const registries: Record<string, number> = {};
  const sectors: Record<string, number> = {};
  const countries: Record<string, number> = {};
  let totalUnits = 0;

  for (const p of projects) {
    // レジストリ
    const reg = p.currentRegistry ?? "不明";
    registries[reg] = (registries[reg] ?? 0) + 1;

    // セクター（日本語化）
    const sec = sectorJa(p.sector ?? "不明");
    sectors[sec] = (sectors[sec] ?? 0) + 1;

    // 国（日本語化）
    for (const loc of p.projectLocations ?? []) {
      const c = countryJa(loc.country ?? "不明");
      countries[c] = (countries[c] ?? 0) + 1;
    }

    // ユニット合計
    for (const e of p.estimations ?? []) {
      totalUnits += e.unitCount ?? 0;
    }
  }

  return {
    registries: Object.entries(registries).sort((a, b) => b[1] - a[1]),
    sectors: Object.entries(sectors).sort((a, b) => b[1] - a[1]).slice(0, 8),
    countries: Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 12),
    totalUnits,
  };
}

export default async function ProjectsPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q ?? "";
  const page = parseInt(params.page ?? "1", 10) || 1;

  // メソドロジーDBを取得（メソドロジータグのリンク化に使用）
  const allMethodologies = await getMethodologies().catch(() => []);

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

  // プロジェクト名を日本語翻訳（サーバーサイドで実行）
  const translated = await translateProjects(result.data).catch(() => []);
  const nameTranslations: Record<string, string> = {};
  for (const t of translated) {
    nameTranslations[t.warehouseProjectId] = t.projectNameJa;
  }

  // 統計用に複数ページからサンプルデータ取得（初回表示時のみ）
  let stats = { registries: [] as [string, number][], sectors: [] as [string, number][], countries: [] as [string, number][], totalUnits: 0 };
  if (!query && page === 1) {
    try {
      // 複数ページからサンプリングしてレジストリ分布を正確に
      const pages = await Promise.all([
        getProjects({ page: 1, limit: 100 }),
        getProjects({ page: 10, limit: 100 }).catch(() => ({ data: [] })),
        getProjects({ page: 50, limit: 100 }).catch(() => ({ data: [] })),
      ]);
      const allSample = pages.flatMap((p) => "data" in p ? p.data : []);
      stats = computeStats(allSample as CadProject[]);
    } catch {
      // stats は空のまま
    }
  }

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">データ取得エラー</p>
          <p className="mt-1 break-all">{fetchError}</p>
        </div>
      )}

      <ProjectDashboard
        data={result.data}
        nameTranslations={nameTranslations}
        query={query}
        currentPage={page}
        totalPages={result.pageCount}
        stats={stats}
        methodologies={allMethodologies}
      />
    </div>
  );
}
