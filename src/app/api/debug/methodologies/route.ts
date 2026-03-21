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

    // Step 3: getMethodologies を呼ぶ
    let gmResult: string;
    let gmCount: number;
    try {
      const { getMethodologies } = await import("@/lib/wordpress");
      const methodologies = await getMethodologies();
      gmCount = methodologies.length;
      gmResult = "success";
    } catch (e) {
      gmResult = `error: ${e instanceof Error ? e.message : String(e)}`;
      gmCount = 0;
    }

    return NextResponse.json({
      apiBase,
      page1: { url: url1, status: res1.status, count: count1, redirected: res1.redirected, finalUrl: res1.url },
      page2: { url: url2, status: res2.status, count: count2 },
      getMethodologies: { result: gmResult, count: gmCount },
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
  }
}
