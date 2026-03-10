import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ScrapedMethodology,
  AiEnrichedFields,
  CreditType,
  BaseType,
  OperationalStatus,
} from "@/types";

// ============================================================
// AI エンリッチャー — Google Gemini で翻訳・要約・分類
//
// 1 回の API コールで以下を生成:
//   - titleJa: 英語タイトルの自然な日本語翻訳
//   - aiSummary: 150 字以内の日本語要約
//   - creditType: 回避・削減系 / 除去系（WordPress ACF select 値に準拠）
//   - baseType: 自然ベース / 技術ベース / 再エネ
//   - subCategory: 森林, バイオ炭, CCS 等（詳細分類）
//   - operationalStatus: 運用中 / 審査中 / 再審査中 / 却下 / 無効化
//   - certificationBody: 認証機関名
// ============================================================

/** Gemini クライアント（遅延初期化） */
let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  if (genAI) return genAI;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[AI Enricher] GOOGLE_GENERATIVE_AI_API_KEY が未設定 — AI エンリッチをスキップ"
    );
    return null;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

/**
 * AI エンリッチのシステムプロンプト。
 * WordPress ACF select フィールドの許可値に完全準拠。
 */
const SYSTEM_PROMPT = `あなたはカーボンクレジットのメソドロジー（方法論）の専門家です。
英語のメソドロジー情報を受け取り、以下のJSON形式で回答してください。

{
  "titleJa": "自然な日本語のタイトル（直訳ではなく、専門用語を適切に使った翻訳）",
  "aiSummary": "このメソドロジーの概要を150字以内の日本語で説明。対象分野、主な手法、適用条件を含める",
  "creditType": "回避・削減系" または "除去系" または null,
  "baseType": "自然ベース" または "技術ベース" または "再エネ" または null,
  "subCategory": 下記の許可値リストから1つ選択 または null,
  "operationalStatus": "運用中" または "審査中" または "再審査中" または "却下" または "無効化" または null,
  "certificationBody": "認証機関名（例: Verra VCS, Gold Standard, Puro.earth）" または null
}

分類ルール:
- creditType（クレジット種別）:
  - "回避・削減系": 排出を防ぐ、または削減するメソドロジー（REDD+、省エネ、再エネ等）
  - "除去系": 大気中のCO2を直接除去するメソドロジー（植林、DACCS、バイオ炭等）
- baseType（基本分類）:
  - "自然ベース": 森林、農地、マングローブ、土壌等の自然生態系を活用
  - "技術ベース": 工業プロセス、CCS、メタン回収等の技術的手法
  - "再エネ": 太陽光、風力、水力、バイオマス等の再生可能エネルギー
- subCategory（詳細分類、以下のいずれか1つのみ選択可能）:
  森林, 土壌炭素, バイオ炭, ERW（岩石風化促進）, 農業, 海洋, 生態系再生複合,
  CCS, CCU, CCUS, DACCS, BECCS, BiCRS, BECCU, 工業材料固定,
  省エネ・効率改善, 燃料転換, 工業プロセス改善, 廃熱回収・再利用,
  廃棄物管理, 調理改善, 冷媒管理, 調達・物流, 低炭素原材料,
  土地利用, 畜産, エネルギー転換・輸送, 都市, 再生可能エネルギー, バイオマス
- operationalStatus: 情報が不明な場合は "運用中" をデフォルトとする
- certificationBody: レジストリ名から推定（Verra → "Verra VCS", Gold Standard → "Gold Standard"）

必ず有効なJSONのみを返してください。マークダウンのコードブロック(\`\`\`)は使わないでください。`;

/**
 * 1 件のスクレイピング結果を AI でエンリッチする。
 *
 * @param scraped スクレイピング済みメソドロジー
 * @returns AI エンリッチフィールド（API 失敗時はフォールバック値）
 */
export async function enrichMethodology(
  scraped: ScrapedMethodology
): Promise<AiEnrichedFields> {
  const client = getClient();

  // API キー未設定時はフォールバック
  if (!client) {
    return createFallback(scraped);
  }

  try {
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    });

    const userMessage = buildUserMessage(scraped);
    const prompt = `${SYSTEM_PROMPT}\n\n---\n${userMessage}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      console.warn(`[AI Enricher] 空レスポンス: ${scraped.name}`);
      return createFallback(scraped);
    }

    // Gemini が ```json ... ``` で囲む場合のフォールバック除去
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return validateAndMap(parsed, scraped);
  } catch (e) {
    console.error(`[AI Enricher] エラー (${scraped.name}):`, e);
    return createFallback(scraped);
  }
}

/**
 * バッチエンリッチ — 複数のメソドロジーを順次処理（レート制限付き）
 */
export async function enrichBatch(
  items: ScrapedMethodology[],
  delayMs = 200
): Promise<Map<string, AiEnrichedFields>> {
  const results = new Map<string, AiEnrichedFields>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(
      `[AI Enricher] ${i + 1}/${items.length}: ${item.name.slice(0, 60)}...`
    );

    const enriched = await enrichMethodology(item);
    results.set(item.sourceUrl, enriched);

    // レート制限
    if (i < items.length - 1) {
      await delay(delayMs);
    }
  }

  return results;
}

/**
 * AI エンリッチが利用可能かチェック。
 */
export function isAiEnrichAvailable(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

// ============================================================
// 内部ヘルパー
// ============================================================

/** ユーザーメッセージを構築 */
function buildUserMessage(scraped: ScrapedMethodology): string {
  return [
    `メソドロジー名: ${scraped.name}`,
    `説明: ${scraped.description}`,
    `レジストリ: ${scraped.registry}`,
    `カテゴリ: ${scraped.category}`,
    `ステータス: ${scraped.status}`,
    scraped.version ? `バージョン: ${scraped.version}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// WordPress ACF select フィールドの許可値定義
const VALID_CREDIT_TYPE: CreditType[] = ["回避・削減系", "除去系"];
const VALID_BASE_TYPE: BaseType[] = ["自然ベース", "技術ベース", "再エネ"];
const VALID_SUB_CATEGORY: string[] = [
  "森林", "土壌炭素", "バイオ炭", "ERW（岩石風化促進）", "農業", "海洋",
  "生態系再生複合", "CCS", "CCU", "CCUS", "DACCS", "BECCS", "BiCRS",
  "BECCU", "工業材料固定", "省エネ・効率改善", "燃料転換", "工業プロセス改善",
  "廃熱回収・再利用", "廃棄物管理", "調理改善", "冷媒管理", "調達・物流",
  "低炭素原材料", "土地利用", "畜産", "エネルギー転換・輸送", "都市",
  "再生可能エネルギー", "バイオマス",
];
const VALID_STATUS: OperationalStatus[] = [
  "運用中", "審査中", "再審査中", "却下", "無効化",
];

/** API レスポンスをバリデートして AiEnrichedFields に変換 */
function validateAndMap(
  raw: Record<string, unknown>,
  scraped: ScrapedMethodology
): AiEnrichedFields {
  const titleJa =
    typeof raw.titleJa === "string" && raw.titleJa.trim()
      ? raw.titleJa.trim()
      : scraped.name;

  const aiSummary =
    typeof raw.aiSummary === "string" && raw.aiSummary.trim()
      ? raw.aiSummary.trim().slice(0, 200)
      : "";

  const creditType =
    typeof raw.creditType === "string" &&
    VALID_CREDIT_TYPE.includes(raw.creditType as CreditType)
      ? (raw.creditType as CreditType)
      : null;

  const baseType =
    typeof raw.baseType === "string" &&
    VALID_BASE_TYPE.includes(raw.baseType as BaseType)
      ? (raw.baseType as BaseType)
      : null;

  const subCategory =
    typeof raw.subCategory === "string" &&
    VALID_SUB_CATEGORY.includes(raw.subCategory)
      ? raw.subCategory
      : null;

  const operationalStatus =
    typeof raw.operationalStatus === "string" &&
    VALID_STATUS.includes(raw.operationalStatus as OperationalStatus)
      ? (raw.operationalStatus as OperationalStatus)
      : null;

  const certificationBody =
    typeof raw.certificationBody === "string" &&
    raw.certificationBody.trim()
      ? raw.certificationBody.trim()
      : null;

  return {
    titleJa,
    aiSummary,
    creditType,
    baseType,
    subCategory,
    operationalStatus,
    certificationBody,
  };
}

/** API 失敗時のフォールバック値 */
function createFallback(scraped: ScrapedMethodology): AiEnrichedFields {
  // レジストリ名から認証機関を推定
  const bodyMap: Record<string, string> = {
    Verra: "Verra VCS",
    "Gold Standard": "Gold Standard",
    "Puro.earth": "Puro.earth",
  };

  return {
    titleJa: scraped.name, // 英語原文をそのまま使用
    aiSummary: "",
    creditType: null,        // select フィールド → null で WP に送らない
    baseType: null,
    subCategory: null,
    operationalStatus: scraped.status === "Active" ? "運用中" : null,
    certificationBody: bodyMap[scraped.registry] ?? null,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
