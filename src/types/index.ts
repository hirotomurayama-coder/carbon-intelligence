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
  // --- AI エンリッチフィールド（ACF 未設定時は null） ---
  titleJa: string | null;              // ACF: title_ja — AI 翻訳日本語タイトル
  aiSummary: string | null;            // ACF: ai_summary — AI 生成要約（150字）
  creditType: string | null;           // ACF: credit_type — 回避・削減系 / 除去系
  baseType: string | null;             // ACF: base_type — 自然ベース / 技術ベース / 再エネ
  subCategory: string | null;          // ACF: sub_category — 詳細分類（森林, バイオ炭 等）
  operationalStatus: string | null;    // ACF: status — 運用中 / 審査中 / 再審査中 / 却下 / 無効化
  certificationBody: string | null;    // ACF: standard — 認証機関名
  version: string | null;              // ACF: version — バージョン
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
  /** ディープスクレイピングで取得した詳細ページの本文テキスト（AI 推論用） */
  detailText?: string;
  /** Verra: Sectoral Scope（例: "11. Fugitive emissions from industrial gases"） */
  sectoralScope?: string;
  /** Verra: Mitigation Outcome Label（例: "Reductions", "Removals"） */
  mitigationOutcome?: string;
};

/** ACF select フィールドの許可値（WordPress 側の定義に完全準拠） */
export type CreditType = "回避・削減系" | "除去系";
export type BaseType = "自然ベース" | "技術ベース" | "再エネ";
export type OperationalStatus = "運用中" | "審査中" | "再審査中" | "却下" | "無効化";

/** AI エンリッチで生成されるフィールド */
export type AiEnrichedFields = {
  titleJa: string;              // 日本語翻訳タイトル
  aiSummary: string;            // AI 生成の150字要約（日本語）
  creditType: CreditType | null;     // ACF: credit_type
  baseType: BaseType | null;         // ACF: base_type
  subCategory: string | null;        // ACF: sub_category
  operationalStatus: OperationalStatus | null; // ACF: status
  certificationBody: string | null;  // ACF: standard — "Verra VCS", "Gold Standard" 等
  reliabilityScore: number | null;   // ACF: reliability_score — 1〜5（AI が推論）
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
