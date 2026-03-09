# Carbon Credit Market Intelligence Platform

カーボンクレジット市場のメソドロジー・企業・インサイトを一覧管理するダッシュボードシステム。

**本番URL**: https://intelligence.carboncredits.jp

---

## アーキテクチャ

```
┌─────────────────────────────┐      REST API       ┌──────────────────────────────────────┐
│  intelligence.carboncredits.jp  │  ──────────────>  │  carboncreditsjp.wpcomstaging.com     │
│  (Vercel / Next.js)             │   GET /wp-json/   │  (WordPress.com staging)              │
│                                 │   wp/v2/{cpt}     │                                      │
│  - ダッシュボード               │                   │  CPT: methodologies                  │
│  - メソドロジー一覧             │  <──────────────  │  CPT: companies                      │
│  - 企業データベース             │   JSON response   │  CPT: insights                       │
└─────────────────────────────┘                      └──────────────────────────────────────┘
```

### 重要な制約

| ルール | 説明 |
|--------|------|
| **API ドメイン固定** | `https://carboncreditsjp.wpcomstaging.com/wp-json/wp/v2` のみ使用 |
| **ルートドメイン禁止** | `carboncredits.jp`（既存ニュースサイト）のAPIやファイルを参照・操作しない |
| **サブドメイン独立** | intelligence.carboncredits.jp は独立したシステム。親ドメインに影響を与えない |

---

## セットアップ

### 前提条件

- Node.js 18+
- npm

### インストール

```bash
git clone <repository-url>
cd carbon-intelligence-platform
npm install
```

### 環境変数

`.env.local` を作成:

```env
NEXT_PUBLIC_WORDPRESS_API_URL=https://carboncreditsjp.wpcomstaging.com/wp-json/wp/v2
```

### 開発サーバー

```bash
npm run dev
# http://localhost:3000 でアクセス
```

### ビルド

```bash
npx next build
```

---

## データソース

WordPress REST API の 3 つのカスタム投稿タイプ (CPT) からデータを取得:

| CPT | エンドポイント | UI 表示 |
|-----|---------------|---------|
| `methodologies` | `/methodologies` | メソドロジー（算定方法論）テーブル |
| `companies` | `/companies` | 企業カード一覧 |
| `insights` | `/insights` | インサイトリスト |

### ACF カスタムフィールド

各 CPT は ACF (Advanced Custom Fields) プラグインでカスタムフィールドを持つ。
WordPress 管理画面でフィールドグループを作成しデータを入力すると、UI に自動反映される。

| CPT | フィールド名 | 型 | 値の例 |
|-----|-------------|-----|-------|
| methodologies | `methodology_type` | テキスト | "ARR", "REDD+", "マングローブ" |
| methodologies | `region` | テキスト | "日本", "東南アジア" |
| methodologies | `valid_until` | 日付 | "2027-12-31" |
| methodologies | `reliability_score` | 数値 | 85 |
| companies | `company_category` | テキスト | "創出事業者", "仲介", "コンサル", "検証機関" |
| companies | `headquarters` | テキスト | "東京都千代田区" |
| companies | `main_projects` | テキスト(CSV) | "森林保全,再エネ" |
| insights | `insight_category` | テキスト | "政策", "市場", "技術" |

**ACF 未設定時の挙動**: フィールドが空の場合、UI は "—"（ダッシュ）または "未分類" を表示する。スコアは `null` として扱い、平均計算の分母から除外する。

---

## ディレクトリ構造

```
src/
  app/
    page.tsx              # ダッシュボード（KPI + 3セクション概要）
    layout.tsx            # 共通レイアウト（サイドバー + ヘッダー）
    methodologies/        # メソドロジー一覧ページ
    companies/            # 企業一覧ページ
    api/debug/route.ts    # デバッグ API（ACF 状態確認）
  components/
    MethodologyList.tsx   # メソドロジーテーブル（クライアントコンポーネント）
    CompanyList.tsx       # 企業カード一覧（クライアントコンポーネント）
    ui/                   # 共通 UI（Badge, SearchInput, TabGroup 等）
  lib/
    wordpress.ts          # WordPress REST API 接続・データマッピング層
    constants.ts          # ナビゲーション定義
  types/
    index.ts              # 型定義（MethodologyType, CompanyCategory 等）
```

---

## デプロイ

`main` ブランチへの push で Vercel が自動デプロイ:

```bash
git push origin main
# → intelligence.carboncredits.jp に反映
```

### Vercel 環境変数

Production / Preview / Development すべてに以下を設定済み:

```
NEXT_PUBLIC_WORDPRESS_API_URL=https://carboncreditsjp.wpcomstaging.com/wp-json/wp/v2
```

---

## デバッグ

### API 接続確認

```
https://intelligence.carboncredits.jp/api/debug
```

各 CPT のステータス・ACF フィールド状態・レスポンスプレビューを JSON で返す。

---

## システム保護ルール

本プロジェクトの安定運用のため、以下のルールを厳守すること:

1. **API エンドポイントは `carboncreditsjp.wpcomstaging.com` に固定** — 他のドメインに変更しない
2. **`carboncredits.jp` ルートドメインのリソースを参照しない** — 既存ニュースサイトとは完全分離
3. **`src/lib/wordpress.ts` の `getAcf()` と `decodeUrlEncoded()` を削除・改変しない** — ACF 空対応と安全なデコードの根幹ロジック
4. **`src/types/index.ts` の nullable 型定義を維持する** — `| null` を外さない
5. **UI の null ガード（"—" / "未分類" 表示）を維持する** — ACF 未設定時のユーザー体験を保護
6. **WordPress 標準の `posts` や `categories` を使わない** — CPT（methodologies, companies, insights）のみ

詳細な AI 向けルールは `CLAUDE.md` を参照。
