import type { NextConfig } from "next";

// ============================================================
// ⚠️  システム保護: 以下の制約を厳守すること
// ------------------------------------------------------------
// - API ドメインは carboncreditsjp.wpcomstaging.com に固定
//   （環境変数 NEXT_PUBLIC_WORDPRESS_API_URL で管理）
// - carboncredits.jp（既存ニュースサイト）への rewrites/redirects 禁止
// - basePath の追加禁止（サブドメイン独立運用のため不要）
// - 詳細は CLAUDE.md および README.md を参照
// ============================================================

const nextConfig: NextConfig = {};

export default nextConfig;
