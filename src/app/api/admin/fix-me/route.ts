import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase";

/**
 * 現在ログイン中のユーザーのSupabaseレコードを強制作成し、status=activeにする。
 * upsertUserが失敗してレコードが存在しない場合の回復用。
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const email = session.user.email;
  const db = createServiceClient();

  // usersテーブルに強制upsert
  const { error: userError } = await db.from("users").upsert(
    {
      email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
      onboarding_completed: true,
    },
    { onConflict: "email" }
  );

  // subscriptionsテーブルに強制upsert（status: active）
  const { error: subError } = await db.from("subscriptions").upsert(
    {
      user_email: email,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_email" }
  );

  return NextResponse.json({
    email,
    userError: userError?.message ?? null,
    subError: subError?.message ?? null,
    message: (!userError && !subError)
      ? "成功。次のURLでセッションを更新してください: /api/admin/refresh-session"
      : "エラーあり。上のエラーメッセージを確認してください。",
  });
}
