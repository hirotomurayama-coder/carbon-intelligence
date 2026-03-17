"use client";

import { useState, useEffect, useMemo } from "react";
import type { PriceTrend, CreditMarketId, TrendDirection } from "@/types";

// ============================================================
// 定数
// ============================================================

const MARKET_COLORS: Record<string, string> = {
  "jcredit-energy-saving": "#3b82f6",
  "jcredit-forest": "#10b981",
  "jcredit-agri-midseason": "#8b5cf6",
  "jcredit-agri-biochar": "#14b8a6",
  "eu-ets": "#f59e0b",
  "vol-biochar": "#ef4444",
  "vol-dac": "#6366f1",
  "vol-erw": "#a855f7",
  "vol-blue-carbon": "#06b6d4",
  "vol-soil-carbon": "#84cc16",
  "vol-redd-plus": "#22c55e",
  "vol-cookstoves": "#f97316",
  "vol-methane": "#64748b",
  "vol-nature-removal": "#f97316",
};

const MARKET_DESCRIPTIONS: Record<string, string> = {
  "jcredit-energy-saving": "省エネルギー由来のJ-クレジット。工場やビルの省エネ設備導入による CO2 削減量を認証。",
  "jcredit-forest": "森林管理由来のJ-クレジット。間伐等の適切な森林管理による CO2 吸収量を認証。",
  "jcredit-agri-midseason": "水稲栽培における中干し延長由来のJ-クレジット。メタン排出削減を認証。",
  "jcredit-agri-biochar": "バイオ炭の農地施用由来のJ-クレジット。炭素固定による除去量を認証。",
  "eu-ets": "EU域内排出量取引制度（EU-ETS）の排出許可証（EUA）。欧州最大の炭素市場。",
  "vol-biochar": "バイオ炭を用いた技術ベースの炭素除去（CDR）クレジット。高い永続性が特徴。",
  "vol-dac": "大気中のCO2を直接回収するDAC（Direct Air Capture）技術による除去クレジット。最も高い永続性（1000年以上）を持つが、現時点では最も高価。",
  "vol-erw": "玄武岩等の岩石粉砕物を農地に散布し、風化反応によりCO2を鉱物として固定する新興CDR技術。農地の土壌改良効果も期待される。",
  "vol-blue-carbon": "マングローブ・海草藻場・塩性湿地等の沿岸生態系によるCO2吸収・固定クレジット。生物多様性保全の共便益が大きい。",
  "vol-soil-carbon": "再生型農業（不耕起栽培、被覆作物、輪作等）による土壌への炭素貯留クレジット。農業生産性向上の共便益がある。",
  "vol-redd-plus": "途上国の森林減少・劣化を防止することで温室効果ガスの排出を回避するREDD+クレジット。世界最大規模のボランタリークレジットカテゴリー。",
  "vol-cookstoves": "途上国で効率的な調理用ストーブを普及させ、薪・炭の使用量を削減するプロジェクト。健康改善・女性の負担軽減等のSDGs共便益が高い。",
  "vol-methane": "埋立地ガス・農業排水・炭鉱等からのメタン排出を回収・利用するプロジェクト。メタンの温暖化係数が高いため、大きなCO2e削減効果。",
  "vol-nature-removal": "森林再生・土壌炭素固定等の自然ベース炭素除去クレジット。",
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

function formatSourcePrice(price: number | null, currency: string | null): string {
  if (price === null || currency === null) return "";
  const symbol = currency === "EUR" ? "\u20ac" : currency === "USD" ? "$" : "\u00a5";
  return `${symbol}${price.toFixed(2)}`;
}

function trendIcon(direction: TrendDirection | null): string {
  switch (direction) {
    case "up": return "\u2191";
    case "down": return "\u2193";
    default: return "\u2192";
  }
}

function trendColorClass(direction: TrendDirection | null): string {
  switch (direction) {
    case "up": return "text-emerald-600";
    case "down": return "text-red-600";
    default: return "text-gray-500";
  }
}

// ============================================================
// Component
// ============================================================

type Props = { trend: PriceTrend };

export function MarketDetailView({ trend }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const mid = trend.marketId ?? "";
  const color = MARKET_COLORS[mid] ?? "#6b7280";
  const description = MARKET_DESCRIPTIONS[mid] ?? "";
  const analysis = trend.analysis;
  const hasAnalysis = !!analysis?.summary;

  // 簡易チャートデータ
  const sparkData = useMemo(() => {
    if (trend.priceHistory.length === 0) return [];
    return [...trend.priceHistory].sort((a, b) => a.date.localeCompare(b.date));
  }, [trend.priceHistory]);

  return (
    <div className="space-y-8">
      {/* ── ヘッダーセクション ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="h-2" style={{ backgroundColor: color }} />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* 左側: タイトルと価格 */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{trend.title}</h1>
              {description && (
                <p className="mt-2 text-sm text-gray-500 max-w-xl">{description}</p>
              )}

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-4xl font-bold text-gray-900" suppressHydrationWarning>
                  {formatJpy(trend.latestPriceJpy)}
                </span>
                <span className="text-sm text-gray-400">/{trend.priceUnit ?? "tCO2e"}</span>
              </div>

              {trend.sourceCurrency !== "JPY" && trend.latestPrice !== null && (
                <div className="mt-1 text-sm text-gray-400" suppressHydrationWarning>
                  {formatSourcePrice(trend.latestPrice, trend.sourceCurrency)}
                  {trend.fxRate ? ` (FX: ${trend.fxRate.toFixed(2)})` : ""}
                </div>
              )}
            </div>

            {/* 右側: トレンド */}
            <div className="flex flex-col items-end gap-2">
              <div className={`text-3xl font-bold ${trendColorClass(trend.trendDirection)}`}>
                {trendIcon(trend.trendDirection)}
                {trend.trendPercentage !== null && (
                  <span className="ml-1 text-xl">
                    {trend.trendPercentage > 0 ? "+" : ""}
                    {trend.trendPercentage.toFixed(1)}%
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">前回比</span>
            </div>
          </div>

          {/* 簡易スパークライン（テキストベース） */}
          {sparkData.length > 1 && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                価格推移
              </h3>
              <MiniChart data={sparkData} color={color} mounted={mounted} />
            </div>
          )}
        </div>
      </div>

      {/* ── AI 分析セクション ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-6">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs">
            AI
          </span>
          マーケット分析
        </h2>

        {hasAnalysis ? (
          <div className="prose prose-sm prose-gray max-w-none">
            {/* サマリー */}
            <p className="text-base leading-relaxed text-gray-700">
              {analysis.summary}
            </p>

            {/* 価格レンジ */}
            {analysis.monthlyRangeLow && analysis.monthlyRangeHigh && (
              <div className="not-prose mt-6 rounded-lg bg-gray-50 p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  過去1ヶ月の価格レンジ
                </h3>
                <div className="mt-2 flex items-center gap-4">
                  <div>
                    <div className="text-xs text-gray-400">安値</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatJpy(analysis.monthlyRangeLow)}
                    </div>
                  </div>
                  <div className="h-px flex-1 bg-gray-200" />
                  <div className="text-right">
                    <div className="text-xs text-gray-400">高値</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatJpy(analysis.monthlyRangeHigh)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 変動要因 */}
            {analysis.factors.length > 0 && (
              <>
                <h3 className="mt-6 text-base font-bold text-gray-800">
                  価格変動の主な要因
                </h3>
                <ul className="mt-2 space-y-2">
                  {analysis.factors.map((factor, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* 短期見通し */}
            {analysis.outlook && (
              <>
                <h3 className="mt-6 text-base font-bold text-gray-800">
                  短期見通し
                </h3>
                <p className="mt-2 text-gray-700">{analysis.outlook}</p>
              </>
            )}

            {/* 分析ソース */}
            {analysis.analysisSources.length > 0 && (
              <div className="not-prose mt-6 border-t border-gray-100 pt-4">
                <p className="text-[10px] text-gray-400">
                  分析ソース: {analysis.analysisSources.join(", ")}
                  {analysis.analyzedAt && (
                    <> | 分析日: {analysis.analyzedAt.slice(0, 10)}</>
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">
              AI分析はまだ生成されていません。
            </p>
            <p className="mt-2 text-xs text-gray-400">
              次回の週次更新（毎週月曜 09:00 JST）で自動生成されます。
              <br />
              手動実行:
              <code className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px]">
                npm run analyze-market
              </code>
            </p>
          </div>
        )}
      </div>

      {/* ── データソース ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-bold text-gray-700 mb-4">データソース</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-400">ソース</div>
            <div className="text-gray-700">{trend.sourceName ?? "\u2014"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">通貨</div>
            <div className="text-gray-700">{trend.sourceCurrency ?? "\u2014"}</div>
          </div>
          {trend.sourceUrl && (
            <div className="sm:col-span-2">
              <div className="text-xs text-gray-400">参照元</div>
              <a
                href={trend.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline break-all"
              >
                {trend.sourceUrl}
              </a>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-400">最終同期</div>
            <div className="text-gray-700" suppressHydrationWarning>
              {mounted && trend.lastSynced
                ? new Date(trend.lastSynced).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
                : trend.lastSynced?.slice(0, 19).replace("T", " ") ?? "\u2014"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ミニチャート（Recharts）
// ============================================================

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

function MiniChart({
  data,
  color,
  mounted,
}: {
  data: { date: string; priceJpy: number }[];
  color: string;
  mounted: boolean;
}) {
  if (!mounted) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-300">
        チャートを読み込み中...
      </div>
    );
  }

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickFormatter={(d: unknown) => {
              const s = String(d ?? "");
              const parts = s.split("-");
              if (parts.length >= 3) return `${Number(parts[1])}/${Number(parts[2])}`;
              return s;
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickFormatter={(v: unknown) => {
              const n = Number(v);
              if (isNaN(n)) return String(v);
              return n >= 1000 ? `\u00a5${(n / 1000).toFixed(1)}k` : `\u00a5${n}`;
            }}
            width={55}
            domain={["dataMin * 0.95", "dataMax * 1.05"]}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e7eb" }}
            formatter={(value: unknown) => {
              const v = typeof value === "number" ? value : 0;
              return [`\u00a5${v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`, "価格"];
            }}
            labelFormatter={(label: unknown) => `${String(label)}`}
          />
          <Area
            type="monotone"
            dataKey="priceJpy"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${color.replace("#", "")})`}
            dot={data.length <= 10 ? { r: 3, fill: color } : false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
