import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "設定 | Carbon Intelligence",
};

export default function SettingsPage() {
  const apiBase = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "未設定";
  const hasDriveKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const hasDriveFolder = !!process.env.GOOGLE_DRIVE_FOLDER_ID;
  const hasGemini = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="mt-1 text-sm text-gray-400">
          システム接続状況と運用情報
        </p>
      </div>

      {/* データソース接続状況 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">データソース接続状況</h2>
        <div className="space-y-3">
          <StatusRow
            label="WordPress REST API"
            value={apiBase.replace("https://", "").replace("/wp-json/wp/v2", "")}
            ok={!!apiBase && apiBase !== "未設定"}
          />
          <StatusRow
            label="Google Drive（ライブラリ）"
            value={hasDriveKey && hasDriveFolder ? "接続済み" : "未接続"}
            ok={hasDriveKey && hasDriveFolder}
          />
          <StatusRow
            label="Gemini AI（市場分析・週次ブリーフ）"
            value={hasGemini ? "APIキー設定済み" : "未設定（フォールバックモード）"}
            ok={hasGemini}
          />
          <StatusRow
            label="Claude AI（ライブラリチャット）"
            value={hasAnthropic ? "APIキー設定済み" : "未設定"}
            ok={hasAnthropic}
          />
        </div>
      </div>

      {/* 自動更新スケジュール */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">自動更新スケジュール</h2>
        <div className="space-y-3">
          <ScheduleRow
            label="価格データ同期"
            schedule="毎週月曜 09:00 JST"
            command="npm run sync-prices"
          />
          <ScheduleRow
            label="AI市場分析"
            schedule="毎週月曜（価格同期後）"
            command="npm run analyze-market"
          />
          <ScheduleRow
            label="週次マーケットブリーフ"
            schedule="毎週月曜（市場分析後）"
            command="npm run generate-weekly-brief"
          />
          <ScheduleRow
            label="企業データ更新"
            schedule="毎月1日 09:00 JST"
            command="npm run sync-companies"
          />
        </div>
      </div>

      {/* データベース概要 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">データベース概要</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DataCard label="メソドロジー" endpoint="/methodologies" />
          <DataCard label="企業" endpoint="/companies" />
          <DataCard label="インサイト" endpoint="/insights" />
          <DataCard label="価格データ" endpoint="/price_trends" />
        </div>
      </div>

      {/* 手動実行ガイド */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">手動実行コマンド</h2>
        <div className="space-y-2 font-mono text-xs">
          <CodeBlock label="価格データ同期" command="source .env.local && export NEXT_PUBLIC_WORDPRESS_API_URL WP_APP_USER WP_APP_PASSWORD GOOGLE_GENERATIVE_AI_API_KEY && npm run sync-prices" />
          <CodeBlock label="AI市場分析" command="npm run analyze-market" />
          <CodeBlock label="週次ブリーフ" command="npm run generate-weekly-brief" />
          <CodeBlock label="企業データ更新" command="npm run sync-companies" />
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-gray-300"}`} />
        <span className={`text-sm ${ok ? "text-gray-900" : "text-gray-400"}`}>{value}</span>
      </div>
    </div>
  );
}

function ScheduleRow({ label, schedule, command }: { label: string; schedule: string; command: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        <span className="ml-2 text-xs text-gray-400">{schedule}</span>
      </div>
      <code className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500">{command}</code>
    </div>
  );
}

function DataCard({ label, endpoint }: { label: string; endpoint: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
      <div className="text-xs text-gray-400">{label}</div>
      <code className="mt-1 block text-[10px] text-gray-500">{endpoint}</code>
    </div>
  );
}

function CodeBlock({ label, command }: { label: string; command: string }) {
  return (
    <div className="rounded-lg bg-gray-900 p-3">
      <div className="text-[10px] text-gray-400 mb-1"># {label}</div>
      <div className="text-emerald-400 break-all">{command}</div>
    </div>
  );
}
