"use client";

import { useState, useMemo, useEffect } from "react";
import type { PriceTrend, CreditMarketId, TrendDirection } from "@/types";

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
// ヘルパー（ハイドレーション安全: toLocaleString 不使用）
// ============================================================

/** JPY 書式化 — サーバー/クライアントで差異が出ないよう手動フォーマット */
function formatJpy(value: number | null): string {
  if (value === null) return "\u2014";
  // 手動カンマ区切り（toLocaleString はサーバー/ブラウザで差異あり）
  const rounded = Math.round(value);
  const str = Math.abs(rounded).toString();
  const withComma = str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `\u00a5${rounded < 0 ? "-" : ""}${withComma}`;
}

/** 元通貨書式化 */
function formatSourcePrice(
  price: number | null,
  currency: string | null
): string {
  if (price === null || currency === null) return "";
  const symbol = currency === "EUR" ? "\u20ac" : currency === "USD" ? "$" : "\u00a5";
  const fixed = price.toFixed(2);
  return `${symbol}${fixed}`;
}

function trendIcon(direction: TrendDirection | null): string {
  switch (direction) {
    case "up":
      return "\u2191";
    case "down":
      return "\u2193";
    default:
      return "\u2192";
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

/** 相対時刻 — クライアントのみで使用（mounted 後） */
function relativeTime(isoString: string | null): string {
  if (!isoString) return "\u2014";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "\u305f\u3063\u305f\u4eca";
    if (diffMin < 60) return `${diffMin}\u5206\u524d`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}\u6642\u9593\u524d`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}\u65e5\u524d`;
  } catch {
    return "\u2014";
  }
}

/** 日付を短い形式で表示（ハイドレーション安全: 純粋な文字列操作のみ） */
function formatShortDate(isoString: string | null): string {
  if (!isoString) return "\u2014";
  // "2026-03-10T..." → "3/10"
  const datePart = isoString.slice(0, 10);
  const parts = datePart.split("-");
  if (parts.length < 3) return datePart;
  return `${Number(parts[1])}/${Number(parts[2])}`;
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
  // ---- ハイドレーション対策: mounted フラグ ----
  // サーバー描画時は mounted=false → Recharts/relativeTime を描画しない
  // クライアントで useEffect 後に mounted=true → 初めて描画
  const [mounted, setMounted] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<CreditMarketId | "all">(
    "all"
  );
  const [period, setPeriod] = useState<PeriodKey>("ALL");

  useEffect(() => {
    setMounted(true);
  }, []);

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
  // ※ mounted 後のみ new Date() を使う（ハイドレーション対策）
  const cutoffDate = useMemo(() => {
    if (!mounted) return null; // サーバーでは常に ALL
    if (period === "ALL") return null;
    const months = PERIODS.find((p) => p.key === period)?.months ?? 0;
    if (months === 0) return null;
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }, [period, mounted]);

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
        // priceJpy が文字列で入っている可能性に対応（WordPress JSON 経由）
        row[trend.marketId] = Number(entry.priceJpy) || 0;
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

              {/* JPY 価格 — suppressHydrationWarning で安全に */}
              <div className="mt-1 text-2xl font-bold text-gray-900" suppressHydrationWarning>
                {formatJpy(trend.latestPriceJpy)}
                <span className="ml-1 text-xs font-normal text-gray-400">
                  /{trend.priceUnit ?? "tCO2e"}
                </span>
              </div>

              {/* 元通貨 + FX */}
              {trend.sourceCurrency !== "JPY" && (
                <div className="mt-0.5 text-xs text-gray-400" suppressHydrationWarning>
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

              {/* ソース + 更新日 — relativeTime はクライアントのみ */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                <span>{trend.sourceName ?? "\u2014"}</span>
                <span suppressHydrationWarning>
                  {mounted ? relativeTime(trend.lastSynced) : formatShortDate(trend.lastSynced)}
                </span>
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
              ` \u2014 ${
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

        {/* チャート — クライアントマウント後にのみ描画（Recharts SSR 不一致対策） */}
        {mounted ? (
          chartData.length > 0 ? (
            <ChartSection chartData={chartData} chartMarkets={chartMarkets} />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              選択期間のデータがありません
            </div>
          )
        ) : (
          <div className="flex h-80 items-center justify-center text-sm text-gray-300">
            チャートを読み込み中...
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

// ============================================================
// Recharts チャート — 別コンポーネントに分離（dynamic import 対応準備）
// ============================================================

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

function ChartSection({
  chartData,
  chartMarkets,
}: {
  chartData: Record<string, unknown>[];
  chartMarkets: CreditMarketId[];
}) {
  return (
    <div>
      {chartData.length === 1 && (
        <p className="mb-2 text-xs text-gray-400">
          現在1日分のデータのみ。同期を繰り返すことで推移グラフが描画されます。
        </p>
      )}
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
              tickFormatter={(d: unknown) => {
                // Recharts は数値を渡す場合がある → 必ず文字列化
                const s = String(d ?? "");
                const parts = s.split("-");
                if (parts.length >= 3) {
                  return `${Number(parts[1])}/${Number(parts[2])}`;
                }
                return s;
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickFormatter={(v: unknown) => {
                const n = Number(v);
                if (isNaN(n)) return String(v);
                return n >= 1000
                  ? `\u00a5${(n / 1000).toFixed(1)}k`
                  : `\u00a5${n}`;
              }}
              width={60}
              domain={chartData.length === 1 ? ["dataMin * 0.8", "dataMax * 1.2"] : ["auto", "auto"]}
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
                return [`\u00a5${v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`, label];
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
                dot={{ r: chartData.length <= 5 ? 6 : chartData.length <= 30 ? 3 : 0 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
