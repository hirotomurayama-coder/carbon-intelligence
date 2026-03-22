"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { NavIcon } from "./NavIcon";
import { SubNavIcon } from "./SubNavIcon";
import type { NavItem } from "@/types/navigation";

function isItemActive(href: string, pathname: string, item: NavItem): boolean {
  if (href === "/") return pathname === "/";
  if (item.children?.some((c) => pathname.startsWith(c.href))) return true;
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
          C
        </div>
        <span className="text-lg font-semibold text-gray-900">{APP_NAME}</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isItemActive(item.href, pathname, item);

          return (
            <div key={item.href}>
              <Link
                href={item.children ? item.children[0].href : item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <NavIcon icon={item.icon} />
                {item.label}
              </Link>

              {item.children && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {item.children.map((child) => {
                    const childActive = pathname.startsWith(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                          childActive
                            ? "font-medium text-emerald-700 bg-emerald-50/50"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {child.icon && <SubNavIcon icon={child.icon} active={childActive} />}
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

      <div className="border-t border-gray-200 px-6 py-4">
        <p className="text-xs text-gray-400">v0.2.0</p>
      </div>
    </aside>
  );
}
