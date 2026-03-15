"use client";

import { useState, useEffect } from "react";
import type { PriceTrend, CreditMarketId, TrendDirection } from "@/types";
import Link from "next/link";

// ============================================================
// 定数
// ============================================================

const MARKET_ORDER: CreditMarketId[] = [
  "jcredit-energy-saving", "jcredit-forest", "jcredit-agri-midseason",
  "jcredit-agri-biochar", "eu-ets", "vol-biochar", "vol-nature-removal",
];

const MARKET_COLORS: Record<CreditMarketId, string> = {
  "jcredit-energy-saving": "#3b82f6",
  "jcredit-forest": "#10b981",
  "jcredit-agri-midseason": "#8b5cf6",
  "jcredit-agri-biochar": "#14b8a6",
  "eu-ets": "#f59e0b",
  "vol-biochar": "#ef4444",
  "vol-nature-removal": "#f97316",
};

const MARKET_CATEGORIES: Record<CreditMarketId, string> = {
  "jcredit-energy-saving": "J-Credit",
  "jcredit-forest": "J-Credit",
  "jcredit-agri-midseason": "J-Credit",
  "jcredit-agri-biochar": "J-Credit",
  "eu-ets": "EU ETS",
  "vol-biochar": "ボランタリー",
  "vol-nature-removal": "ボランタリー",
};

// ============================================================
// ヘルパー
// ============================================================

function formatJpy(value: number | null): string {
  if (value === null) return "\u2014";
  const rounded = Math.round(value);
  const str = Math.abs(rounded).toString();
  const withComma = str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `\u00a5${rounded < 0 ? "-" : ""}${withComma}`;
}

function trendIcon(direction: TrendDirection | null): string {
  switch (direction) {
    case "up": return "\u2191";
    case "down": return "\u2193";
    default: return "\u2192";
  }
}

function trendColor(direction: TrendDirection | null): string {
  switch (direction) {
    case "up": return "text-emerald-600 bg-emerald-50";
    case "down": return "text-red-600 bg-red-50";
    default: return "text-gray-600 bg-gray-50";
  }
}

function relativeTime(isoString: string | null): string {
  if (!isoString) return "\u2014";
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    return `${Math.floor(diffHours / 24)}日前`;
  } catch {
    return "\u2014";
  }
}

// ============================================================
// Component
// ============================================================

type Props = { data: PriceTrend[] };

export function MarketInsightCards({ data }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sorted = [...data].sort((a, b) => {
    const ai = a.marketId ? MARKET_ORDER.indexOf(a.marketId) : 999;
    const bi = b.marketId ? MARKET_ORDER.indexOf(b.marketId) : 999;
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        <p>
          データがありません。
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            npm run sync-prices
          </code>
          を実行してデータを登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((trend) => {
        const mid = trend.marketId as CreditMarketId | null;
        const color = mid ? MARKET_COLORS[mid] : "#9ca3af";
        const category = mid ? MARKET_CATEGORIES[mid] : "";
        const analysis = trend.analysis;
        const hasAnalysis = !!analysis?.summary;

        return (
          <Link
            key={trend.id}
            href={mid ? `/analysis/${mid}` : "#"}
            className="group block rounded-xl border border-gray-200 bg-white transition-all hover:shadow-lg hover:border-gray-300"
          >
            {/* カラーバー */}
            <div className="h-1.5 rounded-t-xl" style={{ backgroundColor: color }} />

            <div className="p-5">
              {/* ヘッダー */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {category}
                  </span>
                  <h3 className="mt-0.5 text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition">
                    {trend.title}
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${trendColor(trend.trendDirection)}`}
                >
                  {trendIcon(trend.trendDirection)}
                  {trend.trendPercentage !== null && (
                    <span className="ml-0.5">
                      {trend.trendPercentage > 0 ? "+" : ""}
                      {trend.trendPercentage.toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>

              {/* 価格 */}
              <div className="mt-3" suppressHydrationWarning>
                <span className="text-2xl font-bold text-gray-900">
                  {formatJpy(trend.latestPriceJpy)}
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  /{trend.priceUnit ?? "tCO2e"}
                </span>
              </div>

              {/* 価格レンジ（AI分析データがある場合） */}
              {analysis?.monthlyRangeLow && analysis?.monthlyRangeHigh && (
                <div className="mt-1.5 text-xs text-gray-400">
                  過去1ヶ月: {formatJpy(analysis.monthlyRangeLow)} 〜 {formatJpy(analysis.monthlyRangeHigh)}
                </div>
              )}

              {/* AI サマリー */}
              {hasAnalysis ? (
                <p className="mt-3 text-xs leading-relaxed text-gray-600 line-clamp-2">
                  {analysis.summary}
                </p>
              ) : (
                <p className="mt-3 text-xs text-gray-300 italic">
                  AI分析は次回の週次更新で生成されます
                </p>
              )}

              {/* フッター */}
              <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
                <span className="text-[10px] text-gray-400">
                  {trend.sourceName ?? "\u2014"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400" suppressHydrationWarning>
                    {mounted ? relativeTime(trend.lastSynced) : ""}
                  </span>
                  <span className="text-xs text-emerald-600 opacity-0 group-hover:opacity-100 transition">
                    詳細 →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
