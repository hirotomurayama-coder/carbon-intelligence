import * as cheerio from "cheerio";
import type { ScrapedMethodology } from "@/types";
import type { RegistryAdapter } from "./base";
import { computeMethodologyHash } from "../hash";
import { SYNC_CONFIG } from "../config";

/**
 * Verra VCS メソドロジー スクレイパー。
 *
 * サーバーレンダリングされた WordPress サイトから
 * アクティブなメソドロジー一覧を取得する。
 */
export class VerraAdapter implements RegistryAdapter {
  readonly name = "Verra" as const;
  readonly baseUrl =
    "https://verra.org/program-methodology/vcs-program-standard/vcs-program-methodologies-active/";

  async scrape(): Promise<ScrapedMethodology[]> {
    try {
      const results: ScrapedMethodology[] = [];
      let page = 1;
      const maxPages = 10; // 安全制限

      while (page <= maxPages) {
        const url =
          page === 1
            ? this.baseUrl
            : `${this.baseUrl}?sf_paged=${page}`;

        console.log(`[Verra] Fetching page ${page}: ${url}`);
        const res = await fetch(url, {
          headers: { "User-Agent": SYNC_CONFIG.userAgent },
          redirect: "follow",
        });

        if (!res.ok) {
          console.error(`[Verra] Page ${page} returned ${res.status}`);
          break;
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        // メソドロジーリンクを抽出（VM番号を含むリンク）
        const items = $('a[href*="/methodologies/vm"]');
        if (items.length === 0) break;

        items.each((_, el) => {
          const $el = $(el);
          const title = $el.text().trim();
          const href = $el.attr("href") ?? "";

          if (!title || !href) return;

          // VM番号を抽出（例: VM0001）
          const vmMatch = href.match(/vm(\d+)/i);
          const vmId = vmMatch ? `VM${vmMatch[1].padStart(4, "0")}` : "";

          // 完全 URL を組み立て
          const sourceUrl = href.startsWith("http")
            ? href
            : `https://verra.org${href}`;

          // 親要素からカテゴリ情報を取得
          const parentText = $el.closest("div").text();
          const category = this.extractCategory(parentText);

          const methodology: ScrapedMethodology = {
            name: vmId ? `${vmId} — ${title}` : title,
            description: title,
            registry: "Verra",
            category,
            status: "Active",
            sourceUrl,
            lastUpdated: this.extractDate(parentText),
            version: this.extractVersion(title),
            dataHash: "", // 後で計算
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

        // 次ページリンクがあるかチェック
        const nextPage = $(`a[href*="sf_paged=${page + 1}"]`);
        if (nextPage.length === 0) break;

        page++;
        await this.delay(SYNC_CONFIG.scrapeDelayMs);
      }

      console.log(`[Verra] ${results.length} methodologies scraped`);
      return results;
    } catch (e) {
      console.error(`[Verra] Scrape failed:`, e);
      return [];
    }
  }

  private extractCategory(text: string): string {
    // Verra の Sectoral Scope からカテゴリを推定
    const lower = text.toLowerCase();
    if (lower.includes("afforestation") || lower.includes("reforestation"))
      return "ARR";
    if (lower.includes("redd")) return "REDD+";
    if (lower.includes("agriculture")) return "ALM";
    if (lower.includes("energy")) return "再生可能エネルギー";
    return "その他";
  }

  private extractDate(text: string): string | null {
    // "Active Date: DD MMM YYYY" パターンを検索
    const match = text.match(
      /active\s*date[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i
    );
    if (!match) return null;
    try {
      const d = new Date(match[1]);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }

  private extractVersion(title: string): string | null {
    const match = title.match(/v(?:ersion\s*)?(\d+(?:\.\d+)*)/i);
    return match ? `v${match[1]}` : null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
