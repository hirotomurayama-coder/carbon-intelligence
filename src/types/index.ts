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
  type: MethodologyType;
  region: string;
  validUntil: string;       // ISO 日付文字列 "YYYY-MM-DD"
  summary: string;
  reliabilityScore: number; // 0–100
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
  category: CompanyCategory;
  headquarters: string;
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
  category: InsightCategory;
  summary: string;
};
