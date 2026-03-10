import { NextResponse } from "next/server";

/**
 * GET /api/updates — 最近更新されたメソドロジーを取得
 *
 * methodologies CPT の modified 日時を元に、最近更新されたメソドロジーを返す。
 * ※ 以前は insights CPT の同期通知を返していたが、
 *   通知は insights に投稿しない方針に変更。
 */
export async function GET() {
  const API_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";

  if (!API_BASE) {
    return NextResponse.json({
      updates: [],
      total: 0,
    });
  }

  try {
    const url = `${API_BASE}/methodologies?per_page=15&orderby=modified&order=desc`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error(`[API /updates] WordPress returned ${res.status}`);
      return NextResponse.json({ updates: [], total: 0 });
    }

    type WPMethodology = {
      id: number;
      date: string;
      modified: string;
      title: { rendered: string };
      acf?: Record<string, unknown> | unknown[];
    };

    const posts: WPMethodology[] = await res.json();

    const updates = posts.map((p) => {
      const title = stripHtml(p.title.rendered);
      let registry = "不明";
      let syncedAt: string | null = null;

      if (
        p.acf &&
        !Array.isArray(p.acf) &&
        typeof p.acf === "object"
      ) {
        const reg = p.acf.registry;
        if (typeof reg === "string" && reg) registry = reg;
        const sa = p.acf.synced_at;
        if (typeof sa === "string" && sa) syncedAt = sa;
      }

      return {
        id: String(p.id),
        title,
        registry,
        syncedAt,
        modifiedAt: p.modified ?? p.date,
      };
    });

    return NextResponse.json({
      updates,
      total: updates.length,
    });
  } catch (e) {
    console.error("[API /updates] Error:", e);
    return NextResponse.json({ updates: [], total: 0 });
  }
}

/** HTML タグを除去 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
