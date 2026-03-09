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
      results[cpt] = {
        status: res.status,
        statusText: res.statusText,
        redirected: res.redirected,
        finalUrl: res.url,
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
