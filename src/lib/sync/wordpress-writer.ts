import type { ScrapedMethodology, AiEnrichedFields } from "@/types";

// ============================================================
// WordPress REST API 書き込みクライアント
// ※ 読み取り専用の src/lib/wordpress.ts とは別モジュール
// ※ API ドメインは carboncreditsjp.wpcomstaging.com に固定
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";

/**
 * WordPress Application Password を使った Basic 認証ヘッダーを生成。
 * WP_APP_USER と WP_APP_PASSWORD 環境変数が必要。
 */
function getAuthHeader(): string {
  const user = process.env.WP_APP_USER;
  const password = process.env.WP_APP_PASSWORD;
  if (!user || !password) {
    throw new Error(
      "[WP Writer] WP_APP_USER と WP_APP_PASSWORD 環境変数を設定してください"
    );
  }
  const encoded = Buffer.from(`${user}:${password}`).toString("base64");
  return `Basic ${encoded}`;
}

/** WordPress REST API レスポンスの最小型 */
type WPMinimalPost = {
  id: number;
  slug: string;
  title: { rendered: string };
  acf?: Record<string, unknown> | unknown[];
};

/**
 * タイトルで既存のメソドロジー投稿を検索。
 * WordPress REST API の search パラメータを使用。
 */
export async function findByTitle(title: string): Promise<number | null> {
  if (!API_BASE) return null;
  try {
    const url = `${API_BASE}/methodologies?search=${encodeURIComponent(title)}&per_page=5`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const posts: WPMinimalPost[] = await res.json();
    const match = posts.find(
      (p) =>
        stripHtmlSimple(p.title.rendered).toLowerCase() ===
        title.toLowerCase()
    );
    return match ? match.id : null;
  } catch {
    return null;
  }
}

/**
 * ACF の source_url フィールドで既存投稿を検索。
 * 全投稿をスキャンして一致を探す（WordPress.com では meta_query が制限されるため）。
 */
export async function findBySourceUrl(
  sourceUrl: string
): Promise<number | null> {
  if (!API_BASE || !sourceUrl) return null;
  try {
    // 全メソドロジーを取得して source_url を比較
    const url = `${API_BASE}/methodologies?per_page=100`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const posts: WPMinimalPost[] = await res.json();
    for (const post of posts) {
      if (
        post.acf &&
        !Array.isArray(post.acf) &&
        typeof post.acf === "object"
      ) {
        const existing = post.acf.source_url;
        if (typeof existing === "string" && existing === sourceUrl) {
          return post.id;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 既存メソドロジーの data_hash を取得。
 * 変更検知（ハッシュ比較）に使用。
 */
export async function getExistingHash(
  wpId: number
): Promise<string | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/methodologies/${wpId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const post: WPMinimalPost = await res.json();
    if (
      post.acf &&
      !Array.isArray(post.acf) &&
      typeof post.acf === "object"
    ) {
      const hash = post.acf.data_hash;
      return typeof hash === "string" && hash ? hash : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 新しいメソドロジー投稿を作成。
 * @param scraped スクレイピング結果
 * @param enriched AI エンリッチ結果（null の場合は AI フィールドなし）
 * @returns 作成された投稿の ID
 */
export async function createMethodology(
  scraped: ScrapedMethodology,
  enriched?: AiEnrichedFields | null
): Promise<number> {
  if (!API_BASE) throw new Error("[WP Writer] API URL が未設定");

  const url = `${API_BASE}/methodologies`;
  const body = buildPostBody(scraped, enriched ?? undefined);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[WP Writer] 作成失敗: ${res.status} ${text.slice(0, 300)}`
    );
  }

  const created = await res.json();
  console.log(`[WP Writer] Created: ${scraped.name} → ID ${created.id}`);
  return created.id;
}

/**
 * 既存のメソドロジー投稿を更新。
 * @param wpId WordPress 投稿 ID
 * @param scraped スクレイピング結果
 * @param enriched AI エンリッチ結果（null の場合は AI フィールドなし）
 */
export async function updateMethodology(
  wpId: number,
  scraped: ScrapedMethodology,
  enriched?: AiEnrichedFields | null
): Promise<void> {
  if (!API_BASE) throw new Error("[WP Writer] API URL が未設定");

  const url = `${API_BASE}/methodologies/${wpId}`;
  const body = buildPostBody(scraped, enriched ?? undefined);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[WP Writer] 更新失敗 (ID ${wpId}): ${res.status} ${text.slice(0, 300)}`
    );
  }

  console.log(`[WP Writer] Updated: ${scraped.name} (ID ${wpId})`);
}

// ============================================================
// 内部ヘルパー
// ============================================================

/** ScrapedMethodology (+ AI エンリッチ) → WordPress POST body に変換 */
function buildPostBody(scraped: ScrapedMethodology, enriched?: AiEnrichedFields) {
  // AI 翻訳がある場合は日本語タイトルを WP 投稿タイトルに設定
  const title = enriched?.titleJa || scraped.name;
  // AI 要約がある場合はコンテンツに設定
  const content = enriched?.aiSummary
    ? `<p>${enriched.aiSummary}</p>`
    : `<p>${scraped.description}</p>`;

  // ACF フィールドを構築（select フィールドは null の場合省略 — 空文字送信はバリデーションエラーになる）
  const acf: Record<string, unknown> = {
    // テキスト系フィールド（空文字OK）
    methodology_type: mapCategoryToType(scraped.category),
    registry: scraped.registry,
    source_url: scraped.sourceUrl,
    data_hash: scraped.dataHash,
    external_last_updated: scraped.lastUpdated ?? "",
    synced_at: new Date().toISOString(),
    title_ja: enriched?.titleJa ?? "",
    ai_summary: enriched?.aiSummary ?? "",
    standard: enriched?.certificationBody ?? "",
    version: scraped.version ?? "",
  };

  // select フィールド — 値がある場合のみ送信（null / undefined は省略）
  if (enriched?.creditType) acf.credit_type = enriched.creditType;
  if (enriched?.baseType) acf.base_type = enriched.baseType;
  if (enriched?.subCategory) acf.sub_category = enriched.subCategory;
  if (enriched?.operationalStatus) acf.status = enriched.operationalStatus;

  // 数値フィールド — AI が推論した reliability_score（0–100 スケール）
  if (enriched?.reliabilityScore != null && enriched.reliabilityScore > 0) {
    acf.reliability_score = enriched.reliabilityScore;
  }

  return {
    title,
    content,
    status: "publish",
    acf,
  };
}

/**
 * スクレイピングカテゴリ → MethodologyType ACF 値にマッピング。
 * マッチしない場合は空文字を返す（WordPress 側で未分類として扱う）。
 */
function mapCategoryToType(category: string): string {
  const lower = category.toLowerCase();
  const mapping: [string[], string][] = [
    [["arr", "afforestation", "reforestation", "新規植林"], "ARR"],
    [["alm", "agriculture", "農地", "農業", "土壌"], "ALM"],
    [["mangrove", "マングローブ"], "マングローブ"],
    [["redd", "森林減少"], "REDD+"],
    [["renewable", "再生可能", "エネルギー", "energy"], "再生可能エネルギー"],
    [["efficiency", "省エネ"], "省エネルギー"],
  ];
  for (const [keywords, type] of mapping) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "";
}

/** HTML タグを簡易除去 */
function stripHtmlSimple(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
