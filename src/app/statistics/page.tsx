import { Suspense } from "react";
import { StatisticsDashboard } from "@/components/StatisticsDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "統計データ | Carbon Intelligence",
  description:
    "UC Berkeley VROD データに基づくボランタリーカーボンクレジット市場の統計分析。発行量・リタイア量・レジストリ分布・メソドロジー実績。",
};

export default function StatisticsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">読み込み中...</div>}>
      <StatisticsDashboard />
    </Suspense>
  );
}
