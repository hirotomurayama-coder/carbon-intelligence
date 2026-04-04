import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { completeOnboarding } from "@/lib/supabase";

export async function POST() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await completeOnboarding(session.user.email);

  return NextResponse.json({ ok: true });
}
