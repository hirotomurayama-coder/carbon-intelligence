import { getPriceTrends } from "@/lib/wordpress";
import { PriceTrendDashboard } from "@/components/PriceTrendDashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { Metadata } from "next";
import type { PriceTrend } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クレジット価格動向 | Carbon Intelligence",
  description:
    "EU ETS、J-Credit、ボランタリークレジット（Xpansiv CBL）の最新価格と価格推移をリアルタイムで可視化。円換算・為替レート情報付き。",
};

export default async function AnalyticsPage() {
  let trends: PriceTrend[] = [];
  let fetchError: string | null = null;

  const apiUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "(未設定)";

  try {
    trends = await getPriceTrends();
    // getPriceTrends は内部 catch で [] を返すため、ここに来た時点で成功
  } catch (e) {
    // getPriceTrends 自体が catch 済みなので通常到達しない。
    // 到達した場合は import エラーやランタイム異常。
    const msg = e instanceof Error ? e.message : String(e);
    fetchError = msg;
    console.error("[AnalyticsPage] 予期しない例外:", e);
  }

  // デバッグ情報（サーバー側で確定した値をそのまま表示）
  const debugLine = fetchError
    ? `API: ${apiUrl} | エラー: ${fetchError}`
    : `API: ${apiUrl} | 取得件数: ${trends.length} | 先頭ID: ${trends[0]?.id ?? "なし"} | 先頭市場: ${trends[0]?.marketId ?? "なし"} | 先頭JPY: ${trends[0]?.latestPriceJpy ?? "なし"}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">クレジット価格動向</h1>
        <p className="mt-1 text-sm text-gray-500">
          主要カーボンクレジット市場の最新価格と推移
        </p>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">データ取得エラー</p>
          <p className="mt-1 break-all">{fetchError}</p>
          <p className="mt-2 text-xs text-red-400 break-all">
            対象 URL: {apiUrl}/price_trends?per_page=100
          </p>
        </div>
      )}

      {/* ErrorBoundary でクライアントサイドエラーを捕捉 */}
      <ErrorBoundary>
        <PriceTrendDashboard data={trends} />
      </ErrorBoundary>

      {/* ===== デバッグ情報（常に最下部に表示） ===== */}
      <div
        className="border-t border-gray-100 pt-3 text-[10px] text-gray-300 font-mono break-all"
        suppressHydrationWarning
      >
        <p>{debugLine}</p>
        <p className="mt-1">
          SSR時刻: {new Date().toISOString()} | dynamic: force-dynamic
        </p>
      </div>
    </div>
  );
}
