import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { createServiceClient, upsertSubscription } from "@/lib/supabase";

/**
 * Supabaseのuser/subscriptionレコードを強制作成し、Stripeと同期する。
 * 緊急回復用エンドポイント。
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const email = session.user.email;
  const db = createServiceClient();

  // Step 1: usersテーブルにレコードを確保
  const { error: userError } = await db.from("users").upsert(
    {
      email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
      onboarding_completed: true,
    },
    { onConflict: "email" }
  );

  // Step 2: Stripeで実際のサブスクリプション状態を確認
  let stripeStatus: string | null = null;
  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;

  try {
    const stripe = getStripe();

    // 既存のSupabaseレコードからcustomer_idを取得
    const { data: subRecord } = await db
      .from("subscriptions").select("stripe_customer_id").eq("user_email", email).single();

    const customerIdsToCheck: string[] = [];
    if (subRecord?.stripe_customer_id) customerIdsToCheck.push(subRecord.stripe_customer_id);

    // メールでも追加検索（上限20件）
    const customers = await stripe.customers.list({ email, limit: 20 });
    for (const c of customers.data) {
      if (!customerIdsToCheck.includes(c.id)) customerIdsToCheck.push(c.id);
    }

    // アクティブなサブスクリプションを探す
    for (const customerId of customerIdsToCheck) {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      if (subs.data.length > 0) {
        stripeStatus = "active";
        stripeCustomerId = customerId;
        stripeSubscriptionId = subs.data[0].id;
        break;
      }
    }
  } catch {
    // Stripe設定なしの場合はスキップ
  }

  // Step 3: subscriptionsテーブルを更新（UNIQUE制約なしでも動作）
  const { error: subError } = await upsertSubscription({
    user_email: email,
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
    status: (stripeStatus ?? "active") as "active",
  });

  return NextResponse.json({
    email,
    errors: {
      user: userError?.message ?? null,
      subscription: subError,
    },
    stripeFound: stripeStatus !== null,
    status: stripeStatus ?? "active (forced)",
    message: (!userError && !subError)
      ? "成功。pricingページの「支払い完了後にアクセスできない方はこちら」を押してセッションを更新してください。"
      : "エラーあり。errorsフィールドを確認してください。",
  });
}
