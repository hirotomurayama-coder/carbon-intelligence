import * as cheerio from "cheerio";
import type { ScrapedMethodology } from "@/types";
import type { RegistryAdapter } from "./base";
import { computeMethodologyHash } from "../hash";
import { SYNC_CONFIG } from "../config";

/**
 * Puro.earth カーボンリムーバル メソッド スクレイパー。
 *
 * Odoo 18 でサーバーレンダリングされたページから
 * Carbon Removal Methods を取得する。
 */
export class PuroEarthAdapter implements RegistryAdapter {
  readonly name = "Puro.earth" as const;
  readonly baseUrl = "https://puro.earth/carbon-removal-methods";

  async scrape(): Promise<ScrapedMethodology[]> {
    try {
      console.log(`[Puro.earth] Fetching: ${this.baseUrl}`);
      const res = await fetch(this.baseUrl, {
        headers: { "User-Agent": SYNC_CONFIG.userAgent },
        redirect: "follow",
      });

      if (!res.ok) {
        console.error(`[Puro.earth] HTTP ${res.status}`);
        return [];
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const results: ScrapedMethodology[] = [];
      const seen = new Set<string>();

      // Puro.earth は h3 タグでメソッド名を表示
      // 各メソッドのセクションを h3 起点で解析
      $("h3").each((_, el) => {
        const $h3 = $(el);
        const title = $h3.text().trim();

        if (!title || title.length < 3 || seen.has(title)) return;
        seen.add(title);

        // 親セクションから説明文を取得
        const $section = $h3.closest("section, div");
        const paragraphs = $section.find("p");
        let description = "";
        paragraphs.each((_, p) => {
          const text = $(p).text().trim();
          if (text.length > 20 && !description) {
            description = text;
          }
        });

        // "Learn more" リンクを取得
        const $learnMore = $section.find('a:contains("Learn more"), a:contains("learn more")');
        let sourceUrl = $learnMore.attr("href") ?? "";
        if (sourceUrl && !sourceUrl.startsWith("http")) {
          sourceUrl = `https://puro.earth${sourceUrl}`;
        }
        if (!sourceUrl) {
          sourceUrl = `${this.baseUrl}#${title.toLowerCase().replace(/\s+/g, "-")}`;
        }

        // Durability 情報を取得
        const sectionText = $section.text();
        const durability = this.extractDurability(sectionText);

        const methodology: ScrapedMethodology = {
          name: title,
          description: this.truncate(description || title, 300),
          registry: "Puro.earth",
          category: this.inferCategory(title),
          status: "Active",
          sourceUrl,
          lastUpdated: null, // Puro.earth はページ上に日付を明示しない
          version: null,
          dataHash: "",
        };

        // Durability 情報があれば description に含める
        if (durability) {
          methodology.description = `[耐久性: ${durability}] ${methodology.description}`;
        }

        methodology.dataHash = computeMethodologyHash({
          name: methodology.name,
          description: methodology.description,
          category: methodology.category,
          status: methodology.status,
          version: methodology.version,
        });

        results.push(methodology);
      });

      console.log(`[Puro.earth] ${results.length} methods scraped`);
      return results;
    } catch (e) {
      console.error(`[Puro.earth] Scrape failed:`, e);
      return [];
    }
  }

  private inferCategory(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes("biochar")) return "バイオ炭";
    if (lower.includes("wood") || lower.includes("timber")) return "木材建築";
    if (lower.includes("direct air") || lower.includes("dac")) return "DAC";
    if (lower.includes("mineral") || lower.includes("rock")) return "鉱物化";
    if (lower.includes("ocean") || lower.includes("marine")) return "海洋";
    if (lower.includes("soil") || lower.includes("agriculture")) return "土壌";
    if (lower.includes("biomass") || lower.includes("bioenergy")) return "バイオマス";
    return "カーボンリムーバル";
  }

  private extractDurability(text: string): string | null {
    const match = text.match(
      /durability[:\s]*(\d+\+?\s*years?|permanent|\d+,?\d*\+?\s*years?)/i
    );
    return match ? match[1] : null;
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + "..." : text;
  }
}
