/**
 * 企業追加登録 v4 — 最終ラウンド。残りの候補＋手動リサーチで追加。
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
  // === まだ拾えていた企業名 ===
  { name: "TD Bank", aliases: ["TD Bank"], cat: "仲介", hq: "カナダ トロント", desc: "カナダ最大の銀行の一つ。ESG投資・カーボンクレジット取引に参入。" },
  { name: "Technip Energies", aliases: ["Technip"], cat: "創出", hq: "フランス パリ", desc: "エネルギー技術大手。CCS・水素インフラの設計・建設を手掛ける。" },
  { name: "Arca Climate", aliases: ["Arca"], cat: "創出", hq: "カナダ", desc: "バイオ炭ベースのCDR技術を展開するカナダのスタートアップ。" },
  { name: "Chestnut Carbon", aliases: ["Chestnut"], cat: "創出", hq: "米国", desc: "米国南部での大規模植林・森林再生カーボンクレジット開発。" },
  { name: "FCPF", aliases: ["FCPF"], cat: "コンサル", hq: "米国 ワシントンD.C.", desc: "Forest Carbon Partnership Facility。世界銀行主導の森林カーボンファンド。" },
  { name: "TFFF", aliases: ["TFFF"], cat: "コンサル", hq: "米国", desc: "Tropical Forest Forever Facility。熱帯林保全のための革新的資金メカニズム。" },
  { name: "Carbon Business Council", aliases: ["Carbon Business Council"], cat: "コンサル", hq: "米国", desc: "CDR業界の業界団体。400社以上の炭素除去企業が参加。" },
  { name: "Climate Impact Partners", aliases: ["Climate Impact"], cat: "コンサル", hq: "英国 ロンドン", desc: "カーボンオフセットプロジェクト開発・企業向け気候戦略コンサルティング。" },
  { name: "Sphere", aliases: ["Sphere"], cat: "コンサル", hq: "ドイツ", desc: "カーボンクレジットのデジタルMRV（測定・報告・検証）プラットフォーム。" },
  { name: "Climate Imperative", aliases: ["Imperative"], cat: "コンサル", hq: "米国", desc: "気候政策推進のための非営利財団。政策・市場形成を支援。" },

  // === カーボンクレジット業界の主要プレイヤー（記事1回でも重要な企業） ===
  { name: "Patch", aliases: ["Patch"], cat: "仲介", hq: "米国 サンフランシスコ", desc: "企業向けカーボンクレジットAPI。アプリ・サービスへのオフセット組み込みを支援。" },
  { name: "Cloverly", aliases: ["Cloverly"], cat: "仲介", hq: "米国 アトランタ", desc: "リアルタイムカーボンオフセットAPIを提供。EC・決済への統合。" },
  { name: "Wren", aliases: ["Wren"], cat: "仲介", hq: "米国 サンフランシスコ", desc: "個人・企業向けカーボンオフセットサブスクリプションサービス。" },
  { name: "Lune", aliases: ["Lune"], cat: "仲介", hq: "英国 ロンドン", desc: "カーボンクレジット購入API。企業のサステナビリティ統合を支援。" },
  { name: "Watershed", aliases: ["Watershed"], cat: "コンサル", hq: "米国 サンフランシスコ", desc: "企業向けカーボン会計・脱炭素プラットフォーム。" },
  { name: "Persefoni", aliases: ["Persefoni"], cat: "コンサル", hq: "米国 アリゾナ", desc: "AIベースのカーボン会計・ESG報告プラットフォーム。" },
  { name: "Plan A", aliases: ["Plan A"], cat: "コンサル", hq: "ドイツ ベルリン", desc: "企業向け脱炭素・カーボンマネジメントプラットフォーム。" },
  { name: "Emitwise", aliases: ["Emitwise"], cat: "コンサル", hq: "英国 ロンドン", desc: "サプライチェーンのScope3排出量測定・管理ツール。" },
  { name: "Normative", aliases: ["Normative"], cat: "コンサル", hq: "スウェーデン ストックホルム", desc: "カーボン会計エンジン。Google出資。企業の排出量自動計算。" },
  { name: "Sweep", aliases: ["Sweep"], cat: "コンサル", hq: "フランス モンペリエ", desc: "企業向けカーボンマネジメント・ESG報告プラットフォーム。" },

  // === アジア・中東 ===
  { name: "Carbonplace", aliases: ["Carbonplace"], cat: "仲介", hq: "英国 ロンドン", desc: "大手銀行9行が設立したカーボンクレジット決済ネットワーク。" },
  { name: "AirCarbon Exchange", aliases: ["AirCarbon"], cat: "仲介", hq: "シンガポール", desc: "ブロックチェーンベースのカーボンクレジット取引所。アジア中心。" },
  { name: "Climate Impact X", aliases: ["Climate Impact X", "CIX"], cat: "仲介", hq: "シンガポール", desc: "SGX・DBS・Temasek出資のカーボンクレジット取引所。" },
  { name: "Respira International", aliases: ["Respira"], cat: "仲介", hq: "英国 ロンドン", desc: "自然ベースカーボンクレジットの大規模取引・ポートフォリオ運用。" },
  { name: "Tamuwa", aliases: ["Tamuwa"], cat: "仲介", hq: "サウジアラビア", desc: "中東初のカーボンクレジット取引プラットフォーム。" },

  // === 日本企業（さらに追加） ===
  { name: "日揮ホールディングス", aliases: ["日揮", "日揮ホールディングス"], cat: "創出", hq: "神奈川県横浜市", desc: "エンジニアリング大手。CCS・メタネーション・水素事業を推進。" },
  { name: "千代田化工建設", aliases: ["千代田化工", "千代田化工建設"], cat: "創出", hq: "神奈川県横浜市", desc: "エンジニアリング企業。水素サプライチェーン・CCS技術を展開。" },
  { name: "清水建設", aliases: ["清水建設"], cat: "創出", hq: "東京都中央区", desc: "ゼネコン大手。建設分野のカーボンニュートラル・木造建築CO2固定を推進。" },
  { name: "大林組", aliases: ["大林組"], cat: "創出", hq: "東京都港区", desc: "ゼネコン大手。CO2-SUICOM（CO2固定コンクリート）技術を開発。" },
  { name: "鹿島建設", aliases: ["鹿島建設", "鹿島"], cat: "創出", hq: "東京都港区", desc: "ゼネコン大手。CCS・ブルーカーボン・再エネ事業に取り組む。" },
  { name: "東京電力", aliases: ["東京電力", "東電", "TEPCO"], cat: "創出", hq: "東京都千代田区", desc: "電力大手。洋上風力・カーボンクレジット活用で脱炭素を推進。" },
  { name: "関西電力", aliases: ["関西電力", "関電"], cat: "創出", hq: "大阪市北区", desc: "電力大手。原子力・再エネに加え、J-クレジット・森林事業を展開。" },
  { name: "東北電力", aliases: ["東北電力"], cat: "創出", hq: "仙台市青葉区", desc: "電力大手。地熱・バイオマス発電からのJ-クレジット創出。" },
  { name: "日本製鉄", aliases: ["日本製鉄"], cat: "創出", hq: "東京都千代田区", desc: "鉄鋼最大手。水素還元製鉄・CCUS技術で鉄鋼の脱炭素化を推進。" },
  { name: "住友林業", aliases: ["住友林業"], cat: "創出", hq: "東京都千代田区", desc: "林業・住宅大手。国内外の森林管理・植林によるカーボンクレジットを創出。" },
  { name: "王子ホールディングス", aliases: ["王子ホールディングス", "王子HD"], cat: "創出", hq: "東京都中央区", desc: "製紙大手。森林経営・バイオマスエネルギーによるカーボンクレジット創出。" },
  { name: "日本郵船", aliases: ["日本郵船"], cat: "仲介", hq: "東京都千代田区", desc: "海運大手。LNG・アンモニア燃料船・カーボンオフセットで海運脱炭素を推進。" },
  { name: "川崎汽船", aliases: ["川崎汽船"], cat: "仲介", hq: "東京都千代田区", desc: "海運大手。LNG燃料船・排出削減クレジットの活用で脱炭素を推進。" },
  { name: "双日", aliases: ["双日"], cat: "仲介", hq: "東京都千代田区", desc: "総合商社。森林保全・再エネ由来カーボンクレジット取引に参入。" },
  { name: "豊田通商", aliases: ["豊田通商"], cat: "仲介", hq: "名古屋市中村区", desc: "トヨタ系総合商社。アフリカ・東南アジアでのカーボンクレジット事業を展開。" },
  { name: "みずほフィナンシャルグループ", aliases: ["みずほ", "みずほFG"], cat: "仲介", hq: "東京都千代田区", desc: "メガバンク。カーボンクレジット市場への金融サービス提供を推進。" },
  { name: "三井住友フィナンシャルグループ", aliases: ["三井住友", "SMFG", "三井住友FG"], cat: "仲介", hq: "東京都千代田区", desc: "メガバンク。カーボンクレジット・GXファイナンスを推進。" },
  { name: "三菱UFJフィナンシャル・グループ", aliases: ["三菱UFJ", "MUFG"], cat: "仲介", hq: "東京都千代田区", desc: "メガバンク最大手。トランジションファイナンス・カーボンクレジット事業を展開。" },
  { name: "野村総合研究所", aliases: ["野村総研", "NRI"], cat: "コンサル", hq: "東京都千代田区", desc: "シンクタンク大手。GX戦略・カーボンクレジット制度設計のコンサルティング。" },
  { name: "アスエネ", aliases: ["アスエネ"], cat: "コンサル", hq: "東京都港区", desc: "CO2排出量可視化SaaS「ASUENE」を提供する日本のスタートアップ。" },
  { name: "booost technologies", aliases: ["booost"], cat: "コンサル", hq: "東京都品川区", desc: "サプライチェーンCO2可視化プラットフォーム「booost Sustainability Cloud」。" },
  { name: "ゼロボード", aliases: ["ゼロボード", "zeroboard"], cat: "コンサル", hq: "東京都港区", desc: "GHG排出量算定・可視化SaaS「zeroboard」を提供。日本のGXスタートアップ。" },
  { name: "e-dash", aliases: ["e-dash"], cat: "コンサル", hq: "東京都千代田区", desc: "三井物産発のCO2排出量可視化・削減支援SaaS。" },
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
    all.push(...(await r.json() as CCJPost[]));
    if ((await Promise.resolve(all.length)) && all.length % 100 !== 0) break;
    await new Promise(r2 => setTimeout(r2, 200));
  }
  return all;
}

async function main() {
  console.log("=== 企業追加登録 v4（最終ラウンド） ===\n");
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
