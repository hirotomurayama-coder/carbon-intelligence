import { Suspense } from "react";
import { getInsights } from "@/lib/wordpress";
import { InsightList } from "@/components/InsightList";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "インサイト | Carbon Intelligence",
  description:
    "カーボンクレジット市場の特別記事・メルマガアーカイブ・週次マーケットブリーフ。政策・市場・技術の深掘り分析。",
};

export default async function InsightsPage() {
  const insights = await getInsights();
  const sorted = [...insights].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">インサイト</h1>
        <p className="mt-1 text-sm text-gray-400">
          特別記事・メルマガアーカイブ・週次マーケットブリーフ・政策/市場/技術分析
        </p>
      </div>

      <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">読み込み中...</div>}>
        <InsightList data={sorted} />
      </Suspense>
    </div>
  );
}
