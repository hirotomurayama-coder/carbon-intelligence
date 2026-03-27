import { Suspense } from "react";
import { getMethodologies } from "@/lib/wordpress";
import { MethodologyList } from "@/components/MethodologyList";
import { CompareProvider } from "@/components/CompareContext";
import { CompareBar } from "@/components/CompareBar";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function MethodologiesPage() {
  const data = await getMethodologies();

  return (
    <CompareProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">メソドロジー</h1>
          <p className="mt-1 text-sm text-gray-500">
            Verra、Gold Standard、CDM等9レジストリの算定手法 ({data.length}件) — 比較ボタンで最大5件まで横並び比較が可能です
          </p>
        </div>
        <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">読み込み中...</div>}>
          <MethodologyList data={data} />
        </Suspense>
      </div>
      <CompareBar />
    </CompareProvider>
  );
}
