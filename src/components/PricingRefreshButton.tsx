"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

/**
 * 支払い済みなのにpricingページに留まっているユーザー向けの回復ボタン。
 * update() でセッションをDBから再取得し、active であればダッシュボードへ遷移する。
 */
export function PricingRefreshButton() {
  const { update } = useSession();
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleCheck() {
    setChecking(true);
    setFailed(false);
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
          支払いがまだ確認できません。数分後に再度お試しください。
          <br />解決しない場合はサポートにお問い合わせください。
        </p>
      )}
      <button
        onClick={handleCheck}
        disabled={checking}
        className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50 transition"
      >
        {checking ? "確認中..." : "支払い完了後にアクセスできない方はこちら"}
      </button>
    </div>
  );
}
