import { NextResponse } from "next/server";

/**
 * GET /api/updates — 最近の同期通知を取得
 *
 * insights CPT から「同期通知」に該当するインサイトを取得して返す。
 * 同期エンジンが作成した通知投稿のタイトルには「【レジストリ名】」が含まれる。
 */
export async function GET() {
  const API_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";

  if (!API_BASE) {
    return NextResponse.json({
      notifications: [],
      total: 0,
    });
  }

  try {
    // insights CPT から最新20件を取得
    const url = `${API_BASE}/insights?per_page=20&orderby=date&order=desc`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error(`[API /updates] WordPress returned ${res.status}`);
      return NextResponse.json({ notifications: [], total: 0 });
    }

    type WPInsight = {
      id: number;
      date: string;
      title: { rendered: string };
      content: { rendered: string };
      acf?: Record<string, unknown> | unknown[];
    };

    const posts: WPInsight[] = await res.json();

    // 同期通知をフィルタ（タイトルに【】を含むもの）
    const notifications = posts
      .filter((p) => {
        const title = stripHtml(p.title.rendered);
        return title.includes("【") && title.includes("】");
      })
      .map((p) => {
        const title = stripHtml(p.title.rendered);
        const registryMatch = title.match(/【(.+?)】/);
        const registry = registryMatch ? registryMatch[1] : "不明";
        const isNew =
          title.includes("新規追加") || title.includes("が追加");
        const isUpdate =
          title.includes("更新") || title.includes("アップデート");

        return {
          id: String(p.id),
          title,
          description: stripHtml(p.content.rendered).slice(0, 200),
          registry,
          date: p.date ? p.date.slice(0, 10) : "",
          type: isNew ? "new" : isUpdate ? "updated" : "info",
        };
      });

    return NextResponse.json({
      notifications,
      total: notifications.length,
    });
  } catch (e) {
    console.error("[API /updates] Error:", e);
    return NextResponse.json({ notifications: [], total: 0 });
  }
}

/** HTML タグを除去 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
