"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 決済成功後（?checkout=success）にセッションを強制リフレッシュし、
 * subscriptionStatus を active に更新してダッシュボードに戻す。
 */
export function CheckoutSuccessBanner() {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("checkout") === "success";
  const { update } = useSession();
  const router = useRouter();
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    if (!isSuccess || refreshed) return;

    // セッションを強制更新してSupabaseの最新状態を取得
    update({ force: true }).then(() => {
      setRefreshed(true);
      // URLからcheckoutパラメータを除去
      router.replace("/");
    });
  }, [isSuccess, refreshed, update, router]);

  if (!isSuccess) return null;

  return (
    <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-sm text-emerald-800">
      <p className="font-semibold">🎉 ご登録ありがとうございます！</p>
      <p className="mt-1 text-emerald-600">有料プランが有効になりました。すべての機能をご利用いただけます。</p>
    </div>
  );
}
