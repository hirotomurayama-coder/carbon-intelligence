/**
 * メソドロジー同期スクリプト（スタンドアロン実行用）
 *
 * 使用方法:
 *   npx tsx scripts/sync-methodologies.ts                      # 全レジストリ同期（AI エンリッチ + ディープスクレイピング付き）
 *   npx tsx scripts/sync-methodologies.ts --registry=Verra     # Verra のみ
 *   npx tsx scripts/sync-methodologies.ts --dry-run            # 書き込みなし（テスト用）
 *   npx tsx scripts/sync-methodologies.ts --skip-ai            # AI エンリッチなし
 *   npx tsx scripts/sync-methodologies.ts --no-deep-scrape     # ディープスクレイピングなし（高速モード）
 *   npx tsx scripts/sync-methodologies.ts --force              # 全件強制更新（ハッシュ比較スキップ）
 *   npx tsx scripts/sync-methodologies.ts --titles-only        # タイトル翻訳のみ（5秒間隔安全モード）
 *
 * 必須環境変数:
 *   NEXT_PUBLIC_WORDPRESS_API_URL   WordPress REST API URL
 *   WP_APP_USER                     WordPress ユーザー名
 *   WP_APP_PASSWORD                 WordPress Application Password
 *
 * オプション環境変数:
 *   GOOGLE_GENERATIVE_AI_API_KEY    Google Gemini API キー（AI エンリッチ用）
 */

import { runSync, runTitleTranslation } from "../src/lib/sync/sync-engine";
import type { RegistryName } from "../src/types";

async function main() {
  const args = process.argv.slice(2);

  // --registry=Verra
  const registryArg = args.find((a) => a.startsWith("--registry="));
  const registry = registryArg
    ? (registryArg.split("=")[1] as RegistryName)
    : undefined;

  // --dry-run
  const dryRun = args.includes("--dry-run");

  // --skip-ai
  const skipAi = args.includes("--skip-ai");

  // --no-deep-scrape（デフォルトはディープスクレイピング有効）
  const deepScrape = !args.includes("--no-deep-scrape");

  // --force（ハッシュ比較をスキップして全件強制更新）
  const forceUpdate = args.includes("--force");

  // --titles-only（タイトル翻訳のみ）
  const titlesOnly = args.includes("--titles-only");

  const aiStatus = skipAi
    ? "OFF (--skip-ai)"
    : process.env.GOOGLE_GENERATIVE_AI_API_KEY
      ? "ON (Gemini 2.0 Flash)"
      : "OFF (GOOGLE_GENERATIVE_AI_API_KEY 未設定)";

  console.log("========================================");
  console.log("  Carbon Intelligence — メソドロジー同期");
  console.log("========================================");
  console.log(`API URL:      ${process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "(未設定)"}`);
  console.log(`Registry:     ${registry ?? "全レジストリ"}`);

  if (!process.env.NEXT_PUBLIC_WORDPRESS_API_URL) {
    console.error("ERROR: NEXT_PUBLIC_WORDPRESS_API_URL が設定されていません");
    process.exit(1);
  }

  if (!process.env.WP_APP_USER || !process.env.WP_APP_PASSWORD) {
    if (!dryRun) {
      console.error("ERROR: WP_APP_USER / WP_APP_PASSWORD が設定されていません");
      console.error("ヒント: --dry-run で書き込みなしテストが可能です");
      process.exit(1);
    }
  }

  // タイトル翻訳モード
  if (titlesOnly) {
    console.log(`Mode:         TITLES ONLY (タイトル翻訳のみ)`);
    console.log(`AI:           ${aiStatus}`);
    console.log("========================================\n");

    const result = await runTitleTranslation(registry);

    console.log("\n========================================");
    console.log("  タイトル翻訳結果サマリー");
    console.log("========================================");
    console.log(`翻訳成功:  ${result.translated}`);
    console.log(`スキップ:  ${result.skipped}`);
    console.log(`エラー:    ${result.errors}`);
    console.log("========================================");
    return;
  }

  // 通常同期モード
  console.log(`Mode:         ${dryRun ? "DRY RUN (書き込みなし)" : "LIVE"}`);
  console.log(`AI:           ${aiStatus}`);
  console.log(`Deep Scrape:  ${deepScrape ? "ON" : "OFF (--no-deep-scrape)"}`);
  console.log(`Force:        ${forceUpdate ? "ON (全件強制更新)" : "OFF"}`);
  console.log("========================================\n");

  const result = await runSync(registry, dryRun, skipAi, deepScrape, forceUpdate);

  console.log("\n========================================");
  console.log("  同期結果サマリー");
  console.log("========================================");
  console.log(`Run ID:    ${result.runId}`);
  console.log(`開始:      ${result.startedAt}`);
  console.log(`完了:      ${result.completedAt}`);
  console.log(`新規作成:  ${result.summary.created}`);
  console.log(`更新:      ${result.summary.updated}`);
  console.log(`変更なし:  ${result.summary.unchanged}`);
  console.log(`エラー:    ${result.summary.errors}`);
  console.log("========================================");

  if (result.summary.errors > 0) {
    console.error("\nエラーが発生した項目:");
    result.results
      .filter((r) => r.action === "error")
      .forEach((r) => {
        console.error(`  - ${r.methodologyName} (${r.registry}): ${r.error}`);
      });
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[Fatal] 同期スクリプトが異常終了:", e);
  process.exit(1);
});
