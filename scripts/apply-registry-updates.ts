/**
 * メソドロジー更新適用スクリプト
 *
 * monitor-registry-updates.ts で検出した新着情報を実際にWordPressへ反映する。
 *
 * 使用方法:
 *   npx tsx scripts/apply-registry-updates.ts           # 検出 + WP更新
 *   npx tsx scripts/apply-registry-updates.ts --dry-run # 検出のみ（WP書き込みなし）
 *
 * 環境変数:
 *   NEXT_PUBLIC_WORDPRESS_API_URL
 *   WP_APP_USER
 *   WP_APP_PASSWORD
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const STATE_FILE = path.join(SCRIPT_DIR, "monitor-state.json");
const UPDATES_FILE = path.join(SCRIPT_DIR, "../src/data/methodology-updates.json");
const WP_BASE = process.env.NEXT_PUBLIC_WORDPRESS_API_URL ?? "";
const WP_AUTH = Buffer.from(
  `${process.env.WP_APP_USER}:${process.env.WP_APP_PASSWORD}`
).toString("base64");

const isDryRun = process.argv.includes("--dry-run");

// ── WP API ───────────────────────────────────────────────────────

async function wpGet(endpoint: string) {
  const res = await fetch(`${WP_BASE}${endpoint}`, {
    headers: { Authorization: `Basic ${WP_AUTH}` },
  });
  if (!res.ok) throw new Error(`GET ${endpoint} → ${res.status}`);
  return res.json();
}

async function wpPut(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${WP_BASE}${endpoint}`, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${WP_AUTH}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${endpoint} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── 共通フェッチ ─────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CarbonIntelligenceBot/1.0)",
        "Accept-Language": "ja,en;q=0.9",
        Accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── J-Credit パーサー ─────────────────────────────────────────────

interface JCreditItem {
  id: string;
  date: string;
  title: string;
  codes: string[];
  pdfUrls: string[];
}

function parseJCredit(html: string): JCreditItem[] {
  const $ = cheerio.load(html);
  const items: JCreditItem[] = [];

  $("div.accordion-block.revision").each((_, el) => {
    const $el = $(el);
    const $h2 = $el.find("div.accordion-title h2").first();
    $h2.find("span.new").remove();
    const rawTitle = $h2.text().replace(/\s+/g, " ").trim();

    const dateMatch = rawTitle.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) return;
    const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;

    const pdfUrls: string[] = [];
    const codes: string[] = [];

    $el.find("div.accordion-inner a[href]").each((_, a) => {
      const href = $(a).attr("href") ?? "";
      if (!href.includes(".pdf")) return;
      const fullUrl = href.startsWith("http") ? href : `https://japancredit.go.jp${href}`;
      pdfUrls.push(fullUrl);
      const codeMatch = href.match(/\/([A-Z]{2,3}-[A-Z0-9]+-\d{3})/);
      if (codeMatch && !codes.includes(codeMatch[1])) codes.push(codeMatch[1]);
    });

    const id = codes.length > 0 ? `${date}:${codes.join(",")}` : `${date}:${rawTitle.slice(0, 40)}`;
    items.push({ id, date, title: rawTitle.slice(0, 150), codes, pdfUrls });
  });

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

// ── Verraパーサー ─────────────────────────────────────────────────

interface VerraItem { id: string; date: string; title: string; url: string; category: string; }

function parseVerra(html: string): VerraItem[] {
  const $ = cheerio.load(html);
  const items: VerraItem[] = [];
  $("article.col").each((_, el) => {
    const $el = $(el);
    const url = $el.find("a[href]").first().attr("href") ?? "";
    if (!url.includes("verra.org")) return;
    const title = $el.find("h2.post-card-title").text().trim();
    if (!title) return;
    const datetime = $el.find("time[datetime]").attr("datetime") ?? "";
    const date = datetime.slice(0, 10);
    const category = $el.find("strong.post-category").text().trim();
    items.push({ id: url, date, title, url, category });
  });
  return items;
}

// ── Gold Standardパーサー ─────────────────────────────────────────

interface GSItem { id: string; date: string; title: string; url: string; pdfUrl: string; }

function parseGoldStandard(html: string): GSItem[] {
  const $ = cheerio.load(html);
  const items: GSItem[] = [];
  $("div.p-wrap.p-list").each((_, el) => {
    const $el = $(el);
    const $link = $el.find("h4.entry-title a.p-url, h4.entry-title a").first();
    const url = $link.attr("href") ?? "";
    const title = $link.text().trim();
    if (!url || !title) return;
    const infoText = $el.find("p.info-list").text().trim();
    const dateMatch = infoText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : "";
    const pdfUrl = $el.find("a[download][href*='.pdf']").attr("href") ?? "";
    items.push({ id: url, date, title, url, pdfUrl });
  });
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

// ── WP: コードでメソドロジーを検索 ───────────────────────────────

async function findWpMethodologyByCode(code: string): Promise<{ id: number; title: string; acf: Record<string, string> } | null> {
  try {
    const results = await wpGet(`/methodologies?search=${encodeURIComponent(code)}&_fields=id,title,acf&per_page=5`) as Array<{ id: number; title: { rendered: string }; acf: Record<string, string> }>;
    // コードが確実に一致するものを選ぶ（タイトルに含まれるか、あるいはACFに含まれるか）
    for (const r of results) {
      const titleText = r.title.rendered;
      if (titleText.includes(code)) {
        return { id: r.id, title: titleText, acf: r.acf };
      }
    }
    // 厳密一致なければ最初の結果を返す（1件のみの場合）
    if (results.length === 1) {
      return { id: results[0].id, title: results[0].title.rendered, acf: results[0].acf };
    }
    return null;
  } catch {
    return null;
  }
}

// ── WP: メソドロジーを更新 ───────────────────────────────────────

async function updateWpMethodology(
  id: number,
  updates: { source_url?: string; external_last_updated?: string }
): Promise<void> {
  await wpPut(`/methodologies/${id}`, { acf: updates });
}

// ── 更新ログファイルへの書き込み ─────────────────────────────────

interface UpdateLogEntry {
  id: string;
  date: string;
  registry: string;
  code: string | null;
  titleJa: string;
  changeType: "revision" | "new" | "rule_update" | "consultation" | "status_change";
  description: string | null;
  url: string;
  autoUpdated: boolean;
}

function appendToUpdateLog(entries: UpdateLogEntry[]): void {
  if (entries.length === 0) return;

  let existing: { lastChecked: string; updates: UpdateLogEntry[] } = {
    lastChecked: new Date().toISOString().slice(0, 10),
    updates: [],
  };

  if (fs.existsSync(UPDATES_FILE)) {
    existing = JSON.parse(fs.readFileSync(UPDATES_FILE, "utf-8"));
  }

  // 重複IDを除外して先頭に追加
  const existingIds = new Set(existing.updates.map((u) => u.id));
  const newEntries = entries.filter((e) => !existingIds.has(e.id));

  if (newEntries.length === 0) {
    console.log("  ℹ️  更新ログへの追加なし（全て既存）");
    return;
  }

  existing.updates = [...newEntries, ...existing.updates].slice(0, 100); // 最大100件保持
  existing.lastChecked = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(UPDATES_FILE, JSON.stringify(existing, null, 2) + "\n", "utf-8");
  console.log(`  ✅ 更新ログに ${newEntries.length}件 追記: ${UPDATES_FILE}`);
}

// ── メイン ────────────────────────────────────────────────────────

async function main() {
  console.log("============================================");
  console.log("  メソドロジー更新検出 → WP反映");
  console.log("============================================");
  if (isDryRun) console.log("モード: Dry Run（WP書き込みなし）\n");

  if (!WP_BASE) { console.error("ERROR: NEXT_PUBLIC_WORDPRESS_API_URL 未設定"); process.exit(1); }
  if (!isDryRun && (!process.env.WP_APP_USER || !process.env.WP_APP_PASSWORD)) {
    console.error("ERROR: WP_APP_USER / WP_APP_PASSWORD 未設定"); process.exit(1);
  }

  // 状態読み込み
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as {
    jcredit: { seenIds: string[] };
    verra: { seenIds: string[] };
    goldstandard: { seenIds: string[] };
  };

  // ── スクレイピング ──────────────────────────────────────────────
  console.log("📡 ページ取得中...");
  const [jcHtml, verraHtml, gsHtml] = await Promise.all([
    fetchHtml("https://japancredit.go.jp/about/revision/").catch(() => ""),
    fetchHtml("https://verra.org/news/").catch(() => ""),
    fetchHtml("https://globalgoals.goldstandard.org/rule-updates/").catch(() => ""),
  ]);

  const jcItems = jcHtml ? parseJCredit(jcHtml) : [];
  const verraItems = verraHtml ? parseVerra(verraHtml) : [];
  const gsItems = gsHtml ? parseGoldStandard(gsHtml) : [];

  // ── 差分検出 ──────────────────────────────────────────────────
  const seenJC = new Set(state.jcredit.seenIds);
  const seenVerra = new Set(state.verra.seenIds);
  const seenGS = new Set(state.goldstandard.seenIds);

  const newJC = jcItems.filter(i => !seenJC.has(i.id));
  const newVerra = verraItems.filter(i => !seenVerra.has(i.id));
  const newGS = gsItems.filter(i => !seenGS.has(i.id));

  console.log(`\n🔍 新着検出:`);
  console.log(`  J-Credit:      ${newJC.length}件`);
  console.log(`  Verra:         ${newVerra.length}件`);
  console.log(`  Gold Standard: ${newGS.length}件\n`);

  // ─────────────────────────────────────────────────────────────
  // J-Credit: コードを特定してWPを自動更新
  // ─────────────────────────────────────────────────────────────
  if (newJC.length > 0) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🇯🇵 J-Credit — WP自動更新");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    for (const item of newJC) {
      console.log(`\n📄 ${item.date} | ${item.codes.join(", ") || "(コード不明)"}`);
      console.log(`   ${item.title.slice(0, 80)}`);

      if (item.codes.length === 0) {
        console.log("   ⚠️  メソドロジーコード未取得 → 手動確認が必要");
        continue;
      }

      for (let i = 0; i < item.codes.length; i++) {
        const code = item.codes[i];
        const pdfUrl = item.pdfUrls[i] ?? item.pdfUrls[0];

        process.stdout.write(`   🔍 WP検索: ${code} ... `);
        const wpEntry = await findWpMethodologyByCode(code);

        if (!wpEntry) {
          console.log(`見つからない → スキップ（WP未登録の可能性）`);
          continue;
        }

        console.log(`見つかった → ID:${wpEntry.id} "${wpEntry.title}"`);
        console.log(`      旧 source_url: ${wpEntry.acf?.source_url || "(空)"}`);
        console.log(`      新 source_url: ${pdfUrl}`);
        console.log(`      external_last_updated: ${item.date}`);

        if (!isDryRun) {
          await updateWpMethodology(wpEntry.id, {
            source_url: pdfUrl,
            external_last_updated: item.date,
          });
          console.log(`      ✅ WP更新完了`);
        } else {
          console.log(`      [DRY RUN] WP更新をスキップ`);
        }

        // APIレート制限対策
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Verra: 一覧表示のみ（構造上WP自動更新は困難）
  // ─────────────────────────────────────────────────────────────
  if (newVerra.length > 0) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🌍 Verra — 新着一覧（手動確認が必要）");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    for (const item of newVerra) {
      const keywords = ["methodology", "vm0", "consultation", "standard", "protocol"];
      const isRelated = keywords.some(k => item.title.toLowerCase().includes(k));
      const flag = isRelated ? "⚡ メソドロジー関連の可能性" : "  ";
      console.log(`\n  ${flag}`);
      console.log(`  📅 ${item.date} | ${item.category}`);
      console.log(`  📌 ${item.title}`);
      console.log(`  🔗 ${item.url}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Gold Standard: 一覧表示のみ
  // ─────────────────────────────────────────────────────────────
  if (newGS.length > 0) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🥇 Gold Standard — 新着一覧（手動確認が必要）");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    for (const item of newGS) {
      console.log(`\n  📅 ${item.date}`);
      console.log(`  📌 ${item.title}`);
      console.log(`  🔗 ${item.url}`);
      if (item.pdfUrl) console.log(`  📄 ${item.pdfUrl}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 更新ログファイルへ追記（src/data/methodology-updates.json）
  // ─────────────────────────────────────────────────────────────
  console.log("\n📝 更新ログへ追記中...");
  const logEntries: UpdateLogEntry[] = [];

  // J-Credit: WP更新完了分をログへ
  for (const item of newJC) {
    for (let i = 0; i < item.codes.length; i++) {
      logEntries.push({
        id: `jcredit-${item.codes[i]}-${item.date}`,
        date: item.date,
        registry: "J-Credit",
        code: item.codes[i],
        titleJa: item.codes[i], // WP側の正式タイトルJaは別途取得困難なのでコードを仮置き
        changeType: "revision",
        description: item.title.replace(/\（\d{4}年\d{1,2}月\d{1,2}日付改定\）.*$/, "").trim().slice(0, 80) || null,
        url: item.pdfUrls[i] ?? item.pdfUrls[0] ?? item.codes[i],
        autoUpdated: true,
      });
    }
    // コードなしの場合（新規制定など）
    if (item.codes.length === 0) {
      logEntries.push({
        id: `jcredit-${item.date}-${item.title.slice(0, 20).replace(/\s/g, "")}`,
        date: item.date,
        registry: "J-Credit",
        code: null,
        titleJa: item.title.slice(0, 60),
        changeType: "new",
        description: null,
        url: "https://japancredit.go.jp/about/revision/",
        autoUpdated: false,
      });
    }
  }

  // Verra: メソドロジー関連の可能性があるものをログへ（手動確認済みマーク）
  const verraKeywords = ["methodology", "vm0", "consultation", "standard", "protocol"];
  for (const item of newVerra) {
    const isRelated = verraKeywords.some(k => item.title.toLowerCase().includes(k));
    if (isRelated) {
      logEntries.push({
        id: `verra-${item.date}-${item.url.split("/").slice(-2, -1)[0]?.slice(0, 30) ?? "news"}`,
        date: item.date,
        registry: "Verra",
        code: null,
        titleJa: item.title.slice(0, 80),
        changeType: item.title.toLowerCase().includes("consultation") ? "consultation" : "rule_update",
        description: null,
        url: item.url,
        autoUpdated: false,
      });
    }
  }

  // Gold Standard: 全件ログへ
  for (const item of newGS) {
    logEntries.push({
      id: `goldstandard-${item.date}-${item.url.split("/").slice(-2, -1)[0]?.slice(0, 30) ?? "update"}`,
      date: item.date,
      registry: "Gold Standard",
      code: null,
      titleJa: item.title.slice(0, 80),
      changeType: "rule_update",
      description: null,
      url: item.url,
      autoUpdated: false,
    });
  }

  if (!isDryRun) {
    appendToUpdateLog(logEntries);
  } else {
    console.log(`  [DRY RUN] ${logEntries.length}件 のログ追記をスキップ`);
  }

  // ─────────────────────────────────────────────────────────────
  // 状態を更新
  // ─────────────────────────────────────────────────────────────
  const newState = {
    lastChecked: new Date().toISOString().slice(0, 10),
    jcredit: { seenIds: jcItems.map(i => i.id).slice(0, 150) },
    verra: { seenIds: verraItems.map(i => i.id).slice(0, 50) },
    goldstandard: { seenIds: gsItems.map(i => i.id).slice(0, 100) },
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
  console.log("\n✓ 状態ファイル更新完了");
  console.log("\n============================================");
  console.log("✅ 完了");
  console.log("============================================");
}

main().catch(e => { console.error("エラー:", e); process.exit(1); });
