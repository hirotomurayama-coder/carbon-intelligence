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
// ファイル一覧
// ============================================================

export async function listFiles(folderId?: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const targetFolder = folderId ?? FOLDER_ID;

  if (!targetFolder) {
    console.warn("[Google Drive] GOOGLE_DRIVE_FOLDER_ID が未設定です");
    return [];
  }

  const res = await drive.files.list({
    q: `'${targetFolder}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: 100,
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
// 全文検索
// ============================================================

export async function searchFiles(query: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const targetFolder = FOLDER_ID;

  if (!targetFolder) return [];

  // クエリ文字列のエスケープ（シングルクォート）
  const escaped = query.replace(/'/g, "\\'");

  const res = await drive.files.list({
    q: `fullText contains '${escaped}' and '${targetFolder}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
    orderBy: "relevance",
    pageSize: 10,
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

    // PDF → バイナリダウンロード → pdf-parse
    if (mimeType === "application/pdf") {
      const res = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      return await extractPdfText(buffer);
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
// PDF テキスト抽出（pdf-parse v2）
// ============================================================

async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (opts: { data: Uint8Array }) => {
      load: () => Promise<void>;
      getText: () => Promise<string | { text: string }>;
      destroy: () => void;
    };
  };

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  const result = await parser.getText();
  parser.destroy();

  const text = typeof result === "string" ? result : result.text;
  return text.slice(0, MAX_CHARS_PER_FILE);
}

// ============================================================
// DOCX テキスト抽出（mammoth）
// ============================================================

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.slice(0, MAX_CHARS_PER_FILE);
}
