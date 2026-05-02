"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

/**
 * 支払い済みなのにpricingページに留まっているユーザー向けの回復ボタン。
 * Webhookに頼らずStripe APIに直接問い合わせてSupabaseを更新してからセッションを再取得する。
 */
export function PricingRefreshButton() {
  const { update } = useSession();
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleCheck() {
    setChecking(true);
    setFailed(false);

    // Step 1: Stripe API直接検証 → Supabase更新
    await fetch("/api/stripe/verify-payment", { method: "POST" }).catch(() => {});

    // Step 2: JWTセッションをDBから再取得
    const updated = await update();
    const subStatus = (updated as { subscriptionStatus?: string } | null)?.subscriptionStatus;

    if (subStatus === "active") {
      window.location.href = "/";
    } else {
      setChecking(false);
      setFailed(true);
    }
  }

  return (
    <div className="mt-6 text-center">
      {failed && (
        <p className="mb-2 text-xs text-amber-600">
          Stripeでの支払いが確認できませんでした。
          <br />Stripeダッシュボードでサブスクリプションの状態をご確認ください。
        </p>
      )}
      <button
        onClick={handleCheck}
        disabled={checking}
        className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50 transition"
      >
        {checking ? "Stripeで確認中..." : "支払い完了後にアクセスできない方はこちら"}
      </button>
    </div>
  );
}
