/**
 * 企業自動発見・登録スクリプト v2 — 追加分
 */

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "").replace(/\/+$/, "");
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";
const CCJ_API = "https://carboncredits.jp/wp-json/wp/v2";

if (!API_BASE || !WP_USER || !WP_PASS) { console.error("env missing"); process.exit(1); }

function auth(): string { return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`; }
function strip(html: string): string { return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim(); }

type Art = { title: string; url: string; date: string };
type CCJPost = { id: number; title: { rendered: string }; link: string; date: string };

// ============================================================
// 追加企業リスト（既存56社と重複しないもの）
// ============================================================

const NEW_COMPANIES: { name: string; aliases: string[]; category: string; hq?: string; desc?: string }[] = [
  // === CDR / テクノロジー（記事頻出） ===
  { name: "ClimeFi", aliases: ["ClimeFi"], category: "仲介", hq: "英国", desc: "カーボンクレジットのトークン化・ブロックチェーン取引プラットフォーム。" },
  { name: "Deep Sky", aliases: ["Deep Sky"], category: "創出", hq: "カナダ ケベック", desc: "カナダ最大のDAC＋CCSプロジェクトを開発するスタートアップ。" },
  { name: "CUR8", aliases: ["CUR8"], category: "コンサル", hq: "英国 ロンドン", desc: "CDR（炭素除去）クレジットの品質評価・キュレーションプラットフォーム。" },
  { name: "Varaha", aliases: ["Varaha"], category: "創出", hq: "インド", desc: "インド発の自然ベースカーボンクレジット開発企業。土壌炭素・農林業。" },
  { name: "Svante", aliases: ["Svante"], category: "創出", hq: "カナダ バンクーバー", desc: "産業排出源向けCO2回収（point-source capture）技術を開発。" },
  { name: "Supercritical", aliases: ["Supercritical"], category: "仲介", hq: "英国 ロンドン", desc: "企業向けCDR（炭素除去）クレジット購入プラットフォーム。" },
  { name: "Terradot", aliases: ["Terradot"], category: "創出", hq: "米国", desc: "風化促進（ERW）による炭素除去技術を展開するスタートアップ。" },
  { name: "PointFive", aliases: ["PointFive"], category: "創出", hq: "イスラエル", desc: "海洋ベースのCDR技術を開発。電気化学的CO2除去。" },
  { name: "Nuada", aliases: ["Nuada"], category: "創出", hq: "オーストラリア", desc: "MOF（金属有機構造体）を使った低コストCO2回収技術を開発。" },
  { name: "Paebbl", aliases: ["Paebbl"], category: "創出", hq: "オランダ", desc: "岩石風化を利用した炭素除去・建材製造の二刀流スタートアップ。" },
  { name: "Equitable Earth", aliases: ["Equitable Earth"], category: "創出", hq: "米国", desc: "風化促進（ERW）を農業と統合した炭素除去プロジェクトを展開。" },
  { name: "Evero", aliases: ["Evero"], category: "創出", hq: "米国", desc: "バイオマスベースの炭素除去技術を開発するスタートアップ。" },
  { name: "BlueLayer", aliases: ["BlueLayer"], category: "コンサル", hq: "米国", desc: "企業のCO2排出管理・カーボンクレジットポートフォリオ管理ツール。" },
  { name: "Boomitra", aliases: ["Boomitra"], category: "創出", hq: "米国 / インド", desc: "衛星データとAIで土壌炭素を測定し、農業カーボンクレジットを発行。" },
  { name: "Gevo", aliases: ["Gevo"], category: "創出", hq: "米国 コロラド", desc: "再生可能燃料（SAF）メーカー。航空業界の脱炭素化に貢献。" },
  { name: "CEEZER", aliases: ["CEEZER"], category: "仲介", hq: "ドイツ ベルリン", desc: "AI搭載のカーボンクレジット品質評価・調達プラットフォーム。" },
  { name: "Seabound", aliases: ["Seabound"], category: "創出", hq: "英国 ロンドン", desc: "船舶からのCO2回収技術を開発する海運脱炭素スタートアップ。" },
  { name: "AIRCO", aliases: ["AIRCO"], category: "創出", hq: "英国", desc: "大気からCO2を回収するDAC技術を開発。" },
  { name: "Zefiro", aliases: ["Zefiro"], category: "創出", hq: "カナダ", desc: "放棄された油井のプラギングによるメタン排出回避クレジットを展開。" },
  { name: "DevvStream", aliases: ["DevvStream"], category: "仲介", hq: "カナダ", desc: "ブロックチェーンベースのカーボンクレジット生成・取引プラットフォーム。" },
  { name: "Altitude", aliases: ["Altitude"], category: "仲介", hq: "米国", desc: "CDR前払い購入アグリゲーター。複数CDR技術への分散投資を支援。" },
  { name: "GenZero", aliases: ["GenZero"], category: "仲介", hq: "シンガポール", desc: "テマセク出資の脱炭素投資プラットフォーム。アジアのカーボンクレジット市場を支援。" },
  { name: "CO2BC", aliases: ["CO2BC"], category: "創出", hq: "フィンランド", desc: "バイオ炭製造によるCDRクレジットを展開するフィンランド企業。" },
  { name: "Holcim", aliases: ["Holcim"], category: "創出", hq: "スイス", desc: "世界最大のセメント企業。CCUS・低炭素セメントで脱炭素を推進。" },

  // === 国際機関・基準策定 ===
  { name: "ICVCM", aliases: ["ICVCM"], category: "検証機関", hq: "英国 ロンドン", desc: "自主的炭素市場のインテグリティ委員会。CCP（Core Carbon Principles）を策定。" },
  { name: "VCMI", aliases: ["VCMI"], category: "検証機関", hq: "英国 ロンドン", desc: "Voluntary Carbon Markets Integrity Initiative。企業のクレジット利用に関するクレーム指針を策定。" },
  { name: "ICROA", aliases: ["ICROA"], category: "検証機関", hq: "英国 ロンドン", desc: "International Carbon Reduction and Offset Alliance。カーボンオフセットのベストプラクティスを推進。" },

  // === テック大手 ===
  { name: "Google", aliases: ["Google", "グーグル", "Alphabet"], category: "コンサル", hq: "米国 マウンテンビュー", desc: "2030年までにネットゼロ排出を目指し、大規模CDRクレジットを購入。Frontierメンバー。" },
  { name: "Apple", aliases: ["Apple", "アップル"], category: "コンサル", hq: "米国 クパチーノ", desc: "サプライチェーン全体のカーボンニュートラルを推進。自然ベースクレジットも活用。" },
  { name: "Salesforce", aliases: ["Salesforce"], category: "コンサル", hq: "米国 サンフランシスコ", desc: "Net Zero Cloudを提供し、企業の排出管理とオフセットを支援。" },
  { name: "Boeing", aliases: ["Boeing", "ボーイング"], category: "コンサル", hq: "米国 シカゴ", desc: "航空機メーカー。SAF普及とカーボンオフセットで航空脱炭素を推進。" },

  // === エネルギー・石油ガス ===
  { name: "INPEX", aliases: ["INPEX"], category: "創出", hq: "東京都港区", desc: "日本最大の石油・天然ガス開発企業。CCS・ブルーカーボン事業を推進。" },
  { name: "ExxonMobil", aliases: ["ExxonMobil", "Exxon"], category: "創出", hq: "米国 テキサス", desc: "世界最大の石油メジャー。CCS事業に大規模投資を展開。" },
  { name: "商船三井", aliases: ["商船三井"], category: "仲介", hq: "東京都港区", desc: "海運大手。ブルーカーボン・海洋CDR・船舶脱炭素化に取り組む。" },
  { name: "BASF", aliases: ["BASF"], category: "創出", hq: "ドイツ ルートヴィヒスハーフェン", desc: "世界最大の化学企業。CCS・CCU技術を活用した脱炭素を推進。" },

  // === 日本企業（追加） ===
  { name: "NTT", aliases: ["NTT"], category: "コンサル", hq: "東京都千代田区", desc: "通信大手。IOWN構想によるエネルギー効率化とカーボンニュートラルを推進。" },
  { name: "Carbon EX", aliases: ["Carbon EX", "CarbonEX"], category: "仲介", hq: "東京都", desc: "三井物産とNTTの合弁。日本のカーボンクレジット取引プラットフォーム。" },
  { name: "KlimaDAO JAPAN", aliases: ["KlimaDAO", "KlimaDAO JAPAN"], category: "仲介", hq: "東京都", desc: "ブロックチェーン上のカーボンクレジット取引プロトコル。日本展開。" },
  { name: "Jizoku", aliases: ["Jizoku"], category: "コンサル", hq: "東京都", desc: "カーボンクレジットの品質評価・データプラットフォームを提供する日本企業。" },
  { name: "NEDO", aliases: ["NEDO"], category: "コンサル", hq: "川崎市", desc: "新エネルギー・産業技術総合開発機構。DAC・CCS等のGX技術開発を支援。" },
  { name: "Green Carbon", aliases: ["Green Carbon", "グリーンカーボン株式会社"], category: "創出", hq: "東京都", desc: "水田中干し延長による農業カーボンクレジット創出を推進するスタートアップ。" },

  // === 保険・金融 ===
  { name: "Oka", aliases: ["Oka"], category: "仲介", hq: "米国", desc: "カーボンクレジット保険を提供。クレジットの無効化リスクを保証。" },
  { name: "BURN Manufacturing", aliases: ["BURN"], category: "創出", hq: "ケニア", desc: "アフリカで改良かまどを製造・普及。Gold Standard認証のクレジットを大量発行。" },
  { name: "IEA", aliases: ["IEA"], category: "コンサル", hq: "フランス パリ", desc: "国際エネルギー機関。エネルギー・気候変動に関する分析とデータを提供。" },
  { name: "HyNet", aliases: ["HyNet"], category: "創出", hq: "英国", desc: "英国北西部の水素・CCSクラスタープロジェクト。産業脱炭素の先駆け。" },
];

async function getExistingNames(): Promise<Set<string>> {
  const names = new Set<string>();
  let page = 1;
  while (page <= 10) {
    const res = await fetch(`${API_BASE}/companies?per_page=100&page=${page}&_fields=id,title`);
    if (!res.ok) break;
    const posts: { id: number; title: { rendered: string } }[] = await res.json();
    for (const p of posts) names.add(strip(p.title.rendered).toLowerCase());
    if (posts.length < 100) break;
    page++;
  }
  return names;
}

async function fetchAllCCJPosts(): Promise<CCJPost[]> {
  const all: CCJPost[] = [];
  for (let p = 1; p <= 18; p++) {
    const r = await fetch(`${CCJ_API}/posts?per_page=100&page=${p}&_fields=id,title,link,date`);
    if (!r.ok) break;
    const d: CCJPost[] = await r.json();
    all.push(...d);
    if (d.length < 100) break;
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

async function main() {
  console.log("=== 企業追加登録 v2 ===\n");

  const [existing, allPosts] = await Promise.all([getExistingNames(), fetchAllCCJPosts()]);
  console.log(`既存: ${existing.size}社, 記事: ${allPosts.length}件\n`);

  let created = 0, skipped = 0, errors = 0;

  for (const company of NEW_COMPANIES) {
    // 重複チェック
    const nameLower = company.name.toLowerCase();
    let exists = false;
    for (const ex of existing) {
      if (ex === nameLower || ex.includes(nameLower) || nameLower.includes(ex)) { exists = true; break; }
    }
    if (exists) { console.log(`[SKIP] ${company.name}`); skipped++; continue; }

    // 記事マッチ
    const articles: Art[] = [];
    for (const post of allPosts) {
      const title = strip(post.title.rendered);
      if (company.aliases.some(a => title.toLowerCase().includes(a.toLowerCase()))) {
        articles.push({ title, url: post.link, date: post.date.slice(0, 10) });
      }
    }

    // 作成（ACF の company_category が「検証機関」だとバリデーションエラーになるので、contentのみ使用）
    const contentData: Record<string, unknown> = {
      company_category: company.category,
      headquarters: company.hq ?? null,
      company_description: company.desc ?? null,
      related_articles: articles.slice(0, 50),
    };
    const content = `<!-- COMPANY_DATA_JSON:${JSON.stringify(contentData)} -->\n<p>${company.name}の企業データ</p>`;

    // ACF は検証機関以外のみ
    const validAcfCategories = ["創出", "仲介", "コンサル"];
    const body: Record<string, unknown> = { title: company.name, content, status: "publish" };
    if (validAcfCategories.includes(company.category)) {
      body.acf = {
        company_category: company.category,
        ...(company.hq ? { headquarters: company.hq } : {}),
        ...(company.desc ? { company_description: company.desc } : {}),
        ...(articles.length > 0 ? { related_articles: JSON.stringify(articles.slice(0, 50)) } : {}),
      };
    }

    try {
      const res = await fetch(`${API_BASE}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`${res.status}: ${t.slice(0, 150)}`);
      }
      const d = await res.json() as { id: number };
      existing.add(nameLower);
      console.log(`[NEW] ${company.name} → ID ${d.id} (${articles.length}記事)`);
      created++;
    } catch (e) {
      console.error(`[ERR] ${company.name}: ${e}`);
      errors++;
    }

    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n=== 完了 === 新規: ${created}, スキップ: ${skipped}, エラー: ${errors}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
