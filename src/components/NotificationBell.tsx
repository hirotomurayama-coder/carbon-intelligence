"use client";

import { useEffect, useState, useRef } from "react";

type Notification = {
  id: string;
  title: string;
  description: string;
  registry: string;
  date: string;
  type: "new" | "updated" | "info";
};

/**
 * 通知ベルアイコン。
 * TopBar に配置し、未読の同期通知をドロップダウンで表示する。
 */
export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/updates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications.slice(0, 5));
        }
      })
      .catch(() => {});
  }, []);

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => n.type === "new").length;

  return (
    <div ref={ref} className="relative">
      {/* ベルボタン */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {/* 未読バッジ */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ドロップダウン */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">通知</p>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-400">
              通知はありません
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="border-b border-gray-50 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-start gap-2">
                    {n.type === "new" && (
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    )}
                    {n.type === "updated" && (
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    )}
                    {n.type === "info" && (
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 line-clamp-2">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        {n.registry} / {n.date}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
