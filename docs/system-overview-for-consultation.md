# Carbon Intelligence Platform — システム概要・相談用インプット

## 1. プラットフォーム概要

**Carbon Intelligence**（https://intelligence.carboncredits.jp）は、カーボンクレジット市場の情報を一元化し、AI分析を加えた市場インテリジェンスプラットフォームです。carboncredits.jp（ニュースメディア）の姉妹サービスとして、メディアには出さない深掘り分析や市場データを提供します。

- **URL**: https://intelligence.carboncredits.jp
- **技術スタック**: Next.js 16.1.6 (React 19) / Vercel / WordPress (Headless CMS) / Gemini AI / Claude AI
- **データソース**: JPX PDF、homaio.com、carboncredits.jp REST API、Google Drive、各種Web情報

---

## 2. 実装済み機能一覧

### 2-1. ダッシュボード（/）
- KPIサマリー（メソドロジー数、企業数、インサイト数、関連記事数、信頼性スコア）
- 市場価格モニター（6市場の最新価格 + トレンド表示）
- 最新インサイト・注目企業の一覧
- レジストリ分布（横棒グラフ）・企業カテゴリ分布

### 2-2. メソドロジーデータベース（/methodologies）
- **200件**のメソドロジーを収録（Verra、Gold Standard、Puro.earth、Isometric、J-Credit）
- 5レジストリ外部自動収集（スクレイピング + AI分類・要約）
- フィルタ: レジストリ、クレジット種別（回避・削減系/除去系）、ベースタイプ（自然/技術/再エネ）、詳細分類
- 検索・並べ替え・CSVエクスポート
- 詳細ページ: AI要約、信頼性スコア、類似メソドロジー推薦
- **月次自動更新**: GitHub Actions で毎月レジストリをスキャン

### 2-3. 企業データベース（/companies）
- **198社**を収録（CDR企業、商社、エネルギー大手、金融、国際機関、日本企業）
- carboncredits.jpの**1,720記事**をスキャンし、各企業の関連記事を自動紐付け
- タブフィルタ: 創出/仲介/コンサル/検証機関/記事あり
- 詳細ページ: 関連記事リスト（carboncredits.jpへのリンク）、同カテゴリ企業
- **月次自動更新**: GitHub Actions で毎月記事を再スキャン

### 2-4. マーケット・インサイト — 価格分析（/analysis）
- **14市場**をカバー:
  - コンプライアンス: EU ETS、J-Credit（省エネ/森林/中干し/バイオ炭）
  - ボランタリー除去: DAC、Biochar、ERW、Blue Carbon、Soil Carbon、Nature Removal
  - ボランタリー回避: REDD+、Clean Cookstoves、Methane Capture
- 3グループに分類して一覧表示
- 詳細ページ: 価格チャート、AI分析（要因・レンジ・見通し）、データソース情報
- **週次自動更新**: JPX PDF解析 + EUA価格取得 + AI集約 + Gemini分析

### 2-5. インサイト（/insights）
- **6カテゴリ**: 特別記事、メルマガ、週次ブリーフ、政策、市場、技術
- タブフィルタ + キーワード検索 + シリーズ別グループ表示
- 読了時間の自動計算・表示
- 詳細ページ: 記事内の企業名を自動検出→企業DBへのリンクカード表示
- シリーズナビゲーション（同一シリーズの前後記事リンク）
- **週次ブリーフのAI自動生成**: 14市場のサマリーを毎週月曜に自動投稿

### 2-6. 政策ロードマップ（/roadmap）
- **28件**の政策イベントをガントチャートで可視化
- 11カテゴリ: SSBJ、GX-ETS、J-Credit、SBTi、GHG Protocol、CORSIA、EU CBAM、COP、パリ協定6条、TNFD、ICVCM/VCMI
- ステータスフィルタ（完了/進行中/準備中/予定）
- 統計カード（クリックでフィルタ）
- ページ読み込み時に「今日」の位置に自動スクロール
- バー内テキストの横スクロール追従（sticky + clip-path）
- バークリックで詳細モーダル表示

### 2-7. ライブラリ（/library）
- Google Drive連携（サービスアカウント認証）
- 1,346件のドキュメントを3階層まで再帰探索
- キーワード検索→関連ドキュメント推薦（Google Drive全文検索 + フォルダ名マッチ + ファイル名マッチ）
- ベータ版表示あり

### 2-8. 設定（/settings）
- データソース接続状況（WordPress、Google Drive、Gemini、Claude）
- 自動更新スケジュール一覧
- データベース概要
- 手動実行コマンドリファレンス

---

## 3. 自動化の仕組み

### GitHub Actions ワークフロー

| ワークフロー | スケジュール | 処理内容 |
|---|---|---|
| weekly-sync-prices.yml | 毎週月曜 09:00 JST | ① sync-prices → ② analyze-market → ③ generate-weekly-brief |
| monthly-sync-companies.yml | 毎月1日 09:00 JST | sync-companies（carboncredits.jp記事再スキャン） |

### スクリプト一覧

| スクリプト | 用途 |
|---|---|
| `npm run sync-prices` | JPX PDF + EU ETS + ボランタリー価格をWordPressに同期 |
| `npm run analyze-market` | Gemini AIで各市場の背景分析を生成 |
| `npm run generate-weekly-brief` | 週次マーケットブリーフをWordPressに自動投稿 |
| `npm run sync-companies` | carboncredits.jpから企業の関連記事を収集・紐付け |

---

## 4. 技術アーキテクチャ

```
[ブラウザ] → [Vercel (Next.js)] → [WordPress REST API (staging)]
                                  → [Google Drive API]
                                  → [Gemini AI API]
                                  → [Claude AI API]

[GitHub Actions] → [scripts/*.ts] → [WordPress REST API]
                                   → [carboncredits.jp REST API]
                                   → [JPX PDF]
                                   → [homaio.com]
                                   → [Gemini AI]
```

- **Next.js App Router**: サーバーコンポーネントでWordPressからデータ取得、クライアントコンポーネントでインタラクティブUI
- **WordPress Headless CMS**: CPT（Custom Post Types）でデータ管理。ACFフィールドとcontent JSONフォールバックの二重構造
- **ACF未対応フィールドの回避策**: `<!-- PRICE_DATA_JSON:{...} -->` をcontent内に埋め込み、フロントでパース

---

## 5. データ規模

| データ | 件数 |
|---|---|
| メソドロジー | 200件 |
| 企業 | 198社 |
| 市場（価格追跡） | 14市場 |
| 政策ロードマップイベント | 28件 |
| インサイト記事 | 7件（テスト含む、今後拡大） |
| Google Driveドキュメント | 1,346件 |
| carboncredits.jp記事（スキャン対象） | 1,720件 |

---

## 6. 既知の課題・制約

| 課題 | 影響 | 対処案 |
|---|---|---|
| Gemini API無料枠が枯渇 | AI市場分析・週次ブリーフがフォールバック版になる | 有料プラン（$0で月1,500リクエスト or 従量課金）に切替 |
| DuckDuckGo検索がbot制限で0件になることがある | analyze-market のニュース収集が不完全 | Tavily API等の有料検索APIに切替 |
| WordPress ACFのselect値に「検証機関」等が未登録 | 一部企業・ロードマップのACFが空 | WordPress管理画面でACFフィールドの選択肢を追加 |
| ライブラリのPDF OCRが不安定 | スキャンPDFのテキスト抽出成功率が低い | Google Cloud Vision API等に切替 |
| GitHub Secretsの設定状況が未確認 | 自動更新が動いていない可能性 | GitHub Settings > Secrets で4つの変数を設定 |

---

## 7. 今後の機能拡充候補

### 短期（実装コスト低）
1. **価格アラート**: 閾値超えで通知（Slack/メール Webhook）
2. **比較機能**: メソドロジー横並び比較テーブル、市場間価格チャート重ね合わせ
3. **ウォッチリスト**: お気に入り登録 → ダッシュボードに優先表示

### 中期（1〜2ヶ月）
4. **ポートフォリオ管理**: 保有クレジットの時価評価・リスク分散可視化
5. **PDFレポート自動生成**: 月次市場レポートを1クリックでPDF出力
6. **規制コンプライアンスチェッカー**: 排出量入力 → GX-ETS/CBAM/CORSIA適用判定

### 長期（差別化・収益化）
7. **AI価格予測**: 過去データ+政策イベント+ニュースからの短期予測
8. **独自品質スコアリング**: 日本市場特化のクレジット品質評価
9. **マーケットプレイス連携**: バイウィル/Carbon EX APIとの接続
10. **マルチテナントSaaS化**: 企業別アカウント・ダッシュボード

---

## 8. 運用体制

| 作業 | 担当 | 頻度 |
|---|---|---|
| 特別記事・メルマガの投稿 | 手動（WordPress管理画面） | 任意 |
| 価格データ・AI分析・週次ブリーフ | 自動（GitHub Actions） | 毎週月曜 |
| 企業データの記事紐付け更新 | 自動（GitHub Actions） | 毎月1日 |
| メソドロジー外部レジストリ同期 | 自動（GitHub Actions） | 毎月 |
| ロードマップイベント追加 | 手動（WordPress管理画面） | 政策発表時 |

---

## 9. 相談したいポイント

1. **次に実装すべき機能の優先順位**をどう考えるか
2. **収益化モデル**（SaaS月額課金 vs レポート販売 vs コンサル連携）
3. **carboncredits.jpとの連携強化**のアイデア
4. **データの信頼性向上**（AI生成コンテンツの品質管理、情報源の拡充）
5. **ターゲットユーザー**の絞り込み（GXリーグ企業、商社、コンサル、金融機関）
