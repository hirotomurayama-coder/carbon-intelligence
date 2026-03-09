import type {
  Methodology,
  MethodologyType,
  Company,
  CompanyCategory,
  Insight,
  InsightCategory,
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

/** acf フィールドを安全に取り出す（配列の場合は空オブジェクトを返す） */
function getAcf(post: WPPost): Record<string, unknown> {
  if (post.acf && !Array.isArray(post.acf)) return post.acf;
  return {};
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

/** HTML タグを除去し、エンティティをデコードする */
function stripHtml(html: string): string {
  const text = html.replace(/<[^>]*>/g, "");
  return decodeHtmlEntities(text).trim();
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

function mapMethodology(wp: WPPost): Methodology {
  const acf = getAcf(wp);

  const rawType = acfString(acf, "methodology_type", "ARR");
  const type: MethodologyType = VALID_METHODOLOGY_TYPES.includes(rawType as MethodologyType)
    ? (rawType as MethodologyType)
    : "ARR";

  return {
    id: String(wp.id),
    title: stripHtml(wp.title.rendered),
    type,
    region: acfString(acf, "region", "—"),
    validUntil: acfString(acf, "valid_until", "—"),
    summary: stripHtml(wp.excerpt?.rendered ?? wp.content.rendered).slice(0, 200),
    reliabilityScore: acfNumber(acf, "reliability_score"),
  };
}

const VALID_COMPANY_CATEGORIES: CompanyCategory[] = [
  "創出事業者", "仲介", "コンサル", "検証機関",
];

function mapCompany(wp: WPPost): Company {
  const acf = getAcf(wp);

  const rawCat = acfString(acf, "company_category", "創出事業者");
  const category: CompanyCategory = VALID_COMPANY_CATEGORIES.includes(rawCat as CompanyCategory)
    ? (rawCat as CompanyCategory)
    : "創出事業者";

  return {
    id: String(wp.id),
    name: stripHtml(wp.title.rendered),
    category,
    headquarters: acfString(acf, "headquarters", "—"),
    mainProjects: acfStringArray(acf, "main_projects"),
  };
}

const VALID_INSIGHT_CATEGORIES: InsightCategory[] = ["政策", "市場", "技術"];

function mapInsight(wp: WPPost): Insight {
  const acf = getAcf(wp);

  const rawCat = acfString(acf, "insight_category", "市場");
  const category: InsightCategory = VALID_INSIGHT_CATEGORIES.includes(rawCat as InsightCategory)
    ? (rawCat as InsightCategory)
    : "市場";

  return {
    id: String(wp.id),
    title: stripHtml(wp.title.rendered),
    date: wp.date ? wp.date.slice(0, 10) : "",
    category,
    summary: stripHtml(wp.excerpt?.rendered ?? wp.content.rendered).slice(0, 200),
  };
}

// ============================================================
// 公開 API 関数 — 3つの CPT を直接取得
// データ取得失敗時は空配列を返す（graceful degradation）
// ============================================================

/** メソドロジー一覧を取得（CPT: methodologies） */
export async function getMethodologies(): Promise<Methodology[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] methodologies — API not configured, returning []");
    return [];
  }
  try {
    const posts = await wpFetch<WPPost>("methodologies?per_page=100");
    return posts.map(mapMethodology);
  } catch (e) {
    console.error("[WP FAIL] methodologies:", e);
    return [];
  }
}

/** 企業一覧を取得（CPT: companies） */
export async function getCompanies(): Promise<Company[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] companies — API not configured, returning []");
    return [];
  }
  try {
    const posts = await wpFetch<WPPost>("companies?per_page=100");
    return posts.map(mapCompany);
  } catch (e) {
    console.error("[WP FAIL] companies:", e);
    return [];
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
    return posts.map(mapInsight);
  } catch (e) {
    console.error("[WP FAIL] insights:", e);
    return [];
  }
}
