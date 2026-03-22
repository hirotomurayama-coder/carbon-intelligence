/**
 * 企業追加登録 v3 — 残りの候補を一括登録
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

const NEW_COMPANIES: { name: string; aliases: string[]; cat: string; hq?: string; desc?: string }[] = [
  // === CDR スタートアップ（追加分） ===
  { name: "Capsol Technologies", aliases: ["Capsol"], cat: "創出", hq: "ノルウェー", desc: "船舶・産業施設向けのモジュール式CO2回収技術を開発。" },
  { name: "CF Industries", aliases: ["CF Industries"], cat: "創出", hq: "米国 イリノイ", desc: "世界最大級の肥料メーカー。ブルーアンモニア・CCSに取り組む。" },
  { name: "Exomad Green", aliases: ["Exomad Green", "Exomad"], cat: "創出", hq: "モンゴル", desc: "モンゴルでの大規模植林・砂漠緑化プロジェクトによるカーボンクレジット創出。" },
  { name: "Cascade Climate", aliases: ["Cascade Climate", "Cascade"], cat: "創出", hq: "米国", desc: "風化促進（ERW）を大規模に展開するCDRスタートアップ。" },
  { name: "Eion Carbon", aliases: ["Eion"], cat: "創出", hq: "米国", desc: "農地での風化促進（ERW）による炭素除去。MRV技術に強み。" },
  { name: "Mast Reforestation", aliases: ["Mast Reforestation", "Mast"], cat: "創出", hq: "米国 オレゴン", desc: "大規模再植林プロジェクトによる森林カーボンクレジット開発。ドローン播種技術。" },
  { name: "Carbonaide", aliases: ["Carbonaide"], cat: "創出", hq: "フィンランド", desc: "コンクリート製造過程でCO2を鉱物化する技術。建材への炭素固定。" },
  { name: "Origen", aliases: ["Origen"], cat: "創出", hq: "英国", desc: "石灰石ベースのDAC技術を開発。低コストCO2除去を目指す。" },
  { name: "Drax Group", aliases: ["Drax"], cat: "創出", hq: "英国 ヨークシャー", desc: "バイオマス発電＋CCS（BECCS）で世界最大のCDRを目指す。" },
  { name: "Avnos", aliases: ["Avnos"], cat: "創出", hq: "米国 カリフォルニア", desc: "Carbon Engineering出身チームによるDAC技術を開発するスタートアップ。" },
  { name: "NEG8 Carbon", aliases: ["NEG8"], cat: "創出", hq: "オーストラリア", desc: "オーストラリアでDAC商用プラントを建設するスタートアップ。" },
  { name: "Carba", aliases: ["Carba"], cat: "創出", hq: "米国", desc: "バイオマス熱分解による耐久性バイオ炭CDRを展開。" },
  { name: "ReGenEarth", aliases: ["ReGenEarth"], cat: "創出", hq: "アイルランド", desc: "土壌炭素・再生型農業ベースのカーボンクレジットを開発。" },
  { name: "Planboo", aliases: ["Planboo"], cat: "創出", hq: "香港", desc: "竹林プロジェクトによるカーボンクレジット開発。アジア中心に展開。" },
  { name: "RepAir Carbon", aliases: ["RepAir"], cat: "創出", hq: "イスラエル", desc: "電気化学ベースのDAC技術を開発するスタートアップ。" },
  { name: "Planetary Technologies", aliases: ["Planetary"], cat: "創出", hq: "カナダ", desc: "海洋アルカリ化によるCO2除去技術（Ocean Alkalinity Enhancement）。" },
  { name: "AtmosClear", aliases: ["AtmosClear"], cat: "創出", hq: "英国", desc: "大気中CO2を直接除去するDAC技術を開発。" },
  { name: "Sirona Biochem", aliases: ["Sirona"], cat: "創出", hq: "カナダ", desc: "バイオテクノロジー企業。カーボンクレジット関連事業にも参入。" },
  { name: "Archeda", aliases: ["Archeda"], cat: "創出", hq: "スイス", desc: "バイオ炭製造によるCDR・農業改善プロジェクトを展開。" },

  // === 仲介・マーケットプレイス ===
  { name: "Senken", aliases: ["Senken"], cat: "仲介", hq: "ドイツ", desc: "Web3ベースのカーボンクレジット取引マーケットプレイス。" },
  { name: "Carbon Streaming", aliases: ["Carbon Streaming"], cat: "仲介", hq: "カナダ トロント", desc: "カーボンクレジットのストリーミング（前払い購入権）モデルを展開。" },
  { name: "Rubicon Carbon", aliases: ["Rubicon Carbon", "Rubicon"], cat: "仲介", hq: "米国 ニューヨーク", desc: "大企業向けカーボンクレジット調達・ポートフォリオ管理を提供。" },
  { name: "CNaught", aliases: ["CNaught"], cat: "仲介", hq: "米国", desc: "API経由でカーボンクレジットを調達できるプラットフォーム。" },
  { name: "Riverse", aliases: ["Riverse"], cat: "検証機関", hq: "フランス パリ", desc: "産業・テクノロジーベースの排出削減クレジット認証基準。" },
  { name: "STAX Carbon", aliases: ["STAX"], cat: "仲介", hq: "米国", desc: "カーボンクレジットのインデックス・分析プラットフォーム。" },
  { name: "Linkhola", aliases: ["Linkhola"], cat: "仲介", hq: "日本", desc: "日本のカーボンクレジット仲介・マッチングサービスを提供。" },
  { name: "Verde", aliases: ["Verde"], cat: "仲介", hq: "ブラジル", desc: "中南米の自然ベースカーボンクレジット開発・取引を展開。" },

  // === 大手買い手・需要家 ===
  { name: "Amazon", aliases: ["Amazon", "アマゾン"], cat: "コンサル", hq: "米国 シアトル", desc: "Climate Pledgeを主導。大規模CDR・再エネクレジットを購入。" },
  { name: "Meta", aliases: ["Meta", "メタ"], cat: "コンサル", hq: "米国 メンロパーク", desc: "Frontierメンバー。CDRクレジットの大量購入を推進。" },
  { name: "Samsung", aliases: ["Samsung", "サムスン"], cat: "コンサル", hq: "韓国 ソウル", desc: "サステナビリティ目標の一環でカーボンクレジット市場に参入。" },
  { name: "BlackRock", aliases: ["BlackRock", "ブラックロック"], cat: "仲介", hq: "米国 ニューヨーク", desc: "世界最大の資産運用会社。ESG投資・カーボンクレジットファンドを運用。" },
  { name: "Trafigura", aliases: ["Trafigura"], cat: "仲介", hq: "シンガポール", desc: "世界的商品トレーディング企業。カーボンクレジット取引事業を拡大。" },

  // === エネルギー・産業 ===
  { name: "Petrobras", aliases: ["Petrobras"], cat: "創出", hq: "ブラジル リオ", desc: "ブラジル国営石油。CCS・森林保全クレジットに投資。" },
  { name: "GE Vernova", aliases: ["GE Vernova", "Vernova"], cat: "創出", hq: "米国", desc: "GEのエネルギー部門。再エネ・水素・CCS技術を展開。" },
  { name: "Carbon Clean", aliases: ["Carbon Clean"], cat: "創出", hq: "英国 ロンドン", desc: "産業排出源からのCO2回収技術（point-source capture）を提供。" },

  // === 日本企業（追加分） ===
  { name: "JCCL", aliases: ["JCCL"], cat: "仲介", hq: "東京都", desc: "Japan Carbon Credit Ltd. 日本のカーボンクレジット市場インフラを整備。" },
  { name: "Cory Group", aliases: ["Cory"], cat: "創出", hq: "英国 ロンドン", desc: "廃棄物処理企業。エネルギー回収＋CCSプロジェクトを展開。" },

  // === 金融・投資 ===
  { name: "BTG Pactual", aliases: ["BTG Pactual"], cat: "仲介", hq: "ブラジル サンパウロ", desc: "中南米最大の投資銀行。森林・自然ベースクレジット投資に注力。" },
  { name: "Bregal Investments", aliases: ["Bregal"], cat: "仲介", hq: "英国 ロンドン", desc: "プライベートエクイティ。気候テック・カーボンクレジット企業に投資。" },
  { name: "Bezos Earth Fund", aliases: ["Bezos"], cat: "コンサル", hq: "米国", desc: "Amazon創業者の100億ドル基金。気候変動対策・CDR研究に助成。" },

  // === 国際機関（追加） ===
  { name: "IETA", aliases: ["IETA"], cat: "コンサル", hq: "スイス ジュネーブ", desc: "International Emissions Trading Association。排出量取引の業界団体。" },
  { name: "UNDP", aliases: ["UNDP"], cat: "コンサル", hq: "米国 ニューヨーク", desc: "国連開発計画。途上国のカーボンクレジット市場構築を支援。" },
  { name: "XPRIZE Carbon", aliases: ["XPRIZE"], cat: "コンサル", hq: "米国", desc: "イーロン・マスク出資の1億ドルCO2除去技術コンペティション。" },
  { name: "Mombak", aliases: ["Mombak"], cat: "創出", hq: "ブラジル", desc: "アマゾン地域での大規模植林・森林再生によるCDRクレジット開発。" },
  { name: "PTTEP", aliases: ["PTTEP"], cat: "創出", hq: "タイ バンコク", desc: "タイ国営石油探査企業。東南アジアでのCCSプロジェクトを推進。" },
  { name: "Kita Earth", aliases: ["Kita"], cat: "仲介", hq: "英国 エディンバラ", desc: "カーボンクレジット保険を提供。クレジット無効化リスクの保証。" },

  // === 航空・運輸 ===
  { name: "IATA", aliases: ["IATA"], cat: "コンサル", hq: "カナダ モントリオール", desc: "国際航空運送協会。CORSIA（国際航空のカーボンオフセット制度）を推進。" },
  { name: "TikTok", aliases: ["TikTok"], cat: "コンサル", hq: "中国 / シンガポール", desc: "ByteDance傘下。カーボンニュートラル宣言と再エネクレジット購入。" },
  { name: "Northern Trust", aliases: ["Northern Trust"], cat: "仲介", hq: "米国 シカゴ", desc: "資産管理大手。ESG投資・カーボンクレジット関連ファンドを運用。" },
  { name: "ISDA", aliases: ["ISDA"], cat: "コンサル", hq: "米国 ニューヨーク", desc: "国際スワップデリバティブ協会。カーボンクレジットの標準契約書を策定。" },
];

async function getExistingNames(): Promise<Set<string>> {
  const names = new Set<string>();
  for (let p = 1; p <= 10; p++) {
    const res = await fetch(`${API_BASE}/companies?per_page=100&page=${p}&_fields=id,title&orderby=date&order=desc`);
    if (!res.ok) break;
    const posts: { id: number; title: { rendered: string } }[] = await res.json();
    for (const p2 of posts) names.add(strip(p2.title.rendered).toLowerCase());
    if (posts.length < 100) break;
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
    await new Promise(r2 => setTimeout(r2, 200));
  }
  return all;
}

async function main() {
  console.log("=== 企業追加登録 v3 ===\n");
  const [existing, allPosts] = await Promise.all([getExistingNames(), fetchAllCCJPosts()]);
  console.log(`既存: ${existing.size}社, 記事: ${allPosts.length}件\n`);

  let created = 0, skipped = 0, errors = 0;
  const validAcf = ["創出", "仲介", "コンサル"];

  for (const c of NEW_COMPANIES) {
    const nl = c.name.toLowerCase();
    let exists = false;
    for (const ex of existing) { if (ex.includes(nl) || nl.includes(ex)) { exists = true; break; } }
    if (exists) { console.log(`[SKIP] ${c.name}`); skipped++; continue; }

    const articles: Art[] = [];
    for (const post of allPosts) {
      const title = strip(post.title.rendered);
      if (c.aliases.some(a => title.toLowerCase().includes(a.toLowerCase()))) {
        articles.push({ title, url: post.link, date: post.date.slice(0, 10) });
      }
    }

    const contentData: Record<string, unknown> = {
      company_category: c.cat, headquarters: c.hq ?? null,
      company_description: c.desc ?? null, related_articles: articles.slice(0, 50),
    };
    const content = `<!-- COMPANY_DATA_JSON:${JSON.stringify(contentData)} -->\n<p>${c.name}</p>`;
    const body: Record<string, unknown> = { title: c.name, content, status: "publish" };
    if (validAcf.includes(c.cat)) {
      body.acf = {
        company_category: c.cat,
        ...(c.hq ? { headquarters: c.hq } : {}),
        ...(c.desc ? { company_description: c.desc } : {}),
        ...(articles.length > 0 ? { related_articles: JSON.stringify(articles.slice(0, 50)) } : {}),
      };
    }

    try {
      const res = await fetch(`${API_BASE}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 100)}`);
      const d = await res.json() as { id: number };
      existing.add(nl);
      console.log(`[NEW] ${c.name} → ID ${d.id} (${articles.length}記事)`);
      created++;
    } catch (e) { console.error(`[ERR] ${c.name}: ${e}`); errors++; }
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\n=== 完了 === 新規: ${created}, スキップ: ${skipped}, エラー: ${errors}`);
  console.log(`合計企業数: ${existing.size}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
