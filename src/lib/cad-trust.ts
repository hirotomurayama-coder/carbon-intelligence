/**
 * CAD Trust (Climate Action Data Trust) API クライアント。
 * 世界中のカーボンクレジットプロジェクト・ユニットデータにアクセス。
 *
 * API: https://observer.climateactiondata.org/api/v1
 * データ: 16,000+ プロジェクト、300,000+ ユニット
 * レジストリ: Verra, Gold Standard, CDM, ACR 等
 */

const CAD_API = "https://observer.climateactiondata.org/api/v1";
const DEFAULT_TIMEOUT = 15_000;

// ============================================================
// 型定義
// ============================================================

export type CadProject = {
  warehouseProjectId: string;
  currentRegistry: string;
  projectId: string;
  registryOfOrigin: string;
  program: string | null;
  projectName: string;
  projectLink: string;
  projectDeveloper: string | null;
  sector: string;
  projectType: string | null;
  projectTags: string | null;
  coveredByNDC: string | null;
  projectStatus: string;
  projectStatusDate: string | null;
  unitMetric: string;
  methodology: string | null;
  methodology2: string | null;
  validationBody: string | null;
  validationDate: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  projectLocations: CadProjectLocation[];
  issuances: CadIssuance[];
  coBenefits: CadCoBenefit[];
  estimations: CadEstimation[];
  labels: CadLabel[];
  projectRatings: CadProjectRating[];
  relatedProjects: CadRelatedProject[];
};

export type CadProjectLocation = {
  id: string;
  country: string;
  inCountryRegion: string | null;
  geographicIdentifier: string | null;
};

export type CadIssuance = {
  id: string;
  startDate: string | null;
  endDate: string | null;
  verificationApproach: string | null;
  verificationReportDate: string | null;
  verificationBody: string | null;
};

export type CadCoBenefit = {
  id: string;
  cobenefit: string;
};

export type CadEstimation = {
  id: string;
  creditingPeriodStart: string | null;
  creditingPeriodEnd: string | null;
  unitCount: number;
};

export type CadLabel = {
  id: string;
  labelType: string | null;
  label: string | null;
  creditingPeriodStartDate: string | null;
  creditingPeriodEndDate: string | null;
  unitQuantity: number | null;
};

export type CadProjectRating = {
  id: string;
  ratingType: string | null;
  rating: string | null;
  ratingLink: string | null;
};

export type CadRelatedProject = {
  id: string;
  relationshipType: string | null;
  registry: string | null;
};

export type CadProjectsResponse = {
  page: number;
  pageCount: number;
  data: CadProject[];
};

// ============================================================
// API 呼び出し
// ============================================================

async function cadFetch<T>(endpoint: string): Promise<T> {
  const url = `${CAD_API}${endpoint}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 }, // 1時間キャッシュ
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!res.ok) {
    throw new Error(`CAD Trust API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/**
 * プロジェクト一覧を取得（ページネーション付き）
 */
export async function getProjects(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<CadProjectsResponse> {
  const { page = 1, limit = 20, search } = params;
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (search) qs.set("search", search);

  return cadFetch<CadProjectsResponse>(`/projects?${qs.toString()}`);
}

/**
 * プロジェクト詳細を取得（warehouseProjectId で直接取得）
 */
export async function getProjectById(warehouseProjectId: string): Promise<CadProject | null> {
  try {
    return await cadFetch<CadProject>(
      `/projects?warehouseProjectId=${encodeURIComponent(warehouseProjectId)}`
    );
  } catch {
    return null;
  }
}

/**
 * メソドロジー名でプロジェクトを検索
 */
export async function getProjectsByMethodology(
  methodology: string,
  limit = 10
): Promise<CadProject[]> {
  try {
    const res = await getProjects({ search: methodology, limit });
    return res.data.filter(
      (p) => p.methodology?.toLowerCase().includes(methodology.toLowerCase())
    );
  } catch {
    return [];
  }
}

/**
 * 統計情報を取得（プロジェクト総数）
 */
export async function getProjectStats(): Promise<{ totalProjects: number }> {
  try {
    const res = await getProjects({ page: 1, limit: 1 });
    return { totalProjects: res.pageCount };
  } catch {
    return { totalProjects: 0 };
  }
}

// ============================================================
// ヘルパー
// ============================================================

/**
 * CAD Trust メソドロジー名から、内部メソドロジーDB のマッチを探す。
 * 例: "VM0047" → Verra VM0047 のメソドロジーID
 */
export function normalizeMethodologyCode(cadMethodology: string): string {
  // "VCS-VM0042" → "VM0042", "CDM - AMS-I.D." → "AMS-I.D."
  return cadMethodology
    .replace(/^VCS-/i, "")
    .replace(/^CDM\s*-\s*/i, "")
    .replace(/^GS\s*-\s*/i, "")
    .trim();
}

// ============================================================
// Google 翻訳（無料API）
// ============================================================

const translateCache = new Map<string, string>();

/**
 * Google翻訳（無料エンドポイント）で英語→日本語に翻訳。
 * メモリキャッシュ付き。失敗時は原文をそのまま返す。
 */
export async function translateToJa(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text;
  // 既に日本語っぽい場合はそのまま返す
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) return text;

  const cached = translateCache.get(text);
  if (cached) return cached;

  try {
    const encoded = encodeURIComponent(text);
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=${encoded}`,
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!res.ok) return text;

    const data = await res.json();
    // レスポンス形式: [[["翻訳文","原文",null,null,10]],null,"en"]
    const translated = Array.isArray(data?.[0])
      ? (data[0] as unknown[][]).map((s) => (s as string[])[0]).join("")
      : text;

    translateCache.set(text, translated);
    return translated;
  } catch {
    return text;
  }
}

/**
 * プロジェクトのテキストフィールドを一括翻訳。
 * projectName と description を翻訳する。
 */
export async function translateProject(project: CadProject): Promise<CadProject & { projectNameJa: string; descriptionJa: string }> {
  const [nameJa, descJa] = await Promise.all([
    translateToJa(project.projectName),
    project.description ? translateToJa(project.description) : Promise.resolve(null),
  ]);

  return {
    ...project,
    projectNameJa: nameJa,
    descriptionJa: descJa ?? "",
  };
}

/**
 * 複数プロジェクトのプロジェクト名を一括翻訳（並列数制限付き）
 */
export async function translateProjects(
  projects: CadProject[]
): Promise<(CadProject & { projectNameJa: string })[]> {
  // 5件ずつ並列で翻訳（レート制限対策）
  const results: (CadProject & { projectNameJa: string })[] = [];
  const batchSize = 5;

  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);
    const translated = await Promise.all(
      batch.map(async (p) => ({
        ...p,
        projectNameJa: await translateToJa(p.projectName),
      }))
    );
    results.push(...translated);
  }

  return results;
}

/** 総発行量（ユニット数）を計算 */
export function calcTotalUnits(project: CadProject): number {
  return project.estimations.reduce((sum, e) => sum + (e.unitCount ?? 0), 0);
}

/** プロジェクトの国リストを取得 */
export function getCountries(project: CadProject): string[] {
  return project.projectLocations
    .map((l) => l.country)
    .filter((c, i, arr) => arr.indexOf(c) === i);
}
