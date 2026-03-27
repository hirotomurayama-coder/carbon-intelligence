import { Suspense } from "react";
import { getMethodologies } from "@/lib/wordpress";
import { MethodologyList } from "@/components/MethodologyList";
import { CompareProvider } from "@/components/CompareContext";
import { CompareBar } from "@/components/CompareBar";
import type { Methodology, RegistryName } from "@/types";
import vrodStats from "@/data/vrod-stats.json";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ============================================================
// VROD メソドロジーデータの変換
// ============================================================

type VrodMethod = { name: string; projects: number; credits: number };

/** VROD メソドロジーコードから発行機関（レジストリ）を推定 */
function inferRegistry(name: string): RegistryName {
  if (/^(ACM|AMS-[A-Z]|AR-ACM|AR-AMS|AR-AM|AM\d{2}|ACM\d)/.test(name)) return "CDM";
  if (/^VMR?\d/.test(name)) return "Verra";
  if (/^ARB /.test(name)) return "ARB";
  if (
    /^(Improved Forest Management|Advanced Refrigeration|Emissions Reductions through Anti-Idling|Plugging Orphan)/.test(name)
  ) return "CAR";
  if (
    /^(Transition to Advanced Formulation|Certified Reclaimed|Destruction of Ozone Depleting)/.test(name)
  ) return "ACR";
  return "CAR"; // fallback
}

/** VROD creditType / baseType の推定 */
function inferCreditType(name: string): string | null {
  const n = name.toUpperCase();
  if (/AR-ACM|AR-AMS|AR-AM|VMR0006|VM0042|VM0047|IFM|FOREST|REDD|VM0015/.test(n)) return "除去系";
  return "回避・削減系";
}

function inferBaseType(name: string): string | null {
  const n = name.toUpperCase();
  if (/AMS-I\.|ACM000[12]|AMS-I[CDEF]|SOLAR|RENEWABLE|WIND|RE/.test(n)) return "再エネ";
  if (/FOREST|AR-|IFM|MANGROVE|SOIL|REDD|VM0047|VM0042/.test(n)) return "自然ベース";
  if (/DAC|BIOCHAR|MINERALI|ENHANCED ROCK/.test(n)) return "技術ベース";
  return null;
}

/** VROD エントリを Methodology 型に変換 */
function vrodToMethodology(m: VrodMethod): Methodology {
  if (m.name === "Methodology Under Development") return null as unknown as Methodology;
  const registry = inferRegistry(m.name);
  return {
    id: `vrod-${m.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
    title: m.name,
    titleJa: null,
    type: null,
    region: null,
    validUntil: null,
    summary: "",
    reliabilityScore: null,
    registry,
    sourceUrl: null,
    dataHash: null,
    externalLastUpdated: null,
    syncedAt: null,
    aiSummary: null,
    creditType: inferCreditType(m.name),
    baseType: inferBaseType(m.name),
    subCategory: null,
    operationalStatus: "運用中",
    certificationBody: null,
    version: null,
    source: "vrod",
    projectCount: m.projects,
    creditCount: m.credits,
  };
}

export default async function MethodologiesPage() {
  const wpMethodologies = await getMethodologies();

  // WordPress に登録済みのタイトルセット（重複排除用）
  const wpTitleSet = new Set(
    wpMethodologies.map((m) => m.title.trim().toLowerCase())
  );

  // VROD の上位メソドロジーを変換し、WPに未登録のものだけ追加
  const vrodMethodologies = (vrodStats.topMethodologies as VrodMethod[])
    .map(vrodToMethodology)
    .filter((m): m is Methodology => m !== null)
    .filter((m) => !wpTitleSet.has(m.title.trim().toLowerCase()));

  // 合算: WordPress 登録分 (詳細あり) → VROD 分 (統計のみ)
  const allMethodologies: Methodology[] = [...wpMethodologies, ...vrodMethodologies];

  return (
    <CompareProvider>
      <div>
        <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">読み込み中...</div>}>
          <MethodologyList data={allMethodologies} />
        </Suspense>
      </div>
      <CompareBar />
    </CompareProvider>
  );
}
