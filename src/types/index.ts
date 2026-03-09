// ============================================================
// メソドロジー (方法論) — CPT: methodologies
// ============================================================

/** 算定手法の種類 */
export type MethodologyType =
  | "ARR"        // 新規植林・再植林
  | "ALM"        // 農地管理
  | "マングローブ"
  | "REDD+"      // 森林減少・劣化の抑制
  | "再生可能エネルギー"
  | "省エネルギー";

/** メソドロジー */
export type Methodology = {
  id: string;
  title: string;
  type: MethodologyType | null;         // ACF 未設定時は null
  region: string | null;                // ACF 未設定時は null
  validUntil: string | null;            // ISO 日付文字列 "YYYY-MM-DD"、ACF 未設定時は null
  summary: string;
  reliabilityScore: number | null;      // 0–100、ACF 未設定時は null
  // --- 同期メタデータ（ACF 未設定時は null） ---
  registry: RegistryName | null;        // ACF: registry
  sourceUrl: string | null;             // ACF: source_url
  dataHash: string | null;              // ACF: data_hash
  externalLastUpdated: string | null;   // ACF: external_last_updated
  syncedAt: string | null;              // ACF: synced_at
};

// ============================================================
// 企業 — CPT: companies
// ============================================================

/** 企業カテゴリー */
export type CompanyCategory =
  | "創出事業者"
  | "仲介"
  | "コンサル"
  | "検証機関";

/** 企業 */
export type Company = {
  id: string;
  name: string;
  category: CompanyCategory | null;     // ACF 未設定時は null
  headquarters: string | null;          // ACF 未設定時は null
  mainProjects: string[];
};

// ============================================================
// インサイト (ニュース・分析) — CPT: insights
// ============================================================

/** インサイトカテゴリー */
export type InsightCategory = "政策" | "市場" | "技術";

/** インサイト */
export type Insight = {
  id: string;
  title: string;
  date: string;             // ISO 日付文字列 "YYYY-MM-DD"
  category: InsightCategory | null;     // ACF 未設定時は null
  summary: string;
};

// ============================================================
// レジストリ同期 — メソドロジー自動収集システム
// ============================================================

/** 外部レジストリ名 */
export type RegistryName =
  | "Verra"
  | "Gold Standard"
  | "Puro.earth"
  | "Isometric"
  | "J-Credit";

/** スクレイピングで取得した生データ（WordPress 書き込み前） */
export type ScrapedMethodology = {
  name: string;
  description: string;
  registry: RegistryName;
  category: string;
  status: string;           // "Active", "Draft" 等
  sourceUrl: string;
  lastUpdated: string | null;
  version: string | null;
  dataHash: string;         // SHA-256（コンテンツ変更検知用）
};

/** 同期結果のアクション種別 */
export type SyncAction = "created" | "updated" | "unchanged" | "error";

/** 1 件の同期結果 */
export type SyncResult = {
  methodologyName: string;
  registry: RegistryName;
  action: SyncAction;
  timestamp: string;
  diff?: string[];
  error?: string;
};

/** 同期実行の全体結果 */
export type SyncRunResult = {
  runId: string;
  startedAt: string;
  completedAt: string;
  results: SyncResult[];
  summary: {
    created: number;
    updated: number;
    unchanged: number;
    errors: number;
  };
};
