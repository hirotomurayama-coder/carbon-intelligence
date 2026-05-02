import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase";

/**
 * Stripe APIに直接問い合わせて支払い状態を確認し、Supabaseを更新する。
 * Webhookの未設定・遅延・失敗の回復手段として使用。
 *
 * 検索順序:
 * 1. Supabaseに保存済みの stripe_customer_id を直接チェック
 * 2. メールアドレスで Stripe 顧客を検索
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const db = createServiceClient();

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // Supabaseに保存済みの stripe_customer_id を優先チェック
  const { data: subRecord } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_email", email)
    .single();

  const customerIdsToCheck: string[] = [];

  if (subRecord?.stripe_customer_id) {
    customerIdsToCheck.push(subRecord.stripe_customer_id);
  }

  // メールアドレスで追加検索
  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const c of customers.data) {
    if (!customerIdsToCheck.includes(c.id)) {
      customerIdsToCheck.push(c.id);
    }
  }

  // 全顧客のサブスクリプションを確認（active のみ）
  for (const customerId of customerIdsToCheck) {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subs.data.length === 0) continue;

    const sub = subs.data[0];

    // Supabase を更新（行がなければ作成）
    await db.from("subscriptions").upsert(
      {
        user_email: email,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email" }
    );

    // ユーザーレコードを upsert（存在しなければ作成）
    await db.from("users").upsert(
      { email, onboarding_completed: true },
      { onConflict: "email" }
    );

    return NextResponse.json({ active: true, customerId });
  }

  return NextResponse.json({
    active: false,
    reason: "no_active_subscription",
    checkedCustomers: customerIdsToCheck.length,
  });
}
