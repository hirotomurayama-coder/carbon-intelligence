"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "@/types/navigation";

/** URL から pathname と query を分解 */
function splitHref(href: string) {
  const [path, query] = href.split("?");
  return { path, query: query ?? "" };
}

/** 子項目がアクティブかどうか（query param 対応） */
function isChildActive(
  childHref: string,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>
): boolean {
  const { path, query } = splitHref(childHref);
  if (!pathname.startsWith(path)) return false;
  if (!query) return true;
  // クエリパラメータを比較
  const childParams = new URLSearchParams(query);
  for (const [k, v] of childParams.entries()) {
    if (searchParams.get(k) !== v) return false;
  }
  return true;
}

/** 親項目がアクティブかどうか */
function isItemActive(item: NavItem, pathname: string, searchParams: ReturnType<typeof useSearchParams>): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.children?.some((c) => isChildActive(c.href, pathname, searchParams))) return true;
  return pathname.startsWith(item.href);
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
          const active = isItemActive(item, pathname, searchParams);

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active && !item.children
                    ? "bg-emerald-50 text-emerald-700"
                    : active && item.children
                      ? "text-emerald-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <NavIcon icon={item.icon} className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>

              {item.children && (
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
                        {childActive && (
                          <span className="h-1 w-1 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                        {!childActive && (
                          <span className="h-1 w-1 rounded-full bg-gray-200 flex-shrink-0" />
                        )}
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
