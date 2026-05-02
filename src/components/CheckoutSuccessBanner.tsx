"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

/**
 * 決済成功後（?checkout=success）にセッションをポーリングして
 * subscriptionStatus が active になったらダッシュボードへ遷移する。
 * Webhook の処理完了を待つため最大30秒（2秒×15回）リトライする。
 */
export function CheckoutSuccessBanner() {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("checkout") === "success";
  const { update } = useSession();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isSuccess) return;

    let cancelled = false;

    async function tryRefresh(count: number) {
      if (cancelled) return;
      setAttempt(count);

      const updated = await update();
      const subStatus = (updated as { subscriptionStatus?: string } | null)?.subscriptionStatus;

      if (subStatus === "active") {
        // オンボーディングも完了扱いにしてダッシュボードへ
        await fetch("/api/auth/complete-onboarding", { method: "POST" }).catch(() => {});
        window.location.href = "/";
        return;
      }

      if (count < 15) {
        setTimeout(() => tryRefresh(count + 1), 2000);
      } else {
        // 30秒待っても確認できない場合はリロード（Stripeサポートに問い合わせ案内）
        window.location.reload();
      }
    }

    tryRefresh(1);
    return () => { cancelled = true; };
  }, [isSuccess, update]);

  if (!isSuccess) return null;

  return (
    <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-sm text-emerald-800">
      <p className="font-semibold">ご登録ありがとうございます！</p>
      <p className="mt-1 text-emerald-600">
        有料プランを確認中です。そのままお待ちください
        {attempt > 1 ? `（${attempt}/15）` : ""}…
      </p>
    </div>
  );
}
