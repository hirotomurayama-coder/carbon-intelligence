import { getRoadmapEvents } from "@/lib/wordpress";
import { RoadmapTimeline } from "@/components/RoadmapTimeline";
import type { Metadata } from "next";
import type { RoadmapEvent } from "@/types";

export const metadata: Metadata = {
  title: "政策ロードマップ | Carbon Intelligence",
  description:
    "日本のカーボンクレジット関連政策のタイムライン。SSBJ、GX-ETS、TNFD、J-Credit などの主要政策の進捗をガントチャートで可視化。",
};

/**
 * WordPress の ACF フィールドグループが未設定の場合にフォールバックする静的データ。
 * ACF 設定完了後は WordPress のデータが優先的に使用される。
 */
const FALLBACK_EVENTS: RoadmapEvent[] = [
  {
    id: "fb-1",
    title: "SSBJ サステナビリティ開示基準 策定",
    category: "SSBJ",
    status: "進行中",
    startDate: "2024-03-01",
    endDate: "2025-03-31",
    description: "ISSBのIFRS S1・S2をベースに、日本版サステナビリティ開示基準を策定中。",
    descriptionHtml: "<p>サステナビリティ基準委員会（SSBJ）によるサステナビリティ開示基準の策定作業。ISSBのIFRS S1・S2をベースに、日本版基準を開発中。2024年3月に公開草案を公表し、2025年3月の最終化を目指す。</p>",
  },
  {
    id: "fb-2",
    title: "SSBJ 基準 適用開始（プライム上場企業）",
    category: "SSBJ",
    status: "予定",
    startDate: "2027-04-01",
    endDate: "2028-03-31",
    description: "プライム市場上場企業に対するSSBJ基準の適用開始。",
    descriptionHtml: "<p>東京証券取引所プライム市場上場企業に対するSSBJ基準の適用開始（2027年3月期決算以降の予定）。段階的に対象企業を拡大し、最終的に全上場企業への適用を目指す。</p>",
  },
  {
    id: "fb-3",
    title: "GX-ETS 試行フェーズ（GXリーグ）",
    category: "GX-ETS",
    status: "進行中",
    startDate: "2023-04-01",
    endDate: "2025-03-31",
    description: "GXリーグ参画企業による排出量取引制度の試行フェーズ。約700社が参加。",
    descriptionHtml: "<p>GX（グリーントランスフォーメーション）リーグ参画企業による排出量取引制度の試行フェーズ。約700社が自主的に参加し、排出量の算定・報告・取引の実務を蓄積。本格稼働に向けた制度設計のフィードバックを収集する。</p>",
  },
  {
    id: "fb-4",
    title: "GX-ETS 本格稼働（第2フェーズ）",
    category: "GX-ETS",
    status: "準備中",
    startDate: "2026-04-01",
    endDate: "2028-03-31",
    description: "排出量取引制度の本格運用開始。キャップ＆トレード方式を導入予定。",
    descriptionHtml: "<p>排出量取引制度の本格運用開始。発電事業者を対象にキャップ＆トレード方式を導入予定。排出枠の有償割当や第三者検証の義務化など、制度の実効性を高める施策を段階的に導入する。</p>",
  },
  {
    id: "fb-5",
    title: "TNFD フレームワーク v1.0 公開",
    category: "TNFD",
    status: "完了",
    startDate: "2023-09-01",
    endDate: "2023-09-30",
    description: "TNFD最終版フレームワーク v1.0 公開。14の推奨開示項目を提示。",
    descriptionHtml: "<p>自然関連財務情報開示タスクフォース（TNFD）が最終版フレームワーク v1.0 を公開。14の推奨開示項目とLEAPアプローチ（Locate, Evaluate, Assess, Prepare）を提示。企業の自然資本に関するリスク・機会の開示枠組みを確立した。</p>",
  },
  {
    id: "fb-6",
    title: "TNFD 日本での採用推進・ガイダンス整備",
    category: "TNFD",
    status: "進行中",
    startDate: "2024-01-01",
    endDate: "2025-12-31",
    description: "環境省・金融庁主導によるTNFDフレームワークの国内採用推進。",
    descriptionHtml: "<p>環境省・金融庁主導によるTNFDフレームワークの国内採用推進。日本企業向けの実施ガイダンス策定や先行開示事例の収集を進める。2025年末までに主要企業100社以上のTNFD開示を目標とする。</p>",
  },
  {
    id: "fb-7",
    title: "J-Credit 制度改訂（対象拡大）",
    category: "J-Credit",
    status: "完了",
    startDate: "2023-04-01",
    endDate: "2024-03-31",
    description: "J-Credit制度の対象分野拡大。森林吸収源・農業分野の方法論追加。",
    descriptionHtml: "<p>J-Credit制度の対象分野拡大に向けた制度改訂。森林吸収源の認証手法見直し、農業分野（水田メタン削減等）の方法論追加、中小企業の参加促進策を実施。デジタル化による申請手続きの簡素化も推進。</p>",
  },
  {
    id: "fb-8",
    title: "J-Credit 算定方法論 拡充",
    category: "J-Credit",
    status: "進行中",
    startDate: "2024-04-01",
    endDate: "2026-03-31",
    description: "ブルーカーボン、バイオ炭、DACなど新領域の算定方法論を追加。",
    descriptionHtml: "<p>新たな算定方法論の開発・承認を加速。ブルーカーボン（藻場・マングローブ）、バイオ炭、DAC（直接空気回収）など、新領域の方法論を追加。既存方法論のデフォルト値更新や算定精度の向上も並行して実施。</p>",
  },
  {
    id: "fb-9",
    title: "ICVCM CCP認定 プロセス開始",
    category: "適格カーボンクレジット",
    status: "進行中",
    startDate: "2024-01-01",
    endDate: "2025-06-30",
    description: "ICVCMによるCore Carbon Principles認定の開始。品質基準の確立。",
    descriptionHtml: "<p>Integrity Council for the Voluntary Carbon Market（ICVCM）によるCore Carbon Principles（CCP）認定の開始。ボランタリークレジットの品質基準を確立し、Verra VCS・Gold Standard等の主要プログラムのCCP適合性審査を実施中。</p>",
  },
  {
    id: "fb-10",
    title: "適格カーボンクレジット 国際基準 整備",
    category: "適格カーボンクレジット",
    status: "準備中",
    startDate: "2025-07-01",
    endDate: "2027-12-31",
    description: "パリ協定6条4項メカニズムの下での国際クレジット基準整備。",
    descriptionHtml: "<p>パリ協定 第6条4項メカニズムの下での国際クレジット基準の整備。国連の監督機関による方法論承認プロセスの本格化と、二重計上防止のための相当調整メカニズムの運用開始を見込む。</p>",
  },
  {
    id: "fb-11",
    title: "炭素賦課金 制度設計",
    category: "カーボンプライシング",
    status: "準備中",
    startDate: "2025-01-01",
    endDate: "2026-12-31",
    description: "GX推進法に基づく炭素賦課金の制度設計。2028年度導入目標。",
    descriptionHtml: "<p>GX推進法に基づく炭素賦課金（カーボンレビー）の具体的な制度設計。化石燃料輸入者を対象とした賦課金の税率・課税対象・減免措置等の詳細を策定中。2028年度の導入開始を目指す。</p>",
  },
  {
    id: "fb-12",
    title: "炭素賦課金 導入開始",
    category: "カーボンプライシング",
    status: "予定",
    startDate: "2028-04-01",
    endDate: "2028-12-31",
    description: "炭素賦課金の正式導入。低税率で開始し段階的引上げ。",
    descriptionHtml: "<p>炭素賦課金の正式導入。当初は低税率で開始し、段階的に引き上げる予定。徴収された財源はGX経済移行債の償還やGX投資の促進に充当。排出量取引制度（GX-ETS）と連動し、包括的なカーボンプライシング体系を構築する。</p>",
  },
];

export default async function RoadmapPage() {
  const wpEvents = await getRoadmapEvents();

  // WordPress ACF データに日付がある場合はそちらを使用、なければフォールバック
  const hasWpDates = wpEvents.some((e) => e.startDate !== null);
  const events = hasWpDates ? wpEvents : FALLBACK_EVENTS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">政策ロードマップ</h1>
        <p className="mt-1 text-sm text-gray-500">
          日本のカーボンクレジット関連政策のタイムライン
        </p>
      </div>
      <RoadmapTimeline data={events} />
    </div>
  );
}
