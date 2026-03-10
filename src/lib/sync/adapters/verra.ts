import * as cheerio from "cheerio";
import type { ScrapedMethodology } from "@/types";
import type { RegistryAdapter } from "./base";
import { computeMethodologyHash } from "../hash";
import { SYNC_CONFIG } from "../config";

/**
 * Verra VCS メソドロジー スクレイパー（ディープスクレイピング対応）。
 *
 * 1. 一覧ページからメソドロジーリンクを収集
 * 2. 各詳細ページにアクセスして Active Date, Sectoral Scope, Mitigation Outcome,
 *    本文テキストを取得（AI 推論の精度向上用）
 */
export class VerraAdapter implements RegistryAdapter {
  readonly name = "Verra" as const;
  readonly baseUrl =
    "https://verra.org/program-methodology/vcs-program-standard/vcs-program-methodologies-active/";

  /** ブラウザと同じ User-Agent（403 回避用） */
  private static readonly BROWSER_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

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
          headers: { "User-Agent": VerraAdapter.BROWSER_UA },
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

      console.log(`[Verra] ${results.length} methodologies scraped from list`);
      return results;
    } catch (e) {
      console.error(`[Verra] Scrape failed:`, e);
      return [];
    }
  }

  /**
   * ディープスクレイピング: 詳細ページにアクセスして追加情報を取得。
   * Active Date, Sectoral Scope, Mitigation Outcome, 本文テキスト, バージョンを返す。
   */
  async scrapeDetailPage(sourceUrl: string): Promise<{
    activeDate: string | null;
    sectoralScope: string | null;
    mitigationOutcome: string | null;
    detailText: string;
    version: string | null;
  }> {
    try {
      console.log(`[Verra Deep] Fetching: ${sourceUrl}`);
      const res = await fetch(sourceUrl, {
        headers: { "User-Agent": VerraAdapter.BROWSER_UA },
        redirect: "follow",
      });

      if (!res.ok) {
        console.warn(`[Verra Deep] ${sourceUrl} returned ${res.status}`);
        return { activeDate: null, sectoralScope: null, mitigationOutcome: null, detailText: "", version: null };
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Active Date
      let activeDate: string | null = null;
      $(".info-line").each((_, el) => {
        const $info = $(el);
        const label = $info.find("span").first().text().trim();
        if (label === "Active Date") {
          const dateText = $info.find("p").first().text().trim();
          if (dateText) {
            activeDate = this.parseDateString(dateText);
          }
        }
      });

      // Sectoral Scope
      let sectoralScope: string | null = null;
      $(".info-line.scope, .info-line").each((_, el) => {
        const $info = $(el);
        const label = $info.find("span").first().text().trim();
        if (label === "Sectoral Scope") {
          const scopeTexts: string[] = [];
          $info.find("p").each((__, p) => {
            const t = $(p).text().trim();
            if (t) scopeTexts.push(t);
          });
          sectoralScope = scopeTexts.join("; ") || null;
        }
      });

      // Mitigation Outcome Label Eligibility
      let mitigationOutcome: string | null = null;
      $(".info-line").each((_, el) => {
        const $info = $(el);
        const label = this.cleanText($info.find("span").first().text());
        if (label.includes("Mitigation") && label.includes("Outcome")) {
          const texts: string[] = [];
          $info.find("p").each((__, p) => {
            const t = $(p).text().trim();
            if (t) texts.push(t);
          });
          mitigationOutcome = texts.join(", ") || null;
        }
      });

      // 本文テキスト（メソドロジーの説明文 + Development History の要約）
      // info-line と methodology-documents の間にあるテキストを抽出
      const bodyParts: string[] = [];

      // メインの説明テキスト（info-line 後の p タグ）
      $(".info-line").parent().find("p").each((_, el) => {
        const text = $(el).text().trim();
        // ナビゲーション系テキストを除外
        if (text && text.length > 30 && !text.includes("menu-item")) {
          bodyParts.push(text);
        }
      });

      // Development History セクションのテキスト
      $("[class*='consultation-archive'], [class*='collapse']").each((_, el) => {
        const text = this.cleanText($(el).text());
        if (text && text.length > 50) {
          bodyParts.push(text.slice(0, 500)); // 長すぎる場合は切り詰め
        }
      });

      // ページ全体からメソドロジー説明を取得（フォールバック）
      if (bodyParts.length === 0) {
        const pageText = this.cleanText($("body").text());
        // メソドロジー名の後のテキストを抽出
        const descMatch = pageText.match(
          /(?:This methodology|This module|The methodology|The module)[^.]*\./i
        );
        if (descMatch) {
          bodyParts.push(descMatch[0]);
        }
      }

      const detailText = bodyParts
        .filter((t, i, arr) => arr.indexOf(t) === i) // 重複除去
        .join("\n")
        .slice(0, 2000); // AI コスト抑制: 最大2000文字

      // バージョン抽出: URL スラッグを最優先、次にページ本文テキスト
      const version = this.extractVersionFromUrl(sourceUrl);

      return { activeDate, sectoralScope, mitigationOutcome, detailText, version };
    } catch (e) {
      console.warn(`[Verra Deep] Failed for ${sourceUrl}:`, e);
      return { activeDate: null, sectoralScope: null, mitigationOutcome: null, detailText: "", version: null };
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
    return this.parseDateString(match[1]);
  }

  /** 英語日付文字列を ISO 日付に変換 */
  private parseDateString(dateStr: string): string | null {
    try {
      const d = new Date(dateStr);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }

  private extractVersion(title: string): string | null {
    const match = title.match(/v(?:ersion\s*)?(\d+(?:\.\d+)*)/i);
    return match ? `v${match[1]}` : null;
  }

  /** URL スラッグからバージョン番号を抽出（例: -v1-2 → v1.2） */
  private extractVersionFromUrl(url: string): string | null {
    const match = url.match(/-v(\d+)-(\d+)\/?$/i);
    if (match) return `v${match[1]}.${match[2]}`;
    const matchMajor = url.match(/-v(\d+)\/?$/i);
    if (matchMajor) return `v${matchMajor[1]}.0`;
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
