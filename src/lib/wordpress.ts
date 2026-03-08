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

// ============================================================
// 設定
// Cloudflare が Vercel IP をブロックするため、
// WordPress.com Public API を直接使用する
// ============================================================

const WP_SITE = "carboncreditsjp.wordpress.com";
const PUBLIC_API = `https://public-api.wordpress.com/wp/v2/sites/${WP_SITE}`;

/** 用語解説カテゴリーID */
const GLOSSARY_CATEGORY_ID = 15;

// ============================================================
// 汎用 fetch ヘルパー（常にダイナミック — キャッシュ無効）
// ============================================================

async function wpFetch<T>(path: string): Promise<T[]> {
  const url = `${PUBLIC_API}/${path}`;

  console.log(`[WP] Fetching: ${url}`);

  const res = await fetch(url, {
    cache: "no-store",
  });

  console.log(`[WP] ${path}: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "(読み取り不可)");
    const msg = `[WP ERROR] ${path}: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`;
    console.error(msg);
    throw new Error(msg);
  }

  const json = await res.json();
  const count = Array.isArray(json) ? json.length : "not-array";
  console.log(`[WP] ${path}: ${count} items returned`);

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

function mapGlossaryTerm(wp: WPPost): GlossaryTerm {
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

/** 記事一覧を取得（用語解説カテゴリーを除外、カテゴリーIDで絞り込み可） */
export async function getArticles(categoryId?: number): Promise<Article[]> {
  try {
    const catParam = categoryId
      ? `categories=${categoryId}`
      : `categories_exclude=${GLOSSARY_CATEGORY_ID}`;
    const posts = await wpFetch<WPPost>(
      `posts?per_page=100&${catParam}`
    );
    return posts.map(mapArticle);
  } catch (e) {
    console.error("[WP FAIL] articles:", e);
    return [];
  }
}

/** 用語集を取得（用語解説カテゴリーの投稿を使用） */
export async function getGlossaryTerms(): Promise<GlossaryTerm[]> {
  try {
    const posts = await wpFetch<WPPost>(
      `posts?per_page=100&categories=${GLOSSARY_CATEGORY_ID}`
    );
    return posts.map(mapGlossaryTerm);
  } catch (e) {
    console.error("[WP FAIL] glossary:", e);
    return [];
  }
}
