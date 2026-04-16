"use client";

import { useState } from "react";

export type ChangeType = "revision" | "new" | "rule_update" | "consultation" | "status_change";

export interface UpdateEntry {
  id: string;
  date: string;
  registry: string;
  code: string | null;
  titleJa: string;
  changeType: ChangeType;
  description: string | null;
  url: string;
  autoUpdated: boolean;
}

interface Props {
  updates: UpdateEntry[];
  lastChecked: string;
}

// ── バッジ設定 ────────────────────────────────────────────────────

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; bg: string; text: string }> = {
  revision:      { label: "改定",     bg: "bg-blue-50",   text: "text-blue-600" },
  new:           { label: "新規制定", bg: "bg-emerald-50", text: "text-emerald-600" },
  rule_update:   { label: "ルール更新", bg: "bg-amber-50",  text: "text-amber-600" },
  consultation:  { label: "意見募集", bg: "bg-purple-50",  text: "text-purple-600" },
  status_change: { label: "ステータス変更", bg: "bg-gray-100", text: "text-gray-500" },
};

const REGISTRY_COLOR: Record<string, string> = {
  "J-Credit":      "bg-sky-100 text-sky-700",
  "Verra":         "bg-emerald-100 text-emerald-700",
  "Gold Standard": "bg-amber-100 text-amber-700",
  "CDM":           "bg-gray-100 text-gray-600",
  "CAR":           "bg-rose-100 text-rose-700",
  "ACR":           "bg-indigo-100 text-indigo-700",
  "Puro.earth":    "bg-teal-100 text-teal-700",
};

function registryColor(registry: string) {
  return REGISTRY_COLOR[registry] ?? "bg-gray-100 text-gray-600";
}

function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (diff === 0) return "今日";
  if (diff === 1) return "昨日";
  if (diff < 7) return `${diff}日前`;
  if (diff < 30) return `${Math.floor(diff / 7)}週間前`;
  if (diff < 365) return `${Math.floor(diff / 30)}ヶ月前`;
  return `${Math.floor(diff / 365)}年前`;
}

// ── コンポーネント ─────────────────────────────────────────────────

export function MethodologyUpdateFeed({ updates, lastChecked }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (updates.length === 0) return null;

  const displayed = expanded ? updates : updates.slice(0, 5);
  const hasMore = updates.length > 5;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-orange-500">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-[11px] font-bold tracking-wide text-gray-800">最近のメソドロジー更新</h2>
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-semibold text-orange-600">
            {updates.length}件
          </span>
        </div>
        <span className="text-[9px] text-gray-300">最終確認: {lastChecked}</span>
      </div>

      {/* 更新リスト */}
      <div className="divide-y divide-gray-50">
        {displayed.map((entry) => {
          const typeConf = CHANGE_TYPE_CONFIG[entry.changeType] ?? CHANGE_TYPE_CONFIG.rule_update;
          return (
            <a
              key={entry.id}
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 px-4 py-2.5 transition hover:bg-gray-50/70"
            >
              {/* 日付 */}
              <div className="w-16 flex-shrink-0 pt-0.5">
                <p className="text-[10px] font-medium text-gray-800">{entry.date.slice(5).replace("-", "/")}</p>
                <p className="text-[9px] text-gray-300">{daysAgo(entry.date)}</p>
              </div>

              {/* バッジ群 */}
              <div className="flex flex-shrink-0 flex-col gap-1 pt-0.5">
                <span className={`inline-block rounded px-1.5 py-px text-[9px] font-semibold ${registryColor(entry.registry)}`}>
                  {entry.registry}
                </span>
                <span className={`inline-block rounded px-1.5 py-px text-[9px] font-semibold ${typeConf.bg} ${typeConf.text}`}>
                  {typeConf.label}
                </span>
              </div>

              {/* 本文 */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-800 transition group-hover:text-orange-600">
                  {entry.code && (
                    <span className="mr-1.5 font-mono text-[10px] text-gray-400">{entry.code}</span>
                  )}
                  {entry.titleJa}
                </p>
                {entry.description && (
                  <p className="mt-0.5 truncate text-[10px] text-gray-400">{entry.description}</p>
                )}
              </div>

              {/* 右端：自動更新バッジ + リンクアイコン */}
              <div className="flex flex-shrink-0 items-center gap-1.5 pt-0.5">
                {entry.autoUpdated && (
                  <span className="rounded bg-sky-50 px-1.5 py-px text-[9px] font-semibold text-sky-600">
                    自動反映済
                  </span>
                )}
                <svg className="h-3 w-3 text-gray-300 transition group-hover:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </div>
            </a>
          );
        })}
      </div>

      {/* もっと見る */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full border-t border-gray-100 py-2 text-center text-[10px] font-medium text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
        >
          {expanded ? "折りたたむ ▲" : `さらに ${updates.length - 5}件を表示 ▼`}
        </button>
      )}
    </div>
  );
}
