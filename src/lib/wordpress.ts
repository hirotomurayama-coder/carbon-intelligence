import type {
  Methodology,
  MethodologyType,
  Company,
  CompanyCategory,
  Insight,
  InsightCategory,
} from "@/types";

// ============================================================
// WordPress REST API のレスポンス型
// ============================================================

type WPPost = {
  id: number;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt?: { rendered: string };
  meta?: Record<string, unknown>;
  acf?: Record<string, unknown> | unknown[];
};

// ============================================================
// 設定
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";

/** API が有効か（URL が設定されている、かつ example.com でない） */
function isApiConfigured(): boolean {
  return API_BASE !== "" && !API_BASE.includes("example.com");
}

/** acf フィールドをオブジェクトとして安全に取得 */
function getAcf(post: WPPost): Record<string, unknown> {
  if (post.acf && !Array.isArray(post.acf)) return post.acf;
  return {};
}

// ============================================================
// 汎用 fetch ヘルパー（常にダイナミック — キャッシュ無効）
// ============================================================

async function wpFetch<T>(endpoint: string): Promise<T[]> {
  const url = `${API_BASE}/${endpoint}?per_page=100`;

  console.log(`[WP] Fetching: ${url}`);

  const res = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
  });

  console.log(
    `[WP] ${endpoint}: ${res.status} ${res.statusText}` +
      (res.redirected ? ` (redirected → ${res.url})` : "")
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "(読み取り不可)");
    const msg = `[WP ERROR] ${endpoint}: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`;
    console.error(msg);
    throw new Error(msg);
  }

  const json = await res.json();
  const count = Array.isArray(json) ? json.length : "not-array";
  console.log(`[WP] ${endpoint}: ${count} posts returned`);

  return json;
}

// ============================================================
// HTML タグ除去ヘルパー
// ============================================================

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// ============================================================
// マッピング (WordPress → アプリ型)
// ============================================================

function mapMethodology(wp: WPPost): Methodology {
  const acf = getAcf(wp);
  const meta = wp.meta ?? {};

  return {
    id: `m-${wp.id}`,
    title: stripHtml(wp.title.rendered),
    type:
      (acf.methodology_type as MethodologyType) ??
      (meta.methodology_type as MethodologyType) ??
      "ARR",
    region:
      (acf.region as string) ??
      (meta.region as string) ??
      "",
    validUntil:
      (acf.valid_until as string) ??
      (meta.valid_until as string) ??
      "",
    summary:
      (acf.summary as string) ??
      (stripHtml(wp.content.rendered) || ""),
    reliabilityScore:
      Number(acf.reliability_score ?? meta.reliability_score) || 0,
  };
}

function mapCompany(wp: WPPost): Company {
  const acf = getAcf(wp);
  const meta = wp.meta ?? {};

  const rawProjects =
    (acf.main_projects as string) ??
    (meta.main_projects as string) ??
    "";
  const projects = rawProjects
    ? rawProjects.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  return {
    id: `c-${wp.id}`,
    name: stripHtml(wp.title.rendered),
    category:
      (acf.category as CompanyCategory) ??
      (meta.category as CompanyCategory) ??
      "創出事業者",
    headquarters:
      (acf.headquarters as string) ??
      (meta.headquarters as string) ??
      "",
    mainProjects: projects,
  };
}

function mapInsight(wp: WPPost): Insight {
  const acf = getAcf(wp);
  const meta = wp.meta ?? {};

  return {
    id: `i-${wp.id}`,
    title: stripHtml(wp.title.rendered),
    date:
      (acf.insight_date as string) ??
      (meta.insight_date as string) ??
      wp.slug.slice(0, 10),
    category:
      (acf.insight_category as InsightCategory) ??
      (meta.insight_category as InsightCategory) ??
      "市場",
    summary:
      (acf.summary as string) ??
      (stripHtml(wp.content.rendered) || ""),
  };
}

// ============================================================
// 公開 API 関数
// データ取得失敗時は空配列を返す（ダミーデータには一切戻さない）
// ============================================================

export async function getMethodologies(): Promise<Methodology[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] methodologies — API not configured, returning []");
    return [];
  }
  try {
    const posts = await wpFetch<WPPost>("methodologies");
    const mapped = posts.map(mapMethodology);
    return mapped;
  } catch (e) {
    console.error("[WP FAIL] methodologies:", e);
    return [];
  }
}

export async function getCompanies(): Promise<Company[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] companies — API not configured, returning []");
    return [];
  }
  try {
    const posts = await wpFetch<WPPost>("companies");
    const mapped = posts.map(mapCompany);
    return mapped;
  } catch (e) {
    console.error("[WP FAIL] companies:", e);
    return [];
  }
}

export async function getInsights(): Promise<Insight[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] insights — API not configured, returning []");
    return [];
  }
  try {
    const posts = await wpFetch<WPPost>("insights");
    const mapped = posts.map(mapInsight);
    return mapped;
  } catch (e) {
    console.error("[WP FAIL] insights:", e);
    return [];
  }
}
