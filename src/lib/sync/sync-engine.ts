import type {
  ScrapedMethodology,
  AiEnrichedFields,
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
  patchTitleJa,
  getAllMethodologiesBasic,
} from "./wordpress-writer";
import { enrichMethodology, isAiEnrichAvailable, translateTitlesBatch } from "./ai-enricher";
import { SYNC_CONFIG } from "./config";
import { VerraAdapter } from "./adapters/verra";
import { JCreditAdapter } from "./adapters/j-credit";

// ============================================================
// 同期エンジン（オーケストレーター）
// スクレイピング → ディープスクレイピング → AI エンリッチ → 差分検出 → WordPress Upsert
// ※ 通知は insights CPT に投稿しない（methodologies の synced_at で追跡）
// ============================================================

function generateRunId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Verra メソドロジーに対してディープスクレイピングを実行。
 * 詳細ページから Active Date, Sectoral Scope, Mitigation Outcome, 本文テキストを取得し、
 * ScrapedMethodology に追加情報を付与する。
 */
async function deepScrapeVerra(
  items: ScrapedMethodology[]
): Promise<void> {
  const verraAdapter = new VerraAdapter();
  const verraItems = items.filter((i) => i.registry === "Verra");

  if (verraItems.length === 0) return;

  console.log(`[Sync] Deep scraping ${verraItems.length} Verra items...`);

  for (let i = 0; i < verraItems.length; i++) {
    const item = verraItems[i];
    console.log(
      `[Sync Deep] ${i + 1}/${verraItems.length}: ${item.name.slice(0, 60)}...`
    );

    const detail = await verraAdapter.scrapeDetailPage(item.sourceUrl);

    // Active Date → lastUpdated に保存（external_last_updated へ書き込まれる）
    if (detail.activeDate) {
      item.lastUpdated = detail.activeDate;
    }

    // 詳細情報を ScrapedMethodology に付与（AI 推論で活用）
    item.detailText = detail.detailText;
    item.sectoralScope = detail.sectoralScope ?? undefined;
    item.mitigationOutcome = detail.mitigationOutcome ?? undefined;

    // ディープスクレイピングのバージョンで上書き（一覧ページより正確）
    if (detail.version) {
      item.version = detail.version;
    }

    // レート制限（Verra サーバー負荷軽減）
    if (i < verraItems.length - 1) {
      await delay(SYNC_CONFIG.scrapeDelayMs);
    }
  }

  console.log(`[Sync] Deep scraping complete`);
}

/**
 * J-Credit メソドロジーに対してディープスクレイピングを実行。
 * 一覧ページを1回だけ取得し、備考テキスト・カテゴリ情報・概要版 PDF URL を
 * ScrapedMethodology に追加して AI エンリッチの精度を高める。
 */
async function deepScrapeJCredit(
  items: ScrapedMethodology[]
): Promise<void> {
  const jcreditItems = items.filter((i) => i.registry === "J-Credit");

  if (jcreditItems.length === 0) return;

  console.log(`[Sync] Deep scraping ${jcreditItems.length} J-Credit items...`);

  const adapter = new JCreditAdapter();

  // 一覧ページ HTML を1回だけ取得（全アイテムで共有）
  const cachedHtml = await adapter.fetchListHtml();
  if (!cachedHtml) {
    console.warn("[Sync] J-Credit list page fetch failed — skipping deep scrape");
    return;
  }

  for (let i = 0; i < jcreditItems.length; i++) {
    const item = jcreditItems[i];

    // メソドロジー ID を name の先頭から抽出（例: "EN-S-001 省エネルギー..." → "EN-S-001"）
    const methodologyId = item.name.split(/\s+/)[0];
    if (!methodologyId) continue;

    console.log(
      `[Sync Deep] ${i + 1}/${jcreditItems.length}: ${methodologyId}`
    );

    const detail = await adapter.scrapeDetailPage(
      methodologyId,
      item.category,
      cachedHtml
    );

    // detailText を付与（AI 推論で活用）
    if (detail.detailText) {
      item.detailText = detail.detailText;
    }

    // ディープスクレイピングのバージョンで上書き（より正確な場合）
    if (detail.version) {
      item.version = detail.version;
    }
  }

  console.log(`[Sync] J-Credit deep scraping complete`);
}

/**
 * 1 件のメソドロジーを処理:
 * 既存検索 → ハッシュ比較 → AI エンリッチ → 作成/更新/スキップ
 *
 * @param forceUpdate true の場合、ハッシュ比較をスキップして無条件で更新
 */
async function processSingle(
  scraped: ScrapedMethodology,
  skipAi: boolean,
  forceUpdate = false
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
      // 3a. 新規作成 → AI エンリッチ実行
      const enriched = skipAi ? null : await safeEnrich(scraped);
      await createMethodology(scraped, enriched);
      return {
        methodologyName: scraped.name,
        registry: scraped.registry,
        action: "created",
        timestamp,
      };
    }

    // 3b-force. 強制更新モード → ハッシュ比較をスキップして無条件更新
    if (forceUpdate) {
      const enriched = skipAi ? null : await safeEnrich(scraped);
      await updateMethodology(wpId, scraped, enriched);
      return {
        methodologyName: scraped.name,
        registry: scraped.registry,
        action: "updated",
        timestamp,
        diff: ["force"],
      };
    }

    // 3b. 既存あり → ハッシュ比較で変更検知
    const existingHash = await getExistingHash(wpId);
    if (existingHash === scraped.dataHash) {
      // ハッシュ一致でも AI フィールドが未設定なら再エンリッチ
      if (!skipAi) {
        const enriched = await safeEnrich(scraped);
        if (enriched) {
          await updateMethodology(wpId, scraped, enriched);
          return {
            methodologyName: scraped.name,
            registry: scraped.registry,
            action: "updated",
            timestamp,
            diff: ["ai_enrichment"],
          };
        }
      }
      return {
        methodologyName: scraped.name,
        registry: scraped.registry,
        action: "unchanged",
        timestamp,
      };
    }

    // 3c. ハッシュ不一致 → AI 再エンリッチ + 更新
    const enriched = skipAi ? null : await safeEnrich(scraped);
    await updateMethodology(wpId, scraped, enriched);
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
 * AI エンリッチのエラーを安全にキャッチ（エンリッチ失敗でも同期は続行）
 */
async function safeEnrich(
  scraped: ScrapedMethodology
): Promise<AiEnrichedFields | null> {
  try {
    return await enrichMethodology(scraped);
  } catch (e) {
    console.error(`[Sync] AI enrich failed for ${scraped.name}:`, e);
    return null;
  }
}

/**
 * 全レジストリ（または特定レジストリ）の同期を実行。
 *
 * @param registryFilter 特定レジストリのみ同期する場合に指定
 * @param dryRun true の場合、WordPress への書き込みをスキップ（スクレイピングのみ）
 * @param skipAi true の場合、AI エンリッチをスキップ（従来動作）
 * @param deepScrape true の場合、詳細ページのディープスクレイピングを実行（デフォルト: true）
 * @param forceUpdate true の場合、ハッシュ比較をスキップして全件を強制更新
 */
export async function runSync(
  registryFilter?: RegistryName,
  dryRun = false,
  skipAi = false,
  deepScrape = true,
  forceUpdate = false
): Promise<SyncRunResult> {
  const runId = generateRunId();
  const startedAt = new Date().toISOString();
  const results: SyncResult[] = [];

  const aiAvailable = !skipAi && isAiEnrichAvailable();

  console.log(
    `[Sync] Run ${runId} started` +
      (registryFilter ? ` (filter: ${registryFilter})` : "") +
      (dryRun ? " [DRY RUN]" : "") +
      (aiAvailable ? " [AI ENRICH ON]" : " [AI ENRICH OFF]") +
      (deepScrape ? " [DEEP SCRAPE ON]" : " [DEEP SCRAPE OFF]") +
      (forceUpdate ? " [FORCE UPDATE]" : "")
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

  // 2. スクレイピング（一覧ページ）
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

  // 2.5. ディープスクレイピング（詳細ページ）
  if (deepScrape) {
    await deepScrapeVerra(toProcess);
    await deepScrapeJCredit(toProcess);
  }

  // 3. WordPress Upsert（+ AI エンリッチ）
  if (!dryRun) {
    for (const scraped of toProcess) {
      const result = await processSingle(scraped, !aiAvailable, forceUpdate);
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

  console.log(
    `[Sync] Run ${runId} complete: ` +
      `${summary.created} created, ${summary.updated} updated, ` +
      `${summary.unchanged} unchanged, ${summary.errors} errors`
  );

  return { runId, startedAt, completedAt, results, summary };
}

// ============================================================
// タイトル翻訳専用モード
// ============================================================

/**
 * 既存メソドロジーの title_ja を AI で翻訳する専用モード。
 * 5秒間隔、失敗時スキップ、ループなし。
 */
export async function runTitleTranslation(
  registryFilter?: RegistryName
): Promise<{ translated: number; skipped: number; errors: number }> {
  console.log("[Sync] Title translation mode started");

  const allPosts = await getAllMethodologiesBasic();

  // レジストリフィルタ + 翻訳が必要なものを抽出
  const needsTranslation = allPosts.filter((p) => {
    if (registryFilter && p.registry !== registryFilter) return false;
    // title_ja が空 or 英語原文と同一 → 翻訳が必要
    return !p.titleJa || p.titleJa === p.name;
  });

  console.log(
    `[Sync] ${needsTranslation.length} items need title translation ` +
      `(out of ${allPosts.length} total)`
  );

  if (needsTranslation.length === 0) {
    return { translated: 0, skipped: 0, errors: 0 };
  }

  if (!isAiEnrichAvailable()) {
    console.warn("[Sync] AI not available — タイトル翻訳をスキップ");
    return { translated: 0, skipped: needsTranslation.length, errors: 0 };
  }

  const translations = await translateTitlesBatch(
    needsTranslation.map((p) => ({ sourceUrl: p.sourceUrl, name: p.name }))
  );

  let translated = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of needsTranslation) {
    const titleJa = translations.get(post.sourceUrl);
    if (!titleJa) {
      skipped++;
      continue;
    }
    try {
      await patchTitleJa(post.wpId, titleJa);
      translated++;
      await delay(500);
    } catch (e) {
      console.error(`[Sync] title_ja 更新失敗: ${post.name}`, e);
      errors++;
    }
  }

  console.log(
    `[Sync] Title translation complete: ${translated} translated, ${skipped} skipped, ${errors} errors`
  );
  return { translated, skipped, errors };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
