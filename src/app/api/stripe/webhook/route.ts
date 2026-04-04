import { NextRequest, NextResponse } from "next/server";
import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET());
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.metadata?.user_email;
      const subscriptionId = session.subscription as string;
      if (!email || !subscriptionId) break;

      await db
        .from("subscriptions")
        .update({
          stripe_subscription_id: subscriptionId,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_email", email);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      if (customer.deleted) break;

      const email = (customer as Stripe.Customer).email;
      if (!email) break;

      const status = mapStripeStatus(sub.status);

      await db
        .from("subscriptions")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("user_email", email);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      if (customer.deleted) break;

      const email = (customer as Stripe.Customer).email;
      if (!email) break;

      await db
        .from("subscriptions")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("user_email", email);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customer = await stripe.customers.retrieve(invoice.customer as string);
      if (customer.deleted) break;

      const email = (customer as Stripe.Customer).email;
      if (!email) break;

      await db
        .from("subscriptions")
        .update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("user_email", email);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":   return "active";
    case "past_due": return "past_due";
    case "canceled": return "canceled";
    case "trialing": return "trialing";
    default:         return "canceled";
  }
}
