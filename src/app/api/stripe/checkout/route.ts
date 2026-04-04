import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, STRIPE_PRICE_ID } from "@/lib/stripe";
import { getSubscription, createServiceClient } from "@/lib/supabase";

export async function POST() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.redirect("/login");
  }

  const email = session.user.email;
  const stripe = getStripe();

  // Get or create Stripe customer
  const sub = await getSubscription(email);
  let customerId = sub?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: session.user.name ?? undefined,
    });
    customerId = customer.id;

    // Save customer ID to Supabase
    const db = createServiceClient();
    await db
      .from("subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("user_email", email);
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: STRIPE_PRICE_ID(),
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/?checkout=success`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: { user_email: email },
  });

  return NextResponse.redirect(checkoutSession.url!, 303);
}
