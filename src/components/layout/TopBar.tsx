"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { NotificationBell } from "@/components/NotificationBell";

function getPageTitle(pathname: string): string {
  for (const nav of NAV_ITEMS) {
    if (nav.children) {
      const child = nav.children.find((c) => pathname.startsWith(c.href));
      if (child) return child.label;
    }
    const match = nav.href === "/" ? pathname === "/" : pathname.startsWith(nav.href);
    if (match) return nav.label;
  }
  return "ページ";
}

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:h-16 lg:px-6">
      <div className="flex items-center gap-3">
        {/* ── Hamburger (mobile only) ── */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition lg:hidden"
          aria-label="メニューを開く"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900 lg:text-xl">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-700">
          U
        </div>
      </div>
    </header>
  );
}
