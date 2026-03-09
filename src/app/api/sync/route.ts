import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync/sync-engine";
import type { RegistryName } from "@/types";

/**
 * POST /api/sync — メソドロジー同期を手動トリガー
 *
 * Headers:
 *   Authorization: Bearer {SYNC_API_KEY} (任意、設定時のみ検証)
 *
 * Body (JSON):
 *   { registry?: RegistryName, dryRun?: boolean }
 *
 * Returns: SyncRunResult
 */
export async function POST(request: Request) {
  // API キー認証（SYNC_API_KEY が設定されている場合のみ）
  const expectedKey = process.env.SYNC_API_KEY;
  if (expectedKey) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  // WordPress 書き込み認証の確認
  if (!process.env.WP_APP_USER || !process.env.WP_APP_PASSWORD) {
    return NextResponse.json(
      {
        error:
          "WP_APP_USER と WP_APP_PASSWORD 環境変数が設定されていません。",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const registry = body.registry as RegistryName | undefined;
    const dryRun = body.dryRun === true;

    const result = await runSync(registry, dryRun);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[API /sync] Error:", e);
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
