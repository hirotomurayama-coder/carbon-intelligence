/**
 * カーボンクレジット関連企業10社を WordPress companies CPT に登録するスクリプト。
 * 既存タイトル検索で重複を防ぎ、新規のみ作成する。
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD && npx tsx scripts/register-companies.ts
 */

const API_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error("環境変数が未設定です: NEXT_PUBLIC_WORDPRESS_API_URL, WP_APP_USER, WP_APP_PASSWORD");
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

type CompanyData = {
  name: string;
  category: string;
  headquarters: string;
  homepageUrl: string;
  mainProjects: string;
  description: string;
};

const companies: CompanyData[] = [
  {
    name: "バイウィル",
    category: "仲介",
    headquarters: "東京都中央区",
    homepageUrl: "https://www.bywill.co.jp/",
    mainProjects: "カーボンクレジット仲介,環境価値取引,J-クレジット",
    description:
      "カーボンクレジットの仲介・コンサルティングを手がける日本企業。J-クレジットを中心に、企業のカーボンニュートラル実現を支援。環境価値の取引プラットフォームを運営し、クレジットの調達から活用戦略まで一気通貫でサポートしている。",
  },
  {
    name: "グリーンカーボン",
    category: "創出事業者",
    headquarters: "東京都港区",
    homepageUrl: "https://green-carbon.co.jp/",
    mainProjects: "ブルーカーボン,マングローブ植林,Jブルークレジット",
    description:
      "ブルーカーボン（海洋由来の炭素吸収）に特化した日本のカーボンクレジット創出事業者。マングローブ植林や藻場再生を通じたクレジット創出に取り組み、Jブルークレジットの認証取得を推進している。",
  },
  {
    name: "サステナビリティ・デザイン研究所",
    category: "コンサル",
    headquarters: "東京都",
    homepageUrl: "https://susdi.org/",
    mainProjects: "サステナビリティ戦略,カーボンマネジメント,環境コンサルティング",
    description:
      "サステナビリティに関する調査・研究・コンサルティングを行う一般社団法人。企業や自治体向けに脱炭素戦略の策定支援やカーボンクレジット活用のアドバイザリーを提供している。",
  },
  {
    name: "カーボン・シナジー（Creatura Inc.）",
    category: "コンサル",
    headquarters: "東京都",
    homepageUrl: "https://creatura.co.jp/",
    mainProjects: "カーボンオフセット,排出量算定,GHGプロトコル",
    description:
      "Creatura Inc. が運営するカーボン・シナジー事業。企業の温室効果ガス排出量算定からカーボンオフセット戦略の立案、クレジット調達までを包括的に支援するコンサルティングサービスを展開。",
  },
  {
    name: "South Pole",
    category: "コンサル",
    headquarters: "チューリッヒ（スイス）",
    homepageUrl: "https://www.southpole.com/",
    mainProjects: "気候変動コンサル,カーボンクレジット開発,再エネプロジェクト",
    description:
      "スイスに本社を置く世界最大級の気候変動ソリューション企業。30カ国以上にオフィスを持ち、カーボンクレジットのプロジェクト開発から企業の気候戦略策定まで、包括的なサービスを提供。700以上のプロジェクトを手がけ、Verra VCS や Gold Standard の認証取得を支援している。",
  },
  {
    name: "Pachama",
    category: "技術開発",
    headquarters: "サンフランシスコ（米国）",
    homepageUrl: "https://pachama.com/",
    mainProjects: "森林カーボンクレジット,衛星画像解析,MRV技術",
    description:
      "衛星画像とAI/機械学習を活用し、森林カーボンクレジットの計測・報告・検証（MRV）を行うテクノロジー企業。2025年11月にCarbon Directに買収され、同社の技術プラットフォームとして統合された。リモートセンシングによる高精度な森林炭素量推定技術で業界をリードしていた。",
  },
  {
    name: "Climeworks",
    category: "技術開発",
    headquarters: "チューリッヒ（スイス）",
    homepageUrl: "https://climeworks.com/",
    mainProjects: "DAC（直接空気回収）,炭素除去,地下貯留",
    description:
      "直接空気回収（DAC: Direct Air Capture）技術のパイオニア企業。大気中のCO2を直接回収し、地下に永久貯留する技術を商用化。アイスランドで世界初の商用DACプラント「Orca」を稼働させ、後継の「Mammoth」プラントの建設も進める。除去系カーボンクレジットの新たな供給源として注目されている。",
  },
  {
    name: "Indigo Ag",
    category: "創出事業者",
    headquarters: "ボストン（米国）",
    homepageUrl: "https://www.indigoag.com/",
    mainProjects: "土壌炭素貯留,リジェネラティブ農業,農業カーボンクレジット",
    description:
      "農業分野のカーボンクレジット創出に特化した米国企業。リジェネラティブ農業（再生型農業）を通じた土壌炭素貯留により、農家がカーボンクレジットを創出・販売できるプラットフォームを運営。不耕起栽培やカバークロップ導入を促進し、農業由来の炭素吸収を定量化している。",
  },
  {
    name: "Carbon Direct",
    category: "コンサル",
    headquarters: "ニューヨーク（米国）",
    homepageUrl: "https://www.carbon-direct.com/",
    mainProjects: "炭素除去戦略,科学的評価,カーボンクレジット品質評価",
    description:
      "科学主導のカーボンマネジメント企業。コロンビア大学の研究者が設立し、企業の炭素除去戦略の策定やカーボンクレジットの品質評価を提供。2025年にはPachamaを買収し、テクノロジープラットフォームを強化。高品質な除去クレジットの科学的検証で業界の信頼性向上に貢献している。",
  },
  {
    name: "Running Tide",
    category: "技術開発",
    headquarters: "ポートランド（米国）",
    homepageUrl: "https://www.runningtide.com/",
    mainProjects: "海洋炭素除去,バイオマス沈降,海洋CDR",
    description:
      "海洋を活用した炭素除去（Ocean CDR）技術を開発していた米国スタートアップ。木質バイオマスを海洋深層に沈降させることでCO2を長期隔離する手法を研究。Shopifyなどから大型契約を獲得したが、技術的・経済的課題により2024年6月に事業を終了した。海洋CDR分野の先駆的事例として記録される。",
  },
];

async function findExistingCompany(name: string): Promise<number | null> {
  try {
    const url = `${API_BASE}/companies?search=${encodeURIComponent(name)}&per_page=10`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const posts: { id: number; title: { rendered: string } }[] = await res.json();
    const match = posts.find(
      (p) => p.title.rendered.replace(/<[^>]*>/g, "").trim().toLowerCase() === name.toLowerCase()
    );
    return match ? match.id : null;
  } catch {
    return null;
  }
}

/**
 * WordPress ACF の company_category select フィールドは
 * 「創出」「仲介」「コンサル」「検証機関」のみ受け付ける。
 * アプリ側のカテゴリをWP側の値にマッピング。
 */
const WP_CATEGORY_MAP: Record<string, string> = {
  "創出事業者": "創出",
  "仲介": "仲介",
  "コンサル": "コンサル",
  "検証機関": "検証機関",
  "開発プロバイダー": "創出",  // WPに選択肢がないので近いものにマッピング
  "技術開発": "創出",          // WPに選択肢がないので近いものにマッピング
};

function buildAcf(company: CompanyData): Record<string, unknown> {
  const acf: Record<string, unknown> = {
    headquarters: company.headquarters,
    main_projects: company.mainProjects,
    homepage_url: company.homepageUrl,
    company_description: company.description,
  };
  const wpCategory = WP_CATEGORY_MAP[company.category];
  if (wpCategory) {
    acf.company_category = wpCategory;
  }
  return acf;
}

async function createCompany(company: CompanyData): Promise<number> {
  const body = {
    title: company.name,
    content: `<p>${company.description}</p>`,
    status: "publish",
    acf: buildAcf(company),
  };

  const res = await fetch(`${API_BASE}/companies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`作成失敗 ${company.name}: ${res.status} ${text.slice(0, 300)}`);
  }

  const created = await res.json();
  return created.id;
}

async function updateCompany(wpId: number, company: CompanyData): Promise<void> {
  const body = {
    title: company.name,
    content: `<p>${company.description}</p>`,
    acf: buildAcf(company),
  };

  const res = await fetch(`${API_BASE}/companies/${wpId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`更新失敗 ${company.name} (ID ${wpId}): ${res.status} ${text.slice(0, 300)}`);
  }
}

async function main() {
  console.log("=== 企業データ登録スクリプト ===");
  console.log(`API: ${API_BASE}`);
  console.log(`企業数: ${companies.length}\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const company of companies) {
    try {
      const existingId = await findExistingCompany(company.name);
      if (existingId) {
        console.log(`[更新] ${company.name} (ID ${existingId})`);
        await updateCompany(existingId, company);
        updated++;
      } else {
        console.log(`[新規] ${company.name}`);
        const newId = await createCompany(company);
        console.log(`  → ID ${newId} で作成完了`);
        created++;
      }
    } catch (e) {
      console.error(`[エラー] ${company.name}: ${e}`);
      errors++;
    }

    // API レート制限対策
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n=== 完了 ===`);
  console.log(`新規作成: ${created}, 更新: ${updated}, エラー: ${errors}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
