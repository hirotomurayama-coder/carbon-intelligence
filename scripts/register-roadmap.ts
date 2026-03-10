/**
 * 政策ロードマップイベントを WordPress roadmap CPT に登録するスクリプト。
 * 既存タイトル検索で重複を防ぎ、新規のみ作成する。
 *
 * 使い方:
 *   source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD && npx tsx scripts/register-roadmap.ts
 */

const API_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";

if (!API_BASE || !WP_USER || !WP_PASS) {
  console.error(
    "環境変数が未設定です: NEXT_PUBLIC_WORDPRESS_API_URL, WP_APP_USER, WP_APP_PASSWORD"
  );
  process.exit(1);
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
}

type RoadmapData = {
  title: string;
  category: string;
  status: string;
  startDate: string;
  endDate: string;
  description: string;
};

const events: RoadmapData[] = [
  // ── SSBJ ──
  {
    title: "SSBJ サステナビリティ開示基準 策定",
    category: "SSBJ",
    status: "進行中",
    startDate: "2024-03-01",
    endDate: "2025-03-31",
    description:
      "<p>サステナビリティ基準委員会（SSBJ）によるサステナビリティ開示基準の策定作業。ISSBのIFRS S1・S2をベースに、日本版基準を開発中。2024年3月に公開草案を公表し、2025年3月の最終化を目指す。</p>",
  },
  {
    title: "SSBJ 基準 適用開始（プライム上場企業）",
    category: "SSBJ",
    status: "予定",
    startDate: "2027-04-01",
    endDate: "2028-03-31",
    description:
      "<p>東京証券取引所プライム市場上場企業に対するSSBJ基準の適用開始（2027年3月期決算以降の予定）。段階的に対象企業を拡大し、最終的に全上場企業への適用を目指す。</p>",
  },
  // ── GX-ETS ──
  {
    title: "GX-ETS 試行フェーズ（GXリーグ）",
    category: "GX-ETS",
    status: "進行中",
    startDate: "2023-04-01",
    endDate: "2025-03-31",
    description:
      "<p>GX（グリーントランスフォーメーション）リーグ参画企業による排出量取引制度の試行フェーズ。約700社が自主的に参加し、排出量の算定・報告・取引の実務を蓄積。本格稼働に向けた制度設計のフィードバックを収集する。</p>",
  },
  {
    title: "GX-ETS 本格稼働（第2フェーズ）",
    category: "GX-ETS",
    status: "準備中",
    startDate: "2026-04-01",
    endDate: "2028-03-31",
    description:
      "<p>排出量取引制度の本格運用開始。発電事業者を対象にキャップ＆トレード方式を導入予定。排出枠の有償割当や第三者検証の義務化など、制度の実効性を高める施策を段階的に導入する。</p>",
  },
  // ── TNFD ──
  {
    title: "TNFD フレームワーク v1.0 公開",
    category: "TNFD",
    status: "完了",
    startDate: "2023-09-01",
    endDate: "2023-09-30",
    description:
      "<p>自然関連財務情報開示タスクフォース（TNFD）が最終版フレームワーク v1.0 を公開。14の推奨開示項目とLEAPアプローチ（Locate, Evaluate, Assess, Prepare）を提示。企業の自然資本に関するリスク・機会の開示枠組みを確立した。</p>",
  },
  {
    title: "TNFD 日本での採用推進・ガイダンス整備",
    category: "TNFD",
    status: "進行中",
    startDate: "2024-01-01",
    endDate: "2025-12-31",
    description:
      "<p>環境省・金融庁主導によるTNFDフレームワークの国内採用推進。日本企業向けの実施ガイダンス策定や先行開示事例の収集を進める。2025年末までに主要企業100社以上のTNFD開示を目標とする。</p>",
  },
  // ── J-Credit ──
  {
    title: "J-Credit 制度改訂（対象拡大）",
    category: "J-Credit",
    status: "完了",
    startDate: "2023-04-01",
    endDate: "2024-03-31",
    description:
      "<p>J-Credit制度の対象分野拡大に向けた制度改訂。森林吸収源の認証手法見直し、農業分野（水田メタン削減等）の方法論追加、中小企業の参加促進策を実施。デジタル化による申請手続きの簡素化も推進。</p>",
  },
  {
    title: "J-Credit 算定方法論 拡充",
    category: "J-Credit",
    status: "進行中",
    startDate: "2024-04-01",
    endDate: "2026-03-31",
    description:
      "<p>新たな算定方法論の開発・承認を加速。ブルーカーボン（藻場・マングローブ）、バイオ炭、DAC（直接空気回収）など、新領域の方法論を追加。既存方法論のデフォルト値更新や算定精度の向上も並行して実施。</p>",
  },
  // ── 適格カーボンクレジット ──
  {
    title: "ICVCM CCP認定 プロセス開始",
    category: "適格カーボンクレジット",
    status: "進行中",
    startDate: "2024-01-01",
    endDate: "2025-06-30",
    description:
      "<p>Integrity Council for the Voluntary Carbon Market（ICVCM）によるCore Carbon Principles（CCP）認定の開始。ボランタリークレジットの品質基準を確立し、Verra VCS・Gold Standard等の主要プログラムのCCP適合性審査を実施中。</p>",
  },
  {
    title: "適格カーボンクレジット 国際基準 整備",
    category: "適格カーボンクレジット",
    status: "準備中",
    startDate: "2025-07-01",
    endDate: "2027-12-31",
    description:
      "<p>パリ協定 第6条4項メカニズムの下での国際クレジット基準の整備。国連の監督機関による方法論承認プロセスの本格化と、二重計上防止のための相当調整メカニズムの運用開始を見込む。</p>",
  },
  // ── カーボンプライシング ──
  {
    title: "炭素賦課金 制度設計",
    category: "カーボンプライシング",
    status: "準備中",
    startDate: "2025-01-01",
    endDate: "2026-12-31",
    description:
      "<p>GX推進法に基づく炭素賦課金（カーボンレビー）の具体的な制度設計。化石燃料輸入者を対象とした賦課金の税率・課税対象・減免措置等の詳細を策定中。2028年度の導入開始を目指す。</p>",
  },
  {
    title: "炭素賦課金 導入開始",
    category: "カーボンプライシング",
    status: "予定",
    startDate: "2028-04-01",
    endDate: "2028-12-31",
    description:
      "<p>炭素賦課金の正式導入。当初は低税率で開始し、段階的に引き上げる予定。徴収された財源はGX経済移行債の償還やGX投資の促進に充当。排出量取引制度（GX-ETS）と連動し、包括的なカーボンプライシング体系を構築する。</p>",
  },
];

async function findExistingEvent(title: string): Promise<number | null> {
  try {
    const url = `${API_BASE}/roadmap?search=${encodeURIComponent(title)}&per_page=10`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const posts: { id: number; title: { rendered: string } }[] =
      await res.json();
    const match = posts.find(
      (p) =>
        p.title.rendered.replace(/<[^>]*>/g, "").trim() === title
    );
    return match ? match.id : null;
  } catch {
    return null;
  }
}

function buildAcf(event: RoadmapData): Record<string, unknown> {
  return {
    roadmap_category: event.category,
    roadmap_status: event.status,
    start_date: event.startDate,
    end_date: event.endDate,
  };
}

async function createEvent(event: RoadmapData): Promise<number> {
  const body = {
    title: event.title,
    content: event.description,
    status: "publish",
    acf: buildAcf(event),
  };

  const res = await fetch(`${API_BASE}/roadmap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `作成失敗 ${event.title}: ${res.status} ${text.slice(0, 300)}`
    );
  }

  const created = await res.json();
  return created.id;
}

async function updateEvent(
  wpId: number,
  event: RoadmapData
): Promise<void> {
  const body = {
    title: event.title,
    content: event.description,
    acf: buildAcf(event),
  };

  const res = await fetch(`${API_BASE}/roadmap/${wpId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `更新失敗 ${event.title} (ID ${wpId}): ${res.status} ${text.slice(0, 300)}`
    );
  }
}

async function main() {
  console.log("=== 政策ロードマップ登録スクリプト ===");
  console.log(`API: ${API_BASE}`);
  console.log(`イベント数: ${events.length}\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const event of events) {
    try {
      const existingId = await findExistingEvent(event.title);
      if (existingId) {
        console.log(`[更新] ${event.title} (ID ${existingId})`);
        await updateEvent(existingId, event);
        updated++;
      } else {
        console.log(`[新規] ${event.title}`);
        const newId = await createEvent(event);
        console.log(`  → ID ${newId} で作成完了`);
        created++;
      }
    } catch (e) {
      console.error(`[エラー] ${event.title}: ${e}`);
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
