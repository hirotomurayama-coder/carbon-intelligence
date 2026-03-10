/**
 * VM0001 テストスクリプト — ディープスクレイピング + AI エンリッチ + WordPress 更新
 */
import { VerraAdapter } from "../src/lib/sync/adapters/verra";
import { enrichMethodology, isAiEnrichAvailable } from "../src/lib/sync/ai-enricher";
import {
  findBySourceUrl,
  findByTitle,
  updateMethodology,
  createMethodology,
} from "../src/lib/sync/wordpress-writer";

async function testVM0001() {
  console.log("========================================");
  console.log("  VM0001 フルテスト（Deep Scrape + AI）");
  console.log("========================================");
  console.log("AI Available:", isAiEnrichAvailable());
  console.log(
    "WP API:",
    process.env.NEXT_PUBLIC_WORDPRESS_API_URL?.slice(0, 60) ?? "(未設定)"
  );
  console.log("");

  // 1. 一覧スクレイピング
  const adapter = new VerraAdapter();
  const all = await adapter.scrape();
  const vm0001 = all.find((m) => m.sourceUrl.includes("vm0001"));

  if (vm0001 === undefined) {
    console.error("VM0001 not found in scraped list");
    process.exit(1);
  }

  console.log("\n=== Step 1: 一覧スクレイピング結果 ===");
  console.log("Name:", vm0001.name);
  console.log("Source URL:", vm0001.sourceUrl);
  console.log("Category:", vm0001.category);
  console.log("Version:", vm0001.version);
  console.log("Last Updated (from list):", vm0001.lastUpdated);

  // 2. ディープスクレイピング
  console.log("\n=== Step 2: ディープスクレイピング ===");
  const detail = await adapter.scrapeDetailPage(vm0001.sourceUrl);
  if (detail.activeDate) {
    vm0001.lastUpdated = detail.activeDate;
  }
  vm0001.detailText = detail.detailText;
  vm0001.sectoralScope = detail.sectoralScope ?? undefined;
  vm0001.mitigationOutcome = detail.mitigationOutcome ?? undefined;

  console.log("Active Date:", detail.activeDate);
  console.log("Sectoral Scope:", detail.sectoralScope);
  console.log("Mitigation Outcome:", detail.mitigationOutcome);
  console.log("Detail Text length:", detail.detailText.length);

  // 3. AI エンリッチ
  console.log("\n=== Step 3: AI エンリッチ（Gemini） ===");
  const enriched = await enrichMethodology(vm0001);
  console.log("titleJa:", enriched.titleJa);
  console.log("aiSummary:", enriched.aiSummary);
  console.log("creditType:", enriched.creditType);
  console.log("baseType:", enriched.baseType);
  console.log("subCategory:", enriched.subCategory);
  console.log("operationalStatus:", enriched.operationalStatus);
  console.log("certificationBody:", enriched.certificationBody);
  console.log("reliabilityScore:", enriched.reliabilityScore, "(0-100 scale)");

  // 4. WordPress 更新
  console.log("\n=== Step 4: WordPress 更新 ===");
  let wpId = await findBySourceUrl(vm0001.sourceUrl);
  if (wpId === null) {
    wpId = await findByTitle(vm0001.name);
  }

  if (wpId !== null) {
    console.log("既存投稿 ID:", wpId);
    await updateMethodology(wpId, vm0001, enriched);
    console.log("更新完了！");
  } else {
    console.log("既存投稿なし → 新規作成");
    const newId = await createMethodology(vm0001, enriched);
    console.log("作成完了！ ID:", newId);
  }

  console.log("\n========================================");
  console.log("  テスト完了");
  console.log("========================================");
}

testVM0001().catch((e) => {
  console.error("[Fatal]", e);
  process.exit(1);
});
