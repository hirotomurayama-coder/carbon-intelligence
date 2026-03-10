import * as cheerio from "cheerio";
import type { ScrapedMethodology } from "@/types";
import type { RegistryAdapter } from "./base";
import { computeMethodologyHash } from "../hash";
import { SYNC_CONFIG } from "../config";

/**
 * J-クレジット制度 メソドロジー スクレイパー。
 *
 * https://japancredit.go.jp/about/methodology/ から
 * 6 カテゴリ（省エネ, 再エネ, 工業プロセス, 農業, 廃棄物, 森林）の
 * メソドロジー一覧をスクレイピングする。
 *
 * HTML構造:
 *   - カテゴリ別に <h2 id="ecology|renewable|industry|farm|waste|forest"> で区切られる
 *   - 各カテゴリ内に <table class="table-type01"> がある
 *   - テーブル行: <td>ID</td> <td><a href="/pdf/...">名前</a></td> <td>概要</td> <td>Ver.</td> <td>日付</td>
 *   - 廃止されたメソドロジーは <span class="denial-line"> で囲まれ、バージョン列に「廃止」と表示
 */
export class JCreditAdapter implements RegistryAdapter {
  readonly name = "J-Credit" as const;
  readonly baseUrl = "https://japancredit.go.jp/about/methodology/";

  /** カテゴリセクション ID → カテゴリ名のマッピング */
  private static readonly CATEGORY_MAP: Record<string, string> = {
    ecology: "省エネルギー",
    renewable: "再生可能エネルギー",
    industry: "工業プロセス",
    farm: "農業",
    waste: "廃棄物",
    forest: "森林",
  };

  /**
   * J-Credit サイトはボット UA をブロック (403) するため、
   * ブラウザライクな User-Agent を使用する。
   */
  private static readonly BROWSER_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  async scrape(): Promise<ScrapedMethodology[]> {
    try {
      console.log(`[J-Credit] Fetching: ${this.baseUrl}`);
      const res = await fetch(this.baseUrl, {
        headers: {
          "User-Agent": JCreditAdapter.BROWSER_UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ja,en;q=0.9",
        },
        redirect: "follow",
      });

      if (!res.ok) {
        console.error(`[J-Credit] HTTP ${res.status} ${res.statusText}`);
        return [];
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const results: ScrapedMethodology[] = [];

      // 各カテゴリセクションを処理
      for (const [sectionId, categoryName] of Object.entries(
        JCreditAdapter.CATEGORY_MAP
      )) {
        const sectionItems = this.scrapeSection($, sectionId, categoryName);
        results.push(...sectionItems);
      }

      console.log(`[J-Credit] ${results.length} methodologies scraped`);
      return results;
    } catch (e) {
      console.error(`[J-Credit] Scrape failed:`, e);
      return [];
    }
  }

  /**
   * 1 つのカテゴリセクション内のテーブルからメソドロジーを抽出する。
   *
   * @param $ Cheerio ルート
   * @param sectionId h2 の id 属性 (ecology, renewable, ...)
   * @param categoryName 日本語カテゴリ名
   */
  private scrapeSection(
    $: cheerio.CheerioAPI,
    sectionId: string,
    categoryName: string
  ): ScrapedMethodology[] {
    const items: ScrapedMethodology[] = [];

    // h2#sectionId の次にある table.table-type01 を探す
    const h2 = $(`h2#${sectionId}`);
    if (h2.length === 0) {
      console.warn(`[J-Credit] Section not found: #${sectionId}`);
      return items;
    }

    // h2 の後続兄弟要素からテーブルを取得
    // 構造: h2 → (div/p) → div.table-scroll > table.table-type01
    const table = h2.nextAll().find("table.table-type01").first();
    if (table.length === 0) {
      // 直接の兄弟として存在する場合
      const directTable = h2.nextAll("table.table-type01").first();
      if (directTable.length === 0) {
        // テーブルを含む div を探す
        const containerTable = h2
          .nextAll()
          .filter(function () {
            return $(this).find("table.table-type01").length > 0;
          })
          .first()
          .find("table.table-type01")
          .first();

        if (containerTable.length > 0) {
          this.parseTable($, containerTable, categoryName, items);
        } else {
          console.warn(
            `[J-Credit] Table not found for section: #${sectionId}`
          );
        }
        return items;
      }
      this.parseTable($, directTable, categoryName, items);
      return items;
    }

    this.parseTable($, table, categoryName, items);
    return items;
  }

  /**
   * テーブルの各行をパースして ScrapedMethodology に変換する。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseTable(
    $: cheerio.CheerioAPI,
    table: cheerio.Cheerio<any>,
    categoryName: string,
    items: ScrapedMethodology[]
  ): void {
    const rows = table.find("tbody tr, tr").not("tr:has(th)");

    rows.each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 4) return;

      // 列構造: [0]ID, [1]方法論名(リンク付き), [2]概要版, [3]Ver., [4]制改定日
      const methodId = this.cleanText($(cells[0]).text());
      const nameCell = $(cells[1]);
      const nameLink = nameCell.find("a").first();
      const methodName = this.cleanText(
        nameLink.length > 0 ? nameLink.text() : nameCell.text()
      );
      const pdfHref = nameLink.attr("href") ?? "";

      // バージョン列と日付列のインデックスはテーブルにより変動
      // 概要版列がある場合: [3]=Ver., [4]=日付
      // 概要版列がない場合: [2]=Ver., [3]=日付
      let versionText: string;
      let dateText: string;

      if (cells.length >= 5) {
        versionText = this.cleanText($(cells[3]).text());
        dateText = this.cleanText($(cells[4]).text());
      } else {
        versionText = this.cleanText($(cells[2]).text());
        dateText = this.cleanText($(cells[3]).text());
      }

      // 空行やヘッダー行をスキップ
      if (!methodId || !methodName) return;

      // 廃止メソドロジーを検出してスキップ
      const isDenied =
        $(row).find(".denial-line").length > 0 ||
        versionText.includes("廃止");
      if (isDenied) {
        console.log(
          `[J-Credit] Skipping deprecated: ${methodId} ${methodName}`
        );
        return;
      }

      // PDF URL を完全 URL に変換
      const sourceUrl = pdfHref
        ? pdfHref.startsWith("http")
          ? pdfHref
          : `https://japancredit.go.jp${pdfHref}`
        : `https://japancredit.go.jp/about/methodology/#${methodId}`;

      // バージョン抽出
      const version = this.extractVersion(versionText);

      // 日付パース（YYYY/MM/DD → YYYY-MM-DD）
      const lastUpdated = this.parseDate(dateText);

      // 表示名（ID + 名前）
      const displayName = `${methodId} ${methodName}`;

      const methodology: ScrapedMethodology = {
        name: displayName.slice(0, 200),
        description: `J-クレジット制度 ${categoryName}分野のメソドロジー。${methodName}`,
        registry: "J-Credit",
        category: categoryName,
        status: "Active",
        sourceUrl,
        lastUpdated,
        version,
        dataHash: "",
      };

      methodology.dataHash = computeMethodologyHash({
        name: methodology.name,
        description: methodology.description,
        category: methodology.category,
        status: methodology.status,
        version: methodology.version,
      });

      items.push(methodology);
    });
  }

  // ============================================================
  // ディープスクレイピング: 一覧ページの備考テキスト＋カテゴリ情報を
  // detailText として構築し、AI エンリッチに活用する。
  // ※ J-Credit には HTML 詳細ページがなく PDF のみのため、
  //    一覧ページから最大限の情報を抽出するアプローチを採用。
  // ============================================================

  /**
   * 一覧ページを再取得し、該当メソドロジーの追加情報を抽出。
   * 備考テキスト、概要版 PDF URL、カテゴリ情報を返す。
   */
  /**
   * 一覧ページの HTML を1回だけ取得してキャッシュ。
   * 全 J-Credit アイテムのディープスクレイピングで共有する。
   */
  async fetchListHtml(): Promise<string | null> {
    try {
      console.log(`[J-Credit Deep] Fetching list page...`);
      const res = await fetch(this.baseUrl, {
        headers: {
          "User-Agent": JCreditAdapter.BROWSER_UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ja,en;q=0.9",
        },
        redirect: "follow",
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  async scrapeDetailPage(
    methodologyId: string,
    existingCategory: string,
    cachedHtml?: string
  ): Promise<{
    detailText: string;
    outlinePdfUrl: string | null;
    notes: string | null;
    version: string | null;
  }> {
    try {
      let html: string;
      if (cachedHtml) {
        html = cachedHtml;
      } else {
        console.log(`[J-Credit Deep] Fetching list page for: ${methodologyId}`);
        const res = await fetch(this.baseUrl, {
          headers: {
            "User-Agent": JCreditAdapter.BROWSER_UA,
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "ja,en;q=0.9",
          },
          redirect: "follow",
        });

        if (!res.ok) {
          return { detailText: "", outlinePdfUrl: null, notes: null, version: null };
        }

        html = await res.text();
      }

      const $ = cheerio.load(html);

      // メソドロジー ID（例: EN-S-001）の行を探す
      let outlinePdfUrl: string | null = null;
      let version: string | null = null;

      // 全テーブルからメソドロジーの概要版 PDF リンクを探す
      $("table.table-type01 tbody tr, table.table-type01 tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 3) return;
        const id = this.cleanText($(cells[0]).text());
        if (id !== methodologyId) return;

        // 概要版列のリンクを探す（通常は cells[2]）
        cells.each((__, cell) => {
          const links = $(cell).find("a");
          links.each((___, link) => {
            const href = $(link).attr("href") ?? "";
            if (href.includes("outline")) {
              outlinePdfUrl = href.startsWith("http")
                ? href
                : `https://japancredit.go.jp${href}`;
            }
          });
        });

        // バージョン列（cells[3] or cells[2]）
        if (cells.length >= 5) {
          const vText = this.cleanText($(cells[3]).text());
          version = this.extractVersion(vText);
        }
      });

      // 備考テーブル（最後のテーブル）からメソドロジーの備考を探す
      let notes: string | null = null;
      const allTables = $("table.table-type01");
      const lastTable = allTables.last();
      if (lastTable.length) {
        lastTable.find("tbody tr, tr").each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length < 3) return;
          const id = this.cleanText($(cells[0]).text());
          if (id === methodologyId) {
            const noteText = this.cleanText($(cells[cells.length - 1]).text());
            if (noteText && noteText !== methodologyId) {
              notes = noteText;
            }
          }
        });
      }

      // detailText を構築: カテゴリ、メソドロジー名、備考、概要版情報
      const parts: string[] = [
        `J-クレジット制度 ${existingCategory}分野`,
        `メソドロジーID: ${methodologyId}`,
      ];
      if (notes) {
        parts.push(`備考: ${notes}`);
      }
      if (existingCategory === "森林") {
        parts.push("分野特性: 森林分野は主に吸収系（除去系）のクレジット。森林経営活動や植林活動によるCO2吸収量をクレジット化。");
      } else if (existingCategory === "農業") {
        parts.push("分野特性: 農業分野は排出削減と一部吸収系。家畜管理、水田管理、バイオ炭等。");
      } else {
        parts.push(`分野特性: ${existingCategory}分野は排出削減系のクレジット。`);
      }

      const detailText = parts.join("\n");

      return { detailText, outlinePdfUrl, notes, version };
    } catch (e) {
      console.warn(`[J-Credit Deep] Failed for ${methodologyId}:`, e);
      return { detailText: "", outlinePdfUrl: null, notes: null, version: null };
    }
  }

  /** テキストの空白・改行を正規化 */
  private cleanText(raw: string): string {
    return raw
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /** バージョン文字列を抽出（"3.3" → "v3.3"） */
  private extractVersion(text: string): string | null {
    // "3.3" や "v3.3" や "Ver.3.3" パターン
    const match = text.match(/v?(?:er\.?\s*)?(\d+(?:\.\d+)*)/i);
    return match ? `v${match[1]}` : null;
  }

  /** 日本語日付フォーマットをパース（"2025/12/19" → "2025-12-19"） */
  private parseDate(text: string): string | null {
    // YYYY/MM/DD
    const match = text.match(/(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    // 令和X年X月X日 パターン（念のため）
    const waMatch = text.match(/令和\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);
    if (waMatch) {
      const [, waYear, month, day] = waMatch;
      const year = 2018 + Number(waYear);
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return null;
  }
}
