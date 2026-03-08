import { NextResponse } from "next/server";

export async function GET() {
  const publicApi = "https://public-api.wordpress.com/wp/v2/sites/carboncreditsjp.wordpress.com";
  const results: Record<string, unknown> = {
    API: publicApi,
  };

  // Test posts fetch
  try {
    const url = `${publicApi}/posts?per_page=1&_fields=id,title,categories`;
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.text();
    results.posts = {
      status: res.status,
      bodyPreview: body.slice(0, 300),
    };
  } catch (e) {
    results.postsError = String(e);
  }

  // Test glossary (category 15) fetch
  try {
    const url = `${publicApi}/posts?per_page=1&categories=15&_fields=id,title`;
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.text();
    results.glossary = {
      status: res.status,
      bodyPreview: body.slice(0, 300),
    };
  } catch (e) {
    results.glossaryError = String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
