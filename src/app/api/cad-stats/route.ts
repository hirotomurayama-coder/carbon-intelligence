/**
 * CAD Trust 統計情報を返す API ルート。
 * ダッシュボードのグラフ表示等に使用。
 */

import { NextResponse } from "next/server";

const CAD_API = "https://observer.climateactiondata.org/api/v1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 100件取得してレジストリ・セクター分布を集計
    const res = await fetch(
      `${CAD_API}/projects?page=1&limit=100`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `CAD Trust API: ${res.status}` });
    }

    const data = await res.json();
    const pageCount = data.pageCount ?? 0;
    const projects = data.data ?? [];

    // レジストリ分布
    const registries: Record<string, number> = {};
    // セクター分布
    const sectors: Record<string, number> = {};
    // 国分布
    const countries: Record<string, number> = {};

    for (const p of projects) {
      const reg = p.currentRegistry ?? "不明";
      registries[reg] = (registries[reg] ?? 0) + 1;

      const sec = p.sector ?? "不明";
      sectors[sec] = (sectors[sec] ?? 0) + 1;

      for (const loc of p.projectLocations ?? []) {
        const c = loc.country ?? "不明";
        countries[c] = (countries[c] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      totalProjects: pageCount,
      registries: Object.entries(registries)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      sectors: Object.entries(sectors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      countries: Object.entries(countries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, count]) => ({ name, count })),
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
