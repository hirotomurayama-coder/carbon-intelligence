/**
 * Google Drive API サービス層。
 * サービスアカウントで管理者の固定フォルダにアクセスし、
 * ファイル一覧・全文検索・テキスト抽出を提供する。
 */

import { google, type drive_v3 } from "googleapis";
import { readFileSync } from "fs";
import { join } from "path";

// ============================================================
// 型定義
// ============================================================

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string | null;
  webViewLink: string | null;
};

// ============================================================
// 認証・クライアント
// ============================================================

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";

let cachedDrive: drive_v3.Drive | null = null;

function getAuthClient() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
    return new google.auth.GoogleAuth({
      credentials: json,
      scopes: SCOPES,
    });
  }

  try {
    const credPath = join(process.cwd(), "credentials.json");
    const json = JSON.parse(readFileSync(credPath, "utf-8"));
    return new google.auth.GoogleAuth({
      credentials: json,
      scopes: SCOPES,
    });
  } catch {
    throw new Error(
      "Google Drive 認証情報が見つかりません。GOOGLE_SERVICE_ACCOUNT_KEY 環境変数または credentials.json を設定してください。"
    );
  }
}

function getDriveClient(): drive_v3.Drive {
  if (!cachedDrive) {
    const auth = getAuthClient();
    cachedDrive = google.drive({ version: "v3", auth });
  }
  return cachedDrive;
}

// ============================================================
// ファイル一覧（再帰的にサブフォルダも探索）
// ============================================================

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** 単一フォルダ内のファイル・フォルダを取得（共有ドライブ対応、ページネーション付き） */
async function listDirect(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const all: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)",
      orderBy: "modifiedTime desc",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const f of res.data.files ?? []) {
      // _temp_ocr_ ファイルを除外
      if (f.name?.startsWith("_temp_ocr_")) continue;
      all.push({
        id: f.id ?? "",
        name: f.name ?? "",
        mimeType: f.mimeType ?? "",
        modifiedTime: f.modifiedTime ?? "",
        size: f.size ?? null,
        webViewLink: f.webViewLink ?? null,
      });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return all;
}

/**
 * 指定フォルダ以下の全ファイルを再帰取得。
 * 最大深度3（ルート → サブフォルダ → サブサブフォルダ → ファイル）で制限。
 */
export async function listFiles(
  folderId?: string,
  depth = 0
): Promise<DriveFile[]> {
  const targetFolder = folderId ?? FOLDER_ID;

  if (!targetFolder) {
    console.warn("[Google Drive] GOOGLE_DRIVE_FOLDER_ID が未設定です");
    return [];
  }

  const items = await listDirect(targetFolder);
  const files: DriveFile[] = [];
  const subfolders: DriveFile[] = [];

  for (const item of items) {
    if (item.mimeType === FOLDER_MIME) {
      subfolders.push(item);
    } else {
      files.push(item);
    }
  }

  // サブフォルダを再帰（深度制限: 3階層まで）
  if (depth < 3 && subfolders.length > 0) {
    const batchSize = 5;
    for (let i = 0; i < subfolders.length; i += batchSize) {
      const batch = subfolders.slice(i, i + batchSize);
      const subResults = await Promise.all(
        batch.map((sf) => listFiles(sf.id, depth + 1).catch(() => []))
      );
      for (const sub of subResults) {
        files.push(...sub);
      }
    }
  }

  return files;
}

// ============================================================
// 全文検索（Google Drive のインデックスで全ファイルを対象に検索）
// ============================================================

/**
 * Google Drive の fullText 検索を使い、全ファイルの内容を対象に検索。
 * Google がサーバー側でインデックスを持っており、PDF・DOCX・Google Docs 等の
 * 中身を含めて全件検索される。
 *
 * 複数キーワードの場合、個別にも検索して結果を統合する。
 */
export async function searchFiles(query: string): Promise<DriveFile[]> {
  const drive = getDriveClient();

  if (!FOLDER_ID) return [];

  const fileMap = new Map<string, DriveFile>();

  // 戦略1: 全キーワードで一括検索
  await searchOnce(drive, query, fileMap);

  // 戦略2: 個別キーワードでも検索（日本語で分かち書き問題がある場合に対応）
  const words = query.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length > 1) {
    for (const word of words.slice(0, 3)) {
      await searchOnce(drive, word, fileMap);
    }
  }

  return Array.from(fileMap.values());
}

async function searchOnce(
  drive: drive_v3.Drive,
  query: string,
  results: Map<string, DriveFile>
): Promise<void> {
  try {
    const escaped = query.replace(/'/g, "\\'");
    const res = await drive.files.list({
      q: `fullText contains '${escaped}' and mimeType != '${FOLDER_MIME}' and trashed = false and not name contains '_temp_ocr_'`,
      fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
      orderBy: "relevance",
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const f of res.data.files ?? []) {
      if (!results.has(f.id!)) {
        results.set(f.id!, {
          id: f.id ?? "",
          name: f.name ?? "",
          mimeType: f.mimeType ?? "",
          modifiedTime: f.modifiedTime ?? "",
          size: f.size ?? null,
          webViewLink: f.webViewLink ?? null,
        });
      }
    }
  } catch (e) {
    console.warn(`[Google Drive] 検索エラー (${query}):`, e);
  }
}

// ============================================================
// テキスト抽出
// ============================================================

const MAX_CHARS_PER_FILE = 12_000;

export async function extractFileText(
  fileId: string,
  mimeType: string
): Promise<string> {
  try {
    const drive = getDriveClient();

    // Google Docs → text/plain エクスポート
    if (mimeType === "application/vnd.google-apps.document") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      const text = typeof res.data === "string" ? res.data : String(res.data);
      return text.slice(0, MAX_CHARS_PER_FILE);
    }

    // Google Sheets → CSV エクスポート
    if (mimeType === "application/vnd.google-apps.spreadsheet") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/csv" },
        { responseType: "text" }
      );
      const text = typeof res.data === "string" ? res.data : String(res.data);
      return text.slice(0, MAX_CHARS_PER_FILE);
    }

    // Google Slides → text/plain エクスポート
    if (mimeType === "application/vnd.google-apps.presentation") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      const text = typeof res.data === "string" ? res.data : String(res.data);
      return text.slice(0, MAX_CHARS_PER_FILE);
    }

    // PDF → pdfjs-dist でテキスト抽出
    if (mimeType === "application/pdf") {
      const res = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      const text = await extractPdfText(buffer);
      // テキストがほぼ空の場合（スキャンPDF等）
      if (text.replace(/\s/g, "").length < 50) {
        return `[このPDFはスキャン画像のためテキスト抽出ができませんでした。ファイル名: ${fileId}]`;
      }
      return text;
    }

    // DOCX → mammoth
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const res = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      return await extractDocxText(buffer);
    }

    // PPTX → テキスト抽出は限定的だがファイル名を返す
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      return `[PowerPoint ファイル — テキスト自動抽出は未対応]`;
    }

    // プレーンテキスト / CSV / TSV
    if (
      mimeType.startsWith("text/") ||
      mimeType === "application/csv"
    ) {
      const res = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "text" }
      );
      const text = typeof res.data === "string" ? res.data : String(res.data);
      return text.slice(0, MAX_CHARS_PER_FILE);
    }

    return `[${mimeType} 形式のファイルはテキスト抽出に未対応です]`;
  } catch (e) {
    console.error(`[Google Drive] テキスト抽出エラー (${fileId}):`, e);
    return "[テキスト抽出に失敗しました]";
  }
}

// ============================================================
// PDF テキスト抽出（pdfjs-dist — サーバーレス互換）
// ============================================================

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    }).promise;

    const pages: string[] = [];
    const maxPages = Math.min(doc.numPages, 30); // 最大30ページ

    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item) => "str" in item && typeof (item as { str: string }).str === "string")
        .map((item) => (item as { str: string }).str)
        .join(" ");
      if (text.trim()) pages.push(text);
    }

    return pages.join("\n").slice(0, MAX_CHARS_PER_FILE);
  } catch (e) {
    console.error("[PDF] pdfjs-dist 抽出エラー:", e);
    return "";
  }
}

// ============================================================
// DOCX テキスト抽出（mammoth）
// ============================================================

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.slice(0, MAX_CHARS_PER_FILE);
}
