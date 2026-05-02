import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase";

/**
 * Stripe APIに直接問い合わせて支払い状態を確認し、Supabaseを更新する。
 * Webhookの未設定・遅延・失敗の回復手段として使用。
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // メールアドレスでStripeの顧客を検索
  const customers = await stripe.customers.list({ email, limit: 5 });
  if (customers.data.length === 0) {
    return NextResponse.json({ active: false, reason: "no_customer" });
  }

  // すべての顧客でアクティブなサブスクリプションを確認
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subs.data.length === 0) continue;

    const sub = subs.data[0];
    const db = createServiceClient();

    // Supabaseを更新（行がなければ作成）
    await db.from("subscriptions").upsert(
      {
        user_email: email,
        stripe_customer_id: customer.id,
        stripe_subscription_id: sub.id,
        status: "active",
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email" }
    );

    // オンボーディングも完了扱いにする
    await db.from("users").update({ onboarding_completed: true }).eq("email", email);

    return NextResponse.json({ active: true, customerId: customer.id });
  }

  return NextResponse.json({ active: false, reason: "no_active_subscription" });
}
