/**
 * メソドロジー更新モニタリングスクリプト
 *
 * J-Credit / Verra / Gold Standard の更新ページを監視し、
 * 前回チェック以降の新着情報を検出したら GitHub Issue を自動作成する。
 *
 * 使用方法:
 *   npx tsx scripts/monitor-registry-updates.ts           # 通常実行
 *   npx tsx scripts/monitor-registry-updates.ts --init    # 初期化（現在の状態を記録、Issue作成なし）
 *   npx tsx scripts/monitor-registry-updates.ts --dry-run # 検出のみ（Issue作成なし）
 *
 * 必要な環境変数（GitHub Actions では自動設定）:
 *   GITHUB_TOKEN       GitHub API トークン（Issue 作成用）
 *   GITHUB_REPOSITORY  リポジトリ名（例: owner/repo）
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

// ── 設定 ─────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const STATE_FILE = path.join(SCRIPT_DIR, "monitor-state.json");

const SOURCES = {
  jcredit: "https://japancredit.go.jp/about/revision/",
  verra: "https://verra.org/news/",
  goldstandard: "https://globalgoals.goldstandard.org/rule-updates/",
} as const;

/** Verraニュースのうちメソドロジー関連として検出するキーワード */
const VERRA_METHODOLOGY_KEYWORDS = [
  "methodology",
  "vm0",
  "vcs standard",
  "program update",
  "public consultation",
  "standard update",
  "protocol",
  "approved methodology",
];

// ── 型定義 ────────────────────────────────────────────────────────

interface JCreditItem {
  id: string;
  date: string;          // YYYY-MM-DD
  title: string;
  codes: string[];       // メソドロジーコード（例: ["EN-R-002"]）
  pdfUrls: string[];
}

interface VerraItem {
  id: string;            // URL をIDとして使用
  date: string;          // YYYY-MM-DD
  title: string;
  url: string;
  category: string;
  isMethodologyRelated: boolean;
}

interface GoldStandardItem {
  id: string;            // URL をIDとして使用
  date: string;          // YYYY-MM-DD
  title: string;
  url: string;
  pdfUrl: string;
}

interface MonitorState {
  lastChecked: string;
  jcredit: { seenIds: string[] };
  verra: { seenIds: string[] };
  goldstandard: { seenIds: string[] };
}

// ── 状態管理 ──────────────────────────────────────────────────────

function loadState(): MonitorState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
}

function saveState(state: MonitorState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  console.log(`✓ 状態を保存: ${STATE_FILE}`);
}

// ── HTML 取得 ─────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CarbonIntelligenceBot/1.0; +https://intelligence.carboncredits.jp)",
        "Accept-Language": "ja,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── J-Credit パーサー ─────────────────────────────────────────────

function parseJCredit(html: string): JCreditItem[] {
  const $ = cheerio.load(html);
  const items: JCreditItem[] = [];

  $("div.accordion-block.revision").each((_, el) => {
    const $el = $(el);

    // タイトル取得（NEWバッジ・SPAN等を除去）
    const $h2 = $el.find("div.accordion-title h2").first();
    $h2.find("span.new").remove();
    const rawTitle = $h2.text().replace(/\s+/g, " ").trim();

    // 日付抽出（例: 「2026年3月4日付改定」）
    const dateMatch = rawTitle.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) return;
    const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;

    // PDF URLとメソドロジーコード抽出
    const pdfUrls: string[] = [];
    const codes: string[] = [];

    $el.find("div.accordion-inner a[href]").each((_, a) => {
      const href = $(a).attr("href") ?? "";
      if (!href.includes(".pdf")) return;

      const fullUrl = href.startsWith("http")
        ? href
        : `https://japancredit.go.jp${href}`;
      pdfUrls.push(fullUrl);

      // メソドロジーコード抽出（例: EN-R-002, FO-001, AG-004）
      const codeMatch = href.match(/\/([A-Z]{2,3}-[A-Z0-9]+-\d{3})/);
      if (codeMatch && !codes.includes(codeMatch[1])) {
        codes.push(codeMatch[1]);
      }
    });

    const id = codes.length > 0
      ? `${date}:${codes.join(",")}`
      : `${date}:${rawTitle.slice(0, 40)}`;

    items.push({ id, date, title: rawTitle.slice(0, 150), codes, pdfUrls });
  });

  // 最新順（日付降順）
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

// ── Verra パーサー ────────────────────────────────────────────────

function parseVerra(html: string): VerraItem[] {
  const $ = cheerio.load(html);
  const items: VerraItem[] = [];

  $("article.col").each((_, el) => {
    const $el = $(el);

    const url = $el.find("a[href]").first().attr("href") ?? "";
    if (!url.includes("verra.org")) return;

    const title = $el.find("h2.post-card-title").text().trim();
    if (!title) return;

    // datetime属性から日付取得（ISO形式）
    const datetime = $el.find("time[datetime]").attr("datetime") ?? "";
    const date = datetime.slice(0, 10); // YYYY-MM-DD

    const category = $el.find("strong.post-category").text().trim();

    // メソドロジー関連かどうかをキーワードで判定
    const lc = (title + " " + category).toLowerCase();
    const isMethodologyRelated = VERRA_METHODOLOGY_KEYWORDS.some((kw) =>
      lc.includes(kw)
    );

    items.push({ id: url, date, title, url, category, isMethodologyRelated });
  });

  return items;
}

// ── Gold Standard パーサー ────────────────────────────────────────

function parseGoldStandard(html: string): GoldStandardItem[] {
  const $ = cheerio.load(html);
  const items: GoldStandardItem[] = [];

  $("div.p-wrap.p-list").each((_, el) => {
    const $el = $(el);

    const $link = $el.find("h4.entry-title a.p-url, h4.entry-title a").first();
    const url = $link.attr("href") ?? "";
    const title = $link.text().trim();
    if (!url || !title) return;

    // 日付: "22.12.2025" 形式 (DD.MM.YYYY)
    const infoText = $el.find("p.info-list").text().trim();
    const dateMatch = infoText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const date = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : "";

    // PDF直リンク
    const pdfUrl = $el.find("a[download][href*='.pdf']").attr("href") ?? "";

    items.push({ id: url, date, title, url, pdfUrl });
  });

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

// ── GitHub Issue 作成 ─────────────────────────────────────────────

async function createGithubIssue(title: string, body: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    console.log("\n[DRY RUN] GitHub Issue 作成をスキップ（GITHUB_TOKEN / GITHUB_REPOSITORY 未設定）");
    console.log(`--- Issue タイトル ---\n${title}`);
    console.log(`--- Issue 本文 ---\n${body}`);
    return null;
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({ title, body }),
  });
  const data = await res.json() as { html_url: string };
  return data.html_url;
}

// ── Issue 本文 生成 ───────────────────────────────────────────────

function buildIssueBody(
  newJCredit: JCreditItem[],
  newVerra: VerraItem[],
  newGS: GoldStandardItem[]
): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `## 📋 メソドロジー更新通知 (${today})`,
    "",
    "以下のレジストリで前回チェック以降の新着情報が検出されました。",
    "確認・WP更新後はこの Issue をクローズしてください。",
    "",
  ];

  // J-Credit
  if (newJCredit.length > 0) {
    lines.push(`---`, `### 🇯🇵 J-Credit（${newJCredit.length}件）`, "");
    lines.push("| 日付 | コード | タイトル概要 | PDF |");
    lines.push("|------|--------|------------|-----|");
    for (const item of newJCredit) {
      const codes = item.codes.length > 0 ? `\`${item.codes.join(", ")}\`` : "—";
      const pdfLinks = item.pdfUrls
        .map((u, i) => `[PDF${item.pdfUrls.length > 1 ? i + 1 : ""}](${u})`)
        .join(" ");
      const shortTitle = item.title.replace(/\s+/g, " ").slice(0, 60) + (item.title.length > 60 ? "…" : "");
      lines.push(`| ${item.date} | ${codes} | ${shortTitle} | ${pdfLinks || "—"} |`);
    }
    lines.push("");
    lines.push("**WP更新手順:**");
    lines.push("1. WordPress管理画面でメソドロジーコードを検索");
    lines.push("2. バージョン番号・`source_url`（PDF URL）を更新");
    lines.push("3. `external_last_updated` に更新日を入力");
    lines.push("");
  }

  // Verra
  if (newVerra.length > 0) {
    const methodologyItems = newVerra.filter((i) => i.isMethodologyRelated);
    const otherItems = newVerra.filter((i) => !i.isMethodologyRelated);

    lines.push(`---`, `### 🌍 Verra（${newVerra.length}件）`, "");

    if (methodologyItems.length > 0) {
      lines.push(`**⚡ メソドロジー関連の可能性あり（${methodologyItems.length}件）**`, "");
      for (const item of methodologyItems) {
        lines.push(`- [${item.title}](${item.url})  `);
        lines.push(`  ${item.date} | ${item.category}`);
      }
      lines.push("");
    }

    if (otherItems.length > 0) {
      lines.push(`<details><summary>その他のニュース（${otherItems.length}件）</summary>`, "");
      for (const item of otherItems) {
        lines.push(`- [${item.title}](${item.url}) — ${item.date}`);
      }
      lines.push("</details>", "");
    }

    lines.push("**WP更新手順:**");
    lines.push("1. 各記事リンクを開いてメソドロジー更新か確認");
    lines.push("2. 該当メソドロジーをWP管理画面で検索して更新");
    lines.push("");
  }

  // Gold Standard
  if (newGS.length > 0) {
    lines.push(`---`, `### 🥇 Gold Standard（${newGS.length}件）`, "");
    lines.push("| 日付 | タイトル | PDF |");
    lines.push("|------|---------|-----|");
    for (const item of newGS) {
      const title = item.title.slice(0, 70) + (item.title.length > 70 ? "…" : "");
      const pdfLink = item.pdfUrl ? `[PDF](${item.pdfUrl})` : "—";
      const titleLink = item.url ? `[${title}](${item.url})` : title;
      lines.push(`| ${item.date || "—"} | ${titleLink} | ${pdfLink} |`);
    }
    lines.push("");
    lines.push("**WP更新手順:**");
    lines.push("1. 各リンクを開いてどのメソドロジーが更新されたか確認");
    lines.push("2. 該当エントリをWP管理画面で検索して更新");
    lines.push("");
  }

  lines.push("---");
  lines.push("*このIssueは [monitor-registry-updates.ts](../blob/main/scripts/monitor-registry-updates.ts) により自動生成されました。*");

  return lines.join("\n");
}

// ── メイン ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isInit = args.includes("--init");
  const isDryRun = args.includes("--dry-run") || isInit;

  console.log("=====================================");
  console.log("  メソドロジー更新モニタリング");
  console.log("=====================================");
  if (isInit) console.log("モード: 初期化（Issue作成なし）");
  else if (isDryRun) console.log("モード: Dry Run（Issue作成なし）");
  console.log("");

  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);

  // ── 各ページをスクレイピング ──────────────────────────────────
  console.log("📡 ページ取得中...");

  const [jcHtml, verraHtml, gsHtml] = await Promise.all([
    fetchHtml(SOURCES.jcredit).catch((e) => { console.error(`  J-Credit 取得失敗: ${e.message}`); return ""; }),
    fetchHtml(SOURCES.verra).catch((e) => { console.error(`  Verra 取得失敗: ${e.message}`); return ""; }),
    fetchHtml(SOURCES.goldstandard).catch((e) => { console.error(`  GoldStandard 取得失敗: ${e.message}`); return ""; }),
  ]);

  const jcItems = jcHtml ? parseJCredit(jcHtml) : [];
  const verraItems = verraHtml ? parseVerra(verraHtml) : [];
  const gsItems = gsHtml ? parseGoldStandard(gsHtml) : [];

  console.log(`  J-Credit:      ${jcItems.length}件 取得`);
  console.log(`  Verra:         ${verraItems.length}件 取得`);
  console.log(`  Gold Standard: ${gsItems.length}件 取得`);
  console.log("");

  // ── 差分検出 ──────────────────────────────────────────────────
  const seenJC = new Set(state?.jcredit.seenIds ?? []);
  const seenVerra = new Set(state?.verra.seenIds ?? []);
  const seenGS = new Set(state?.goldstandard.seenIds ?? []);

  const newJCredit = jcItems.filter((i) => !seenJC.has(i.id));
  const newVerra = verraItems.filter((i) => !seenVerra.has(i.id));
  const newGS = gsItems.filter((i) => !seenGS.has(i.id));

  const totalNew = newJCredit.length + newVerra.length + newGS.length;

  console.log("🔍 差分検出:");
  console.log(`  J-Credit:      ${newJCredit.length}件 新着`);
  if (newJCredit.length > 0) {
    for (const item of newJCredit.slice(0, 5)) {
      console.log(`    [${item.date}] ${item.codes.join(", ") || "—"} ${item.title.slice(0, 60)}`);
    }
  }
  console.log(`  Verra:         ${newVerra.length}件 新着（うちメソドロジー関連: ${newVerra.filter(i => i.isMethodologyRelated).length}件）`);
  if (newVerra.length > 0) {
    for (const item of newVerra.slice(0, 5)) {
      const flag = item.isMethodologyRelated ? "⚡" : "  ";
      console.log(`    ${flag} [${item.date}] ${item.title.slice(0, 60)}`);
    }
  }
  console.log(`  Gold Standard: ${newGS.length}件 新着`);
  if (newGS.length > 0) {
    for (const item of newGS.slice(0, 5)) {
      console.log(`    [${item.date}] ${item.title.slice(0, 60)}`);
    }
  }
  console.log("");

  // ── 新状態を構築 ──────────────────────────────────────────────
  const newState: MonitorState = {
    lastChecked: today,
    jcredit: { seenIds: jcItems.map((i) => i.id).slice(0, 150) },
    verra: { seenIds: verraItems.map((i) => i.id).slice(0, 50) },
    goldstandard: { seenIds: gsItems.map((i) => i.id).slice(0, 100) },
  };

  // ── 初回実行: 状態を記録するのみ ─────────────────────────────
  if (!state || isInit) {
    saveState(newState);
    console.log("✅ 初期化完了。現在のデータを基準として記録しました。");
    console.log("   次回実行時から差分を検出します。");
    return;
  }

  // ── 新着なし ──────────────────────────────────────────────────
  if (totalNew === 0) {
    saveState(newState);
    console.log("✅ 新着情報なし。状態を更新しました。");
    return;
  }

  // ── GitHub Issue 作成 ─────────────────────────────────────────
  const issueTitle = `[メソドロジー更新] ${today} — ${[
    newJCredit.length > 0 ? `J-Credit ${newJCredit.length}件` : null,
    newVerra.length > 0 ? `Verra ${newVerra.length}件` : null,
    newGS.length > 0 ? `Gold Standard ${newGS.length}件` : null,
  ].filter(Boolean).join(" / ")}`;

  const issueBody = buildIssueBody(newJCredit, newVerra, newGS);

  if (!isDryRun) {
    const issueUrl = await createGithubIssue(issueTitle, issueBody);
    if (issueUrl) {
      console.log(`✅ GitHub Issue を作成しました: ${issueUrl}`);
      saveState(newState);
    }
  } else {
    console.log("\n--- [DRY RUN] 生成されるIssue ---");
    console.log(`タイトル: ${issueTitle}`);
    console.log(issueBody);
    saveState(newState);
  }
}

main().catch((e) => {
  console.error("エラー:", e);
  process.exit(1);
});
