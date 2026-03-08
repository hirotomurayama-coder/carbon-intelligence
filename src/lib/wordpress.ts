import type {
  Methodology,
  MethodologyType,
  Company,
  CompanyCategory,
  Insight,
  InsightCategory,
} from "@/types";
import {
  methodologies as dummyMethodologies,
  companies as dummyCompanies,
  insights as dummyInsights,
} from "./dummyData";

// ============================================================
// WordPress REST API のレスポンス型
// ============================================================

/**
 * WordPress.com のレスポンス共通フィールド。
 * - acf は ACF プラグイン有効時はオブジェクト、無効時は空配列 [] になる。
 * - meta にカスタムフィールドが格納されるケースもある。
 */
type WPPost = {
  id: number;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt?: { rendered: string };
  meta?: Record<string, unknown>;
  // ACF REST API 有効時はオブジェクト、未設定時は [] (空配列)
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
  // ACF 未設定時は [] (配列) が返るのでオブジェクトかどうかチェック
  if (post.acf && !Array.isArray(post.acf)) return post.acf;
  return {};
}

// ============================================================
// デバッグログ
// ============================================================

const DEBUG = process.env.NODE_ENV === "development";

function debugLog(label: string, data: unknown) {
  if (!DEBUG) return;
  console.log(`[WP DEBUG] ${label}:`, JSON.stringify(data, null, 2));
}

// ============================================================
// 汎用 fetch ヘルパー
// ============================================================

async function wpFetch<T>(endpoint: string): Promise<T[]> {
  const url = `${API_BASE}/${endpoint}?per_page=100`;

  debugLog("Fetching", url);

  // dev ではキャッシュ無効化、本番では 60 秒 ISR
  const fetchOptions: RequestInit = {
    redirect: "follow",
    ...(DEBUG ? { cache: "no-store" as const } : { next: { revalidate: 1 } }),
  };

  const res = await fetch(url, fetchOptions);

  debugLog("Response status", {
    endpoint,
    status: res.status,
    redirected: res.redirected,
    finalUrl: res.url,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(読み取り不可)");
    const msg = `WordPress API error [${endpoint}]: ${res.status} ${res.statusText} - ${body.slice(0, 300)}`;
    debugLog("Error", msg);
    throw new Error(msg);
  }

  const json = await res.json();
  const count = Array.isArray(json) ? json.length : "not-array";

  debugLog(`${endpoint} result`, {
    count,
    ids: Array.isArray(json) ? json.map((p: { id: number }) => p.id) : [],
  });

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
// WordPress 未接続 or データ0件 のときはダミーデータにフォールバック
// ============================================================

export async function getMethodologies(): Promise<Methodology[]> {
  if (!isApiConfigured()) {
    debugLog("Skip", "methodologies — API not configured, using dummy");
    return dummyMethodologies;
  }
  try {
    const posts = await wpFetch<WPPost>("methodologies");
    if (posts.length === 0) {
      debugLog("Empty", "methodologies: 0 posts from WP, using dummy");
      return dummyMethodologies;
    }
    const mapped = posts.map(mapMethodology);
    debugLog("OK", `methodologies: ${mapped.length} items mapped from WP`);
    return mapped;
  } catch (e) {
    debugLog("Error", `methodologies fetch failed: ${e}`);
    console.error("Failed to fetch methodologies:", e);
    return dummyMethodologies;
  }
}

export async function getCompanies(): Promise<Company[]> {
  if (!isApiConfigured()) {
    debugLog("Skip", "companies — API not configured, using dummy");
    return dummyCompanies;
  }
  try {
    const posts = await wpFetch<WPPost>("companies");
    if (posts.length === 0) {
      debugLog("Empty", "companies: 0 posts from WP, using dummy");
      return dummyCompanies;
    }
    const mapped = posts.map(mapCompany);
    debugLog("OK", `companies: ${mapped.length} items mapped from WP`);
    return mapped;
  } catch (e) {
    debugLog("Error", `companies fetch failed: ${e}`);
    console.error("Failed to fetch companies:", e);
    return dummyCompanies;
  }
}

export async function getInsights(): Promise<Insight[]> {
  if (!isApiConfigured()) {
    debugLog("Skip", "insights — API not configured, using dummy");
    return dummyInsights;
  }
  try {
    const posts = await wpFetch<WPPost>("insights");
    if (posts.length === 0) {
      debugLog("Empty", "insights: 0 posts from WP, using dummy");
      return dummyInsights;
    }
    const mapped = posts.map(mapInsight);
    debugLog("OK", `insights: ${mapped.length} items mapped from WP`);
    return mapped;
  } catch (e) {
    debugLog("Error", `insights fetch failed: ${e}`);
    console.error("Failed to fetch insights:", e);
    return dummyInsights;
  }
}
