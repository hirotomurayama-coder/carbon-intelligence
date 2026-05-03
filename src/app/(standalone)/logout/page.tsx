"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

/**
 * /logout にアクセスするだけでログアウトして /login に遷移するページ。
 * pricing ページから抜け出せないときの脱出口として機能する。
 */
export default function LogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500 text-sm">ログアウト中...</p>
    </div>
  );
}
