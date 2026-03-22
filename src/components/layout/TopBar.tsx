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

export function TopBar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-700">
          U
        </div>
      </div>
    </header>
  );
}
