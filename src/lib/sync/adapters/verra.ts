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
          const rawText = $el.text();
          const href = $el.attr("href") ?? "";

          if (!rawText || !href) return;

          // テキストをクリーンアップ（余分な空白、改行、タブを除去）
          const cleanedText = this.cleanText(rawText);
          if (!cleanedText) return;

          // VM番号を抽出（例: VM0001）
          const vmMatch = href.match(/vm(\d+)/i);
          const vmId = vmMatch ? `VM${vmMatch[1].padStart(4, "0")}` : "";

          // "Active Date: ..." や "VM0001" プレフィックスを除去してタイトル抽出
          // 実際のテキスト例: "VM0001 Active Date: November 5, 2024 VM0001 Refrigerant Leak Detection, v1.2"
          const titleCleaned = cleanedText
            .replace(/active\s*date[:\s]*\w+\s+\d{1,2},?\s*\d{4}/gi, "")
            .replace(/VM[R]?\d{4}\s*/g, "")
            .replace(/,\s*v[\d.]+\s*$/i, "")
            .replace(/\s{2,}/g, " ")
            .trim();
          const title = titleCleaned || cleanedText;

          // 完全 URL を組み立て
          const sourceUrl = href.startsWith("http")
            ? href
            : `https://verra.org${href}`;

          // 親要素からカテゴリ情報を取得
          const parentText = $el.closest("div").text();
          const category = this.extractCategory(parentText);

          const displayName = vmId
            ? `${vmId} ${title}`
            : title;

          const methodology: ScrapedMethodology = {
            name: displayName.slice(0, 200),
            description: cleanedText.slice(0, 300),
            registry: "Verra",
            category,
            status: "Active",
            sourceUrl,
            lastUpdated: this.extractDate(parentText),
            version: this.extractVersion(cleanedText),
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

  /** 空白・改行・タブを正規化し、余分なテキストを除去 */
  private cleanText(raw: string): string {
    return raw
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
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
