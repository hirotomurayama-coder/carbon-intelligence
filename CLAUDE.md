# CLAUDE.md — Carbon Credit Market Intelligence Platform

このファイルは Claude Code が毎セッション自動的に読み込むプロジェクト指示書です。
以下のルールはすべての AI セッションで厳守してください。

---

## 開発方針（必読）

**すべての開発判断の前に `docs/development-direction.md` を参照すること。**

このドキュメントには事業目的、ターゲットユーザー（月額5,000円の個人プロフェッショナル）、提供価値の4層構造（L1情報集約 → L2解釈 → L3意思決定支援 → L4コミュニティ）、開発優先順位（S/A/B/C）、ペイウォール設計原則が定義されている。

**核心**: Carbon Intelligence の価値は「データの集約」ではなく「解釈付きのインテリジェンス」。L2（解釈）が最重要レイヤー。

---

## 禁止事項（絶対に破らないこと）

1. **ルートドメイン `carboncredits.jp` への参照・操作は一切禁止**
   - `carboncredits.jp` は既存ニュースサイト（1,675+ 記事）であり、本プロジェクトとは完全に無関係
   - コード・環境変数・設定ファイルにおいて `carboncredits.jp` の API やファイルを参照してはならない
   - WordPress.com のリダイレクトで `carboncredits.jp` に飛ばされる場合があるが、それはサーバー間のリダイレクト挙動であり、コード側では staging URL のみを使用する

2. **API エンドポイントの変更禁止**
   - 正典 URL: `https://carboncreditsjp.wpcomstaging.com/wp-json/wp/v2`
   - この URL を別のドメインに変更してはならない
   - 環境変数 `NEXT_PUBLIC_WORDPRESS_API_URL` の値はこの URL に固定

3. **既存ニュースサイトのデータ（posts, categories 等）を取得してはならない**
   - 本プロジェクトが使うのは CPT: `methodologies`, `companies`, `insights` のみ
   - WordPress 標準の `posts` や `categories` エンドポイントは使用しない

---

## API エンドポイント

```
https://carboncreditsjp.wpcomstaging.com/wp-json/wp/v2
```

| CPT | エンドポイント | 用途 |
|-----|---------------|------|
| methodologies | `/methodologies` | メソドロジー（算定方法論）一覧 |
| companies | `/companies` | 企業データベース |
| insights | `/insights` | インサイト（政策・市場・技術分析） |

---

## 必須コードパターン（削除・改変禁止）

### 1. `getAcf()` — ACF データ有無フラグ付き取得

```typescript
// src/lib/wordpress.ts
function getAcf(post: WPPost): { data: Record<string, unknown>; hasData: boolean }
```

- ACF フィールドが空配列 `[]` の場合は `{ data: {}, hasData: false }` を返す
- `hasData === false` のときは ACF 依存フィールドに `null` を設定する
- この関数を削除してはならない

### 2. `decodeUrlEncoded()` — 安全な URL デコード

```typescript
// src/lib/wordpress.ts
function decodeUrlEncoded(text: string): string {
  try { return decodeURIComponent(text); } catch { return text; }
}
```

- `stripHtml()` パイプライン内で使用される
- try-catch は必須（不正な文字列でクラッシュさせない）
- この関数を削除してはならない

### 3. Nullable 型定義

```typescript
// src/types/index.ts
Methodology.type:             MethodologyType | null
Methodology.region:           string | null
Methodology.validUntil:       string | null
Methodology.reliabilityScore: number | null
Company.category:             CompanyCategory | null
Company.headquarters:         string | null
Insight.category:             InsightCategory | null
```

- ACF 未設定時に `0` や `""` ではなく `null` を返す設計
- UI 側では `null` → "—"（ダッシュ）または "未分類" と表示する
- この nullable 設計を non-nullable に変更してはならない

### 4. KPI 平均スコア計算

```typescript
// src/app/page.tsx — null スコアを分母から除外
const scoredItems = methodologies.filter(m => m.reliabilityScore !== null);
const avgScore = scoredItems.length > 0
  ? Math.round(scoredItems.reduce((sum, m) => sum + m.reliabilityScore, 0) / scoredItems.length)
  : null;
```

---

## ACF フィールド名マッピング（WordPress 管理画面で設定）

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

ACF フィールドグループが作成・データ入力されると、コードは自動的に実データを表示する。コード変更は不要。

---

## ディレクトリ構造

```
src/
  app/
    page.tsx              # ダッシュボード（KPI + 3セクション概要）
    layout.tsx            # 共通レイアウト
    methodologies/        # メソドロジー一覧ページ
    companies/            # 企業一覧ページ
    api/debug/route.ts    # デバッグ API（ACF 状態確認用）
  components/
    MethodologyList.tsx   # メソドロジーテーブル（クライアント）
    CompanyList.tsx        # 企業カード一覧（クライアント）
    ui/                   # 共通 UI コンポーネント
  lib/
    wordpress.ts          # WordPress REST API 接続層（★最重要ファイル）
    constants.ts          # ナビゲーション定義
  types/
    index.ts              # 型定義（nullable ACF フィールド）
```

---

## 環境変数

| 変数名 | 値 | 用途 |
|--------|-----|------|
| `NEXT_PUBLIC_WORDPRESS_API_URL` | `https://carboncreditsjp.wpcomstaging.com/wp-json/wp/v2` | WordPress REST API |

Vercel の Production / Preview / Development すべてで同じ値を設定済み。

---

## ビルド & デプロイ

```bash
npm run dev          # ローカル開発（http://localhost:3000）
npx next build       # 本番ビルド
git push origin main # Vercel 自動デプロイ → intelligence.carboncredits.jp
```

---

## アーキテクチャ原則

- **サブドメイン独立型**: intelligence.carboncredits.jp は carboncredits.jp のサブドメインだが、サーバー・コード・データベースは完全に分離している
- **WordPress staging 専用接続**: データソースは `carboncreditsjp.wpcomstaging.com` のみ
- **Graceful Degradation**: API 接続失敗時やデータ未設定時は空配列・null を返し、UI はフォールバック表示（"—", "未分類"）を行う
- **動的レンダリング**: `cache: "no-store"` で常に最新データを取得
