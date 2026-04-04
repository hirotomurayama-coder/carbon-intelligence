/**
 * Supabase DB セットアップスクリプト
 * 実行: npx tsx scripts/setup-supabase.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log("🔧 Supabase テーブルをセットアップ中...\n");

  // Check if tables already exist by querying them
  const { error: usersError } = await db.from("users").select("id").limit(1);
  const { error: subsError } = await db.from("subscriptions").select("id").limit(1);

  if (!usersError && !subsError) {
    console.log("✅ テーブルはすでに存在します");
    console.log("   users: OK");
    console.log("   subscriptions: OK");
    return;
  }

  if (usersError) {
    console.log("⚠️  users テーブルが見つかりません");
    console.log("   エラー:", usersError.message);
  }
  if (subsError) {
    console.log("⚠️  subscriptions テーブルが見つかりません");
    console.log("   エラー:", subsError.message);
  }

  console.log("\n📋 以下のSQLをSupabase SQLエディタで実行してください:");
  console.log("   https://supabase.com/dashboard/project/wcbsjwfrwdvsfmxosdfu/sql/new\n");
  console.log("─".repeat(60));
  console.log(`
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  google_id TEXT UNIQUE,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS を有効化（Service Role Key は bypass する）
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Service Role はすべてアクセス可能（デフォルトで true）
CREATE POLICY "service_role_all" ON public.users
  FOR ALL USING (true);
CREATE POLICY "service_role_all" ON public.subscriptions
  FOR ALL USING (true);
  `);
  console.log("─".repeat(60));
  console.log("\n✅ SQL実行後、再度このスクリプトを実行して確認してください");
}

main().catch(console.error);
