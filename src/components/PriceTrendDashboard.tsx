"use client";

import { useState, useMemo } from "react";
import type { PriceTrend, CreditMarketId, TrendDirection } from "@/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ============================================================
// 市場表示順序 & カラー定義
// ============================================================

const MARKET_ORDER: CreditMarketId[] = [
  "eu-ets",
  "jcredit-renewable",
  "jcredit-energy-saving",
  "vcs-geo",
  "vcs-ngeo",
];

const MARKET_COLORS: Record<CreditMarketId, string> = {
  "eu-ets": "#10b981",            // emerald
  "jcredit-renewable": "#3b82f6", // blue
  "jcredit-energy-saving": "#8b5cf6", // violet
  "vcs-geo": "#f59e0b",          // amber
  "vcs-ngeo": "#ef4444",         // red
};

const MARKET_SHORT_NAMES: Record<CreditMarketId, string> = {
  "eu-ets": "EU ETS",
  "jcredit-renewable": "J-Credit 再エネ",
  "jcredit-energy-saving": "J-Credit 省エネ",
  "vcs-geo": "GEO",
  "vcs-ngeo": "N-GEO",
};

// ============================================================
// 期間フィルタ定義
// ============================================================

type PeriodKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

const PERIODS: { key: PeriodKey; label: string; months: number }[] = [
  { key: "1M", label: "1M", months: 1 },
  { key: "3M", label: "3M", months: 3 },
  { key: "6M", label: "6M", months: 6 },
  { key: "1Y", label: "1Y", months: 12 },
  { key: "ALL", label: "ALL", months: 0 },
];

// ============================================================
// ヘルパー
// ============================================================

function formatJpy(value: number | null): string {
  if (value === null) return "—";
  return `¥${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}`;
}

function formatSourcePrice(
  price: number | null,
  currency: string | null
): string {
  if (price === null || currency === null) return "";
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "¥";
  return `${symbol}${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trendIcon(direction: TrendDirection | null): string {
  switch (direction) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    default:
      return "→";
  }
}

function trendColor(direction: TrendDirection | null): string {
  switch (direction) {
    case "up":
      return "text-emerald-600 bg-emerald-50";
    case "down":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

function relativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}日前`;
  } catch {
    return "—";
  }
}

// ============================================================
// Props
// ============================================================

type Props = {
  data: PriceTrend[];
};

// ============================================================
// Component
// ============================================================

export function PriceTrendDashboard({ data }: Props) {
  const [selectedMarket, setSelectedMarket] = useState<CreditMarketId | "all">(
    "all"
  );
  const [period, setPeriod] = useState<PeriodKey>("ALL");

  // 市場順にソート
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aIdx = a.marketId
        ? MARKET_ORDER.indexOf(a.marketId)
        : MARKET_ORDER.length;
      const bIdx = b.marketId
        ? MARKET_ORDER.indexOf(b.marketId)
        : MARKET_ORDER.length;
      return (aIdx === -1 ? MARKET_ORDER.length : aIdx) -
        (bIdx === -1 ? MARKET_ORDER.length : bIdx);
    });
  }, [data]);

  // 期間フィルタで切り出した日付の閾値
  const cutoffDate = useMemo(() => {
    if (period === "ALL") return null;
    const months = PERIODS.find((p) => p.key === period)?.months ?? 0;
    if (months === 0) return null;
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }, [period]);

  // チャート用データ: 全市場の price_history を date をキーに結合
  const chartData = useMemo(() => {
    const dateMap = new Map<
      string,
      Record<string, number>
    >();

    const marketsToShow =
      selectedMarket === "all"
        ? sortedData
        : sortedData.filter((t) => t.marketId === selectedMarket);

    for (const trend of marketsToShow) {
      if (!trend.marketId) continue;
      for (const entry of trend.priceHistory) {
        if (cutoffDate && entry.date < cutoffDate) continue;
        if (!dateMap.has(entry.date)) {
          dateMap.set(entry.date, { date: 0 }); // date placeholder
        }
        const row = dateMap.get(entry.date)!;
        row[trend.marketId] = entry.priceJpy;
      }
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        ...values,
      }));
  }, [sortedData, selectedMarket, cutoffDate]);

  // チャートに表示する市場リスト
  const chartMarkets = useMemo(() => {
    if (selectedMarket === "all") {
      return sortedData
        .filter((t) => t.marketId)
        .map((t) => t.marketId as CreditMarketId);
    }
    return [selectedMarket];
  }, [sortedData, selectedMarket]);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        <p>
          価格データがありません。
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            npm run sync-prices
          </code>
          を実行してデータを登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 価格カード ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sortedData.map((trend) => {
          const mid = trend.marketId as CreditMarketId | null;
          const isSelected =
            selectedMarket === "all" ||
            selectedMarket === mid;
          const borderColor =
            mid && selectedMarket === mid
              ? `border-l-4`
              : "border-l-4 border-l-transparent";

          return (
            <button
              key={trend.id}
              type="button"
              onClick={() =>
                setSelectedMarket(
                  selectedMarket === mid ? "all" : (mid ?? "all")
                )
              }
              className={`rounded-lg border bg-white p-4 text-left transition-shadow hover:shadow-md ${borderColor} ${
                isSelected ? "ring-1 ring-gray-200" : "opacity-60"
              } ${selectedMarket === "all" ? "opacity-100" : ""}`}
              style={
                mid && selectedMarket === mid
                  ? { borderLeftColor: MARKET_COLORS[mid] }
                  : undefined
              }
            >
              {/* 市場名 */}
              <div className="text-xs font-medium text-gray-500 truncate">
                {trend.title}
              </div>

              {/* JPY 価格 */}
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {formatJpy(trend.latestPriceJpy)}
                <span className="ml-1 text-xs font-normal text-gray-400">
                  /{trend.priceUnit ?? "tCO2e"}
                </span>
              </div>

              {/* 元通貨 + FX */}
              {trend.sourceCurrency !== "JPY" && (
                <div className="mt-0.5 text-xs text-gray-400">
                  {formatSourcePrice(trend.latestPrice, trend.sourceCurrency)}
                  {trend.fxRate
                    ? ` (FX: ${trend.fxRate.toFixed(2)})`
                    : ""}
                </div>
              )}

              {/* トレンドバッジ */}
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${trendColor(
                    trend.trendDirection
                  )}`}
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

              {/* ソース + 更新日 */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                <span>{trend.sourceName ?? "—"}</span>
                <span>{relativeTime(trend.lastSynced)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── チャートセクション ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* コントロールバー */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-700">
            価格推移（JPY/tCO2e）
            {selectedMarket !== "all" &&
              ` — ${
                MARKET_SHORT_NAMES[selectedMarket] ?? selectedMarket
              }`}
          </h2>

          {/* 期間フィルタ */}
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  period === p.key
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* チャート */}
        {chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(d: string) => {
                    // "2026-03-10" → "3/10"
                    const parts = d.split("-");
                    return `${Number(parts[1])}/${Number(parts[2])}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v: number) =>
                    v >= 1000
                      ? `¥${(v / 1000).toFixed(1)}k`
                      : `¥${v}`
                  }
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    borderColor: "#e5e7eb",
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    const v = typeof value === "number" ? value : 0;
                    const n = typeof name === "string" ? name : "";
                    const label =
                      MARKET_SHORT_NAMES[n as CreditMarketId] ?? n;
                    return [`¥${v.toLocaleString("ja-JP")}`, label];
                  }}
                  labelFormatter={(label: unknown) => `日付: ${String(label)}`}
                />
                <Legend
                  formatter={(value: unknown) => {
                    const v = typeof value === "string" ? value : String(value);
                    return MARKET_SHORT_NAMES[v as CreditMarketId] ?? v;
                  }}
                  wrapperStyle={{ fontSize: 11 }}
                />
                {chartMarkets.map((mid) => (
                  <Line
                    key={mid}
                    type="monotone"
                    dataKey={mid}
                    stroke={MARKET_COLORS[mid]}
                    strokeWidth={2}
                    dot={chartData.length <= 30}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            選択期間のデータがありません
          </div>
        )}

        {/* ソースリンク */}
        <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-3">
          {sortedData
            .filter(
              (t) =>
                t.sourceUrl &&
                (selectedMarket === "all" || selectedMarket === t.marketId)
            )
            .map((t) => (
              <a
                key={t.id}
                href={t.sourceUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{
                  backgroundColor: t.marketId
                    ? MARKET_COLORS[t.marketId as CreditMarketId]
                    : "#9ca3af",
                }} />
                {t.sourceName}
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ))}
        </div>
      </div>
    </div>
  );
}
