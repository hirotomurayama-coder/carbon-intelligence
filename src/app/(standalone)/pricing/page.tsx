import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "プランのアップグレード | Carbon Intelligence",
};

export default async function PricingPage() {
  const session = await auth();

  // Already active → back to dashboard
  if (session?.subscriptionStatus === "active") {
    redirect("/");
  }

  const isTrialExpired =
    !session?.subscriptionStatus ||
    session.subscriptionStatus === "trial_expired";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Trial expired notice */}
        {isTrialExpired && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold">無料体験期間が終了しました</p>
            <p className="mt-1 text-amber-600">
              引き続きご利用いただくには、有料プランへのアップグレードが必要です。
            </p>
          </div>
        )}

        {/* Pricing card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white">
              C
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Carbon Intelligence Pro</h1>
            <p className="mt-2 text-sm text-gray-500">
              カーボンクレジット市場のプロフェッショナル向けツール
            </p>
          </div>

          <div className="mt-8 text-center">
            <span className="text-4xl font-bold text-gray-900">¥5,000</span>
            <span className="text-gray-400 ml-1">/ 月</span>
          </div>

          {/* Features */}
          <ul className="mt-6 space-y-3">
            {[
              "80以上のカーボン価格制度データベース",
              "14市場のリアルタイム価格・トレンド分析",
              "メソドロジー・算定方法論DB（検索・比較）",
              "企業・プロジェクトデータベース",
              "週次マーケットインサイトレポート",
              "AI搭載ソース探索・分析ツール",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {/* CTA */}
          {process.env.STRIPE_PRICE_ID ? (
            <form action="/api/stripe/checkout" method="POST" className="mt-8">
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                有料プランを開始する
              </button>
            </form>
          ) : (
            <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 text-center">
              <p className="text-sm font-medium text-gray-600">決済システム設定中</p>
              <p className="mt-1 text-xs text-gray-400">
                まもなく利用開始できるようになります。
              </p>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-gray-400">
            いつでもキャンセル可能。翌月以降の請求はありません。
          </p>
        </div>

        {/* Customer portal link for existing subscribers */}
        {session?.user && (
          <p className="mt-4 text-center text-xs text-gray-400">
            支払い管理・解約は{" "}
            <a href="/api/stripe/portal" className="underline hover:text-gray-600">
              こちら
            </a>
          </p>
        )}

        <p className="mt-6 text-center text-xs text-gray-300 space-x-2">
          <a href="/tokushoho" className="hover:text-gray-400 underline">特定商取引法に基づく表記</a>
          <span>·</span>
          <a href="/terms" className="hover:text-gray-400 underline">利用規約</a>
        </p>
      </div>
    </div>
  );
}
