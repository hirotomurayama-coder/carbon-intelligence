import { getPriceTrends } from "@/lib/wordpress";
import { PriceTrendDashboard } from "@/components/PriceTrendDashboard";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クレジット価格動向 | Carbon Intelligence",
  description:
    "EU ETS、J-Credit、ボランタリークレジット（Xpansiv CBL）の最新価格と価格推移をリアルタイムで可視化。円換算・為替レート情報付き。",
};

export default async function AnalyticsPage() {
  // getPriceTrends は内部で try-catch し、エラー時は [] を返す。
  // ここでの try-catch は予期しない例外（型エラー等）の最終防壁。
  let trends = await getPriceTrends();
  let fetchError: string | null = null;

  // getPriceTrends が例外を返すケースの防衛（通常は到達しない）
  if (!Array.isArray(trends)) {
    console.error("[AnalyticsPage] getPriceTrends returned non-array:", trends);
    trends = [];
    fetchError = "データの取得中に予期しないエラーが発生しました";
  }

  // データが0件でも「取得失敗」ではなく空表示。
  // エラーバナーは本当に例外が発生した場合のみ。

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">クレジット価格動向</h1>
        <p className="mt-1 text-sm text-gray-500">
          主要カーボンクレジット市場の最新価格と推移
        </p>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">データ取得エラー</p>
          <p className="mt-1">{fetchError}</p>
        </div>
      )}

      <PriceTrendDashboard data={trends} />
    </div>
  );
}
