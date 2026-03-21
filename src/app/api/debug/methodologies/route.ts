import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "(未設定)";

  try {
    // Step 1: 直接 fetch してみる
    const url1 = `${apiBase}/methodologies?per_page=100&page=1`;
    console.log("[debug] Fetching:", url1);
    const res1 = await fetch(url1, { cache: "no-store", headers: { Accept: "application/json" } });
    console.log("[debug] Response:", res1.status, res1.statusText, "redirected:", res1.redirected, "url:", res1.url);

    if (!res1.ok) {
      return NextResponse.json({ error: `HTTP ${res1.status}`, url: url1 });
    }

    const data1 = await res1.json();
    const count1 = Array.isArray(data1) ? data1.length : "not-array";

    // Step 2: ページ2
    const url2 = `${apiBase}/methodologies?per_page=100&page=2`;
    const res2 = await fetch(url2, { cache: "no-store", headers: { Accept: "application/json" } });
    const data2 = await res2.json();
    const count2 = Array.isArray(data2) ? data2.length : "not-array";

    // Step 3: wpFetch と同じロジックを手動で実行
    const allPosts: unknown[] = [];
    let page = 1;
    const pageLog: string[] = [];
    while (true) {
      const pUrl = `${apiBase}/methodologies?per_page=100&page=${page}`;
      const pRes = await fetch(pUrl, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!pRes.ok) {
        pageLog.push(`page ${page}: HTTP ${pRes.status}`);
        break;
      }
      const pData = await pRes.json();
      const pCount = Array.isArray(pData) ? pData.length : 0;
      pageLog.push(`page ${page}: ${pCount} items`);
      if (Array.isArray(pData)) allPosts.push(...pData);
      if (pCount < 100) break;
      page++;
    }

    // Step 4: mapMethodology をテスト
    let mapResult: string;
    let mapCount: number;
    let mapSample: unknown = null;
    try {
      const { getMethodologies } = await import("@/lib/wordpress");
      const methodologies = await getMethodologies();
      mapCount = methodologies.length;
      mapResult = "success";
      if (methodologies.length > 0) {
        mapSample = { title: methodologies[0].title, registry: methodologies[0].registry };
      }
    } catch (e) {
      mapResult = `error: ${e instanceof Error ? e.message : String(e)}\n${e instanceof Error ? e.stack : ""}`;
      mapCount = 0;
    }

    return NextResponse.json({
      apiBase,
      page1: { url: url1, status: res1.status, count: count1, redirected: res1.redirected, finalUrl: res1.url },
      page2: { url: url2, status: res2.status, count: count2 },
      manualPagination: { totalPosts: allPosts.length, pages: pageLog },
      getMethodologies: { result: mapResult, count: mapCount, sample: mapSample },
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
  }
}
