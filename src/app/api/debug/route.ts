import { NextResponse } from "next/server";

export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "(not set)";
  const results: Record<string, unknown> = {
    API_BASE: apiBase,
    isConfigured: apiBase !== "" && !apiBase.includes("example.com"),
  };

  // Test posts fetch
  try {
    const url = `${apiBase}/posts?per_page=1&_fields=id,title`;
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    const body = await res.text();
    results.posts = {
      status: res.status,
      statusText: res.statusText,
      redirected: res.redirected,
      finalUrl: res.url,
      bodyPreview: body.slice(0, 500),
    };
  } catch (e) {
    results.postsError = String(e);
  }

  // Test glossary fetch
  try {
    const url = `${apiBase}/glossary?per_page=1&_fields=id,title`;
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    const body = await res.text();
    results.glossary = {
      status: res.status,
      statusText: res.statusText,
      redirected: res.redirected,
      finalUrl: res.url,
      bodyPreview: body.slice(0, 500),
    };
  } catch (e) {
    results.glossaryError = String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
