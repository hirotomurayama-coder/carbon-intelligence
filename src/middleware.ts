import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔓 一時的にログイン不要モード（Stripeレビュー対応）
// 復活させるには: AUTH_DISABLED を false に変更してpush
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const AUTH_DISABLED = true;

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/pricing", "/onboarding", "/tokushoho", "/api/auth", "/api/stripe/webhook"];

export default auth((req: NextAuthRequest) => {
  // 🔓 一時停止中: すべてのリクエストを通す
  if (AUTH_DISABLED) return NextResponse.next();

  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const session = req.auth;

  // Always allow public routes and static assets
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Not authenticated → /login
  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Subscription expired/canceled/past_due → /pricing
  const status = session.subscriptionStatus;
  const needsUpgrade =
    status === "trial_expired" || status === "canceled" || status === "past_due";

  if (needsUpgrade) {
    return NextResponse.redirect(new URL("/pricing", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
