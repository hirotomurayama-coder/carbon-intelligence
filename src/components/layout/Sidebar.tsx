"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { NavIcon } from "./NavIcon";

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

interface SidebarProps {
  onClose?: () => void;
}

function TrialBadge() {
  const { data: session } = useSession();
  if (!session?.trialEndsAt || session.subscriptionStatus === "active") return null;

  const endsAt = new Date(session.trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  if (session.subscriptionStatus === "trial_expired" || daysLeft === 0) {
    return (
      <Link
        href="/pricing"
        className="mx-2 mb-2 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 transition"
      >
        <span className="font-medium">体験期間終了</span>
        <span className="font-semibold underline">アップグレード →</span>
      </Link>
    );
  }

  return (
    <Link
      href="/pricing"
      className="mx-2 mb-2 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-100 transition"
    >
      <span>無料体験中</span>
      <span className="font-semibold">{daysLeft}日残り</span>
    </Link>
  );
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openItem, setOpenItem] = useState<string | null>(() => getDefaultOpen(pathname));

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* ── Brand header ── */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 px-4 lg:h-16">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            C
          </div>
          <span className="text-sm font-semibold text-gray-900">{APP_NAME}</span>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition lg:hidden"
            aria-label="閉じる"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
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
                /* Accordion parent */
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
                  <span className="flex-1 truncate">{item.label}</span>
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
                /* Normal item */
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <NavIcon icon={item.icon} className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )}

              {/* Children (when open) */}
              {item.children && isOpen && (
                <div className="ml-3 mb-1 mt-0.5 space-y-0.5 border-l border-gray-100 pl-3">
                  {item.children.map((child) => {
                    const childActive = isChildActive(child.href, pathname, searchParams);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                          childActive
                            ? "bg-emerald-50/60 font-semibold text-emerald-700"
                            : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                        }`}
                      >
                        <span
                          className={`h-1 w-1 flex-shrink-0 rounded-full ${
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

      {/* ── Footer ── */}
      <div className="flex-shrink-0 border-t border-gray-200 px-2 py-3 space-y-2">
        <TrialBadge />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition"
        >
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          ログアウト
        </button>
        <Link
          href="/tokushoho"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
        >
          特定商取引法に基づく表記
        </Link>
        <Link
          href="/terms"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
        >
          サービス利用規約
        </Link>
        <p className="px-3 text-xs text-gray-400">v0.2.0</p>
        <p className="px-3 text-[10px] text-gray-300">
          運営会社：<a href="https://cradleto.com/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 underline">株式会社クレイドルトゥー</a>
        </p>
      </div>
    </aside>
  );
}
