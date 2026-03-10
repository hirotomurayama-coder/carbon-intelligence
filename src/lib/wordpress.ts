import type {
  Methodology,
  MethodologyType,
  Company,
  CompanyCategory,
  Insight,
  InsightDetail,
  InsightCategory,
  RegistryName,
} from "@/types";

// ============================================================
// WordPress REST API レスポンス型
// ============================================================

type WPPost = {
  id: number;
  slug: string;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt?: { rendered: string };
  meta?: Record<string, unknown>;
  acf?: Record<string, unknown> | unknown[];
};

// ============================================================
// 設定 — 環境B（staging サイト）のみに接続
// ※ carboncredits.jp（既存ニュースサイト）には一切接続しない
// ============================================================

const API_BASE =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";

function isApiConfigured(): boolean {
  return API_BASE !== "" && !API_BASE.includes("example.com");
}

// ============================================================
// ACF カスタムフィールド読み取りヘルパー
// ============================================================

/** acf フィールドを安全に取り出す（データ有無フラグ付き） */
function getAcf(post: WPPost): { data: Record<string, unknown>; hasData: boolean } {
  if (
    post.acf &&
    !Array.isArray(post.acf) &&
    typeof post.acf === "object" &&
    Object.keys(post.acf).length > 0
  ) {
    return { data: post.acf, hasData: true };
  }
  return { data: {}, hasData: false };
}

/** acf → 文字列 */
function acfString(acf: Record<string, unknown>, key: string, fallback = ""): string {
  const v = acf[key];
  return typeof v === "string" ? v : fallback;
}

/** acf → 数値 */
function acfNumber(acf: Record<string, unknown>, key: string, fallback = 0): number {
  const v = acf[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** acf → 文字列配列（カンマ区切り文字列 or JSON 配列） */
function acfStringArray(acf: Record<string, unknown>, key: string): string[] {
  const v = acf[key];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim() !== "") return v.split(",").map((s) => s.trim());
  return [];
}

// ============================================================
// HTML エンティティデコード + タグ除去
// ============================================================

/** HTML エンティティをデコードする（二重エンコード対応） */
function decodeHtmlEntities(text: string): string {
  // 1. &amp; → & (二重エンコード対策: &amp;#12464; → &#12464;)
  let decoded = text.replace(/&amp;/g, "&");
  // 2. 数値エンティティ &#12464; → グ
  decoded = decoded.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(Number(code))
  );
  // 3. 16進エンティティ &#x30B0; → グ
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  // 4. 名前付きエンティティ
  decoded = decoded.replace(/&lt;/g, "<");
  decoded = decoded.replace(/&gt;/g, ">");
  decoded = decoded.replace(/&quot;/g, '"');
  decoded = decoded.replace(/&apos;/g, "'");
  decoded = decoded.replace(/&nbsp;/g, " ");
  return decoded;
}

/** URL エンコードされた文字列をデコードする（不正な文字列でもクラッシュしない） */
function decodeUrlEncoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** HTML タグを除去し、エンティティ + URL エンコードをデコードする */
function stripHtml(html: string): string {
  const text = html.replace(/<[^>]*>/g, "");
  return decodeUrlEncoded(decodeHtmlEntities(text)).trim();
}

// ============================================================
// 汎用 fetch ヘルパー（常にダイナミック — キャッシュ無効）
// ============================================================

async function wpFetch<T>(endpoint: string): Promise<T[]> {
  const url = `${API_BASE}/${endpoint}`;

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
  console.log(`[WP] ${endpoint}: ${count} items returned`);

  return json;
}

// ============================================================
// マッピング (WordPress CPT → アプリ型)
// ============================================================

const VALID_METHODOLOGY_TYPES: MethodologyType[] = [
  "ARR", "ALM", "マングローブ", "REDD+", "再生可能エネルギー", "省エネルギー",
];

const VALID_REGISTRY_NAMES: RegistryName[] = [
  "Verra", "Gold Standard", "Puro.earth", "Isometric", "J-Credit",
];

function mapMethodology(wp: WPPost): Methodology {
  const { data: acf, hasData } = getAcf(wp);

  let type: MethodologyType | null = null;
  let region: string | null = null;
  let validUntil: string | null = null;
  let reliabilityScore: number | null = null;

  if (hasData) {
    const rawType = acfString(acf, "methodology_type", "");
    type = VALID_METHODOLOGY_TYPES.includes(rawType as MethodologyType)
      ? (rawType as MethodologyType)
      : null;
    region = acfString(acf, "region", "") || null;
    validUntil = acfString(acf, "valid_until", "") || null;
    const score = acfNumber(acf, "reliability_score", -1);
    reliabilityScore = score >= 0 ? score : null;
  }

  // 同期メタデータ（ACF: registry, source_url, data_hash, external_last_updated, synced_at）
  let registry: RegistryName | null = null;
  let sourceUrl: string | null = null;
  let dataHash: string | null = null;
  let externalLastUpdated: string | null = null;
  let syncedAt: string | null = null;

  if (hasData) {
    const rawRegistry = acfString(acf, "registry", "");
    registry = VALID_REGISTRY_NAMES.includes(rawRegistry as RegistryName)
      ? (rawRegistry as RegistryName)
      : null;
    sourceUrl = acfString(acf, "source_url", "") || null;
    dataHash = acfString(acf, "data_hash", "") || null;
    externalLastUpdated = acfString(acf, "external_last_updated", "") || null;
    syncedAt = acfString(acf, "synced_at", "") || null;
  }

  // AI エンリッチフィールド（WordPress ACF フィールド名で読み取り）
  let titleJa: string | null = null;
  let aiSummary: string | null = null;
  let creditType: string | null = null;
  let baseType: string | null = null;
  let subCategory: string | null = null;
  let operationalStatus: string | null = null;
  let certificationBody: string | null = null;
  let version: string | null = null;

  if (hasData) {
    const rawTitleJa = acfString(acf, "title_ja", "");
    // title_ja が英語原文と同じ場合は「翻訳なし」扱い → null
    titleJa = rawTitleJa && rawTitleJa !== stripHtml(wp.title.rendered) ? rawTitleJa : null;
    aiSummary = acfString(acf, "ai_summary", "") || null;
    // select フィールド: WP が false を返す場合がある → acfString で空文字化 → || null で null に
    creditType = acfString(acf, "credit_type", "") || null;
    baseType = acfString(acf, "base_type", "") || null;
    subCategory = acfString(acf, "sub_category", "") || null;
    operationalStatus = acfString(acf, "status", "") || null;
    certificationBody = acfString(acf, "standard", "") || null;
    version = acfString(acf, "version", "") || null;
  }

  return {
    id: String(wp.id),
    title: stripHtml(wp.title.rendered),
    type,
    region,
    validUntil,
    summary: stripHtml(wp.excerpt?.rendered ?? wp.content.rendered).slice(0, 200),
    reliabilityScore,
    registry,
    sourceUrl,
    dataHash,
    externalLastUpdated,
    syncedAt,
    titleJa,
    aiSummary,
    creditType,
    baseType,
    subCategory,
    operationalStatus,
    certificationBody,
    version,
  };
}

const VALID_COMPANY_CATEGORIES: CompanyCategory[] = [
  "創出", "仲介", "コンサル", "検証機関",
];

function mapCompany(wp: WPPost): Company {
  const { data: acf, hasData } = getAcf(wp);

  let category: CompanyCategory | null = null;
  let headquarters: string | null = null;
  let homepageUrl: string | null = null;
  let description: string | null = null;

  if (hasData) {
    const rawCat = acfString(acf, "company_category", "");
    category = VALID_COMPANY_CATEGORIES.includes(rawCat as CompanyCategory)
      ? (rawCat as CompanyCategory)
      : null;
    headquarters = acfString(acf, "headquarters", "") || null;
    homepageUrl = acfString(acf, "homepage_url", "") || null;
    description = acfString(acf, "company_description", "") || null;
  }

  return {
    id: String(wp.id),
    name: stripHtml(wp.title.rendered),
    category,
    headquarters,
    mainProjects: hasData ? acfStringArray(acf, "main_projects") : [],
    homepageUrl,
    description,
  };
}

const VALID_INSIGHT_CATEGORIES: InsightCategory[] = ["政策", "市場", "技術"];

function mapInsight(wp: WPPost): Insight {
  const { data: acf, hasData } = getAcf(wp);

  let category: InsightCategory | null = null;

  if (hasData) {
    const rawCat = acfString(acf, "insight_category", "");
    category = VALID_INSIGHT_CATEGORIES.includes(rawCat as InsightCategory)
      ? (rawCat as InsightCategory)
      : null;
  }

  return {
    id: String(wp.id),
    title: stripHtml(wp.title.rendered),
    date: wp.date ? wp.date.slice(0, 10) : "",
    category,
    summary: stripHtml(wp.excerpt?.rendered ?? wp.content.rendered).slice(0, 200),
  };
}

/** WPPost + _embedded を扱う拡張型 */
type WPPostWithEmbed = WPPost & {
  featured_media?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _embedded?: { "wp:featuredmedia"?: any[] };
};

/** 詳細用マッピング — 本文 HTML とアイキャッチ画像を含む */
function mapInsightDetail(wp: WPPostWithEmbed): InsightDetail {
  const base = mapInsight(wp);

  // アイキャッチ画像 URL を _embedded から取得
  let featuredImageUrl: string | null = null;
  const media = wp._embedded?.["wp:featuredmedia"];
  if (Array.isArray(media) && media.length > 0) {
    const src = media[0]?.source_url;
    if (typeof src === "string") featuredImageUrl = src;
  }

  return {
    ...base,
    content: wp.content.rendered,
    featuredImageUrl,
  };
}

// ============================================================
// 公開 API 関数 — 3つの CPT を直接取得
// データ取得失敗時は空配列を返す（graceful degradation）
// ============================================================

/** 単一リソースを取得する汎用ヘルパー */
async function wpFetchSingle<T>(endpoint: string): Promise<T | null> {
  const url = `${API_BASE}/${endpoint}`;
  console.log(`[WP] Fetching single: ${url}`);

  const res = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`[WP ERROR] ${endpoint}: ${res.status} ${res.statusText}`);
    return null;
  }

  return res.json();
}

/** メソドロジーを ID で1件取得（詳細ページ用） */
export async function getMethodologyById(id: string): Promise<Methodology | null> {
  if (!isApiConfigured()) return null;
  try {
    const post = await wpFetchSingle<WPPost>(`methodologies/${id}`);
    if (!post) return null;
    return mapMethodology(post);
  } catch (e) {
    console.error(`[WP FAIL] methodology/${id}:`, e);
    return null;
  }
}

/** メソドロジー一覧を取得（CPT: methodologies、全件ページネーション対応） */
export async function getMethodologies(): Promise<Methodology[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] methodologies — API not configured, returning []");
    return [];
  }
  try {
    const allPosts: WPPost[] = [];
    let page = 1;
    while (true) {
      const posts = await wpFetch<WPPost>(
        `methodologies?per_page=100&page=${page}`
      );
      allPosts.push(...posts);
      if (posts.length < 100) break;
      page++;
    }
    return allPosts.map(mapMethodology);
  } catch (e) {
    console.error("[WP FAIL] methodologies:", e);
    return [];
  }
}

/** 企業を ID で1件取得（詳細ページ用） */
export async function getCompanyById(id: string): Promise<Company | null> {
  if (!isApiConfigured()) return null;
  try {
    const post = await wpFetchSingle<WPPost>(`companies/${id}`);
    if (!post) return null;
    return mapCompany(post);
  } catch (e) {
    console.error(`[WP FAIL] company/${id}:`, e);
    return null;
  }
}

/** 企業一覧を取得（CPT: companies、全件ページネーション対応） */
export async function getCompanies(): Promise<Company[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] companies — API not configured, returning []");
    return [];
  }
  try {
    const allPosts: WPPost[] = [];
    let page = 1;
    while (true) {
      const posts = await wpFetch<WPPost>(
        `companies?per_page=100&page=${page}`
      );
      allPosts.push(...posts);
      if (posts.length < 100) break;
      page++;
    }
    return allPosts.map(mapCompany);
  } catch (e) {
    console.error("[WP FAIL] companies:", e);
    return [];
  }
}

/** インサイトを ID で1件取得（詳細ページ用、_embed でアイキャッチ画像も取得） */
export async function getInsightById(id: string): Promise<InsightDetail | null> {
  if (!isApiConfigured()) return null;
  try {
    const post = await wpFetchSingle<WPPostWithEmbed>(`insights/${id}?_embed`);
    if (!post) return null;
    return mapInsightDetail(post);
  } catch (e) {
    console.error(`[WP FAIL] insight/${id}:`, e);
    return null;
  }
}

/** インサイト一覧を取得（CPT: insights） */
export async function getInsights(): Promise<Insight[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] insights — API not configured, returning []");
    return [];
  }
  try {
    const posts = await wpFetch<WPPost>("insights?per_page=100");
    // 同期エンジンが過去に作成した通知投稿（タイトルに【】を含む）を除外し、
    // 手動で作成された本来のインサイト記事のみを返す
    return posts
      .filter((p) => {
        const title = stripHtml(p.title.rendered);
        return !(title.includes("【") && title.includes("】"));
      })
      .map(mapInsight);
  } catch (e) {
    console.error("[WP FAIL] insights:", e);
    return [];
  }
}

/**
 * 最近更新されたメソドロジーを取得（レジストリ更新セクション用）。
 * ACF の external_last_updated（外部サイト側の最終更新日）を基準にソートし、
 * 外部更新日が新しい順に返す。
 * external_last_updated が空のアイテムはリスト末尾に「日付不明」として配置。
 */
export type RecentUpdate = {
  id: string;
  title: string;
  registry: RegistryName | null;
  externalLastUpdated: string | null;
  modifiedAt: string;
};

export async function getRecentUpdates(limit = 10): Promise<RecentUpdate[]> {
  if (!isApiConfigured()) return [];
  try {
    // 多めに取得してクライアント側で external_last_updated でソート
    // （WP REST API は ACF カスタムフィールドでの orderby をサポートしない）
    const posts = await wpFetch<WPPost & { modified: string }>(
      `methodologies?per_page=100&orderby=modified&order=desc`
    );

    const mapped = posts.map((wp) => {
      const { data: acf, hasData } = getAcf(wp);
      const rawRegistry = hasData ? acfString(acf, "registry", "") : "";
      const registry = VALID_REGISTRY_NAMES.includes(rawRegistry as RegistryName)
        ? (rawRegistry as RegistryName)
        : null;
      const externalLastUpdated =
        hasData ? acfString(acf, "external_last_updated", "") || null : null;
      return {
        id: String(wp.id),
        title: stripHtml(wp.title.rendered),
        registry,
        externalLastUpdated,
        modifiedAt: wp.modified ?? wp.date,
      };
    });

    // external_last_updated でソート（日付あり → 新しい順、日付なし → 末尾）
    mapped.sort((a, b) => {
      if (a.externalLastUpdated && b.externalLastUpdated) {
        return b.externalLastUpdated.localeCompare(a.externalLastUpdated);
      }
      if (a.externalLastUpdated && !b.externalLastUpdated) return -1;
      if (!a.externalLastUpdated && b.externalLastUpdated) return 1;
      return 0;
    });

    return mapped.slice(0, limit);
  } catch (e) {
    console.error("[WP FAIL] recentUpdates:", e);
    return [];
  }
}
