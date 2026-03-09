import type {
  ScrapedMethodology,
  SyncResult,
  SyncRunResult,
  RegistryName,
} from "@/types";
import { getAllAdapters, getAdapter } from "./adapters";
import {
  findBySourceUrl,
  findByTitle,
  createMethodology,
  updateMethodology,
  getExistingHash,
  createSyncNotification,
} from "./wordpress-writer";
import { SYNC_CONFIG } from "./config";

// ============================================================
// 同期エンジン（オーケストレーター）
// スクレイピング → 差分検出 → WordPress Upsert → 通知
// ============================================================

function generateRunId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 1 件のメソドロジーを処理: 既存検索 → ハッシュ比較 → 作成/更新/スキップ
 */
async function processSingle(
  scraped: ScrapedMethodology
): Promise<SyncResult> {
  const timestamp = new Date().toISOString();

  try {
    // 1. source_url で既存投稿を検索
    let wpId = await findBySourceUrl(scraped.sourceUrl);

    // 2. 見つからなければ title で検索
    if (wpId === null) {
      wpId = await findByTitle(scraped.name);
    }

    if (wpId === null) {
      // 3a. 新規作成
      await createMethodology(scraped);
      return {
        methodologyName: scraped.name,
        registry: scraped.registry,
        action: "created",
        timestamp,
      };
    }

    // 3b. 既存あり → ハッシュ比較で変更検知
    const existingHash = await getExistingHash(wpId);
    if (existingHash === scraped.dataHash) {
      return {
        methodologyName: scraped.name,
        registry: scraped.registry,
        action: "unchanged",
        timestamp,
      };
    }

    // 3c. ハッシュ不一致 → 更新
    await updateMethodology(wpId, scraped);
    return {
      methodologyName: scraped.name,
      registry: scraped.registry,
      action: "updated",
      timestamp,
      diff: ["content"],
    };
  } catch (e) {
    return {
      methodologyName: scraped.name,
      registry: scraped.registry,
      action: "error",
      timestamp,
      error: String(e),
    };
  }
}

/**
 * 同期通知を WordPress insights CPT に投稿する。
 */
async function postNotifications(results: SyncResult[]): Promise<void> {
  const actionable = results.filter(
    (r) => r.action === "created" || r.action === "updated"
  );

  for (const result of actionable) {
    const verb = result.action === "created" ? "新規追加" : "更新";
    const title = `【${result.registry}】${result.methodologyName} が${verb}されました`;
    const content =
      result.action === "updated" && result.diff
        ? `${result.registry} のメソドロジー「${result.methodologyName}」が${verb}されました。変更フィールド: ${result.diff.join(", ")}`
        : `${result.registry} のメソドロジー「${result.methodologyName}」が${verb}されました。`;

    await createSyncNotification(title, content, result.registry);
    await delay(SYNC_CONFIG.writeDelayMs);
  }
}

/**
 * 全レジストリ（または特定レジストリ）の同期を実行。
 *
 * @param registryFilter 特定レジストリのみ同期する場合に指定
 * @param dryRun true の場合、WordPress への書き込みをスキップ（スクレイピングのみ）
 */
export async function runSync(
  registryFilter?: RegistryName,
  dryRun = false
): Promise<SyncRunResult> {
  const runId = generateRunId();
  const startedAt = new Date().toISOString();
  const results: SyncResult[] = [];

  console.log(
    `[Sync] Run ${runId} started` +
      (registryFilter ? ` (filter: ${registryFilter})` : "") +
      (dryRun ? " [DRY RUN]" : "")
  );

  // 1. アダプター取得
  const adapters = registryFilter
    ? [getAdapter(registryFilter)].filter(
        (a): a is NonNullable<typeof a> => a !== null
      )
    : getAllAdapters();

  if (adapters.length === 0) {
    console.warn("[Sync] No adapters available");
  }

  // 2. スクレイピング
  const allScraped: ScrapedMethodology[] = [];
  for (const adapter of adapters) {
    console.log(`[Sync] Scraping ${adapter.name}...`);
    const scraped = await adapter.scrape();
    console.log(`[Sync] ${adapter.name}: ${scraped.length} items found`);
    allScraped.push(...scraped);
  }

  // 安全制限
  const toProcess = allScraped.slice(0, SYNC_CONFIG.maxPerRun);
  if (allScraped.length > SYNC_CONFIG.maxPerRun) {
    console.warn(
      `[Sync] Limiting to ${SYNC_CONFIG.maxPerRun} items (${allScraped.length} total)`
    );
  }

  // 3. WordPress Upsert
  if (!dryRun) {
    for (const scraped of toProcess) {
      const result = await processSingle(scraped);
      results.push(result);
      console.log(
        `[Sync] ${result.methodologyName}: ${result.action}` +
          (result.error ? ` — ${result.error}` : "")
      );
      await delay(SYNC_CONFIG.writeDelayMs);
    }
  } else {
    // Dry run: スクレイピング結果のみ記録
    for (const scraped of toProcess) {
      results.push({
        methodologyName: scraped.name,
        registry: scraped.registry,
        action: "unchanged",
        timestamp: new Date().toISOString(),
      });
    }
  }

  const completedAt = new Date().toISOString();
  const summary = {
    created: results.filter((r) => r.action === "created").length,
    updated: results.filter((r) => r.action === "updated").length,
    unchanged: results.filter((r) => r.action === "unchanged").length,
    errors: results.filter((r) => r.action === "error").length,
  };

  // 4. 通知投稿
  if (!dryRun && (summary.created > 0 || summary.updated > 0)) {
    console.log("[Sync] Posting notifications...");
    await postNotifications(results);
  }

  console.log(
    `[Sync] Run ${runId} complete: ` +
      `${summary.created} created, ${summary.updated} updated, ` +
      `${summary.unchanged} unchanged, ${summary.errors} errors`
  );

  return { runId, startedAt, completedAt, results, summary };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
