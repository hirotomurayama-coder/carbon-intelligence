"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

const STATUSES = [
  { key: "trialing",      label: "🟡 trialing（体験中）",     desc: "7日間トライアル有効 → ダッシュボード入れる" },
  { key: "trial_expired", label: "🔴 trial_expired（体験終了）", desc: "trial_ends_at を過去日に設定 → /pricing にリダイレクト" },
  { key: "active",        label: "🟢 active（有料）",           desc: "有料会員 → ダッシュボード入れる" },
  { key: "canceled",      label: "⚫ canceled（解約済み）",     desc: "解約後 → /pricing にリダイレクト" },
  { key: "past_due",      label: "🟠 past_due（支払い遅延）",   desc: "請求失敗 → /pricing にリダイレクト" },
];

type TestResult = {
  status: string;
  dbStatus: string | null;
  sessionStatus: string | undefined;
  pass: boolean;
  note: string;
};

export default function AdminTestPage() {
  const { data: session, update } = useSession();
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState("");

  const sessionStatus = (session as { subscriptionStatus?: string } | null)?.subscriptionStatus;

  async function setStatus(status: string): Promise<string> {
    const res = await fetch("/api/admin/set-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    return data.db?.status ?? "unknown";
  }

  async function refreshSession(): Promise<string | undefined> {
    const updated = await update();
    return (updated as { subscriptionStatus?: string } | null)?.subscriptionStatus;
  }

  async function runAllTests() {
    setRunning(true);
    setResults([]);

    const ACCESSIBLE = ["trialing", "active"];
    const BLOCKED    = ["trial_expired", "canceled", "past_due"];

    const newResults: TestResult[] = [];

    for (const { key, label } of STATUSES) {
      setCurrentTest(label);

      // 1. DB に状態をセット
      const dbStatus = await setStatus(key);

      // 2. セッションを強制更新
      await new Promise(r => setTimeout(r, 500)); // DB反映を待つ
      const newSessionStatus = await refreshSession();
      await new Promise(r => setTimeout(r, 300));

      // 3. 期待値と照合
      const shouldAccess = ACCESSIBLE.includes(key);
      const sessionAligned =
        key === "trialing"
          ? newSessionStatus === "trialing"
          : key === "trial_expired"
          ? newSessionStatus === "trial_expired"
          : newSessionStatus === key;

      const pass = sessionAligned;
      const note = shouldAccess
        ? `ダッシュボードへのアクセス: ${sessionAligned ? "✅ 許可される" : "❌ ブロックされる（バグ）"}`
        : `/pricing へのリダイレクト: ${sessionAligned ? "✅ ブロックされる" : "❌ アクセス可能（バグ）"}`;

      newResults.push({ status: key, dbStatus, sessionStatus: newSessionStatus, pass, note });
      setResults([...newResults]);
    }

    // テスト後: active に戻す
    setCurrentTest("テスト完了 → active に復元中...");
    await setStatus("active");
    await new Promise(r => setTimeout(r, 500));
    await refreshSession();
    setCurrentTest("");
    setRunning(false);
  }

  async function manualSet(status: string) {
    await setStatus(status);
    await new Promise(r => setTimeout(r, 300));
    await refreshSession();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-1">サブスクリプション状態テスト</h1>
        <p className="text-sm text-gray-500 mb-6">管理者専用 — 本番運用前に削除してください</p>

        {/* 現在状態 */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <p className="text-xs text-gray-500 mb-1">現在のセッション状態</p>
          <p className="text-lg font-mono font-bold text-gray-800">{sessionStatus ?? "不明"}</p>
          <p className="text-xs text-gray-400 mt-1">ログイン: {session?.user?.email ?? "未ログイン"}</p>
        </div>

        {/* 一括テスト */}
        <button
          onClick={runAllTests}
          disabled={running}
          className="w-full py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 mb-6 transition"
        >
          {running ? `テスト実行中: ${currentTest}` : "▶ 全ケースを自動テスト"}
        </button>

        {/* テスト結果 */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg border mb-6 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-sm font-medium text-gray-700">テスト結果</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-2 text-gray-500">テストケース</th>
                  <th className="text-left px-4 py-2 text-gray-500">DB状態</th>
                  <th className="text-left px-4 py-2 text-gray-500">セッション</th>
                  <th className="text-left px-4 py-2 text-gray-500">判定</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.status} className={`border-b ${r.pass ? "bg-green-50" : "bg-red-50"}`}>
                    <td className="px-4 py-3 font-mono">{r.status}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{r.dbStatus}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{r.sessionStatus}</td>
                    <td className="px-4 py-3">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 手動切り替え */}
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">手動で状態を切り替える</p>
          <div className="space-y-2">
            {STATUSES.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <button
                  onClick={() => manualSet(key)}
                  disabled={running}
                  className="shrink-0 px-3 py-1.5 bg-gray-800 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 transition"
                >
                  セット
                </button>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          状態を変更後、ページをリロードしてリダイレクト動作を確認してください。
        </p>
      </div>
    </div>
  );
}
