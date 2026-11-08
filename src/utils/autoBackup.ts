// Backup automatico su Google Drive (solo Pro, solo app Android).
//
// Non c'è un vero lavoro in background (un'app web su Android non può contarci):
// il controllo parte all'apertura dell'app, quando la si chiude e qualche minuto
// dopo una modifica. La frequenza la sceglie l'utente: dopo ogni modifica, ogni
// giorno o ogni settimana; se i dati non sono cambiati non carica nulla. Su Drive si
// aggiunge un file: i dati sul telefono non vengono mai toccati, e restano gli
// ultimi DRIVE_BACKUPS_TO_KEEP backup (manuali e automatici insieme).
//
// Protezione: se sul telefono ci sono molti meno dati dell'ultimo backup
// (es. dati cancellati per errore), il backup automatico si ferma invece di
// salvare un'app quasi vuota che, dopo qualche settimana, farebbe sparire dal
// Drive tutti i backup buoni. Un backup manuale o un ripristino riallineano
// il riferimento.

import { Capacitor } from "@capacitor/core";
import { getMeta, setMeta } from "./db";
import { buildBackup, getLastBackupDate, setLastBackupDate, type BackupData } from "./storage";
import { uploadBackupToDrive } from "../services/googleDrive/driveBackup";

export const AUTO_BACKUP_DAYS = 7;

const ENABLED_KEY = "autoBackup:enabled";
const LAST_AUTO_KEY = "autoBackup:last";
const BASELINE_KEY = "autoBackup:baseline";
const DRIVE_USED_KEY = "drive:used";
const FREQ_KEY = "autoBackup:freq";
const HASH_KEY = "autoBackup:hash";

/** Quando salvare su Drive. "change": qualche minuto dopo ogni modifica (al massimo uno ogni CHANGE_MIN_MINUTES). */
export type AutoBackupFrequency = "change" | "daily" | "weekly";
export const AUTO_BACKUP_FREQUENCIES: AutoBackupFrequency[] = ["change", "daily", "weekly"];
const CHANGE_MIN_MINUTES = 5;

export async function getAutoBackupFrequency(): Promise<AutoBackupFrequency> {
  const v = await getMeta(FREQ_KEY);
  return v === "daily" || v === "weekly" || v === "change" ? v : "change";
}

export async function setAutoBackupFrequency(freq: AutoBackupFrequency): Promise<void> {
  await setMeta(FREQ_KEY, freq);
}

/** Impronta dei dati (senza la data di esportazione): se non cambia, non serve un nuovo backup. */
export function backupFingerprint(data: BackupData): string {
  const text = JSON.stringify({ ...data, exportedAt: "" });
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length}:${(h >>> 0).toString(16)}`;
}

/** Il backup automatico deve partire adesso? */
export function shouldAutoBackup(
  freq: AutoBackupFrequency,
  lastAuto: string | null,
  lastAny: string | null,
  changed: boolean,
  now = Date.now(),
): boolean {
  if (!changed) return false;
  if (freq === "change") return isAutoBackupDue(lastAuto, now, CHANGE_MIN_MINUTES / (24 * 60));
  const days = freq === "daily" ? 1 : AUTO_BACKUP_DAYS;
  // Conta anche un backup manuale recente: niente doppioni nello stesso periodo.
  return isAutoBackupDue(lastAuto, now, days) && isAutoBackupDue(lastAny, now, days);
}

export interface BackupCounts {
  vehicles: number;
  records: number; // rifornimenti, ricariche, manutenzioni, spese, scadenze
}

export function countBackup(data: BackupData): BackupCounts {
  return {
    vehicles: data.vehicles.length,
    records:
      data.fuelEntries.length +
      (data.chargingEntries?.length ?? 0) +
      data.maintenanceEntries.length +
      (data.expenseEntries?.length ?? 0) +
      data.reminders.length,
  };
}

/**
 * true se i dati attuali sono sospettosamente meno di quelli dell'ultimo backup:
 * tutto sparito, oppure meno della metà dei veicoli o dei dati (con un minimo
 * di 10 voci in meno, così eliminare qualche voce non blocca nulla).
 */
export function looksLikeDataLoss(previous: BackupCounts | null, current: BackupCounts): boolean {
  if (!previous) return false;
  const prevTotal = previous.vehicles + previous.records;
  const curTotal = current.vehicles + current.records;
  if (prevTotal > 0 && curTotal === 0) return true;
  if (previous.vehicles >= 2 && current.vehicles < previous.vehicles / 2) return true;
  return previous.records - current.records >= 10 && current.records < previous.records / 2;
}

export function isAutoBackupDue(lastIso: string | null, now = Date.now(), days = AUTO_BACKUP_DAYS): boolean {
  if (!lastIso) return true;
  const last = new Date(lastIso).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= days * 24 * 60 * 60 * 1000;
}

export async function isAutoBackupEnabled(): Promise<boolean> {
  // Attivo per default: parte comunque solo dopo il primo backup manuale su Drive.
  return (await getMeta(ENABLED_KEY)) !== "false";
}

export async function setAutoBackupEnabled(enabled: boolean): Promise<void> {
  await setMeta(ENABLED_KEY, enabled ? "true" : "false");
}

export async function getLastAutoBackupDate(): Promise<string | null> {
  return getMeta(LAST_AUTO_KEY);
}

export async function hasUsedDrive(): Promise<boolean> {
  return (await getMeta(DRIVE_USED_KEY)) === "true";
}

async function getBaseline(): Promise<BackupCounts | null> {
  try {
    const raw = await getMeta(BASELINE_KEY);
    return raw ? (JSON.parse(raw) as BackupCounts) : null;
  } catch {
    return null;
  }
}

/** Da chiamare dopo un backup manuale su Drive o un ripristino: i dati attuali diventano il riferimento. */
export async function markDataAsReference(data: BackupData, viaDrive: boolean): Promise<void> {
  await setMeta(BASELINE_KEY, JSON.stringify(countBackup(data)));
  if (viaDrive) {
    await setMeta(DRIVE_USED_KEY, "true");
    // questi dati sono già su Drive: il prossimo automatico parte solo se cambiano
    await setMeta(HASH_KEY, backupFingerprint(data));
  }
}

export type AutoBackupResult = "skipped" | "done" | "blocked" | "failed";

let running = false;

/** Controlla le condizioni e, se serve, carica il backup su Drive senza chiedere nulla all'utente. */
export async function runAutoBackupIfDue(isPro: boolean): Promise<AutoBackupResult> {
  if (running || !isPro || !Capacitor.isNativePlatform()) return "skipped";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "skipped";
  running = true;
  try {
    if (!(await isAutoBackupEnabled()) || !(await hasUsedDrive())) return "skipped";
    const backup = await buildBackup();
    const hash = backupFingerprint(backup);
    const changed = hash !== (await getMeta(HASH_KEY));
    if (!shouldAutoBackup(await getAutoBackupFrequency(), await getLastAutoBackupDate(), await getLastBackupDate(), changed)) return "skipped";
    if (looksLikeDataLoss(await getBaseline(), countBackup(backup))) return "blocked";

    await uploadBackupToDrive(JSON.stringify(backup), { interactive: false });
    const now = new Date().toISOString();
    await setMeta(LAST_AUTO_KEY, now);
    await setLastBackupDate(now);
    await setMeta(BASELINE_KEY, JSON.stringify(countBackup(backup)));
    await setMeta(HASH_KEY, hash);
    return "done";
  } catch {
    // Offline, accesso Google revocato, Drive pieno...: si riprova alla prossima apertura.
    return "failed";
  } finally {
    running = false;
  }
}
