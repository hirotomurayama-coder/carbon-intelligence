"use client";

import { useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const STANDALONE_ROUTES = ["/login", "/pricing", "/onboarding", "/tokushoho", "/api/auth"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isStandalone = STANDALONE_ROUTES.some((r) => pathname.startsWith(r));

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 flex-shrink-0
          transition-transform duration-200 ease-in-out
          lg:relative lg:h-full lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Suspense fallback={<div className="w-64 border-r border-gray-200 bg-white h-full" />}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </Suspense>
      </div>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
