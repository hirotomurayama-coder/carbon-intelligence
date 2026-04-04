import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client (service role — bypasses RLS)
export function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Public client (anon key — respects RLS)
export function createAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// ── DB helpers ─────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "trial_expired"
  | "canceled"
  | "past_due";

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  google_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface SubscriptionRecord {
  id: string;
  user_email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Upsert user on first login. Also creates a trialing subscription record.
 */
export async function upsertUser(params: {
  email: string;
  name: string | null;
  image: string | null;
  google_id: string;
}): Promise<void> {
  const db = createServiceClient();

  const { error: userError } = await db.from("users").upsert(
    {
      email: params.email,
      name: params.name,
      image: params.image,
      google_id: params.google_id,
    },
    { onConflict: "email", ignoreDuplicates: false }
  );
  if (userError) throw userError;

  // Create trial subscription only if one doesn't exist
  const { data: existing } = await db
    .from("subscriptions")
    .select("id")
    .eq("user_email", params.email)
    .single();

  if (!existing) {
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: subError } = await db.from("subscriptions").insert({
      user_email: params.email,
      status: "trialing",
      trial_ends_at: trialEndsAt,
    });
    if (subError) throw subError;
  }
}

/**
 * Get subscription record for a user email.
 */
export async function getSubscription(
  email: string
): Promise<SubscriptionRecord | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_email", email)
    .single();
  if (error) return null;
  return data as SubscriptionRecord;
}

/**
 * Compute effective subscription status (handles trial expiry).
 */
export function computeStatus(sub: SubscriptionRecord): SubscriptionStatus {
  if (sub.status === "trialing") {
    if (sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) {
      return "trial_expired";
    }
  }
  return sub.status;
}

/**
 * Get user onboarding status.
 */
export async function getUserOnboarding(email: string): Promise<boolean> {
  const db = createServiceClient();
  const { data } = await db
    .from("users")
    .select("onboarding_completed")
    .eq("email", email)
    .single();
  return data?.onboarding_completed ?? false;
}

/**
 * Mark onboarding as completed.
 */
export async function completeOnboarding(email: string): Promise<void> {
  const db = createServiceClient();
  await db
    .from("users")
    .update({ onboarding_completed: true })
    .eq("email", email);
}
