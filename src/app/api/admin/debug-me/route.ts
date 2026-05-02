import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { createServiceClient, upsertSubscription } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const email = session.user.email;
  const db = createServiceClient();

  // 1. 現在のレコード読み取り
  const { data: subRow, error: subReadErr } = await db
    .from("subscriptions").select("*").eq("user_email", email).single();
  const { data: userRow, error: userReadErr } = await db
    .from("users").select("email, onboarding_completed, created_at").eq("email", email).single();

  // 2. users書き込みテスト（実際のupsertUserと同じ操作）
  const { error: writeUserErr } = await db.from("users").upsert(
    { email, name: session.user.name ?? null, image: session.user.image ?? null },
    { onConflict: "email" }
  );

  // 3. subscriptions書き込みテスト
  const { error: writeSubErr } = await upsertSubscription({ user_email: email, status: "trialing" });

  // 4. Stripe状態
  let stripeData: Record<string, unknown> = { skipped: true };
  try {
    const stripe = getStripe();
    const customers = await stripe.customers.list({ email, limit: 5 });
    stripeData = {
      customerCount: customers.data.length,
      customers: await Promise.all(customers.data.map(async (c) => {
        const subs = await stripe.subscriptions.list({ customer: c.id, limit: 5 });
        return { id: c.id, created: new Date(c.created * 1000).toISOString(),
          subscriptions: subs.data.map((s) => ({ id: s.id, status: s.status })) };
      })),
    };
  } catch (e) { stripeData = { error: String(e) }; }

  return NextResponse.json({
    email,
    sessionStatus: session.subscriptionStatus,
    supabase: {
      reads: {
        user: userRow ?? null,
        userReadError: userReadErr?.message ?? null,
        subscription: subRow ?? null,
        subReadError: subReadErr?.message ?? null,
      },
      writes: {
        userWriteError: writeUserErr ? { message: writeUserErr.message, code: writeUserErr.code, details: writeUserErr.details, hint: writeUserErr.hint } : null,
        subWriteError: writeSubErr ?? null,
      },
    },
    stripe: stripeData,
  });
}
