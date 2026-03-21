/**
 * Google Drive API サービス層。
 * サービスアカウントで管理者の固定フォルダにアクセスし、
 * ファイル一覧・全文検索・テキスト抽出を提供する。
 *
 * PDF は pdfjs-dist で抽出し、失敗時は Google Docs 変換（OCR 内蔵）でフォールバック。
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

// drive（フルアクセス）: PDF→Docs 変換用の一時コピー作成・削除に必要
const SCOPES = ["https://www.googleapis.com/auth/drive"];
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
 * 最大深度3で制限。
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
// 全文検索
// ============================================================

export async function searchFiles(query: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  if (!FOLDER_ID) return [];

  const fileMap = new Map<string, DriveFile>();

  await searchOnce(drive, query, fileMap);

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

    // PDF → pdfjs-dist で抽出、失敗時は Google Docs OCR 変換でフォールバック
    if (mimeType === "application/pdf") {
      return await extractPdfFromDrive(drive, fileId);
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

    // プレーンテキスト / CSV / TSV
    if (mimeType.startsWith("text/") || mimeType === "application/csv") {
      const res = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "text" }
      );
      const text = typeof res.data === "string" ? res.data : String(res.data);
      return text.slice(0, MAX_CHARS_PER_FILE);
    }

    return `[${mimeType} 形式は未対応]`;
  } catch (e) {
    console.error(`[Google Drive] テキスト抽出エラー (${fileId}):`, e);
    return "[テキスト抽出に失敗しました]";
  }
}

// ============================================================
// PDF テキスト抽出 — 2段階戦略
//   1. pdfjs-dist でローカル抽出（テキスト埋め込みPDF用）
//   2. 失敗時: Google Docs 変換（OCR 内蔵）でフォールバック
// ============================================================

async function extractPdfFromDrive(
  drive: drive_v3.Drive,
  fileId: string
): Promise<string> {
  // --- 方法1: pdfjs-dist ---
  try {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    const buffer = Buffer.from(res.data as ArrayBuffer);
    const text = await extractPdfText(buffer);
    if (text.replace(/\s/g, "").length > 50) {
      return text;
    }
  } catch (e) {
    console.warn(`[PDF] pdfjs-dist 失敗 (${fileId}):`, e);
  }

  // --- 方法2: Google Docs OCR 変換 ---
  // サービスアカウントの My Drive に一時的な Google Docs コピーを作成（OCR付き）
  // → テキスト抽出 → 一時ファイルを即座に削除
  let tempDocId: string | null = null;
  try {
    console.log(`[PDF→Docs] OCR 変換開始: ${fileId}`);
    const copyRes = await drive.files.copy({
      fileId,
      requestBody: {
        mimeType: "application/vnd.google-apps.document",
        name: `_temp_ocr_${Date.now()}`,
        // parents を指定しない → サービスアカウント自身の My Drive に作成
      },
      supportsAllDrives: true,
      ocrLanguage: "ja",
    });
    tempDocId = copyRes.data.id ?? null;

    if (tempDocId) {
      const textRes = await drive.files.export(
        { fileId: tempDocId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      const text =
        typeof textRes.data === "string" ? textRes.data : String(textRes.data);
      if (text.replace(/\s/g, "").length > 30) {
        console.log(
          `[PDF→Docs] OCR 成功: ${fileId} (${text.length} chars)`
        );
        return text.slice(0, MAX_CHARS_PER_FILE);
      }
    }
  } catch (e) {
    console.warn(`[PDF→Docs] OCR 変換失敗 (${fileId}):`, e);
  } finally {
    // 一時ファイルを確実に削除（サービスアカウントの My Drive なので削除可能）
    if (tempDocId) {
      drive.files
        .delete({ fileId: tempDocId })
        .catch((e) =>
          console.warn(`[PDF→Docs] 一時ファイル削除失敗: ${tempDocId}`, e)
        );
    }
  }

  return "[PDF テキスト抽出に失敗しました]";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    }).promise;

    const pages: string[] = [];
    const maxPages = Math.min(doc.numPages, 30);

    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .filter(
          (item) =>
            "str" in item &&
            typeof (item as { str: string }).str === "string"
        )
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
