import { Capacitor } from "@capacitor/core";
import { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_SCOPE, isGoogleDriveConfigured } from "./config";
import type { TokenResponse } from "./googleIdentityTypes";
import NativeGoogleDriveAuth from "./nativeGoogleDriveAuth";

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const DRIVE_FILE_NAME_PREFIX = "diario-auto-backup-";

let gisLoadPromise: Promise<void> | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossibile caricare Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

export type DriveErrorReason = "not_configured" | "script_failed" | "cancelled" | "auth_failed" | "network";

export class DriveError extends Error {
  reason: DriveErrorReason;
  constructor(reason: DriveErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

async function getAccessToken(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { accessToken } = await NativeGoogleDriveAuth.getAccessToken();
      return accessToken;
    } catch (err) {
      const reason = (err as { code?: string })?.code === "cancelled" ? "cancelled" : "auth_failed";
      throw new DriveError(reason, "Autenticazione Google fallita");
    }
  }

  if (!isGoogleDriveConfigured()) {
    throw new DriveError("not_configured", "Google Drive non configurato (Client ID mancante)");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  try {
    await loadGisScript();
  } catch {
    throw new DriveError("script_failed", "Impossibile caricare i servizi Google");
  }

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new DriveError("script_failed", "Google Identity Services non disponibile"));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_DRIVE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response: TokenResponse) => {
        if (response.error || !response.access_token) {
          reject(new DriveError("auth_failed", response.error_description ?? "Autenticazione Google fallita"));
          return;
        }
        cachedToken = { value: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 };
        resolve(response.access_token);
      },
      error_callback: (error) => {
        if (error.type === "popup_closed" || error.type === "popup_failed_to_open") {
          reject(new DriveError("cancelled", "Accesso annullato"));
        } else {
          reject(new DriveError("auth_failed", error.message ?? "Autenticazione Google fallita"));
        }
      },
    });
    client.requestAccessToken();
  });
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
}

/** Quanti backup su Drive tenere: dopo ogni caricamento i più vecchi vanno nel cestino di Drive. */
export const DRIVE_BACKUPS_TO_KEEP = 5;

// Il caricamento "multipart" di Drive accetta file fino a 5 MB: sotto questa
// soglia (con margine) si usa quello, sopra il caricamento "resumable".
const MULTIPART_MAX_BYTES = 4 * 1024 * 1024;

/** Carica il backup JSON su Google Drive dell'utente (nella sezione "File creati da questa app", non nel resto del Drive). */
export async function uploadBackupToDrive(jsonContent: string): Promise<void> {
  const token = await getAccessToken();
  const filename = `${DRIVE_FILE_NAME_PREFIX}${new Date().toISOString().slice(0, 10)}.json`;
  const metadata = { name: filename, mimeType: "application/json" };
  const content = new Blob([jsonContent], { type: "application/json" });

  if (content.size <= MULTIPART_MAX_BYTES) {
    await uploadMultipart(token, metadata, jsonContent);
  } else {
    await uploadResumable(token, metadata, content);
  }

  // La pulizia non deve far fallire un backup già caricato.
  await trashOldBackups(token).catch(() => {});
}

async function uploadMultipart(token: string, metadata: object, jsonContent: string): Promise<void> {
  const boundary = "diario_auto_boundary";
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${jsonContent}\r\n` +
    `--${boundary}--`;

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw new DriveError("network", `Caricamento su Drive fallito (${res.status})`);
  }
}

/** Caricamento in due passi (apertura sessione + invio del file), senza il limite di 5 MB. */
async function uploadResumable(token: string, metadata: object, content: Blob): Promise<void> {
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "application/json",
      "X-Upload-Content-Length": String(content.size),
    },
    body: JSON.stringify(metadata),
  });
  const sessionUrl = start.headers.get("Location");
  if (!start.ok || !sessionUrl) {
    throw new DriveError("network", `Caricamento su Drive fallito (${start.status})`);
  }

  const res = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: content,
  });
  if (!res.ok) {
    throw new DriveError("network", `Caricamento su Drive fallito (${res.status})`);
  }
}

/** Sposta nel cestino di Drive i backup oltre gli ultimi DRIVE_BACKUPS_TO_KEEP (recuperabili per 30 giorni). */
async function trashOldBackups(token: string): Promise<void> {
  const files = await listBackupsWithToken(token);
  const old = files.slice(DRIVE_BACKUPS_TO_KEEP);
  for (const file of old) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  }
}

/** Elenca i backup precedenti salvati su Drive da questa app (nome, data), più recenti prima. */
export async function listBackupsOnDrive(): Promise<DriveBackupFile[]> {
  return listBackupsWithToken(await getAccessToken());
}

async function listBackupsWithToken(token: string): Promise<DriveBackupFile[]> {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q: `name contains '${DRIVE_FILE_NAME_PREFIX}' and trashed = false`,
        fields: "files(id,name,createdTime)",
        orderBy: "createdTime desc",
        pageSize: "50",
      }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new DriveError("network", `Lettura da Drive fallita (${res.status})`);
  }
  const data = (await res.json()) as { files: DriveBackupFile[] };
  return data.files ?? [];
}

/** Scarica il contenuto testuale (JSON) di un backup specifico da Drive. */
export async function downloadBackupFromDrive(fileId: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new DriveError("network", `Download da Drive fallito (${res.status})`);
  }
  return res.text();
}
