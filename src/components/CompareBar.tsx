"use client";

import { useCompare } from "./CompareContext";
import Link from "next/link";

/** 画面下部に固定表示される比較バー */
export function CompareBar() {
  const { items, remove, clear } = useCompare();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-200 bg-emerald-50 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-emerald-800">
            比較 ({items.length}/3)
          </span>
          <div className="flex flex-wrap gap-2">
            {items.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm"
              >
                <span className="max-w-[150px] truncate">
                  {m.titleJa ?? m.title}
                </span>
                <button
                  onClick={() => remove(m.id)}
                  className="ml-0.5 text-gray-400 hover:text-red-500 transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clear}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition"
          >
            クリア
          </button>
          {items.length >= 2 && (
            <Link
              href={`/methodologies/compare?ids=${items.map((m) => m.id).join(",")}`}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"
            >
              比較する
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
