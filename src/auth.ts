import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  upsertUser,
  getSubscription,
  computeStatus,
  getUserOnboarding,
} from "@/lib/supabase";

const SESSION_REFRESH_INTERVAL = 24 * 60 * 60; // 24 hours in seconds

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      checks: ["pkce", "state"], // "iss" check を除外（Googleは応答に iss を含まないため）
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      if (!user.email) return false;

      await upsertUser({
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        google_id: account.providerAccountId,
      });

      return true;
    },

    async jwt({ token, user, trigger }) {
      // On first sign-in or explicit refresh, load from DB
      const now = Math.floor(Date.now() / 1000);
      const lastRefreshed = (token.sessionLastRefreshed as number | undefined) ?? 0;
      const shouldRefresh =
        !!user || trigger === "update" || now - lastRefreshed > SESSION_REFRESH_INTERVAL;

      if (shouldRefresh && token.email) {
        const sub = await getSubscription(token.email);
        const onboarding = await getUserOnboarding(token.email);

        if (sub) {
          token.subscriptionStatus = computeStatus(sub);
          token.trialEndsAt = sub.trial_ends_at ?? undefined;
        } else {
          token.subscriptionStatus = "trial_expired";
        }
        token.onboardingCompleted = onboarding;
        token.sessionLastRefreshed = now;
      }

      return token;
    },

    async session({ session, token }) {
      session.subscriptionStatus = token.subscriptionStatus as string | undefined;
      session.trialEndsAt = token.trialEndsAt as string | undefined;
      session.onboardingCompleted = token.onboardingCompleted as boolean | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
