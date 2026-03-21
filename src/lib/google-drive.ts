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

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";

let cachedDrive: drive_v3.Drive | null = null;

function getAuthClient() {
  // 方法1: 環境変数から Base64 エンコードされた JSON を読む（Vercel 用）
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
    return new google.auth.GoogleAuth({
      credentials: json,
      scopes: SCOPES,
    });
  }

  // 方法2: ローカルの credentials.json を読む
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

/** 単一フォルダ内のファイル・フォルダを取得（共有ドライブ対応） */
async function listDirect(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? "",
    size: f.size ?? null,
    webViewLink: f.webViewLink ?? null,
  }));
}

/**
 * 指定フォルダ以下の全ファイルを再帰取得。
 * 最大深度3（ルート → サブフォルダ → サブサブフォルダ → ファイル）で制限。
 */
export async function listFiles(folderId?: string, depth = 0): Promise<DriveFile[]> {
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
    // 並列数を制限（API レート対策）
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
// 全文検索（サービスアカウントがアクセス可能な全ファイルを対象）
// ============================================================

export async function searchFiles(query: string): Promise<DriveFile[]> {
  const drive = getDriveClient();

  if (!FOLDER_ID) return [];

  // サービスアカウントはこのフォルダしか共有されていないので
  // フォルダ制約なしで全文検索しても安全
  const escaped = query.replace(/'/g, "\\'");

  const res = await drive.files.list({
    q: `fullText contains '${escaped}' and mimeType != '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
    orderBy: "relevance",
    pageSize: 30,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? "",
    size: f.size ?? null,
    webViewLink: f.webViewLink ?? null,
  }));
}

// ============================================================
// テキスト抽出
// ============================================================

const MAX_CHARS_PER_FILE = 15_000;

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

    // PDF → pdfjs-dist で抽出、失敗時は Google Docs 変換でフォールバック
    if (mimeType === "application/pdf") {
      // 方法1: pdfjs-dist でローカル抽出
      try {
        const res = await drive.files.get(
          { fileId, alt: "media", supportsAllDrives: true },
          { responseType: "arraybuffer" }
        );
        const buffer = Buffer.from(res.data as ArrayBuffer);
        const text = await extractPdfText(buffer);
        if (text.replace(/\s/g, "").length > 50) return text;
      } catch (e) {
        console.warn(`[Google Drive] pdfjs-dist 抽出失敗 (${fileId}):`, e);
      }

      // 方法2: Google Drive の OCR 機能（PDF → Google Docs → テキスト）
      try {
        const copyRes = await drive.files.copy({
          fileId,
          requestBody: {
            mimeType: "application/vnd.google-apps.document",
            name: `_temp_ocr_${fileId}`,
            parents: undefined,
          },
          supportsAllDrives: true,
          ocrLanguage: "ja",
        });
        const tempId = copyRes.data.id!;
        try {
          const textRes = await drive.files.export(
            { fileId: tempId, mimeType: "text/plain" },
            { responseType: "text" }
          );
          const text = typeof textRes.data === "string" ? textRes.data : String(textRes.data);
          if (text.replace(/\s/g, "").length > 50) return text.slice(0, MAX_CHARS_PER_FILE);
        } finally {
          // 一時ファイルを削除（読み取り専用なら失敗しても OK）
          await drive.files.delete({ fileId: tempId, supportsAllDrives: true }).catch(() => {});
        }
      } catch (e) {
        console.warn(`[Google Drive] OCR フォールバック失敗 (${fileId}):`, e);
      }

      return "[PDF テキスト抽出に失敗しました]";
    }

    // DOCX → バイナリダウンロード → mammoth
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const res = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      return await extractDocxText(buffer);
    }

    // プレーンテキスト
    if (mimeType.startsWith("text/")) {
      const res = await drive.files.get(
        { fileId, alt: "media" },
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
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const pages: string[] = [];
  const maxPages = Math.min(doc.numPages, 50); // 最大50ページ

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item) => "str" in item && typeof (item as { str: string }).str === "string")
      .map((item) => (item as { str: string }).str)
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n").slice(0, MAX_CHARS_PER_FILE);
}

// ============================================================
// DOCX テキスト抽出（mammoth）
// ============================================================

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.slice(0, MAX_CHARS_PER_FILE);
}
