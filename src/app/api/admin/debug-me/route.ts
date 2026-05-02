import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase";

/** 現在のユーザーのStripe・Supabase状態を診断するデバッグエンドポイント */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const email = session.user.email;
  const db = createServiceClient();

  // Supabase の状態
  const { data: subRow } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_email", email)
    .single();

  const { data: userRow } = await db
    .from("users")
    .select("email, onboarding_completed, created_at")
    .eq("email", email)
    .single();

  // Stripe の状態
  let stripeData: Record<string, unknown> = { error: "Stripe not configured" };
  try {
    const stripe = getStripe();
    const customers = await stripe.customers.list({ email, limit: 5 });

    const customerDetails = await Promise.all(
      customers.data.map(async (c) => {
        const subs = await stripe.subscriptions.list({ customer: c.id, limit: 10 });
        return {
          id: c.id,
          email: c.email,
          created: new Date(c.created * 1000).toISOString(),
          subscriptions: subs.data.map((s) => ({
            id: s.id,
            status: s.status,
            // @ts-expect-error property name may vary by Stripe API version
            current_period_end: s.current_period_end ?? s.currentPeriodEnd ?? null,
          })),
        };
      })
    );

    stripeData = { customers: customerDetails };
  } catch (e) {
    stripeData = { error: String(e) };
  }

  return NextResponse.json({
    session: {
      email,
      subscriptionStatus: session.subscriptionStatus,
      onboardingCompleted: session.onboardingCompleted,
    },
    supabase: {
      user: userRow,
      subscription: subRow,
    },
    stripe: stripeData,
  });
}
