/**
 * レビュー待ちコンテンツを取得する API。
 * WordPress の下書き（draft）ステータスの insights を返す。
 * 認証付きリクエストが必要（下書きは公開APIでは取得不可）。
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "").replace(/\/+$/, "");
const WP_USER = process.env.WP_APP_USER ?? "";
const WP_PASS = process.env.WP_APP_PASSWORD ?? "";

export async function GET() {
  if (!API_BASE || !WP_USER || !WP_PASS) {
    return NextResponse.json({ drafts: [], error: "WordPress credentials not configured" });
  }

  try {
    const auth = `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
    const res = await fetch(
      `${API_BASE}/insights?status=draft&per_page=20&orderby=date&order=desc`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: auth,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ drafts: [], error: `WordPress API: ${res.status}` });
    }

    const posts = (await res.json()) as {
      id: number;
      title: { rendered: string };
      date: string;
      modified: string;
      acf?: Record<string, unknown> | unknown[];
    }[];

    const drafts = posts.map((p) => {
      const acf = p.acf && !Array.isArray(p.acf) ? p.acf : {};
      return {
        id: p.id,
        title: p.title.rendered.replace(/<[^>]*>/g, ""),
        category: typeof acf.insight_category === "string" ? acf.insight_category : null,
        createdAt: p.date,
        modifiedAt: p.modified,
        editUrl: `https://carboncreditsjp.wpcomstaging.com/wp-admin/post.php?post=${p.id}&action=edit`,
      };
    });

    return NextResponse.json({ drafts });
  } catch (e) {
    return NextResponse.json({
      drafts: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
