/**
 * all-methodologies.json のレジストリ分類を修正するスクリプト
 * - VCS-VM0042 → Verra (VCS - VM0042 のスペースなしパターン)
 * - VCS-ACM0002 → CDM (VCS 登録された CDM 方法論)
 * - CCB → Verra (CCB は Verra が管理)
 * - BCR → Biocarbon Registry
 * - RIV → Riverse (英国 CDR レジストリ)
 * - "Not specified" → 削除
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dir, "../src/data/all-methodologies.json");

const data = JSON.parse(readFileSync(FILE, "utf8"));

function inferFromName(name) {
  const n = name.trim();

  // VCS-prefixed (no space) e.g. "VCS-VM0042", "VCS-ACM0001", "VCS-AMS-I.D."
  const vcsMatch = n.match(/^VCS-(.+)$/);
  if (vcsMatch) {
    const code = vcsMatch[1];
    if (/^VM[R\d]/.test(code)) return ["Verra", code];
    if (/^(ACM|AMS-|AR-ACM|AR-AMS|AR-AM|AM\d)/.test(code)) return ["CDM", code];
    return ["Verra", code]; // default VCS → Verra
  }

  // BCR-prefixed (Biocarbon Registry / Berkeley Carbon Register)
  if (/^BCR\d/.test(n)) return ["BCR", n];

  // RIV-prefixed (Riverse - UK CDR registry)
  if (/^RIV-/.test(n)) return ["Riverse", n];

  // CCB (Climate, Community & Biodiversity - Verra administered)
  // Already handled as CCB registry prefix in CAD data

  // CATS (Carbon Accounting and Trading System)
  // Keep as-is

  // CDM with version suffix: "AMS-I.D V.18", "ACM0002, V.20", "ACM0014: ..." etc.
  if (/^(ACM|AMS-|AR-ACM|AR-AMS|AR-AM|AM\d)[^a-z]/.test(n)) return ["CDM", n.split(/[:,;]/)[0].trim()];

  // Verra with typo: "VM00015" → VM0015
  if (/^VMR?\d\d/.test(n)) return ["Verra", n];

  // Gold Standard GCCM codes
  if (/^GCCM\d/.test(n)) return ["Gold Standard", n.split(/[ ,V]/)[0].trim()];

  // CCB methodology codes (M/LU, M/UT, M/E prefix)
  if (/^M\/[A-Z]/.test(n)) return ["CCB", n];

  // T-VER = Thailand GHG Management Organization
  if (/^T-VER/.test(n)) return ["T-VER", n];

  // TERO = Terrasos (Colombia CDR registry)
  if (/^TERO\.\d/.test(n)) return ["Terrasos", n];

  // Generic REDD+ descriptions → keep as Verra (most REDD+ credits are VCS)
  if (/^REDD\s*\+?:/.test(n)) return ["Verra", n];

  // Plastic Waste methodologies (Verra has plastic waste methodology)
  if (/Plastic Waste/.test(n)) return ["Verra", n];

  // "Not specified" - mark for removal
  if (n.toLowerCase() === "not specified" || n === "") return ["__REMOVE__", n];

  return [null, n]; // no change
}

let fixed = 0;
let removed = 0;
const methodologies = [];

for (const m of data.methodologies) {
  const [newRegistry, newName] = inferFromName(m.name);

  if (newRegistry === "__REMOVE__") {
    removed++;
    continue;
  }

  if (newRegistry !== null) {
    // Update registry and name (use extracted code as cleaner name)
    const oldReg = m.registry;
    m.registry = newRegistry;
    if (newName !== m.name) {
      m.code = m.name; // preserve original as code
      m.name = newName;
    }
    if (oldReg !== newRegistry) fixed++;
  }

  // CCB → Verra (CCB is managed under Verra's umbrella)
  // Keep CCB label but note it's Verra-family
  // Actually keep CCB as its own registry since it has distinct methodology naming

  methodologies.push(m);
}

// Re-sort by totalProjects
methodologies.sort((a, b) => b.totalProjects - a.totalProjects);

// Recompute summary
const byRegistry = {};
for (const m of methodologies) {
  byRegistry[m.registry] = (byRegistry[m.registry] || 0) + 1;
}

data.methodologies = methodologies;
data.summary = {
  total: methodologies.length,
  vrodOnly: methodologies.filter(m => JSON.stringify(m.source) === '["vrod"]').length,
  cadOnly: methodologies.filter(m => JSON.stringify(m.source) === '["cad-trust"]').length,
  both: methodologies.filter(m => m.source.length > 1).length,
  byRegistry,
};
data.generatedAt = new Date().toISOString();

writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");

console.log(`Fixed: ${fixed} registry assignments`);
console.log(`Removed: ${removed} invalid entries`);
console.log(`Total: ${methodologies.length} methodologies`);
console.log("By registry:");
Object.entries(byRegistry)
  .sort((a, b) => b[1] - a[1])
  .forEach(([r, c]) => console.log(`  ${r}: ${c}件`));
