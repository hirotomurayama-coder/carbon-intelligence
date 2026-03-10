import { getRoadmapEvents } from "@/lib/wordpress";
import { RoadmapTimeline } from "@/components/RoadmapTimeline";
import type { Metadata } from "next";
import type { RoadmapEvent } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "政策ロードマップ | Carbon Intelligence",
  description:
    "日本のカーボンクレジット関連政策のタイムライン。SSBJ、GX-ETS、TNFD、J-Credit などの主要政策の進捗をガントチャートで可視化。",
};

export default async function RoadmapPage() {
  let events: RoadmapEvent[] = [];
  let fetchError: string | null = null;

  try {
    events = await getRoadmapEvents();
  } catch (e) {
    fetchError =
      e instanceof Error ? e.message : "WordPress API からのデータ取得に失敗しました";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">政策ロードマップ</h1>
        <p className="mt-1 text-sm text-gray-500">
          日本のカーボンクレジット関連政策のタイムライン
        </p>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">データ取得エラー</p>
          <p className="mt-1">{fetchError}</p>
        </div>
      )}

      <RoadmapTimeline data={events} />
    </div>
  );
}
