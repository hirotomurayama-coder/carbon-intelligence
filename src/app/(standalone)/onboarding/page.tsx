"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

const STEPS = [
  {
    title: "ようこそ！Carbon Intelligenceへ",
    icon: "🌱",
    content: (
      <div className="space-y-3 text-sm text-gray-600">
        <p>
          Carbon Intelligenceは、カーボンクレジット市場のプロフェッショナルのための
          インテリジェンス・プラットフォームです。
        </p>
        <p>
          世界の価格制度データ、リアルタイム市場価格、メソドロジーDB、企業・プロジェクト情報を
          一つのプラットフォームで提供します。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { icon: "📊", label: "価格データ", desc: "80以上の制度" },
            { icon: "🔍", label: "メソドロジー", desc: "算定方法論DB" },
            { icon: "🏢", label: "企業DB", desc: "業界プレイヤー" },
            { icon: "📈", label: "インサイト", desc: "市場・政策分析" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="text-2xl">{item.icon}</div>
              <div className="mt-1 text-xs font-semibold text-gray-700">{item.label}</div>
              <div className="text-[10px] text-gray-400">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "ダッシュボード",
    icon: "📊",
    content: (
      <div className="space-y-3 text-sm text-gray-600">
        <p>
          ダッシュボードでは、カーボン市場の重要指標を一覧できます。
        </p>
        <ul className="space-y-2">
          {[
            "World Bank Carbon Pricing Dashboardの集計データ（80制度・28.6%カバー率）",
            "EU ETS・カナダ・UK ETSの主要価格指標",
            "日本・海外14市場のリアルタイム価格とトレンド",
            "メソドロジー・企業・インサイトの最新件数",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-500">•</span>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
          <p className="text-xs text-emerald-700 font-medium">
            価格データは定期的に更新されます。最新の市場動向を把握しましょう。
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "インサイト",
    icon: "💡",
    content: (
      <div className="space-y-3 text-sm text-gray-600">
        <p>
          インサイトページでは、専門家が執筆した政策・市場・技術分析レポートを読めます。
        </p>
        <ul className="space-y-2">
          {[
            "政策動向: 各国の炭素税・ETSの最新動向",
            "市場分析: 価格変動の背景と今後の見通し",
            "技術トレンド: 測定・報告・検証（MRV）の最前線",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-500">•</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-400 mt-2">
          ※ インサイトコンテンツは順次追加されます。
        </p>
      </div>
    ),
  },
  {
    title: "メソドロジーDB",
    icon: "🔬",
    content: (
      <div className="space-y-3 text-sm text-gray-600">
        <p>
          メソドロジーデータベースでは、カーボンクレジットの算定方法論を検索・比較できます。
        </p>
        <ul className="space-y-2">
          {[
            "ACR・CAR・Gold Standard・Verra等の主要方法論",
            "種別（ARR、REDD+、再エネ等）・地域でフィルタ",
            "信頼性スコア・有効期限で比較",
            "プロジェクト開発・投資判断に活用",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-500">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  // 最終ステップはコンポーネント内で動的に生成するため、ここではプレースホルダー
  { title: "準備完了！", icon: "🎉", content: null },
];

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  // 無料体験の状態を判定
  const subscriptionStatus = (session as { subscriptionStatus?: string } | null)?.subscriptionStatus;
  const isTrialExpired = subscriptionStatus === "trial_expired";
  const isTrialActive = !subscriptionStatus || subscriptionStatus === "trialing";

  // 最終ステップのコンテンツ（セッション状態に応じて切り替え）
  const lastStepContent = (
    <div className="space-y-3 text-sm text-gray-600">
      <p className="text-base font-semibold text-gray-800">
        {isTrialExpired
          ? "無料体験期間が終了しました。"
          : "Carbon Intelligenceの利用準備が整いました。"}
      </p>
      <p>
        {isTrialExpired
          ? "引き続きご利用いただくには、有料プランへのアップグレードが必要です。"
          : "ダッシュボードから最新の市場情報をチェックしてみましょう。ご不明な点はいつでもサポートにお問い合わせください。"}
      </p>
      {isTrialExpired ? (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-center">
          <p className="text-sm font-medium text-amber-700">無料体験期間終了</p>
          <p className="mt-1 text-xs text-amber-600">
            有料プラン（¥2,980/月）にアップグレードして、引き続きご利用ください。
          </p>
        </div>
      ) : isTrialActive ? (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-4 text-center">
          <p className="text-sm font-medium text-emerald-700">7日間の無料体験中</p>
          <p className="mt-1 text-xs text-emerald-600">
            体験終了後は有料プラン（¥2,980/月）への移行が必要です。
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-4 text-center">
          <p className="text-sm font-medium text-emerald-700">プラン有効中</p>
          <p className="mt-1 text-xs text-emerald-600">
            Carbon Intelligenceをご利用いただけます。
          </p>
        </div>
      )}
    </div>
  );

  async function handleNext() {
    if (isLast) {
      setCompleting(true);
      try {
        await fetch("/api/auth/complete-onboarding", { method: "POST" });
        await update({ onboardingCompleted: true });
      } catch {
        // エラーが発生しても遷移は続行
      }
      // 無料期間切れの場合は pricing へ、それ以外はダッシュボードへ
      window.location.href = isTrialExpired ? "/pricing" : "/";
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 bg-emerald-500"
                  : i < step
                  ? "w-2 bg-emerald-300"
                  : "w-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-8 shadow-lg">
          <div className="mb-5 text-center">
            <span className="text-4xl">{current.icon}</span>
            <h2 className="mt-3 text-lg font-bold text-gray-900">{current.title}</h2>
          </div>

          <div>{isLast ? lastStepContent : current.content}</div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-sm text-gray-400 hover:text-gray-600 disabled:invisible transition"
            >
              ← 戻る
            </button>
            <button
              onClick={handleNext}
              disabled={completing}
              className={`rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${
                isLast && isTrialExpired
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {completing
                ? "処理中..."
                : isLast
                ? isTrialExpired
                  ? "プランを確認する →"
                  : "ダッシュボードへ →"
                : "次へ →"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          ステップ {step + 1} / {STEPS.length}
        </p>
      </div>
    </div>
  );
}
