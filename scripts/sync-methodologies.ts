/**
 * メソドロジー同期スクリプト（スタンドアロン実行用）
 *
 * 使用方法:
 *   npx tsx scripts/sync-methodologies.ts                      # 全レジストリ同期（AI エンリッチ付き）
 *   npx tsx scripts/sync-methodologies.ts --registry=Verra     # Verra のみ
 *   npx tsx scripts/sync-methodologies.ts --dry-run            # 書き込みなし（テスト用）
 *   npx tsx scripts/sync-methodologies.ts --skip-ai            # AI エンリッチなし
 *
 * 必須環境変数:
 *   NEXT_PUBLIC_WORDPRESS_API_URL   WordPress REST API URL
 *   WP_APP_USER                     WordPress ユーザー名
 *   WP_APP_PASSWORD                 WordPress Application Password
 *
 * オプション環境変数:
 *   GOOGLE_GENERATIVE_AI_API_KEY    Google Gemini API キー（AI エンリッチ用）
 */

import { runSync } from "../src/lib/sync/sync-engine";
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

  const aiStatus = skipAi
    ? "OFF (--skip-ai)"
    : process.env.GOOGLE_GENERATIVE_AI_API_KEY
      ? "ON (Gemini 2.0 Flash)"
      : "OFF (GOOGLE_GENERATIVE_AI_API_KEY 未設定)";

  console.log("========================================");
  console.log("  Carbon Intelligence — メソドロジー同期");
  console.log("========================================");
  console.log(`API URL:  ${process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "(未設定)"}`);
  console.log(`Registry: ${registry ?? "全レジストリ"}`);
  console.log(`Mode:     ${dryRun ? "DRY RUN (書き込みなし)" : "LIVE"}`);
  console.log(`AI:       ${aiStatus}`);
  console.log("========================================\n");

  if (!process.env.NEXT_PUBLIC_WORDPRESS_API_URL) {
    console.error("ERROR: NEXT_PUBLIC_WORDPRESS_API_URL が設定されていません");
    process.exit(1);
  }

  if (!dryRun && (!process.env.WP_APP_USER || !process.env.WP_APP_PASSWORD)) {
    console.error("ERROR: WP_APP_USER / WP_APP_PASSWORD が設定されていません");
    console.error("ヒント: --dry-run で書き込みなしテストが可能です");
    process.exit(1);
  }

  const result = await runSync(registry, dryRun, skipAi);

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
