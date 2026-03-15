import { getPriceTrends } from "@/lib/wordpress";
import { MarketInsightCards } from "@/components/MarketInsightCards";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { Metadata } from "next";
import type { PriceTrend } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "マーケット・インサイト | Carbon Intelligence",
  description:
    "EU ETS、J-Credit、ボランタリークレジットのAI分析付き市場インサイト。価格動向の背景要因と短期見通しを解説。",
};

export default async function AnalysisPage() {
  let trends: PriceTrend[] = [];
  let fetchError: string | null = null;

  try {
    trends = await getPriceTrends();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fetchError = msg;
    console.error("[AnalysisPage] 予期しない例外:", e);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">マーケット・インサイト</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI分析に基づくカーボンクレジット市場の価格動向と見通し
        </p>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">データ取得エラー</p>
          <p className="mt-1 break-all">{fetchError}</p>
        </div>
      )}

      <ErrorBoundary>
        <MarketInsightCards data={trends} />
      </ErrorBoundary>
    </div>
  );
}
