import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { getSubscription } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://intelligence.carboncredits.jp";

  if (!session?.user?.email) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const sub = await getSubscription(session.user.email);
  if (!sub?.stripe_customer_id) {
    return NextResponse.redirect(`${baseUrl}/pricing`);
  }

  const stripe = getStripe();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: baseUrl,
  });

  return NextResponse.redirect(portalSession.url, 303);
}
