/**
 * J-Credit の実同期テスト（WordPress 書き込み付き）。
 * 5件だけを --force で同期し、ACF フィールドの埋まりを確認する。
 */

import { JCreditAdapter } from "../src/lib/sync/adapters/j-credit";
import { enrichMethodology, isAiEnrichAvailable } from "../src/lib/sync/ai-enricher";
import {
  findBySourceUrl,
  findByTitle,
  createMethodology,
  updateMethodology,
} from "../src/lib/sync/wordpress-writer";

async function main() {
  console.log("=== J-Credit WordPress Sync Test ===");
  console.log(`API URL: ${process.env.NEXT_PUBLIC_WORDPRESS_API_URL}`);
  console.log(`AI available: ${isAiEnrichAvailable()}`);

  const adapter = new JCreditAdapter();

  // 1. スクレイピング
  const all = await adapter.scrape();
  console.log(`Total scraped: ${all.length}`);

  // 5件選択（各カテゴリから1件 + α）
  const testItems = [
    all.find((i) => i.category === "省エネルギー"),
    all.find((i) => i.category === "森林"),
    all.find((i) => i.category === "再生可能エネルギー"),
    all.find((i) => i.category === "農業"),
    all.find((i) => i.category === "廃棄物"),
  ].filter((i): i is NonNullable<typeof i> => i != null);

  console.log(`\nTest items: ${testItems.length}`);

  // 2. ディープスクレイピング（1回の fetch で全件処理）
  const cachedHtml = await adapter.fetchListHtml();
  if (!cachedHtml) {
    console.error("Failed to fetch list page");
    process.exit(1);
  }

  for (const item of testItems) {
    const methodologyId = item.name.split(/\s+/)[0];
    const detail = await adapter.scrapeDetailPage(methodologyId, item.category, cachedHtml);
    if (detail.detailText) item.detailText = detail.detailText;
    if (detail.version) item.version = detail.version;
  }

  // 3. WordPress Upsert（+ AI エンリッチ）
  for (const item of testItems) {
    const methodologyId = item.name.split(/\s+/)[0];
    console.log(`\n--- ${methodologyId} [${item.category}] ---`);

    // AI エンリッチ
    let enriched = null;
    try {
      enriched = await enrichMethodology(item);
      if (enriched) {
        console.log(`  creditType: ${enriched.creditType}`);
        console.log(`  baseType: ${enriched.baseType}`);
        console.log(`  subCategory: ${enriched.subCategory}`);
        console.log(`  certificationBody: ${enriched.certificationBody}`);
      }
    } catch (e) {
      console.error(`  AI failed: ${e}`);
    }

    // WordPress 検索 & Upsert
    let wpId = await findBySourceUrl(item.sourceUrl);
    if (wpId === null) {
      wpId = await findByTitle(item.name);
    }

    if (wpId === null) {
      console.log("  → Creating new post...");
      const newId = await createMethodology(item, enriched);
      console.log(`  → Created: ID ${newId}`);
    } else {
      console.log(`  → Updating existing post (ID ${wpId})...`);
      await updateMethodology(wpId, item, enriched);
      console.log(`  → Updated`);
    }

    // 3秒インターバル
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("\n=== Sync Test Complete ===");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
