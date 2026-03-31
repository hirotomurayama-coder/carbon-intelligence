/**
 * J-Credit ディープスクレイピング + AI エンリッチのテスト。
 * 3件のみ処理して detailText と AI 推論結果を確認する。
 */

import { JCreditAdapter } from "../src/lib/sync/adapters/j-credit";
import { enrichMethodology, isAiEnrichAvailable } from "../src/lib/sync/ai-enricher";

async function main() {
  const adapter = new JCreditAdapter();

  // 1. 一覧ページをスクレイピング
  console.log("=== Step 1: Scraping J-Credit list page ===");
  const all = await adapter.scrape();
  console.log(`Total items: ${all.length}`);

  // 3件だけ処理（省エネ、森林、再エネから1件ずつ）
  const testItems = [
    all.find((i) => i.category === "省エネルギー"),
    all.find((i) => i.category === "森林"),
    all.find((i) => i.category === "再生可能エネルギー"),
  ].filter((i): i is NonNullable<typeof i> => i != null);

  console.log(`\nTest items: ${testItems.length}`);
  testItems.forEach((i) => console.log(`  - ${i.name} [${i.category}]`));

  // 2. 一覧ページ HTML を1回だけ取得
  console.log("\n=== Step 2: Deep scraping (single fetch) ===");
  const cachedHtml = await adapter.fetchListHtml();
  if (!cachedHtml) {
    console.error("Failed to fetch list page");
    process.exit(1);
  }

  for (const item of testItems) {
    const methodologyId = item.name.split(/\s+/)[0];
    console.log(`\n--- ${methodologyId} (${item.category}) ---`);

    const detail = await adapter.scrapeDetailPage(
      methodologyId,
      item.category,
      cachedHtml
    );

    console.log(`  detailText: ${detail.detailText.slice(0, 200)}`);
    console.log(`  outlinePdfUrl: ${detail.outlinePdfUrl}`);
    console.log(`  notes: ${detail.notes}`);
    console.log(`  version: ${detail.version}`);

    // detailText を ScrapedMethodology に付与
    if (detail.detailText) {
      item.detailText = detail.detailText;
    }
    if (detail.version) {
      item.version = detail.version;
    }
  }

  // 3. AI エンリッチ
  console.log("\n=== Step 3: AI Enrichment ===");
  console.log(`AI available: ${isAiEnrichAvailable()}`);

  for (const item of testItems) {
    const methodologyId = item.name.split(/\s+/)[0];
    console.log(`\n--- AI Enrich: ${methodologyId} ---`);

    try {
      const enriched = await enrichMethodology(item);
      if (enriched) {
        console.log(`  creditType: ${enriched.creditType}`);
        console.log(`  baseType: ${enriched.baseType}`);
        console.log(`  subCategory: ${enriched.subCategory}`);
        console.log(`  operationalStatus: ${enriched.operationalStatus}`);
        console.log(`  certificationBody: ${enriched.certificationBody}`);
        console.log(`  titleJa: ${enriched.titleJa?.slice(0, 80)}`);
        console.log(`  aiSummary: ${enriched.aiSummary?.slice(0, 120)}`);
      } else {
        console.log("  → null (no enrichment)");
      }
    } catch (e) {
      console.error(`  → Error: ${e}`);
    }

    // 2秒待機
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
