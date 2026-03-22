/**
 * 企業データ拡充スクリプト — carboncredits.jp の記事から関連記事を収集。
 *
 * 処理:
 *   1. WordPress staging から既存企業一覧を取得
 *   2. carboncredits.jp REST API で各企業名を検索
 *   3. 記事タイトルに企業名が含まれるものを関連記事として収集
 *   4. WordPress staging の companies CPT に related_articles を保存
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD && npm run sync-companies
 *
 * オプション:
 *   --dry-run    WordPress 書き込みなし
 */

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "").replace(/\/+$/, "");
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

// carboncredits.jp（ニュースサイト）の REST API — このスクリプトのみで使用
// Next.js アプリコードでは参照禁止（CLAUDE.md 準拠）
const CCJ_API = "https://carboncredits.jp/wp-json/wp/v2";

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error("環境変数が未設定: NEXT_PUBLIC_WORDPRESS_API_URL, WP_APP_USER, WP_APP_PASSWORD");
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

// ============================================================
// 型定義
// ============================================================

type WPCompany = {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  acf?: Record<string, unknown> | unknown[];
};

type CCJPost = {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
};

type RelatedArticle = {
  title: string;
  url: string;
  date: string;
};

// ============================================================
// carboncredits.jp 記事検索
// ============================================================

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8217;/g, "'").replace(/&#8220;|&#8221;/g, '"').trim();
}

async function searchCCJArticles(companyName: string): Promise<RelatedArticle[]> {
  const results: RelatedArticle[] = [];

  // 短すぎる名前はスキップ（false positive 防止）
  if (companyName.length < 2) return [];

  // 括弧部分を除去した検索名を準備
  const searchName = companyName
    .replace(/[\(\)（）]/g, " ")
    .replace(/株式会社|有限会社|合同会社|一般社団法人|一般財団法人/g, "")
    .trim();

  if (searchName.length < 2) return [];

  try {
    const encoded = encodeURIComponent(searchName);
    const url = `${CCJ_API}/posts?search=${encoded}&per_page=50&_fields=id,title,link,date&orderby=date&order=desc`;

    console.log(`  検索: "${searchName}"`);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CarbonIntelBot/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`  HTTP ${res.status} — スキップ`);
      return [];
    }

    const posts: CCJPost[] = await res.json();

    // 記事タイトルに企業名が含まれるものだけフィルタ（false positive 防止）
    for (const post of posts) {
      const title = stripHtml(post.title.rendered);
      // 企業名またはその主要部分がタイトルに含まれるか
      const nameVariants = [
        companyName,
        searchName,
        // 英語企業名の場合、大文字小文字を無視
        companyName.toLowerCase(),
      ];

      const titleLower = title.toLowerCase();
      const matches = nameVariants.some((v) => titleLower.includes(v.toLowerCase()));

      if (matches) {
        results.push({
          title,
          url: post.link,
          date: post.date.slice(0, 10),
        });
      }
    }

    console.log(`  → ${posts.length} 件中 ${results.length} 件マッチ`);
  } catch (e) {
    console.warn(`  検索エラー: ${e}`);
  }

  return results;
}

// ============================================================
// WordPress 読み取り・書き込み
// ============================================================

async function fetchAllCompanies(): Promise<WPCompany[]> {
  const all: WPCompany[] = [];
  let page = 1;

  while (page <= 10) {
    try {
      const res = await fetch(`${API_BASE}/companies?per_page=100&page=${page}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) break;
      const posts: WPCompany[] = await res.json();
      all.push(...posts);
      if (posts.length < 100) break;
      page++;
    } catch {
      break;
    }
  }

  return all;
}

function parseExistingContentJson(html: string): Record<string, unknown> | null {
  const match = html.match(/<!-- COMPANY_DATA_JSON:([\s\S]*?) -->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function updateCompany(
  wpId: number,
  companyName: string,
  existingAcf: Record<string, unknown>,
  articles: RelatedArticle[]
): Promise<void> {
  // 既存 ACF データを保持しつつ related_articles を追加
  const updatedAcf = {
    ...existingAcf,
    related_articles: JSON.stringify(articles),
  };

  // Content JSON フォールバック
  const contentData = {
    ...updatedAcf,
    related_articles: articles,
  };
  const content = `<!-- COMPANY_DATA_JSON:${JSON.stringify(contentData)} -->\n<p>${companyName}の企業データ</p>`;

  const res = await fetch(`${API_BASE}/companies/${wpId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ content, acf: updatedAcf }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WordPress 更新失敗: ${res.status} ${text.slice(0, 200)}`);
  }
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log("=== 企業データ拡充スクリプト ===");
  console.log(`API: ${API_BASE}`);
  console.log(`CCJ: ${CCJ_API}`);
  if (DRY_RUN) console.log("DRY RUN モード");
  console.log("");

  // 1. 既存企業を取得
  console.log("=== WordPress から企業一覧を取得 ===");
  const companies = await fetchAllCompanies();
  console.log(`企業数: ${companies.length}`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const company of companies) {
    const name = stripHtml(company.title.rendered);
    console.log(`\n[${company.id}] ${name}`);

    try {
      // 2. carboncredits.jp で記事検索
      const articles = await searchCCJArticles(name);

      if (articles.length === 0) {
        console.log("  記事なし — スキップ");
        skipped++;
        continue;
      }

      // 3. WordPress に保存
      if (DRY_RUN) {
        console.log(`  [DRY RUN] ${articles.length} 件の記事 — 書き込みスキップ`);
        for (const a of articles.slice(0, 3)) {
          console.log(`    - ${a.title} (${a.date})`);
        }
      } else {
        // 既存データを取得
        const acf = company.acf && !Array.isArray(company.acf) ? company.acf : {};
        const contentData = parseExistingContentJson(company.content.rendered);
        const existingData = Object.keys(acf).length > 0 ? acf : (contentData ?? {});

        await updateCompany(company.id, name, existingData, articles);
        console.log(`  ✓ ${articles.length} 件の記事を保存`);
      }

      updated++;
    } catch (e) {
      console.error(`  エラー: ${e}`);
      errors++;
    }

    // レート制限
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n=== 完了 ===`);
  console.log(`更新: ${updated}, スキップ: ${skipped}, エラー: ${errors}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
