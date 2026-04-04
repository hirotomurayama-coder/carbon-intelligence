import { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    subscriptionStatus?: string;
    trialEndsAt?: string;
    onboardingCompleted?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    subscriptionStatus?: string;
    trialEndsAt?: string;
    onboardingCompleted?: boolean;
    sessionLastRefreshed?: number;
  }
}
