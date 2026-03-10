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
 * メソドロジー名・説明・レジストリ・カテゴリ情報から分類を推論する。
 */
const SYSTEM_PROMPT = `あなたはカーボンクレジットのメソドロジー（方法論）分類・翻訳の専門家です。

## タスク
メソドロジーの情報（タイトル、説明、レジストリ、カテゴリ）を受け取り、以下を推論してJSON形式で返してください。

## 出力JSON形式
{
  "titleJa": "日本語タイトル",
  "aiSummary": "150字以内の日本語要約",
  "creditType": "回避・削減系" or "除去系" or null,
  "baseType": "自然ベース" or "技術ベース" or "再エネ" or null,
  "subCategory": "許可値リストから1つ" or null,
  "operationalStatus": "運用中" or "審査中" or "再審査中" or "却下" or "無効化" or null,
  "certificationBody": "認証機関名" or null
}

## titleJa（日本語タイトル）翻訳ルール
- 英語タイトルの場合: 自然な日本語に翻訳。カーボンクレジット業界の専門用語を適切に使用
  - 例: "Afforestation, Reforestation and Revegetation" → "植林・再植林・緑化"
  - 例: "Reducing emissions from deforestation" → "森林減少からの排出削減（REDD+）"
- 既に日本語タイトルの場合: そのまま使用（J-クレジット等）
  - 例: "EN-S-001 ボイラーの導入" → "ボイラーの導入"（メソドロジーIDは除去）

## creditType（クレジット種別）推論ルール
必ず "回避・削減系" か "除去系" のどちらかを選択してください（nullは最終手段）:
- "回避・削減系": 排出を防ぐ、または削減する手法
  - キーワード: REDD+, 省エネ, エネルギー効率, 再エネ, 燃料転換, メタン回収, 冷媒管理, ボイラー, LED, コジェネ, ヒートポンプ
  - J-クレジット省エネ分野・再エネ分野・工業プロセス分野・廃棄物分野の多くはこちら
- "除去系": 大気中のCO2を直接除去する手法
  - キーワード: 植林, 再植林, ARR, DACCS, バイオ炭, CCS, 土壌炭素, マングローブ, 森林経営
  - J-クレジット森林分野のほとんどはこちら

## baseType（基本分類）推論ルール
- "自然ベース": 森林, 農地, マングローブ, 土壌, 海洋等の自然生態系を活用
- "技術ベース": 工業プロセス, CCS, メタン回収, ボイラー, LED, コジェネ等の技術的手法
- "再エネ": 太陽光, 風力, 水力, バイオマス発電, 地熱等の再生可能エネルギー
※ J-クレジット分野との対応: 省エネ→技術ベース, 再エネ→再エネ, 工業プロセス→技術ベース, 農業→自然ベース, 廃棄物→技術ベース, 森林→自然ベース

## subCategory（詳細分類）— 以下の許可値リストからのみ選択
森林, 土壌炭素, バイオ炭, ERW（岩石風化促進）, 農業, 海洋, 生態系再生複合,
CCS, CCU, CCUS, DACCS, BECCS, BiCRS, BECCU, 工業材料固定,
省エネ・効率改善, 燃料転換, 工業プロセス改善, 廃熱回収・再利用,
廃棄物管理, 調理改善, 冷媒管理, 調達・物流, 低炭素原材料,
土地利用, 畜産, エネルギー転換・輸送, 都市, 再生可能エネルギー, バイオマス

推論例:
- ボイラー導入、LED照明、コジェネ → "省エネ・効率改善"
- 太陽光発電、風力発電、バイオマス発電 → "再生可能エネルギー"
- 森林経営、植林 → "森林"
- 家畜排泄物管理 → "畜産"
- 冷媒の回収・破壊 → "冷媒管理"
- メタン回収 → "廃棄物管理"

## operationalStatus（運用状況）
- ステータスが "Active" の場合 → "運用中"
- ステータスが明示的に非アクティブでない限り、"運用中" をデフォルトとする
- J-クレジット: 廃止でなければ → "運用中"

## certificationBody（認証機関）
レジストリから推定:
- Verra → "Verra VCS"
- Gold Standard → "Gold Standard"
- Puro.earth → "Puro.earth"
- J-Credit → "J-クレジット制度"

## aiSummary（日本語要約）
- 150字以内で、このメソドロジーの対象分野、主な手法、適用条件を簡潔に説明
- カーボンクレジット専門家向けの文体で

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

/** ユーザーメッセージを構築（推論に使える全情報を提供） */
function buildUserMessage(scraped: ScrapedMethodology): string {
  return [
    `メソドロジー名: ${scraped.name}`,
    `説明: ${scraped.description}`,
    `レジストリ: ${scraped.registry}`,
    `カテゴリ: ${scraped.category}`,
    `ステータス: ${scraped.status}`,
    scraped.version ? `バージョン: ${scraped.version}` : "",
    scraped.sourceUrl ? `ソースURL: ${scraped.sourceUrl}` : "",
    scraped.lastUpdated ? `最終更新: ${scraped.lastUpdated}` : "",
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
    "J-Credit": "J-クレジット制度",
  };

  return {
    titleJa: scraped.name, // 原文をそのまま使用
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
