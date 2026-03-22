/**
 * 企業自動発見・登録スクリプト
 *
 * carboncredits.jp の全記事タイトルから企業名を抽出し、
 * WordPress staging に新規企業として登録 + 関連記事を紐付ける。
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD && npx tsx scripts/discover-companies.ts
 */

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "").replace(/\/+$/, "");
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";
const DRY_RUN = process.argv.includes("--dry-run");
const CCJ_API = "https://carboncredits.jp/wp-json/wp/v2";

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error("環境変数が未設定");
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8217;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&#8211;/g, "–").replace(/&#038;/g, "&").trim();
}

type CCJPost = { id: number; title: { rendered: string }; link: string; date: string };
type RelatedArticle = { title: string; url: string; date: string };

// ============================================================
// Phase 1: carboncredits.jp の全記事を取得
// ============================================================

async function fetchAllCCJPosts(): Promise<CCJPost[]> {
  const all: CCJPost[] = [];
  let page = 1;

  while (true) {
    console.log(`  記事取得: ページ ${page}...`);
    try {
      const res = await fetch(
        `${CCJ_API}/posts?per_page=100&page=${page}&_fields=id,title,link,date&orderby=date&order=desc`,
        {
          headers: { "User-Agent": "CarbonIntelBot/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        }
      );
      if (!res.ok) {
        console.log(`  ページ ${page}: HTTP ${res.status} — 終了`);
        break;
      }
      const posts: CCJPost[] = await res.json();
      all.push(...posts);
      console.log(`  ページ ${page}: ${posts.length} 件 (累計 ${all.length})`);
      if (posts.length < 100) break;
      page++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.warn(`  ページ ${page} エラー: ${e}`);
      break;
    }
  }

  return all;
}

// ============================================================
// Phase 2: 記事タイトルから企業名を抽出
// ============================================================

/**
 * 記事タイトルから企業名候補を抽出するパターンマッチング。
 * 日本語記事: 「〇〇が」「〇〇、」「〇〇と」パターン
 * 英語記事: 先頭の固有名詞
 */
function extractCompanyNames(posts: CCJPost[]): Map<string, { count: number; articles: RelatedArticle[] }> {
  const companyMap = new Map<string, { count: number; articles: RelatedArticle[] }>();

  // よく出る企業名パターン（手動で主要企業リストを定義）
  // carboncredits.jp の記事から頻出する企業名
  const KNOWN_COMPANIES: { name: string; aliases: string[]; category: string; hq?: string; description?: string }[] = [
    // === CDR / テクノロジー系 ===
    { name: "Climeworks", aliases: ["Climeworks"], category: "創出", hq: "スイス チューリッヒ", description: "世界最大のDAC（直接空気回収）企業。アイスランドのOrca、Mammothプラントを運営。" },
    { name: "Carbon Engineering", aliases: ["Carbon Engineering", "CE"], category: "創出", hq: "カナダ ブリティッシュコロンビア", description: "大規模DAC技術を開発。Occidental Petroleumの子会社。" },
    { name: "Heirloom Carbon", aliases: ["Heirloom"], category: "創出", hq: "米国 サンフランシスコ", description: "石灰石ベースのDAC技術を開発する炭素除去スタートアップ。" },
    { name: "CarbonCapture Inc.", aliases: ["CarbonCapture"], category: "創出", hq: "米国 ロサンゼルス", description: "モジュール式DAC技術を開発。Project Bison等の大規模プロジェクトを展開。" },
    { name: "Charm Industrial", aliases: ["Charm Industrial", "Charm"], category: "創出", hq: "米国 サンフランシスコ", description: "バイオオイル地中注入によるバイオ炭素除去（BiCRS）を展開。" },
    { name: "Running Tide", aliases: ["Running Tide"], category: "創出", hq: "米国 メイン州", description: "海洋ベースの炭素除去技術を開発。海藻・木質バイオマスの深海沈降。" },
    { name: "Carbonfuture", aliases: ["Carbonfuture"], category: "創出", hq: "ドイツ フライブルク", description: "バイオ炭ベースの炭素除去クレジットプラットフォームを運営。" },
    { name: "UNDO", aliases: ["UNDO"], category: "創出", hq: "英国 スコットランド", description: "風化促進（ERW）による炭素除去技術を展開。農地への玄武岩散布。" },
    { name: "Lithos Carbon", aliases: ["Lithos"], category: "創出", hq: "米国 フィラデルフィア", description: "風化促進（ERW）による炭素除去。農業との統合アプローチ。" },
    { name: "44.01", aliases: ["44.01"], category: "創出", hq: "オマーン マスカット", description: "岩石の鉱物化によるCO2永久固定技術を開発。" },
    { name: "Isometric", aliases: ["Isometric"], category: "検証機関", hq: "英国 ロンドン", description: "CDR（炭素除去）クレジットの科学的検証・認証機関。" },
    { name: "Puro.earth", aliases: ["Puro.earth", "Puro"], category: "検証機関", hq: "フィンランド ヘルシンキ", description: "炭素除去クレジットの認証基準・マーケットプレイスを運営。Nasdaq傘下。" },
    // === ボランタリー市場プラットフォーム ===
    { name: "Verra", aliases: ["Verra", "VCS"], category: "検証機関", hq: "米国 ワシントンD.C.", description: "世界最大のボランタリーカーボンクレジット認証機関。VCS（Verified Carbon Standard）を運営。" },
    { name: "Gold Standard", aliases: ["Gold Standard"], category: "検証機関", hq: "スイス ジュネーブ", description: "SDGs共便益重視のカーボンクレジット認証基準を運営。" },
    { name: "ACR", aliases: ["ACR", "American Carbon Registry"], category: "検証機関", hq: "米国 バージニア", description: "米国を中心としたカーボンオフセット認証機関。" },
    // === マーケットプレイス・取引所 ===
    { name: "Xpansiv", aliases: ["Xpansiv", "CBL"], category: "仲介", hq: "米国 ニューヨーク", description: "世界最大の環境商品取引プラットフォーム。CBLマーケットを運営。" },
    { name: "Nasdaq", aliases: ["Nasdaq"], category: "仲介", hq: "米国 ニューヨーク", description: "Puro.earthを買収し、炭素除去クレジット市場に参入した証券取引所。" },
    { name: "ICE", aliases: ["ICE", "Intercontinental Exchange"], category: "仲介", hq: "米国 アトランタ", description: "EUA等の排出権取引を扱う世界的商品取引所。" },
    // === コンサル・仲介 ===
    { name: "South Pole", aliases: ["South Pole"], category: "コンサル", hq: "スイス チューリッヒ", description: "世界最大級の気候ソリューション企業。カーボンクレジット開発・取引。" },
    { name: "Carbon Direct", aliases: ["Carbon Direct"], category: "コンサル", hq: "米国 ニューヨーク", description: "科学主導のカーボンマネジメント企業。コロンビア大学の研究者が設立。" },
    { name: "Pachama", aliases: ["Pachama"], category: "コンサル", hq: "米国 サンフランシスコ", description: "衛星画像とAIを用いた森林カーボンクレジットの検証プラットフォーム。" },
    { name: "Sylvera", aliases: ["Sylvera"], category: "コンサル", hq: "英国 ロンドン", description: "カーボンクレジットの品質評価・格付けプラットフォーム。" },
    { name: "BeZero Carbon", aliases: ["BeZero"], category: "コンサル", hq: "英国 ロンドン", description: "カーボンクレジットの格付け・リスク評価サービスを提供。" },
    { name: "Calyx Global", aliases: ["Calyx Global", "Calyx"], category: "コンサル", hq: "米国", description: "カーボンクレジットの品質・リスク評価を行う独立機関。" },
    { name: "MSCI", aliases: ["MSCI"], category: "コンサル", hq: "米国 ニューヨーク", description: "ESG格付け・カーボンクレジット品質評価を提供する金融データ企業。" },
    // === 大手買い手・需要家 ===
    { name: "Microsoft", aliases: ["Microsoft", "マイクロソフト"], category: "コンサル", hq: "米国 レドモンド", description: "2030年カーボンネガティブ目標を掲げ、大規模CDRクレジットを購入。" },
    { name: "Frontier", aliases: ["Frontier"], category: "仲介", hq: "米国", description: "Stripe主導のCDR前払い購入プログラム。Google、Meta、Shopify等が参加。" },
    { name: "NextGen CDR", aliases: ["NextGen"], category: "仲介", hq: "スイス", description: "South Pole発のCDR購入プログラム。企業向けの除去クレジット調達。" },
    // === 日本企業 ===
    { name: "バイウィル", aliases: ["バイウィル"], category: "仲介", hq: "東京都千代田区", description: "J-クレジット等のカーボンクレジット取引プラットフォームを運営する日本企業。" },
    { name: "グリーンカーボン", aliases: ["グリーンカーボン"], category: "創出", hq: "東京都港区", description: "水田中干し延長等の農業由来カーボンクレジット創出を推進。" },
    { name: "Sustineri", aliases: ["Sustineri", "サステナリ"], category: "コンサル", hq: "東京都", description: "カーボンクレジットのコンサルティング・ブローカレッジサービスを提供。" },
    { name: "ウェイストボックス", aliases: ["ウェイストボックス"], category: "創出", hq: "東京都", description: "廃棄物関連のカーボンクレジット創出事業を展開。" },
    { name: "Indigo Ag", aliases: ["Indigo Ag", "Indigo"], category: "創出", hq: "米国 ボストン", description: "再生型農業プラットフォーム。農業由来の土壌炭素クレジットを発行。" },
    { name: "Stripe", aliases: ["Stripe"], category: "仲介", hq: "米国 サンフランシスコ", description: "決済プラットフォーム大手。Frontier CDR購入イニシアチブを主導。" },
    { name: "Shopify", aliases: ["Shopify"], category: "仲介", hq: "カナダ オタワ", description: "EC プラットフォーム大手。Sustainability Fund でCDRクレジットを購入。" },
    { name: "JPX", aliases: ["JPX", "東京証券取引所", "日本取引所グループ"], category: "仲介", hq: "東京都中央区", description: "J-クレジットのカーボン・クレジット市場を運営する日本取引所グループ。" },
    { name: "JFE", aliases: ["JFE", "JFEスチール", "JFEエンジニアリング"], category: "創出", hq: "東京都千代田区", description: "鉄鋼大手。CCS/CCU技術やブルーカーボンクレジット創出に取り組む。" },
    { name: "三井物産", aliases: ["三井物産"], category: "仲介", hq: "東京都千代田区", description: "総合商社。森林・ブルーカーボン等のカーボンクレジット事業を展開。" },
    { name: "三菱商事", aliases: ["三菱商事"], category: "仲介", hq: "東京都千代田区", description: "総合商社。CCS・DACへの投資やカーボンクレジット取引事業を推進。" },
    { name: "住友商事", aliases: ["住友商事"], category: "仲介", hq: "東京都千代田区", description: "総合商社。森林保全・再生可能エネルギー由来のクレジット事業を展開。" },
    { name: "丸紅", aliases: ["丸紅"], category: "仲介", hq: "東京都千代田区", description: "総合商社。ブルーカーボン・森林クレジットの開発・取引を推進。" },
    { name: "伊藤忠商事", aliases: ["伊藤忠商事", "伊藤忠"], category: "仲介", hq: "東京都港区", description: "総合商社。カーボンクレジット取引・GXリーグ参画企業。" },
    { name: "ENEOS", aliases: ["ENEOS"], category: "創出", hq: "東京都千代田区", description: "石油元売り大手。CCS・DAC技術への投資、カーボンクレジット活用を推進。" },
    { name: "出光興産", aliases: ["出光興産", "出光"], category: "創出", hq: "東京都千代田区", description: "石油元売り。ブルーカーボン・CCS事業に取り組む。" },
    { name: "東京ガス", aliases: ["東京ガス"], category: "創出", hq: "東京都港区", description: "都市ガス大手。メタネーション・CCSによる脱炭素と J-クレジット活用を推進。" },
    { name: "JERA", aliases: ["JERA"], category: "創出", hq: "東京都中央区", description: "東電・中電合弁の発電大手。アンモニア混焼・CCSでの排出削減を推進。" },
    { name: "ANA", aliases: ["ANA", "全日空", "ANAホールディングス"], category: "コンサル", hq: "東京都港区", description: "航空大手。SAF導入とカーボンオフセットプログラムを展開。" },
    { name: "JAL", aliases: ["JAL", "日本航空"], category: "コンサル", hq: "東京都品川区", description: "航空大手。SAFとカーボンクレジットを活用した脱炭素を推進。" },
    { name: "トヨタ自動車", aliases: ["トヨタ", "トヨタ自動車", "Toyota"], category: "コンサル", hq: "愛知県豊田市", description: "自動車最大手。水素・電動化に加え、カーボンクレジット市場にも参入。" },
    { name: "ホンダ", aliases: ["ホンダ", "Honda", "本田技研工業"], category: "コンサル", hq: "東京都港区", description: "自動車大手。Indigo Agとの土壌炭素除去クレジット購入等に取り組む。" },
    { name: "Occidental", aliases: ["Occidental", "OXY", "Occidental Petroleum"], category: "創出", hq: "米国 ヒューストン", description: "石油大手。Carbon Engineering買収でDAC事業に大規模参入。" },
    { name: "Equinor", aliases: ["Equinor"], category: "創出", hq: "ノルウェー スタヴァンゲル", description: "エネルギー大手。Northern Lights CCSプロジェクトを主導。" },
    { name: "Shell", aliases: ["Shell", "シェル"], category: "創出", hq: "英国 ロンドン", description: "エネルギーメジャー。自然ベースクレジット・CCS事業を展開。" },
    { name: "BP", aliases: ["BP"], category: "創出", hq: "英国 ロンドン", description: "エネルギーメジャー。カーボンオフセット・CCS・再エネ事業を推進。" },
    { name: "TotalEnergies", aliases: ["TotalEnergies", "Total"], category: "創出", hq: "フランス パリ", description: "エネルギーメジャー。森林保全・CCS等のカーボンクレジット事業を展開。" },
  ];

  // 各企業について記事をマッチング
  for (const company of KNOWN_COMPANIES) {
    const articles: RelatedArticle[] = [];

    for (const post of posts) {
      const title = stripHtml(post.title.rendered);
      const titleLower = title.toLowerCase();

      const matches = company.aliases.some((alias) =>
        titleLower.includes(alias.toLowerCase())
      );

      if (matches) {
        articles.push({
          title,
          url: post.link,
          date: post.date.slice(0, 10),
        });
      }
    }

    if (articles.length > 0 || true) { // 記事0でも企業は登録
      companyMap.set(company.name, {
        count: articles.length,
        articles: articles.slice(0, 50), // 最大50件
      });
    }
  }

  // KNOWNに含まれていない企業名をメタ情報として返す
  return companyMap;
}

// ============================================================
// Phase 3: WordPress に企業を登録
// ============================================================

async function getExistingCompanyNames(): Promise<Set<string>> {
  const names = new Set<string>();
  let page = 1;
  while (page <= 10) {
    try {
      const res = await fetch(`${API_BASE}/companies?per_page=100&page=${page}&_fields=id,title`, {
        cache: "no-store",
      });
      if (!res.ok) break;
      const posts: { id: number; title: { rendered: string } }[] = await res.json();
      for (const p of posts) {
        names.add(stripHtml(p.title.rendered).toLowerCase());
      }
      if (posts.length < 100) break;
      page++;
    } catch {
      break;
    }
  }
  return names;
}

// 企業情報の参照用
const COMPANY_DB: Record<string, { category: string; hq?: string; description?: string }> = {};

// KNOWN_COMPANIES を再利用するためにグローバル化
const KNOWN_COMPANIES_LIST = [
  { name: "Climeworks", category: "創出", hq: "スイス チューリッヒ", description: "世界最大のDAC（直接空気回収）企業。アイスランドのOrca、Mammothプラントを運営。" },
  { name: "Carbon Engineering", category: "創出", hq: "カナダ ブリティッシュコロンビア", description: "大規模DAC技術を開発。Occidental Petroleumの子会社。" },
  { name: "Heirloom Carbon", category: "創出", hq: "米国 サンフランシスコ", description: "石灰石ベースのDAC技術を開発する炭素除去スタートアップ。" },
  { name: "CarbonCapture Inc.", category: "創出", hq: "米国 ロサンゼルス", description: "モジュール式DAC技術を開発。Project Bison等の大規模プロジェクトを展開。" },
  { name: "Charm Industrial", category: "創出", hq: "米国 サンフランシスコ", description: "バイオオイル地中注入によるバイオ炭素除去（BiCRS）を展開。" },
  { name: "Carbonfuture", category: "創出", hq: "ドイツ フライブルク", description: "バイオ炭ベースの炭素除去クレジットプラットフォームを運営。" },
  { name: "UNDO", category: "創出", hq: "英国 スコットランド", description: "風化促進（ERW）による炭素除去技術を展開。" },
  { name: "Lithos Carbon", category: "創出", hq: "米国 フィラデルフィア", description: "風化促進（ERW）による炭素除去。農業との統合アプローチ。" },
  { name: "44.01", category: "創出", hq: "オマーン マスカット", description: "岩石の鉱物化によるCO2永久固定技術を開発。" },
  { name: "Isometric", category: "検証機関", hq: "英国 ロンドン", description: "CDR（炭素除去）クレジットの科学的検証・認証機関。" },
  { name: "Puro.earth", category: "検証機関", hq: "フィンランド ヘルシンキ", description: "炭素除去クレジットの認証基準・マーケットプレイスを運営。Nasdaq傘下。" },
  { name: "Verra", category: "検証機関", hq: "米国 ワシントンD.C.", description: "世界最大のボランタリーカーボンクレジット認証機関。VCSを運営。" },
  { name: "Gold Standard", category: "検証機関", hq: "スイス ジュネーブ", description: "SDGs共便益重視のカーボンクレジット認証基準を運営。" },
  { name: "ACR", category: "検証機関", hq: "米国 バージニア", description: "米国のカーボンオフセット認証機関。American Carbon Registry。" },
  { name: "Xpansiv", category: "仲介", hq: "米国 ニューヨーク", description: "世界最大の環境商品取引プラットフォーム。CBLマーケットを運営。" },
  { name: "Nasdaq", category: "仲介", hq: "米国 ニューヨーク", description: "Puro.earthを買収し炭素除去クレジット市場に参入した証券取引所。" },
  { name: "Sylvera", category: "コンサル", hq: "英国 ロンドン", description: "カーボンクレジットの品質評価・格付けプラットフォーム。" },
  { name: "BeZero Carbon", category: "コンサル", hq: "英国 ロンドン", description: "カーボンクレジットの格付け・リスク評価サービスを提供。" },
  { name: "Calyx Global", category: "コンサル", hq: "米国", description: "カーボンクレジットの品質・リスク評価を行う独立機関。" },
  { name: "MSCI", category: "コンサル", hq: "米国 ニューヨーク", description: "ESG格付け・カーボンクレジット品質評価を提供する金融データ企業。" },
  { name: "Microsoft", category: "コンサル", hq: "米国 レドモンド", description: "2030年カーボンネガティブ目標を掲げ大規模CDRクレジットを購入。" },
  { name: "Frontier", category: "仲介", hq: "米国", description: "Stripe主導のCDR前払い購入プログラム。Google、Meta、Shopify等が参加。" },
  { name: "NextGen CDR", category: "仲介", hq: "スイス", description: "South Pole発のCDR購入プログラム。企業向けの除去クレジット調達。" },
  { name: "Sustineri", category: "コンサル", hq: "東京都", description: "カーボンクレジットのコンサルティング・ブローカレッジサービスを提供。" },
  { name: "ウェイストボックス", category: "創出", hq: "東京都", description: "廃棄物関連のカーボンクレジット創出事業を展開。" },
  { name: "Stripe", category: "仲介", hq: "米国 サンフランシスコ", description: "決済プラットフォーム大手。Frontier CDR購入イニシアチブを主導。" },
  { name: "Shopify", category: "仲介", hq: "カナダ オタワ", description: "ECプラットフォーム大手。Sustainability FundでCDRクレジットを購入。" },
  { name: "JPX", category: "仲介", hq: "東京都中央区", description: "J-クレジットのカーボン・クレジット市場を運営する日本取引所グループ。" },
  { name: "JFE", category: "創出", hq: "東京都千代田区", description: "鉄鋼大手。CCS/CCU技術やブルーカーボンクレジット創出に取り組む。" },
  { name: "三井物産", category: "仲介", hq: "東京都千代田区", description: "総合商社。森林・ブルーカーボン等のカーボンクレジット事業を展開。" },
  { name: "三菱商事", category: "仲介", hq: "東京都千代田区", description: "総合商社。CCS・DACへの投資やカーボンクレジット取引事業を推進。" },
  { name: "住友商事", category: "仲介", hq: "東京都千代田区", description: "総合商社。森林保全・再エネ由来のクレジット事業を展開。" },
  { name: "丸紅", category: "仲介", hq: "東京都千代田区", description: "総合商社。ブルーカーボン・森林クレジットの開発・取引を推進。" },
  { name: "伊藤忠商事", category: "仲介", hq: "東京都港区", description: "総合商社。カーボンクレジット取引・GXリーグ参画企業。" },
  { name: "ENEOS", category: "創出", hq: "東京都千代田区", description: "石油元売り大手。CCS・DAC技術への投資、カーボンクレジット活用を推進。" },
  { name: "出光興産", category: "創出", hq: "東京都千代田区", description: "石油元売り。ブルーカーボン・CCS事業に取り組む。" },
  { name: "東京ガス", category: "創出", hq: "東京都港区", description: "都市ガス大手。メタネーション・CCSによる脱炭素とJ-クレジット活用を推進。" },
  { name: "JERA", category: "創出", hq: "東京都中央区", description: "東電・中電合弁の発電大手。アンモニア混焼・CCSでの排出削減を推進。" },
  { name: "ANA", category: "コンサル", hq: "東京都港区", description: "航空大手。SAF導入とカーボンオフセットプログラムを展開。" },
  { name: "JAL", category: "コンサル", hq: "東京都品川区", description: "航空大手。SAFとカーボンクレジットを活用した脱炭素を推進。" },
  { name: "トヨタ自動車", category: "コンサル", hq: "愛知県豊田市", description: "自動車最大手。水素・電動化に加えカーボンクレジット市場にも参入。" },
  { name: "ホンダ", category: "コンサル", hq: "東京都港区", description: "自動車大手。Indigo Agとの土壌炭素除去クレジット購入等に取り組む。" },
  { name: "Occidental", category: "創出", hq: "米国 ヒューストン", description: "石油大手。Carbon Engineering買収でDAC事業に大規模参入。" },
  { name: "Equinor", category: "創出", hq: "ノルウェー スタヴァンゲル", description: "エネルギー大手。Northern Lights CCSプロジェクトを主導。" },
  { name: "Shell", category: "創出", hq: "英国 ロンドン", description: "エネルギーメジャー。自然ベースクレジット・CCS事業を展開。" },
  { name: "BP", category: "創出", hq: "英国 ロンドン", description: "エネルギーメジャー。カーボンオフセット・CCS・再エネ事業を推進。" },
  { name: "TotalEnergies", category: "創出", hq: "フランス パリ", description: "エネルギーメジャー。森林保全・CCS等のカーボンクレジット事業を展開。" },
];

for (const c of KNOWN_COMPANIES_LIST) {
  COMPANY_DB[c.name] = { category: c.category, hq: c.hq, description: c.description };
}

async function createCompany(
  name: string,
  info: { category: string; hq?: string; description?: string },
  articles: RelatedArticle[]
): Promise<void> {
  const acfData: Record<string, unknown> = {
    company_category: info.category,
  };
  if (info.hq) acfData.headquarters = info.hq;
  if (info.description) acfData.company_description = info.description;
  if (articles.length > 0) acfData.related_articles = JSON.stringify(articles);

  const contentData = { ...acfData, related_articles: articles };
  const content = `<!-- COMPANY_DATA_JSON:${JSON.stringify(contentData)} -->\n<p>${name}の企業データ</p>`;

  const res = await fetch(`${API_BASE}/companies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({
      title: name,
      content,
      status: "publish",
      acf: acfData,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`作成失敗: ${res.status} ${text.slice(0, 200)}`);
  }

  const created = (await res.json()) as { id: number };
  console.log(`  → ID ${created.id} で作成完了`);
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log("=== 企業自動発見・登録スクリプト ===");
  if (DRY_RUN) console.log("DRY RUN モード\n");

  // 1. carboncredits.jp の全記事を取得
  console.log("=== Phase 1: carboncredits.jp 全記事取得 ===");
  const allPosts = await fetchAllCCJPosts();
  console.log(`合計記事数: ${allPosts.length}\n`);

  // 2. 既存企業名を取得
  console.log("=== Phase 2: 既存企業を確認 ===");
  const existing = await getExistingCompanyNames();
  console.log(`既存企業数: ${existing.size}\n`);

  // 3. 企業と記事のマッチング
  console.log("=== Phase 3: 企業-記事マッチング ===");
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const company of KNOWN_COMPANIES_LIST) {
    const nameLower = company.name.toLowerCase();

    // 既存チェック（完全一致 or 部分一致）
    let alreadyExists = false;
    for (const ex of existing) {
      if (ex === nameLower || ex.includes(nameLower) || nameLower.includes(ex)) {
        alreadyExists = true;
        break;
      }
    }

    if (alreadyExists) {
      console.log(`[SKIP] ${company.name} — 既存`);
      skipped++;
      continue;
    }

    // 記事マッチング
    const articles: RelatedArticle[] = [];
    const aliases = [company.name, ...(company.name.includes(" ") ? [company.name.split(" ")[0]] : [])];

    for (const post of allPosts) {
      const title = stripHtml(post.title.rendered);
      const titleLower = title.toLowerCase();
      if (aliases.some((a) => titleLower.includes(a.toLowerCase()))) {
        articles.push({ title, url: post.link, date: post.date.slice(0, 10) });
      }
    }

    console.log(`[NEW] ${company.name} — ${articles.length} 記事`);

    if (DRY_RUN) {
      for (const a of articles.slice(0, 2)) console.log(`       ${a.title.slice(0, 60)}`);
      created++;
      continue;
    }

    try {
      await createCompany(company.name, COMPANY_DB[company.name], articles.slice(0, 50));
      existing.add(nameLower);
      created++;
    } catch (e) {
      console.error(`  エラー: ${e}`);
      errors++;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n=== 完了 ===`);
  console.log(`新規作成: ${created}, スキップ（既存）: ${skipped}, エラー: ${errors}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
