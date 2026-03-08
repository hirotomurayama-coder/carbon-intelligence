// ============================================================
// 記事 (WordPress posts)
// ============================================================

/** WordPress カテゴリーID → 表示名のマッピング */
export const CATEGORY_MAP: Record<number, ArticleCategory> = {
  1: "国内ニュース",
  29: "海外ニュース",
  2: "コラム",
  51: "オフセット事例",
  15: "用語解説",
};

/** 記事カテゴリー */
export type ArticleCategory =
  | "国内ニュース"
  | "海外ニュース"
  | "コラム"
  | "オフセット事例"
  | "用語解説";

/** 記事 */
export type Article = {
  id: string;
  title: string;
  date: string; // ISO 日付文字列 "YYYY-MM-DD"
  category: ArticleCategory;
  excerpt: string;
  link: string;
};

// ============================================================
// 用語集 (WordPress glossary CPT)
// ============================================================

/** 用語集エントリー */
export type GlossaryTerm = {
  id: string;
  term: string;
  slug: string;
  description: string;
};
