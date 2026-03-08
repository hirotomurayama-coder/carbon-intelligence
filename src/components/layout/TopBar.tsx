"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";

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

        {/* 通知ベル */}
        <button
          type="button"
          className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
            />
          </svg>
        </button>

        {/* ユーザーアバター */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-700">
          U
        </div>
      </div>
    </header>
  );
}
