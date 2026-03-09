import * as cheerio from "cheerio";
import type { ScrapedMethodology } from "@/types";
import type { RegistryAdapter } from "./base";
import { computeMethodologyHash } from "../hash";
import { SYNC_CONFIG } from "../config";

/**
 * Gold Standard メソドロジー スクレイパー。
 *
 * サーバーレンダリングされた WordPress サイトから
 * SDG Impact Quantification メソドロジー一覧を取得する。
 */
export class GoldStandardAdapter implements RegistryAdapter {
  readonly name = "Gold Standard" as const;
  readonly baseUrl =
    "https://globalgoals.goldstandard.org/400-sdg-impact-quantification/";

  async scrape(): Promise<ScrapedMethodology[]> {
    try {
      console.log(`[Gold Standard] Fetching: ${this.baseUrl}`);
      const res = await fetch(this.baseUrl, {
        headers: { "User-Agent": SYNC_CONFIG.userAgent },
        redirect: "follow",
      });

      if (!res.ok) {
        console.error(`[Gold Standard] HTTP ${res.status}`);
        return [];
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const results: ScrapedMethodology[] = [];

      // Gold Standard はセクション別にメソドロジーを列挙
      // 各リンクが /standards/ または /methodologies/ を含む
      const seen = new Set<string>();

      // 記事カード形式（.p-wrap.p-list）
      $(".p-wrap.p-list").each((_, el) => {
        const $el = $(el);
        const $link = $el.find(".entry-title a.p-url, .p-header a").first();
        const title = $link.text().trim();
        const href = $link.attr("href") ?? "";

        if (!title || !href || seen.has(href)) return;
        seen.add(href);

        // table.list-info からメタデータ取得
        const metaText = $el.find("table.list-info").text();
        const version = this.extractVersion(metaText || title);

        const sourceUrl = href.startsWith("http")
          ? href
          : `https://globalgoals.goldstandard.org${href}`;

        const methodology: ScrapedMethodology = {
          name: title,
          description: this.truncate($el.find("p").first().text().trim(), 300),
          registry: "Gold Standard",
          category: this.inferCategory(title),
          status: "Active",
          sourceUrl,
          lastUpdated: this.extractDate(metaText || title),
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

        results.push(methodology);
      });

      // カード以外の直接リンク形式（フォールバック）
      if (results.length === 0) {
        $("a[href*='/standards/'], a[href*='/methodologies/'], a[href*='/400']")
          .each((_, el) => {
            const $el = $(el);
            const title = $el.text().trim();
            const href = $el.attr("href") ?? "";

            if (
              !title ||
              title.length < 10 ||
              !href ||
              seen.has(href) ||
              href.endsWith(".pdf")
            )
              return;
            seen.add(href);

            const sourceUrl = href.startsWith("http")
              ? href
              : `https://globalgoals.goldstandard.org${href}`;

            const methodology: ScrapedMethodology = {
              name: title,
              description: title,
              registry: "Gold Standard",
              category: this.inferCategory(title),
              status: "Active",
              sourceUrl,
              lastUpdated: null,
              version: this.extractVersion(title),
              dataHash: "",
            };

            methodology.dataHash = computeMethodologyHash({
              name: methodology.name,
              description: methodology.description,
              category: methodology.category,
              status: methodology.status,
              version: methodology.version,
            });

            results.push(methodology);
          });
      }

      console.log(`[Gold Standard] ${results.length} methodologies scraped`);
      return results;
    } catch (e) {
      console.error(`[Gold Standard] Scrape failed:`, e);
      return [];
    }
  }

  private inferCategory(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes("land use") || lower.includes("land-use")) return "土地利用";
    if (lower.includes("agriculture")) return "農業";
    if (lower.includes("energy")) return "エネルギー";
    if (lower.includes("waste")) return "廃棄物";
    if (lower.includes("water")) return "水";
    if (lower.includes("cookstove")) return "クックストーブ";
    return "その他";
  }

  private extractVersion(text: string): string | null {
    const match = text.match(/v\.?\s*(\d+(?:\.\d+)*)/i);
    return match ? `v${match[1]}` : null;
  }

  private extractDate(text: string): string | null {
    // "DD.MM.YYYY" 形式
    const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    // "YYYY-MM-DD" 形式
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
    return null;
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + "..." : text;
  }
}
