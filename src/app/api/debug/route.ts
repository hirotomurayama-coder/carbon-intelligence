import { NextResponse } from "next/server";

export async function GET() {
  const apiBase =
    process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "(未設定)";

  const results: Record<string, unknown> = {
    apiBase,
    timestamp: new Date().toISOString(),
  };

  const endpoints = ["methodologies", "companies", "insights"];

  for (const cpt of endpoints) {
    try {
      const url = `${apiBase}/${cpt}?per_page=1`;
      const res = await fetch(url, { cache: "no-store", redirect: "follow" });
      const body = await res.text();
      let acfStatus = "unknown";
      try {
        const json = JSON.parse(body);
        if (Array.isArray(json) && json.length > 0) {
          const firstPost = json[0];
          if (Array.isArray(firstPost.acf) && firstPost.acf.length === 0) {
            acfStatus = "empty (ACF field groups not configured or no data)";
          } else if (firstPost.acf && typeof firstPost.acf === "object" && !Array.isArray(firstPost.acf)) {
            acfStatus = `populated (${Object.keys(firstPost.acf).length} fields)`;
          } else {
            acfStatus = "absent";
          }
        }
      } catch { /* parse failed */ }
      results[cpt] = {
        status: res.status,
        statusText: res.statusText,
        redirected: res.redirected,
        finalUrl: res.url,
        acfStatus,
        bodyPreview: body.slice(0, 500),
      };
    } catch (e) {
      results[cpt] = { error: String(e) };
    }
  }

  // Also check /types to see registered CPTs
  try {
    const url = `${apiBase}/types`;
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    const body = await res.text();
    results.types = {
      status: res.status,
      bodyPreview: body.slice(0, 1000),
    };
  } catch (e) {
    results.typesError = String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
