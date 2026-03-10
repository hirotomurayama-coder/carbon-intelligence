"use client";

import { useEffect, useCallback, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

/**
 * アクセシブルなモーダルダイアログ。
 * - ESC キーで閉じる
 * - 背景クリックで閉じる
 * - body のスクロールをロック
 */
export function Modal({ open, onClose, title, children }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          {title && (
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {/* コンテンツ */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
