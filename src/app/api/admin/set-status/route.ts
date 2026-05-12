import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase";
import type { SubscriptionStatus } from "@/lib/supabase";

// テスト用：サブスクリプション状態を直接 DB に書き込む
// 本番運用後は削除すること

const ADMIN_EMAIL = "hiroto.murayama@rechroma.co.jp";

const VALID_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "trial_expired",
  "canceled",
  "past_due",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status, trial_ends_at } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = createServiceClient();

  // trial_expired は DB には存在しない（computeStatus で動的に判定する）
  // 代わりに status=trialing + trial_ends_at を過去日にセットする
  let dbStatus = status;
  let dbTrialEndsAt: string | null = trial_ends_at ?? null;

  if (status === "trial_expired") {
    dbStatus = "trialing";
    dbTrialEndsAt = new Date(Date.now() - 1000).toISOString(); // 1秒前
  } else if (status === "trialing") {
    dbTrialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  const { error } = await db
    .from("subscriptions")
    .update({
      status: dbStatus,
      trial_ends_at: dbTrialEndsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_email", ADMIN_EMAIL);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 現在の DB 状態を返す
  const { data } = await db
    .from("subscriptions")
    .select("status, trial_ends_at, updated_at")
    .eq("user_email", ADMIN_EMAIL)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ ok: true, db: data, requestedStatus: status });
}
