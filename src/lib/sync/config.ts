import type { RegistryName } from "@/types";

/** 各レジストリの設定 */
export const REGISTRY_CONFIG: Record<
  RegistryName,
  { url: string; enabled: boolean; notes: string }
> = {
  Verra: {
    url: "https://verra.org/methodologies/methodologies-active/",
    enabled: true,
    notes: "サーバーレンダリング WordPress。Cheerio で解析。",
  },
  "Gold Standard": {
    url: "https://globalgoals.goldstandard.org/400-sdg-impact-quantification/",
    enabled: true,
    notes: "サーバーレンダリング WordPress。Cheerio で解析。",
  },
  "Puro.earth": {
    url: "https://puro.earth/carbon-removal-methods",
    enabled: true,
    notes: "サーバーレンダリング Odoo 18。Cheerio で解析。",
  },
  Isometric: {
    url: "https://registry.isometric.com/protocols",
    enabled: false,
    notes: "Next.js SPA（CSR）。Playwright 必要。将来対応。",
  },
  "J-Credit": {
    url: "https://japancredit.go.jp/about/methodology/",
    enabled: true,
    notes: "サーバーレンダリング HTML。Cheerio で解析。6カテゴリ（省エネ, 再エネ, 工業, 農業, 廃棄物, 森林）。",
  },
};

/** 同期全体の設定 */
export const SYNC_CONFIG = {
  /** レジストリへの HTTP リクエスト間隔（ms） */
  scrapeDelayMs: 1000,
  /** WordPress 書き込みリクエスト間隔（ms） */
  writeDelayMs: 500,
  /** 1 回の同期で処理する最大件数（安全制限） */
  maxPerRun: 200,
  /** スクレイピングリクエストの User-Agent */
  userAgent: "CarbonIntelligenceBot/1.0 (+https://intelligence.carboncredits.jp)",
};
