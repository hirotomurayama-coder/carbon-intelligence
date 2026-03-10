import type { RegistryAdapter } from "./base";
import type { RegistryName } from "@/types";
import { VerraAdapter } from "./verra";
import { GoldStandardAdapter } from "./gold-standard";
import { PuroEarthAdapter } from "./puro-earth";
import { JCreditAdapter } from "./j-credit";
import { REGISTRY_CONFIG } from "../config";

/** 利用可能なアダプターの登録マップ */
const ADAPTER_MAP: Partial<Record<RegistryName, () => RegistryAdapter>> = {
  Verra: () => new VerraAdapter(),
  "Gold Standard": () => new GoldStandardAdapter(),
  "Puro.earth": () => new PuroEarthAdapter(),
  "J-Credit": () => new JCreditAdapter(),
};

/** 有効な全アダプターを取得 */
export function getAllAdapters(): RegistryAdapter[] {
  return Object.entries(ADAPTER_MAP)
    .filter(([name]) => REGISTRY_CONFIG[name as RegistryName]?.enabled)
    .map(([, factory]) => factory());
}

/** 特定のレジストリのアダプターを取得 */
export function getAdapter(name: RegistryName): RegistryAdapter | null {
  const factory = ADAPTER_MAP[name];
  return factory ? factory() : null;
}

/** 利用可能なレジストリ名一覧 */
export function getAvailableRegistries(): RegistryName[] {
  return Object.keys(ADAPTER_MAP) as RegistryName[];
}
