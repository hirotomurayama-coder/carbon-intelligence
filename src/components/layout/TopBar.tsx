"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { NotificationBell } from "@/components/NotificationBell";

/** パスからページタイトルを取得（子メニュー対応） */
function getPageTitle(pathname: string): string {
  for (const nav of NAV_ITEMS) {
    // 子メニューを先にチェック
    if (nav.children) {
      const child = nav.children.find((c) => pathname.startsWith(c.href));
      if (child) return child.label;
    }
    const match = nav.href === "/" ? pathname === "/" : pathname.startsWith(nav.href);
    if (match) return nav.label;
  }
  return "ページ";
}

/**
 * トップバー。
 * 現在のページ名と検索バー、ユーザーアバターを表示。
 */
export function TopBar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* ページタイトル */}
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        {/* 検索バー */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="検索..."
            className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* 通知ベル（同期更新通知） */}
        <NotificationBell />

        {/* ユーザーアバター */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-700">
          U
        </div>
      </div>
    </header>
  );
}
