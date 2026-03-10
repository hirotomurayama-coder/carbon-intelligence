import { getPriceTrends } from "@/lib/wordpress";
import { PriceTrendDashboard } from "@/components/PriceTrendDashboard";
import type { Metadata } from "next";
import type { PriceTrend } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クレジット価格動向 | Carbon Intelligence",
  description:
    "EU ETS、J-Credit、ボランタリークレジット（Xpansiv CBL）の最新価格と価格推移をリアルタイムで可視化。円換算・為替レート情報付き。",
};

export default async function AnalyticsPage() {
  let trends: PriceTrend[] = [];
  let fetchError: string | null = null;

  try {
    trends = await getPriceTrends();
  } catch (e) {
    fetchError =
      e instanceof Error ? e.message : "WordPress API からのデータ取得に失敗しました";
  }

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
