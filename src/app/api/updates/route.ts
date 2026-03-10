import { NextResponse } from "next/server";

/**
 * GET /api/updates — 最近更新されたメソドロジーを取得
 *
 * methodologies CPT の external_last_updated（外部サイト側の更新日）を基準に、
 * 最近更新されたメソドロジーを返す。
 * external_last_updated が空のものは末尾に配置。
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
      let externalLastUpdated: string | null = null;

      if (
        p.acf &&
        !Array.isArray(p.acf) &&
        typeof p.acf === "object"
      ) {
        const reg = p.acf.registry;
        if (typeof reg === "string" && reg) registry = reg;
        const elu = p.acf.external_last_updated;
        if (typeof elu === "string" && elu) externalLastUpdated = elu;
      }

      return {
        id: String(p.id),
        title,
        registry,
        externalLastUpdated,
        modifiedAt: p.modified ?? p.date,
      };
    });

    // external_last_updated でソート（日付あり → 新しい順、日付なし → 末尾）
    updates.sort((a, b) => {
      if (a.externalLastUpdated && b.externalLastUpdated) {
        return b.externalLastUpdated.localeCompare(a.externalLastUpdated);
      }
      if (a.externalLastUpdated && !b.externalLastUpdated) return -1;
      if (!a.externalLastUpdated && b.externalLastUpdated) return 1;
      return 0;
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
