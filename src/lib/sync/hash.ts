import { createHash } from "crypto";

/**
 * 正規化されたコンテンツの SHA-256 ハッシュを計算。
 * 空白の違いや大文字/小文字の差異による誤検知を防ぐ。
 */
export function computeHash(content: string): string {
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalized, "utf-8").digest("hex");
}

/**
 * ScrapedMethodology の主要フィールドからハッシュを生成。
 * プレゼンテーション変更（空白等）を無視し、実質的な変更のみ検知する。
 */
export function computeMethodologyHash(fields: {
  name: string;
  description: string;
  category: string;
  status: string;
  version: string | null;
}): string {
  const content = [
    fields.name,
    fields.description,
    fields.category,
    fields.status,
    fields.version ?? "",
  ].join("|");
  return computeHash(content);
}
