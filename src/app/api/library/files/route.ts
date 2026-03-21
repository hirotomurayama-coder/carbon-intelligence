/**
 * ライブラリ ファイル一覧 API
 *
 * GET /api/library/files → { files: DriveFile[] }
 */

import { NextResponse } from "next/server";
import { listFiles } from "@/lib/google-drive";

export async function GET() {
  try {
    const files = await listFiles();
    return NextResponse.json({ files });
  } catch (e) {
    console.error("[API /library/files] エラー:", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, files: [] }, { status: 500 });
  }
}
