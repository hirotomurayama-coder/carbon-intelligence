import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ScrapedMethodology,
  AiEnrichedFields,
  CreditType,
  BaseType,
  OperationalStatus,
} from "@/types";

// ============================================================
// AI エンリッチャー — Google Gemini で翻訳・要約・分類・スコアリング
//
// 1 回の API コールで以下を生成:
//   - titleJa: 英語タイトルの自然な日本語翻訳
//   - aiSummary: 150 字以内の日本語要約
//   - creditType: 回避・削減系 / 除去系（WordPress ACF select 値に準拠）
//   - baseType: 自然ベース / 技術ベース / 再エネ
//   - subCategory: 森林, バイオ炭, CCS 等（詳細分類）
//   - operationalStatus: 運用中 / 審査中 / 再審査中 / 却下 / 無効化
//   - certificationBody: 認証機関名
//   - reliabilityScore: 1.0〜5.0（信頼性・普及度スコア）
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
 * ディープスクレイピングで取得した詳細テキストを活用した高精度推論。
 */
const SYSTEM_PROMPT = `あなたはカーボンクレジットのメソドロジー（方法論）分類・翻訳・評価の専門家です。

## タスク
メソドロジーの情報（タイトル、説明、詳細ページテキスト、レジストリ、カテゴリ等）を受け取り、以下を推論してJSON形式で返してください。

## 出力JSON形式
{
  "titleJa": "日本語タイトル",
  "aiSummary": "150字以内の日本語要約",
  "creditType": "回避・削減系" or "除去系" or null,
  "baseType": "自然ベース" or "技術ベース" or "再エネ" or null,
  "subCategory": "許可値リストから1つ" or null,
  "operationalStatus": "運用中" or "審査中" or "再審査中" or "却下" or "無効化" or null,
  "certificationBody": "認証機関名" or null,
  "reliabilityScore": 1.0〜5.0の数値
}

## titleJa（日本語タイトル）翻訳ルール
- 英語タイトルの場合: 自然な日本語に翻訳。カーボンクレジット業界の専門用語を適切に使用
  - 例: "Afforestation, Reforestation and Revegetation" → "植林・再植林・緑化"
  - 例: "Reducing emissions from deforestation" → "森林減少からの排出削減（REDD+）"
  - 例: "Refrigerant Leak Detection" → "冷媒漏洩検知"
- 既に日本語タイトルの場合: そのまま使用（J-クレジット等）
  - 例: "EN-S-001 ボイラーの導入" → "ボイラーの導入"（メソドロジーIDは除去）

## creditType（クレジット種別）推論ルール
必ず "回避・削減系" か "除去系" のどちらかを選択してください（nullは最終手段）:

**重要: 詳細ページに "Mitigation Outcome Label" 情報がある場合、これを最優先で利用**:
- "Reductions" → "回避・削減系"
- "Removals" → "除去系"
- "Reductions, Removals" → 主要な手法に基づいて判断

キーワード判定:
- "回避・削減系": 排出を防ぐ、または削減する手法
  - キーワード: REDD+, 省エネ, エネルギー効率, 再エネ, 燃料転換, メタン回収, 冷媒管理, ボイラー, LED, コジェネ, ヒートポンプ, leak detection, fugitive emissions
  - J-クレジット省エネ分野・再エネ分野・工業プロセス分野・廃棄物分野の多くはこちら
- "除去系": 大気中のCO2を直接除去する手法
  - キーワード: 植林, 再植林, ARR, DACCS, バイオ炭, CCS, 土壌炭素, マングローブ, 森林経営, biochar, afforestation, reforestation, carbon removal
  - J-クレジット森林分野のほとんどはこちら

## baseType（基本分類）推論ルール
- "自然ベース": 森林, 農地, マングローブ, 土壌, 海洋等の自然生態系を活用
- "技術ベース": 工業プロセス, CCS, メタン回収, ボイラー, LED, コジェネ, 冷媒管理等の技術的手法
- "再エネ": 太陽光, 風力, 水力, バイオマス発電, 地熱等の再生可能エネルギー
※ J-クレジット分野との対応: 省エネ→技術ベース, 再エネ→再エネ, 工業プロセス→技術ベース, 農業→自然ベース, 廃棄物→技術ベース, 森林→自然ベース

## subCategory（詳細分類）— 以下の許可値リストからのみ選択
森林, 土壌炭素, バイオ炭, ERW（岩石風化促進）, 農業, 海洋, 生態系再生複合,
CCS, CCU, CCUS, DACCS, BECCS, BiCRS, BECCU, 工業材料固定,
省エネ・効率改善, 燃料転換, 工業プロセス改善, 廃熱回収・再利用,
廃棄物管理, 調理改善, 冷媒管理, 調達・物流, 低炭素原材料,
土地利用, 畜産, エネルギー転換・輸送, 都市, 再生可能エネルギー, バイオマス

**Sectoral Scope 情報がある場合、これを活用して subCategory を推論**:
- "1. Energy industries" → "再生可能エネルギー" or "省エネ・効率改善"
- "3. Energy demand" → "省エネ・効率改善"
- "4. Manufacturing industries" → "工業プロセス改善"
- "5. Chemical industry" → "工業プロセス改善"
- "11. Fugitive emissions" → "冷媒管理" or "廃棄物管理"
- "13. Waste handling" → "廃棄物管理"
- "14. AFOLU" → "森林" or "農業" or "土地利用"

推論例:
- ボイラー導入、LED照明、コジェネ → "省エネ・効率改善"
- 太陽光発電、風力発電、バイオマス発電 → "再生可能エネルギー"
- 森林経営、植林 → "森林"
- 家畜排泄物管理 → "畜産"
- 冷媒の回収・破壊、冷媒漏洩検知 → "冷媒管理"
- メタン回収 → "廃棄物管理"
- 土壌炭素貯留 → "土壌炭素"
- バイオ炭 → "バイオ炭"
- 調理用ストーブ → "調理改善"

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

## reliabilityScore（信頼性・普及度スコア）
1.0〜5.0の範囲で、以下の基準に基づいて評価してください:

5.0: 世界的に広く使用され、多数のプロジェクトで検証済み。長い実績がある（例: VM0007 REDD-MF, VM0015）
4.0: 多くのプロジェクトで使用され、実績が十分。業界で認知度が高い
3.0: 一定のプロジェクト実績がある。方法論として確立している
2.0: 比較的新しい、または適用範囲が限定的。実績はまだ少ない
1.0: 非常に新しい、またはニッチな分野。実績データがほぼない

判定のヒント:
- バージョン番号が高い（v2.0以上）→ 成熟度が高い → スコア上昇
- REDD+, ARR, 再エネ系 → 市場で広く使われる → スコア上昇
- ニッチな技術（特定化学物質、特定地域限定）→ スコア低め
- Active Date が古い（長期運用）→ 信頼性高い → スコア上昇
- Sectoral Scope が広い → 適用範囲が広い → スコア上昇
- Development History にバージョン改定が多い → 継続的に改善 → スコア上昇

## aiSummary（日本語要約）
- 150字以内で、このメソドロジーの対象分野、主な手法、適用条件を簡潔に説明
- カーボンクレジット専門家向けの文体で
- 詳細ページのテキストが提供されている場合、具体的な手法や適用範囲を要約に含める

必ず有効なJSONのみを返してください。マークダウンのコードブロック(\`\`\`)は使わないでください。`;

/**
 * 1 件のスクレイピング結果を AI でエンリッチする。
 *
 * @param scraped スクレイピング済みメソドロジー（ディープスクレイピング情報含む）
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
        maxOutputTokens: 800,
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

/** ユーザーメッセージを構築（ディープスクレイピング情報を含む全情報を提供） */
function buildUserMessage(scraped: ScrapedMethodology): string {
  const lines = [
    `メソドロジー名: ${scraped.name}`,
    `説明: ${scraped.description}`,
    `レジストリ: ${scraped.registry}`,
    `カテゴリ: ${scraped.category}`,
    `ステータス: ${scraped.status}`,
    scraped.version ? `バージョン: ${scraped.version}` : "",
    scraped.sourceUrl ? `ソースURL: ${scraped.sourceUrl}` : "",
    scraped.lastUpdated ? `最終更新（Active Date）: ${scraped.lastUpdated}` : "",
  ];

  // ディープスクレイピング情報
  if (scraped.sectoralScope) {
    lines.push(`Sectoral Scope: ${scraped.sectoralScope}`);
  }
  if (scraped.mitigationOutcome) {
    lines.push(`Mitigation Outcome Label: ${scraped.mitigationOutcome}`);
  }
  if (scraped.detailText) {
    lines.push("");
    lines.push("--- 詳細ページの本文テキスト ---");
    lines.push(scraped.detailText.slice(0, 2000));
  }

  return lines.filter((l) => l !== undefined).join("\n");
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

  // reliabilityScore: 1.0〜5.0 の範囲に制限し、0–100 スケール（×20）に変換
  let reliabilityScore: number | null = null;
  if (typeof raw.reliabilityScore === "number" && raw.reliabilityScore >= 1 && raw.reliabilityScore <= 5) {
    // 1.0〜5.0 を 20〜100 に変換（WordPress UI で 0–100 スケールで表示するため）
    reliabilityScore = Math.round(raw.reliabilityScore * 20);
  } else if (typeof raw.reliabilityScore === "string") {
    const n = parseFloat(raw.reliabilityScore);
    if (n >= 1 && n <= 5) {
      reliabilityScore = Math.round(n * 20);
    }
  }

  return {
    titleJa,
    aiSummary,
    creditType,
    baseType,
    subCategory,
    operationalStatus,
    certificationBody,
    reliabilityScore,
  };
}

/** API 失敗時のフォールバック値（ディープスクレイピング情報を最大限活用） */
function createFallback(scraped: ScrapedMethodology): AiEnrichedFields {
  // レジストリ名から認証機関を推定
  const bodyMap: Record<string, string> = {
    Verra: "Verra VCS",
    "Gold Standard": "Gold Standard",
    "Puro.earth": "Puro.earth",
    "J-Credit": "J-クレジット制度",
  };

  // Mitigation Outcome から creditType を推論
  let creditType: CreditType | null = null;
  if (scraped.mitigationOutcome) {
    const outcome = scraped.mitigationOutcome.toLowerCase();
    if (outcome.includes("removal")) {
      creditType = "除去系";
    } else if (outcome.includes("reduction")) {
      creditType = "回避・削減系";
    }
  }

  // Sectoral Scope + カテゴリから baseType と subCategory を推論
  // ※ Sectoral Scope（ディープスクレイピング情報）を最優先で判定に使用
  let baseType: BaseType | null = null;
  let subCategory: string | null = null;
  const scope = (scraped.sectoralScope ?? "").toLowerCase();
  const cat = scraped.category.toLowerCase();
  const nameL = scraped.name.toLowerCase();

  // subCategory 推論（Sectoral Scope ベース — 最優先）
  if (scope.includes("fugitive emissions")) {
    subCategory = "冷媒管理";
  } else if (scope.includes("waste handling") || scope.includes("waste disposal")) {
    subCategory = "廃棄物管理";
  } else if (scope.includes("afolu")) {
    if (nameL.includes("redd") || nameL.includes("deforestation")) {
      subCategory = "森林";
    } else if (nameL.includes("arr") || nameL.includes("afforestation") || nameL.includes("reforestation")) {
      subCategory = "森林";
    } else if (nameL.includes("agriculture") || nameL.includes("soil")) {
      subCategory = "農業";
    } else if (nameL.includes("mangrove") || nameL.includes("wetland") || nameL.includes("blue carbon")) {
      subCategory = "海洋";
    } else if (nameL.includes("biochar")) {
      subCategory = "バイオ炭";
    } else {
      subCategory = "森林"; // AFOLU default
    }
  } else if (scope.includes("energy industries")) {
    subCategory = "再生可能エネルギー";
  } else if (scope.includes("energy demand")) {
    subCategory = "省エネ・効率改善";
  } else if (scope.includes("manufacturing") || scope.includes("chemical")) {
    subCategory = "工業プロセス改善";
  } else if (scope.includes("transport")) {
    subCategory = "エネルギー転換・輸送";
  }

  // カテゴリからの追加推論（scope がない場合のフォールバック）
  if (subCategory === null) {
    if (cat === "arr" || nameL.includes("forest")) subCategory = "森林";
    else if (cat.includes("redd")) subCategory = "森林";
    else if (cat.includes("省エネ")) subCategory = "省エネ・効率改善";
    else if (cat.includes("再生可能")) subCategory = "再生可能エネルギー";
    else if (cat.includes("農")) subCategory = "農業";
    else if (cat.includes("廃棄物")) subCategory = "廃棄物管理";
    else if (nameL.includes("biochar")) subCategory = "バイオ炭";
    else if (nameL.includes("cookstove") || nameL.includes("cooking")) subCategory = "調理改善";
  }

  // baseType 推論（Sectoral Scope 優先、次にカテゴリ）
  // ※ scope がある場合はそちらを優先（一覧ページのカテゴリは不正確な場合がある）
  if (scope) {
    // Sectoral Scope ベースの baseType
    if (scope.includes("afolu")) {
      baseType = "自然ベース";
    } else if (scope.includes("energy industries") || scope.includes("energy distribution")) {
      baseType = "再エネ";
    } else {
      // それ以外の Sectoral Scope（demand, manufacturing, chemical, fugitive, waste, transport...）
      baseType = "技術ベース";
    }
  } else {
    // scope がない場合はカテゴリベース
    if (cat === "arr" || cat.includes("redd") || cat.includes("alm") || cat.includes("forest") || cat.includes("農")) {
      baseType = "自然ベース";
    } else if (cat.includes("再生可能") || cat.includes("renewable")) {
      baseType = "再エネ";
    } else if (cat.includes("省エネ") || cat.includes("技術") || cat.includes("工業") || cat.includes("廃棄物")) {
      baseType = "技術ベース";
    }
  }

  return {
    titleJa: scraped.name, // 原文をそのまま使用
    aiSummary: "",
    creditType,
    baseType,
    subCategory,
    operationalStatus: scraped.status === "Active" ? "運用中" : null,
    certificationBody: bodyMap[scraped.registry] ?? null,
    reliabilityScore: null,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// タイトル翻訳専用モード（軽量・安全モード）
// ============================================================

const TITLE_ONLY_PROMPT = `あなたはカーボンクレジットの専門翻訳者です。
メソドロジー名を自然な日本語に翻訳してください。

ルール:
- VM番号（VM0001等）やメソドロジーID（EN-S-001等）は除去して翻訳
- カーボンクレジット業界の専門用語を適切に使用
- 既に日本語の場合はそのまま返す（メソドロジーIDは除去）
- 例: "Afforestation, Reforestation and Revegetation" → "植林・再植林・緑化"
- 例: "Reducing emissions from deforestation" → "森林減少からの排出削減（REDD+）"
- 例: "Refrigerant Leak Detection" → "冷媒漏洩検知"

JSON形式で返してください: {"titleJa": "日本語タイトル"}`;

/**
 * タイトルのみを日本語に翻訳する軽量モード。
 * 失敗時は null を返す（ループ・リトライなし）。
 */
export async function translateTitleOnly(
  name: string
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 200,
        responseMimeType: "application/json",
      },
    });

    const prompt = `${TITLE_ONLY_PROMPT}\n\nメソドロジー名: ${name}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) return null;

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return typeof parsed.titleJa === "string" && parsed.titleJa.trim()
      ? parsed.titleJa.trim()
      : null;
  } catch (e) {
    console.warn(`[AI Title] 翻訳失敗 (${name}):`, (e as Error).message ?? e);
    return null;
  }
}

/**
 * タイトル翻訳バッチ処理 — 5秒間隔、失敗時スキップ
 */
export async function translateTitlesBatch(
  items: { sourceUrl: string; name: string }[],
  delayMs = 5000
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(
      `[AI Title] ${i + 1}/${items.length}: ${item.name.slice(0, 60)}...`
    );

    const titleJa = await translateTitleOnly(item.name);
    if (titleJa) {
      results.set(item.sourceUrl, titleJa);
      console.log(`[AI Title] → ${titleJa}`);
    } else {
      console.log(`[AI Title] → スキップ (翻訳失敗)`);
    }

    if (i < items.length - 1) {
      await delay(delayMs);
    }
  }

  return results;
}
