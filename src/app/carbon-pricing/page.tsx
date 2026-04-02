import type { Metadata } from "next";
import { CarbonPricingList } from "@/components/CarbonPricingList";
import cpData from "@/data/carbon-pricing-dashboard.json";

export const metadata: Metadata = {
  title: "カーボン価格制度データベース | Carbon Intelligence",
  description: "世界80以上のカーボン価格制度（ETS・炭素税）の価格・収益・カバー率データ。World Bank Carbon Pricing Dashboard提供。",
};

// 年別収益トレンド用SVGチャート（server-side）
type RevEntry = { year: number; totalUSD_M: number };
function RevenueTrendChart({ data }: { data: RevEntry[] }) {
  const recent = data.filter(d => d.year >= 2015);
  if (!recent.length) return null;
  const maxV = Math.max(...recent.map(d => d.totalUSD_M));
  const W = 14, GAP = 4, H = 48, LABEL_H = 12;
  const totalW = recent.length * W + (recent.length - 1) * GAP;
  return (
    <svg width={totalW} height={H + LABEL_H} viewBox={`0 0 ${totalW} ${H + LABEL_H}`} className="overflow-visible">
      {recent.map((d, i) => {
        const bh = Math.max(2, (d.totalUSD_M / maxV) * H);
        const x = i * (W + GAP);
        const isLatest = i === recent.length - 1;
        return (
          <g key={d.year}>
            <rect x={x} y={H - bh} width={W} height={bh} rx={2}
              fill={isLatest ? "#10b981" : "#d1fae5"} opacity={0.9} />
            <text x={x + W / 2} y={H + LABEL_H - 1} textAnchor="middle" fontSize={7} fill="#9ca3af">
              {String(d.year).slice(2)}
            </text>
            {isLatest && (
              <text x={x + W / 2} y={H - bh - 3} textAnchor="middle" fontSize={7} fill="#10b981" fontWeight="bold">
                ${(d.totalUSD_M / 1000).toFixed(0)}B
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function CarbonPricingPage() {
  const meta = cpData.meta;
  const implemented = cpData.instruments.filter(i => i.status === "Implemented");
  const etsCount  = implemented.filter(i => i.type === "ETS").length;
  const taxCount  = implemented.filter(i => i.type === "Carbon tax").length;

  // Top 5 highest 2025 prices
  const top5 = [...cpData.instruments]
    .filter(i => i.price2025 != null)
    .sort((a, b) => (b.price2025 ?? 0) - (a.price2025 ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">カーボン価格制度データベース</h1>
        <p className="mt-1 text-sm text-gray-400">
          World Bank Carbon Pricing Dashboard — 世界のETS・炭素税 {meta.instruments_total}制度の価格・収益・排出量カバー率データ
        </p>
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-400">実施中の制度</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{meta.instruments_implemented}<span className="text-sm font-normal text-gray-400 ml-1">件</span></p>
          <p className="mt-1 text-[11px] text-gray-400">ETS {etsCount}件 / 炭素税 {taxCount}件</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-400">世界排出量カバー率</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{meta.globalCoverage2024_pct}<span className="text-sm font-normal text-gray-400 ml-1">%</span></p>
          <p className="mt-1 text-[11px] text-gray-400">2024年実績</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-400">政府収入（2024年）</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">US${meta.totalRevenue2024_USD_B}<span className="text-sm font-normal text-gray-400 ml-1">十億ドル</span></p>
          <div className="mt-2">
            <RevenueTrendChart data={cpData.revenue as RevEntry[]} />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-400">最高価格 TOP5（2025年）</p>
          <ul className="mt-1 space-y-1">
            {top5.map((inst, i) => (
              <li key={inst.id} className="flex items-center justify-between">
                <span className="truncate text-[11px] text-gray-600 max-w-[120px]">{inst.jurisdiction}</span>
                <span className="font-mono text-xs font-bold text-gray-900">${inst.price2025?.toFixed(0)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 制度一覧 */}
      <CarbonPricingList instruments={cpData.instruments as any} />
    </div>
  );
}
