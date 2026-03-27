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
      <div>
        <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">読み込み中...</div>}>
          <MethodologyList data={data} />
        </Suspense>
      </div>
      <CompareBar />
    </CompareProvider>
  );
}
