import type { Methodology, Company, Insight } from "@/types";

// ============================================================
// メソドロジー
// ============================================================

export const methodologies: Methodology[] = [
  {
    id: "m-001",
    title: "VCS VM0007 REDD+ 方法論フレームワーク",
    type: "REDD+",
    region: "東南アジア",
    validUntil: "2028-12-31",
    summary:
      "熱帯林における森林減少・劣化からの排出削減を定量化するための包括的フレームワーク。ベースラインシナリオとの差分で削減量を算出。",
    reliabilityScore: 92,
  },
  {
    id: "m-002",
    title: "J-クレジット 森林管理プロジェクト (AR-001)",
    type: "ARR",
    region: "日本",
    validUntil: "2027-03-31",
    summary:
      "国内の新規植林・再植林による CO₂ 吸収量をクレジット化。森林経営計画に基づく長期的な炭素固定を評価。",
    reliabilityScore: 88,
  },
  {
    id: "m-003",
    title: "ブルーカーボン・マングローブ復元方法論",
    type: "マングローブ",
    region: "太平洋諸島",
    validUntil: "2029-06-30",
    summary:
      "劣化したマングローブ生態系の復元による炭素隔離効果を測定。土壌炭素と地上バイオマスの両方を対象。",
    reliabilityScore: 85,
  },
  {
    id: "m-004",
    title: "農地土壌炭素貯留プログラム (ALM-Asia)",
    type: "ALM",
    region: "アジア全域",
    validUntil: "2028-09-30",
    summary:
      "不耕起栽培やカバークロップ導入による農地土壌の炭素蓄積量増加を算定。衛星画像とサンプリング調査を併用。",
    reliabilityScore: 78,
  },
  {
    id: "m-005",
    title: "小規模再生可能エネルギー方法論 (AMS-I.D)",
    type: "再生可能エネルギー",
    region: "グローバル",
    validUntil: "2030-12-31",
    summary:
      "グリッド接続型の再生可能エネルギー発電による排出削減量を計算。グリッド排出係数を基に削減量を算出。",
    reliabilityScore: 95,
  },
];

// ============================================================
// 企業
// ============================================================

export const companies: Company[] = [
  {
    id: "c-001",
    name: "グリーンカーボン株式会社",
    category: "創出事業者",
    headquarters: "東京都千代田区",
    mainProjects: ["北海道森林再生プロジェクト", "九州バイオマス事業"],
  },
  {
    id: "c-002",
    name: "カーボンブリッジ・ジャパン",
    category: "仲介",
    headquarters: "東京都港区",
    mainProjects: ["J-クレジット取引仲介", "VCS クレジット調達支援"],
  },
  {
    id: "c-003",
    name: "サステナコンサルティング",
    category: "コンサル",
    headquarters: "大阪府大阪市",
    mainProjects: ["企業カーボンニュートラル戦略策定", "SBT 認定支援"],
  },
  {
    id: "c-004",
    name: "Japan Verification Institute",
    category: "検証機関",
    headquarters: "東京都中央区",
    mainProjects: ["VCS プロジェクト第三者検証", "ISO 14064 認証"],
  },
];

// ============================================================
// インサイト
// ============================================================

export const insights: Insight[] = [
  {
    id: "i-001",
    title: "GX リーグ、2026年度排出量取引ルールを最終化",
    date: "2026-03-05",
    category: "政策",
    summary:
      "経済産業省は GX リーグにおける排出量取引の新ルールを正式に公表。対象企業の拡大と罰則規定の強化が盛り込まれた。",
  },
  {
    id: "i-002",
    title: "ボランタリークレジット価格、年初来15%上昇",
    date: "2026-03-03",
    category: "市場",
    summary:
      "CORSIA 需要の拡大と企業のネットゼロ宣言増加を背景に、主要ボランタリークレジットの平均取引価格が上昇傾向を維持。",
  },
  {
    id: "i-003",
    title: "衛星MRV技術の精度が大幅に向上 — 新手法発表",
    date: "2026-02-28",
    category: "技術",
    summary:
      "欧州の研究チームが衛星リモートセンシングによる炭素蓄積量推定の新手法を発表。従来比で誤差を40%削減。",
  },
  {
    id: "i-004",
    title: "ICVCM が CCP ラベル付与対象方法論を追加発表",
    date: "2026-02-25",
    category: "政策",
    summary:
      "Integrity Council for the Voluntary Carbon Market が新たに12件の方法論に Core Carbon Principles 適合ラベルを付与。",
  },
  {
    id: "i-005",
    title: "日本のJ-クレジット登録量、累計1,000万トン突破",
    date: "2026-02-20",
    category: "市場",
    summary:
      "環境省の集計によると、J-クレジット制度の累計登録量が初めて1,000万 tCO₂ を超えた。再エネ由来が全体の約6割を占める。",
  },
];
