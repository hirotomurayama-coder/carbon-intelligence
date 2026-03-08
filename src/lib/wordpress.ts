import type { Article, GlossaryTerm } from "@/types";
import { CATEGORY_MAP } from "@/types";

// ============================================================
// WordPress REST API のレスポンス型
// ============================================================

type WPPost = {
  id: number;
  slug: string;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt?: { rendered: string };
  categories?: number[];
  link?: string;
};

type WPGlossary = {
  id: number;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
};

// ============================================================
// 設定
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";

/** API が有効か（URL が設定されている、かつ example.com でない） */
function isApiConfigured(): boolean {
  return API_BASE !== "" && !API_BASE.includes("example.com");
}

// ============================================================
// 汎用 fetch ヘルパー（常にダイナミック — キャッシュ無効）
// ============================================================

async function wpFetch<T>(endpoint: string, params = ""): Promise<T[]> {
  const sep = params ? "&" : "";
  const url = `${API_BASE}/${endpoint}?per_page=100${sep}${params}`;

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
// HTML タグ除去ヘルパー
// ============================================================

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// ============================================================
// マッピング (WordPress → アプリ型)
// ============================================================

function mapArticle(wp: WPPost): Article {
  const firstCatId = wp.categories?.[0] ?? 0;
  const category = CATEGORY_MAP[firstCatId] ?? "国内ニュース";
  const dateStr = wp.date ? wp.date.slice(0, 10) : "";

  return {
    id: `a-${wp.id}`,
    title: stripHtml(wp.title.rendered),
    date: dateStr,
    category,
    excerpt: stripHtml(wp.excerpt?.rendered ?? wp.content.rendered).slice(0, 200),
    link: wp.link ?? "",
  };
}

function mapGlossaryTerm(wp: WPGlossary): GlossaryTerm {
  return {
    id: `g-${wp.id}`,
    term: stripHtml(wp.title.rendered),
    slug: wp.slug,
    description: stripHtml(wp.content.rendered).slice(0, 300),
  };
}

// ============================================================
// 公開 API 関数
// データ取得失敗時は空配列を返す
// ============================================================

/** 記事一覧を取得（カテゴリーIDで絞り込み可） */
export async function getArticles(categoryId?: number): Promise<Article[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] articles — API not configured, returning []");
    return [];
  }
  try {
    const params = categoryId ? `categories=${categoryId}` : "";
    const posts = await wpFetch<WPPost>("posts", params);
    return posts.map(mapArticle);
  } catch (e) {
    console.error("[WP FAIL] articles:", e);
    return [];
  }
}

/** 用語集を取得 */
export async function getGlossaryTerms(): Promise<GlossaryTerm[]> {
  if (!isApiConfigured()) {
    console.warn("[WP] glossary — API not configured, returning []");
    return [];
  }
  try {
    const posts = await wpFetch<WPGlossary>("glossary", "_fields=id,slug,title,content");
    return posts.map(mapGlossaryTerm);
  } catch (e) {
    console.error("[WP FAIL] glossary:", e);
    return [];
  }
}
