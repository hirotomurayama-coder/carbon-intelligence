import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

// Convenience re-export for use in route handlers
export { getStripe as stripe };

export const STRIPE_PRICE_ID = () => {
  if (!process.env.STRIPE_PRICE_ID) throw new Error("STRIPE_PRICE_ID is not set");
  return process.env.STRIPE_PRICE_ID;
};

export const STRIPE_WEBHOOK_SECRET = () => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return process.env.STRIPE_WEBHOOK_SECRET;
};
