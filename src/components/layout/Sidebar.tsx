"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "@/types/navigation";

function splitHref(href: string) {
  const [path, query] = href.split("?");
  return { path, query: query ?? "" };
}

function isChildActive(
  childHref: string,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>
): boolean {
  const { path, query } = splitHref(childHref);
  if (!pathname.startsWith(path)) return false;
  if (!query) return true;
  const childParams = new URLSearchParams(query);
  for (const [k, v] of childParams.entries()) {
    if (searchParams.get(k) !== v) return false;
  }
  return true;
}

function getDefaultOpen(pathname: string): string | null {
  return NAV_ITEMS.find(
    (item) =>
      item.children &&
      (pathname.startsWith(item.href) ||
        item.children.some((c) => pathname.startsWith(c.href.split("?")[0])))
  )?.href ?? null;
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openItem, setOpenItem] = useState<string | null>(() => getDefaultOpen(pathname));

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
          C
        </div>
        <span className="text-base font-semibold text-gray-900">{APP_NAME}</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isOpen = openItem === item.href;
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          const hasActiveChild = item.children?.some((c) =>
            isChildActive(c.href, pathname, searchParams)
          );

          return (
            <div key={item.href}>
              {item.children ? (
                /* アコーディオン親項目: クリックで開閉 + ページ遷移 */
                <Link
                  href={item.href}
                  onClick={() =>
                    setOpenItem((prev) => (prev === item.href ? null : item.href))
                  }
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive || hasActiveChild
                      ? "text-emerald-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <NavIcon icon={item.icon} className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <svg
                    className={`h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </Link>
              ) : (
                /* 通常項目 */
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <NavIcon icon={item.icon} className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              )}

              {/* サブ項目（開いているときのみ表示） */}
              {item.children && isOpen && (
                <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-gray-100 pl-3">
                  {item.children.map((child) => {
                    const childActive = isChildActive(child.href, pathname, searchParams);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                          childActive
                            ? "font-semibold text-emerald-700 bg-emerald-50/60"
                            : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full flex-shrink-0 ${
                            childActive ? "bg-emerald-500" : "bg-gray-200"
                          }`}
                        />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 px-5 py-4">
        <p className="text-xs text-gray-400">v0.2.0</p>
      </div>
    </aside>
  );
}
