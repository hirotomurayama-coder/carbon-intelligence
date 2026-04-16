/**
 * ai_summary 一括生成スクリプト
 *
 * source_url はあるが ai_summary が空の WordPress メソドロジーエントリを対象に
 * Gemini API で日本語解説文を生成して WP に書き込む。
 *
 * 使用方法:
 *   npx tsx scripts/fill-ai-summaries.ts                       # 全レジストリ
 *   npx tsx scripts/fill-ai-summaries.ts --registry=J-Credit   # J-Credit のみ
 *   npx tsx scripts/fill-ai-summaries.ts --registry="Gold Standard"
 *   npx tsx scripts/fill-ai-summaries.ts --registry=Verra
 *   npx tsx scripts/fill-ai-summaries.ts --registry=Puro.earth
 *   npx tsx scripts/fill-ai-summaries.ts --dry-run             # WP書き込みなし
 *   npx tsx scripts/fill-ai-summaries.ts --limit=20            # 最大20件で止める
 *
 * 必要な環境変数:
 *   NEXT_PUBLIC_WORDPRESS_API_URL
 *   WP_APP_USER
 *   WP_APP_PASSWORD
 *   GOOGLE_GENERATIVE_AI_API_KEY
 */

import { enrichMethodology } from "../src/lib/sync/ai-enricher";
import type { ScrapedMethodology, RegistryName } from "../src/types";
import * as crypto from "crypto";

// ── 設定 ─────────────────────────────────────────────────────────

const WP_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";
const WP_AUTH = Buffer.from(
  `${process.env.WP_APP_USER ?? ""}:${process.env.WP_APP_PASSWORD ?? ""}`
).toString("base64");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const registryFilter = args.find(a => a.startsWith("--registry="))?.split("=")[1] ?? null;
const limitArg = args.find(a => a.startsWith("--limit="));
const maxItems = limitArg ? parseInt(limitArg.split("=")[1]) : Infinity;

/** Gemini API コール間隔（ms）— レート制限対策 */
const API_INTERVAL_MS = 1500;

// ── WP API ───────────────────────────────────────────────────────

interface WPAcf {
  registry: string;
  source_url: string;
  title_ja: string;
  ai_summary: string;
  sub_category: string;
  credit_type: string;
  base_type: string;
  status: string;
  standard: string;
  version: string;
  external_last_updated: string;
}

interface WPEntry {
  id: number;
  title: { rendered: string };
  acf: WPAcf;
}

async function wpFetch(endpoint: string): Promise<WPEntry[]> {
  const res = await fetch(`${WP_BASE}${endpoint}`, {
    headers: { Authorization: `Basic ${WP_AUTH}` },
  });
  if (!res.ok) throw new Error(`GET ${endpoint} → ${res.status}`);
  return res.json() as Promise<WPEntry[]>;
}

async function wpPut(id: number, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${WP_BASE}/methodologies/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${WP_AUTH}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT /methodologies/${id} → ${res.status}: ${text.slice(0, 200)}`);
  }
}

/** ai_summary が空で source_url がある全エントリを取得 */
async function fetchTargets(registry: string | null): Promise<WPEntry[]> {
  const targets: WPEntry[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
      _fields: "id,title,acf",
    });
    let items: WPEntry[];
    try {
      items = await wpFetch(`/methodologies?${params}`);
    } catch {
      break;
    }
    if (items.length === 0) break;

    for (const item of items) {
      const acf = item.acf;
      if (!acf || typeof acf !== "object") continue;
      const hasSourceUrl = Boolean(acf.source_url?.trim());
      const hasAiSummary = Boolean(acf.ai_summary?.trim());
      const matchesRegistry = !registry || acf.registry === registry;
      if (hasSourceUrl && !hasAiSummary && matchesRegistry) {
        targets.push(item);
      }
    }

    if (items.length < 100) break;
    page++;
  }

  return targets;
}

/** WP ACF データから ScrapedMethodology を構築 */
function buildScraped(entry: WPEntry): ScrapedMethodology {
  const acf = entry.acf;
  const title = entry.title.rendered.replace(/<[^>]+>/g, "").trim();

  // description: title_ja があれば活用。なければ英語タイトルをそのまま
  const description = acf.title_ja?.trim() && acf.title_ja !== title
    ? acf.title_ja.trim()
    : "";

  return {
    name: title,
    description,
    registry: acf.registry as RegistryName,
    category: acf.sub_category ?? "",
    status: acf.status ?? "Active",
    sourceUrl: acf.source_url ?? "",
    lastUpdated: acf.external_last_updated ?? null,
    version: acf.version ?? null,
    dataHash: crypto.createHash("sha256").update(title).digest("hex"),
  };
}

// ── メイン ────────────────────────────────────────────────────────

async function main() {
  console.log("============================================");
  console.log("  ai_summary 一括生成");
  console.log("============================================");
  if (isDryRun)       console.log("モード: Dry Run（WP書き込みなし）");
  if (registryFilter) console.log(`対象レジストリ: ${registryFilter}`);
  if (maxItems !== Infinity) console.log(`上限: ${maxItems}件`);
  console.log("");

  // 環境変数チェック
  if (!WP_BASE) { console.error("ERROR: NEXT_PUBLIC_WORDPRESS_API_URL 未設定"); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY 未設定"); process.exit(1);
  }
  if (!isDryRun && (!process.env.WP_APP_USER || !process.env.WP_APP_PASSWORD)) {
    console.error("ERROR: WP_APP_USER / WP_APP_PASSWORD 未設定"); process.exit(1);
  }

  // 対象取得
  console.log("📋 対象エントリを取得中...");
  const targets = await fetchTargets(registryFilter);
  const limited = targets.slice(0, maxItems);

  // レジストリ別の内訳を表示
  const byRegistry: Record<string, number> = {};
  for (const t of targets) {
    byRegistry[t.acf.registry] = (byRegistry[t.acf.registry] ?? 0) + 1;
  }
  console.log(`\n対象合計: ${targets.length}件${limited.length < targets.length ? ` (今回は ${limited.length}件まで)` : ""}`);
  for (const [reg, cnt] of Object.entries(byRegistry).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reg}: ${cnt}件`);
  }
  console.log("");

  if (limited.length === 0) {
    console.log("✅ 対象なし（全エントリに ai_summary が設定済み）");
    return;
  }

  // 処理ループ
  let done = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < limited.length; i++) {
    const entry = limited[i];
    const scraped = buildScraped(entry);
    const pct = Math.round(((i + 1) / limited.length) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const eta = i > 0 ? Math.round((elapsed / i) * (limited.length - i)) : "—";

    process.stdout.write(
      `[${String(i + 1).padStart(3)}/${limited.length}] ${pct}% | ETA: ${eta}s | ${scraped.name.slice(0, 45).padEnd(45)} ... `
    );

    try {
      const enriched = await enrichMethodology(scraped);

      if (!enriched || !enriched.aiSummary) {
        console.log("⚠️  summary空");
        failed++;
      } else if (isDryRun) {
        console.log(`[DRY] "${enriched.aiSummary.slice(0, 40)}…"`);
        done++;
      } else {
        await wpPut(entry.id, {
          acf: {
            ai_summary: enriched.aiSummary,
            // ai_summary 以外のフィールドも空なら一緒に補完
            ...(entry.acf.credit_type ? {} : enriched.creditType ? { credit_type: enriched.creditType } : {}),
            ...(entry.acf.base_type   ? {} : enriched.baseType   ? { base_type:   enriched.baseType   } : {}),
            ...(entry.acf.sub_category ? {} : enriched.subCategory ? { sub_category: enriched.subCategory } : {}),
            ...(entry.acf.standard    ? {} : enriched.certificationBody ? { standard: enriched.certificationBody } : {}),
          },
        });
        console.log(`✅ "${enriched.aiSummary.slice(0, 40)}…"`);
        done++;
      }
    } catch (e) {
      console.log(`❌ ${(e as Error).message.slice(0, 60)}`);
      failed++;
    }

    // レート制限: 最後の1件以外は待機
    if (i < limited.length - 1) {
      await new Promise(r => setTimeout(r, API_INTERVAL_MS));
    }
  }

  // 最終レポート
  const totalSec = Math.round((Date.now() - startTime) / 1000);
  console.log("\n============================================");
  console.log(`✅ 完了: ${done}件成功 / ${failed}件失敗 / ${totalSec}秒`);
  console.log("============================================");

  if (failed > 0) {
    console.log("\n💡 失敗分の再実行:");
    console.log(`   npx tsx scripts/fill-ai-summaries.ts${registryFilter ? ` --registry="${registryFilter}"` : ""}`);
  }
}

main().catch(e => { console.error("致命的エラー:", e); process.exit(1); });
