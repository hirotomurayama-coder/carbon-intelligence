import { StatisticsDashboard } from "@/components/StatisticsDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "クレジット統計 | Carbon Intelligence",
  description:
    "UC Berkeley VROD データに基づくボランタリーカーボンクレジット市場の統計分析。発行量・リタイア量・レジストリ分布・メソドロジー実績。",
};

export default function StatisticsPage() {
  return <StatisticsDashboard />;
}
