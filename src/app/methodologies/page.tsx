import { Suspense } from "react";
import { getMethodologies } from "@/lib/wordpress";
import { MethodologyList } from "@/components/MethodologyList";
import { CompareProvider } from "@/components/CompareContext";
import { CompareBar } from "@/components/CompareBar";
import type { Methodology, RegistryName } from "@/types";
import allMethodsData from "@/data/all-methodologies.json";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ============================================================
// all-methodologies.json のエントリ型
// ============================================================

type AllMethodologyEntry = {
  name: string;
  registry: string;
  projectsVrod: number;
  creditsVrod: number;
  projectsCad: number;
  totalProjects: number;
  source: string[];
  code?: string; // VCS-VM0042 などのオリジナルコード
};

// ============================================================
// レジストリ名を RegistryName 型に正規化
// ============================================================

const REGISTRY_ALIAS: Record<string, RegistryName> = {
  Verra: "Verra",
  VCS: "Verra",
  "Gold Standard": "Gold Standard",
  GS: "Gold Standard",
  CDM: "CDM",
  ARB: "ARB",
  CAR: "CAR",
  ACR: "ACR",
  ART: "ART",
  "Puro.earth": "Puro.earth",
  Isometric: "Isometric",
  "J-Credit": "J-Credit",
};

function toRegistryName(raw: string): RegistryName | null {
  return REGISTRY_ALIAS[raw] ?? null;
}

// ============================================================
// creditType / baseType の推定
// ============================================================

function inferCreditType(name: string): string | null {
  const n = name.toUpperCase();
  if (/AR-ACM|AR-AMS|AR-AM|VMR0006|VM0042|VM0047|VM0015|IFM|FOREST|REDD|REFORESTATION|WETLAND|MANGROVE|SOIL|SEAGRASS|BLUE CARBON|DAC|BIOCHAR|ERW|MINERALI|ENHANCED ROCK|REMOVAL/.test(n)) return "除去系";
  return "回避・削減系";
}

function inferBaseType(name: string): string | null {
  const n = name.toUpperCase();
  if (/AMS-I\.|ACM000[12]|SOLAR|RENEWABLE|WIND|HYDRO|GEOTHERMAL|BIOMASS ENERGY/.test(n)) return "再エネ";
  if (/FOREST|AR-|IFM|MANGROVE|SOIL|REDD|VM0047|VM0042|VM0015|WETLAND|SEAGRASS|GRASSLAND|AFFORESTATION|REFORESTATION/.test(n)) return "自然ベース";
  if (/DAC|BIOCHAR|MINERALI|ENHANCED ROCK|DIRECT AIR/.test(n)) return "技術ベース";
  return null;
}

// ============================================================
// 外部エントリ → Methodology 型変換
// ============================================================

function externalToMethodology(m: AllMethodologyEntry): Methodology {
  const registry = toRegistryName(m.registry);
  const totalProjects = m.totalProjects;
  // ソース種別を判定
  const hasCad = m.source.includes("cad-trust");
  const hasVrod = m.source.includes("vrod");
  const sourceLabel = hasCad && hasVrod ? "vrod" : hasCad ? "cad-trust" : "vrod";

  return {
    id: `ext-${m.name.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 60)}`,
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
    certificationBody: m.registry !== (registry ?? "") ? m.registry : null,
    version: null,
    source: sourceLabel as "vrod" | "cad-trust",
    projectCount: totalProjects > 0 ? totalProjects : null,
    creditCount: m.creditsVrod > 0 ? m.creditsVrod : null,
  };
}

// ============================================================
// ページ
// ============================================================

export default async function MethodologiesPage() {
  const wpMethodologies = await getMethodologies();

  // WordPress 登録済みタイトルセット（重複排除）
  const wpTitleSet = new Set(
    wpMethodologies.map((m) => m.title.trim().toLowerCase())
  );
  // コードベースの突合用セット（"VM0042" など短縮形も含む）
  const wpCodeSet = new Set(
    wpMethodologies.flatMap((m) => {
      const parts = [m.title.trim().toLowerCase()];
      // タイトルの最初のトークン（コード部分）も登録
      const firstToken = m.title.split(/[\s,;:]/)[0].toLowerCase();
      if (firstToken) parts.push(firstToken);
      return parts;
    })
  );

  // 外部メソドロジーを変換し、WP登録済みを除外
  const externalMethodologies = (allMethodsData.methodologies as AllMethodologyEntry[])
    .filter((m) => {
      const titleLower = m.name.trim().toLowerCase();
      const codeLower = (m.code ?? m.name).trim().toLowerCase();
      return !wpTitleSet.has(titleLower) && !wpCodeSet.has(codeLower);
    })
    .map(externalToMethodology);

  // 合算: WP登録分（詳細・比較あり）→ 外部データ分（統計のみ）
  const allMethodologies: Methodology[] = [...wpMethodologies, ...externalMethodologies];

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
