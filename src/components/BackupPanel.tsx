import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle, FuelEntry, MaintenanceEntry, ExpenseEntry, ChargingEntry } from "../types";
import { formatNumber, getNumberLocale } from "../utils/locale";
import { useProStatus } from "../services/billing/useProStatus";
import { exportTextFile } from "../utils/nativeFileExport";
import PremiumScreen from "./PremiumScreen";
import { localDateString } from "../utils/dates";
import CsvImportPanel from "./CsvImportPanel";
import {
  AUTO_BACKUP_FREQUENCIES,
  getAutoBackupFrequency,
  setAutoBackupFrequency,
  type AutoBackupFrequency,
  getLastAutoBackupDate,
  getLastAutoBackupError,
  runAutoBackupIfDue,
  type AutoBackupErrorCode,
  hasUsedDrive,
  isAutoBackupEnabled,
  markDataAsReference,
  setAutoBackupEnabled,
} from "../utils/autoBackup";
import {
  uploadBackupToDrive,
  DRIVE_BACKUPS_TO_KEEP,
  listBackupsOnDrive,
  downloadBackupFromDrive,
  DriveError,
  type DriveBackupFile,
} from "../services/googleDrive/driveBackup";
import {
  buildBackup,
  restoreBackup,
  isValidBackupData,
  type BackupData,
  getLastBackupDate,
  setLastBackupDate,
  daysSince,
  fuelEntriesToCsv,
  maintenanceEntriesToCsv,
  expenseEntriesToCsv,
} from "../utils/storage";

interface Props {
  vehicles: Vehicle[];
  fuelEntries: FuelEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries: ExpenseEntry[];
  chargingEntries: ChargingEntry[];
  onRestored: () => void;
}

export default function BackupPanel({ vehicles, fuelEntries, maintenanceEntries, expenseEntries, chargingEntries, onRestored }: Props) {
  const { t, i18n } = useTranslation();
  const { isPro } = useProStatus();
  const [showPremium, setShowPremium] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvNote, setCsvNote] = useState<{ text: string; error: boolean } | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [storageUsedKb, setStorageUsedKb] = useState<number | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveBackupFile[] | null>(null);
  // Ripristino in attesa di conferma: sostituisce TUTTI i dati attuali, quindi mai senza un "sei sicuro?"
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [autoFreq, setAutoFreq] = useState<AutoBackupFrequency>("change");
  const [driveUsed, setDriveUsed] = useState(false);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<AutoBackupErrorCode | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryOk, setRetryOk] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{ data: BackupData; label: string; source: "file" | "drive" } | null>(null);

  async function refreshStatus() {
    setLastBackup(await getLastBackupDate());
    setAutoEnabled(await isAutoBackupEnabled());
    setAutoFreq(await getAutoBackupFrequency());
    setDriveUsed(await hasUsedDrive());
    setLastAutoBackup(await getLastAutoBackupDate());
    setAutoError(await getLastAutoBackupError());
    // stima l'uso reale del quota browser (IndexedDB + resto), più accurata
    // del vecchio conteggio manuale dei soli byte in localStorage
    if (navigator.storage?.estimate) {
      try {
        const { usage } = await navigator.storage.estimate();
        setStorageUsedKb(usage !== undefined ? Math.round(usage / 1024) : null);
      } catch {
        setStorageUsedKb(null);
      }
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  const daysAgo = lastBackup ? daysSince(lastBackup) : null;

  async function handleExportJson() {
    const backup = await buildBackup();
    const filename = `diario-auto-backup-${localDateString()}.json`;
    try {
      await exportTextFile(filename, JSON.stringify(backup, null, 2), "application/json");
    } catch {
      setError(t("backupPanel.exportFailed"));
      return;
    }
    await markDataAsReference(backup, false);
    await setLastBackupDate(new Date().toISOString());
    await refreshStatus();
    setMessage(t("backupPanel.exportedOk"));
    setError(null);
  }

  // L'esito dei CSV si mostra sotto i loro pulsanti: in cima alla pagina non si vedrebbe.
  async function exportCsv(count: number, emptyKey: string, build: () => string, name: string, okKey: string) {
    if (!isPro) {
      setShowPremium(true);
      return;
    }
    if (count === 0) {
      setCsvNote({ text: t(emptyKey), error: true });
      return;
    }
    try {
      await exportTextFile(`${name}-${localDateString()}.csv`, build(), "text/csv");
    } catch {
      setCsvNote({ text: t("backupPanel.exportFailed"), error: true });
      return;
    }
    setCsvNote({ text: t(okKey), error: false });
  }

  const handleExportFuelCsv = () =>
    exportCsv(fuelEntries.length, "backupPanel.noFuelToExport", () => fuelEntriesToCsv(fuelEntries, vehicles), "rifornimenti", "backupPanel.fuelExportedOk");
  const handleExportMaintenanceCsv = () =>
    exportCsv(maintenanceEntries.length, "backupPanel.noMaintenanceToExport", () => maintenanceEntriesToCsv(maintenanceEntries, vehicles), "manutenzioni", "backupPanel.maintenanceExportedOk");
  const handleExportExpensesCsv = () =>
    exportCsv(expenseEntries.length, "backupPanel.noExpensesToExport", () => expenseEntriesToCsv(expenseEntries, vehicles), "spese", "backupPanel.expensesExportedOk");

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function driveErrorMessage(err: unknown): string {
    if (err instanceof DriveError) {
      if (err.reason === "not_configured") return t("backupPanel.driveNotConfigured");
      if (err.reason === "cancelled") return t("backupPanel.driveCancelled");
      if (err.reason === "script_failed") return t("backupPanel.driveScriptFailed");
      return t("backupPanel.driveGenericError");
    }
    return t("backupPanel.driveGenericError");
  }

  async function handleSaveToDrive() {
    if (!isPro) {
      setShowPremium(true);
      return;
    }
    setDriveBusy(true);
    setError(null);
    try {
      const backup = await buildBackup();
      await uploadBackupToDrive(JSON.stringify(backup, null, 2));
      await markDataAsReference(backup, true);
      await setLastBackupDate(new Date().toISOString());
      await refreshStatus();
      setMessage(t("backupPanel.driveSavedOk", { n: DRIVE_BACKUPS_TO_KEEP }));
    } catch (err) {
      setError(driveErrorMessage(err));
    } finally {
      setDriveBusy(false);
    }
  }

  async function handleListDriveBackups() {
    if (!isPro) {
      setShowPremium(true);
      return;
    }
    setDriveBusy(true);
    setError(null);
    try {
      const files = await listBackupsOnDrive();
      setDriveFiles(files);
      if (files.length === 0) setMessage(t("backupPanel.driveNoBackups"));
    } catch (err) {
      setError(driveErrorMessage(err));
    } finally {
      setDriveBusy(false);
    }
  }

  async function handleRestoreFromDriveFile(fileId: string, fileName: string) {
    setDriveBusy(true);
    setError(null);
    try {
      const content = await downloadBackupFromDrive(fileId);
      const parsed: unknown = JSON.parse(content);
      if (!isValidBackupData(parsed)) throw new Error("Formato non valido");
      setPendingRestore({ data: parsed, label: fileName, source: "drive" });
    } catch (err) {
      setError(err instanceof DriveError ? driveErrorMessage(err) : t("backupPanel.invalidFile"));
      setMessage(null);
    } finally {
      setDriveBusy(false);
    }
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    const { data } = pendingRestore;
    setPendingRestore(null);
    try {
      await restoreBackup(data);
      await markDataAsReference(data, false);
      await refreshStatus();
      setMessage(t("backupPanel.restoredOk"));
      setError(null);
      setDriveFiles(null);
      onRestored();
    } catch {
      setError(t("backupPanel.invalidFile"));
      setMessage(null);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isValidBackupData(parsed)) throw new Error("Formato non valido");
        setPendingRestore({ data: parsed, label: file.name, source: "file" });
        setError(null);
        setMessage(null);
      } catch {
        setError(t("backupPanel.invalidFile"));
        setMessage(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pendingRestore) confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pendingRestore]);

  function renderConfirm(source: "file" | "drive") {
    if (!pendingRestore || pendingRestore.source !== source) return null;
    const pending = pendingRestore;
    return (
      <div className="backup-panel__confirm" role="alertdialog" aria-live="assertive" ref={confirmRef}>
        <strong>{t("backupPanel.confirmTitle")}</strong>
        <p>
          {t("backupPanel.confirmBody", {
            name: pending.label,
            date: pending.data.exportedAt
              ? new Date(pending.data.exportedAt).toLocaleDateString(getNumberLocale(i18n.language))
              : "?",
          })}
        </p>
        <div className="backup-panel__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setPendingRestore(null)}>
            {t("backupPanel.confirmCancel")}
          </button>
          <button type="button" className="btn btn--primary" onClick={confirmRestore}>
            {t("backupPanel.confirmRestore")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="backup-panel">
      <div className={`backup-panel__status ${daysAgo !== null && daysAgo > 14 ? "is-warning" : ""}`}>
        {lastBackup ? (
          <>
            {t("backupPanel.lastBackup", { date: new Date(lastBackup).toLocaleDateString(getNumberLocale(i18n.language)) })}
            {daysAgo !== null && (
              <span className="backup-panel__days"> · {t("backupPanel.daysAgo", { days: daysAgo })}</span>
            )}
          </>
        ) : (
          t("backupPanel.noBackupYet")
        )}
      </div>

      {message && <p className="backup-panel__message backup-panel__message--ok">{message}</p>}
      {error && <p className="backup-panel__message backup-panel__message--error">{error}</p>}

      {storageUsedKb !== null && (
        <p className="backup-panel__status">
          {t("backupPanel.storageUsed", { mb: formatNumber(storageUsedKb / 1024, 1, getNumberLocale(i18n.language)) })}
        </p>
      )}

      <div className="backup-panel__actions">
        <button type="button" className="btn btn--primary" onClick={handleExportJson}>
          {t("backupPanel.exportJson")}
        </button>
        <button type="button" className="btn btn--ghost" onClick={handleImportClick}>
          {t("backupPanel.restore")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {renderConfirm("file")}

      <p className="backup-panel__hint">{t("backupPanel.hint")}</p>

      <div className="backup-panel__csv">
        <span className="backup-panel__csv-label">
          {t("backupPanel.csvSectionLabel")}
          {!isPro && <span className="backup-panel__pro-badge">🔒 Pro</span>}
        </span>
        <div className="backup-panel__actions">
          <button type="button" className="btn btn--ghost" onClick={handleExportFuelCsv}>
            {t("backupPanel.fuelCsv")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleExportMaintenanceCsv}>
            {t("backupPanel.maintenanceCsv")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleExportExpensesCsv}>
            {t("backupPanel.expensesCsv")}
          </button>
        </div>
        {csvNote && (
          <p role="status" className={`backup-panel__message backup-panel__message--${csvNote.error ? "error" : "ok"}`}>{csvNote.text}</p>
        )}
      </div>

      {vehicles.some((v) => !v.archived) && (
        <CsvImportPanel vehicles={vehicles} fuelEntries={fuelEntries} chargingEntries={chargingEntries} onImported={onRestored} />
      )}

      <div className="backup-panel__csv">
        <span className="backup-panel__csv-label">
          {t("backupPanel.driveSectionLabel")}
          {!isPro && <span className="backup-panel__pro-badge">🔒 Pro</span>}
        </span>
        <div className="backup-panel__actions">
          <button type="button" className="btn btn--ghost" onClick={handleSaveToDrive} disabled={driveBusy}>
            {driveBusy ? t("backupPanel.driveWorking") : t("backupPanel.driveSave")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleListDriveBackups} disabled={driveBusy}>
            {t("backupPanel.driveRestore")}
          </button>
        </div>

        {driveFiles && driveFiles.length > 0 && (
          <div className="vehicle-picker__list" style={{ marginTop: "0.75rem" }}>
            {driveFiles.map((f) => (
              <button
                key={f.id}
                type="button"
                className="vehicle-picker__item"
                onClick={() => handleRestoreFromDriveFile(f.id, f.name)}
                disabled={driveBusy}
              >
                <span className="vehicle-picker__name">{f.name}</span>
                <span className="vehicle-picker__km">
                  {new Date(f.createdTime).toLocaleDateString(getNumberLocale(i18n.language))}
                </span>
              </button>
            ))}
          </div>
        )}

        {renderConfirm("drive")}

        <p className="backup-panel__hint">{t("backupPanel.driveHint")}</p>

        <label className="backup-panel__auto">
          <input
            type="checkbox"
            checked={isPro && autoEnabled}
            onChange={async (e) => {
              if (!isPro) {
                setShowPremium(true);
                return;
              }
              await setAutoBackupEnabled(e.target.checked);
              setAutoEnabled(e.target.checked);
            }}
          />
          <span>
            <strong>{t("backupPanel.autoTitleShort")}</strong>
            <span className="backup-panel__auto-hint">
              {!isPro
                ? t("backupPanel.autoHintPro")
                : !autoEnabled
                  ? t("backupPanel.autoHintOff")
                  : !driveUsed
                    ? t("backupPanel.autoHintFirst")
                    : lastAutoBackup
                      ? t("backupPanel.autoHintLast", { date: new Date(lastAutoBackup).toLocaleDateString(getNumberLocale(i18n.language)) })
                      : t("backupPanel.autoHintOn")}
            </span>
          </span>
        </label>
        {isPro && autoEnabled && driveUsed && Capacitor.isNativePlatform() && (autoError || retryOk) && (
          <div className={`backup-auto-status${autoError ? " is-error" : ""}`} role="status">
            <p>{retryOk && !autoError ? t("backupPanel.autoRetryDone") : t(`backupPanel.autoError.${autoError}`)}</p>
            {autoError && autoError !== "blocked" && (
              <button
                type="button"
                className="btn btn--small"
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  setRetryOk(false);
                  const result = await runAutoBackupIfDue(true, { force: true });
                  await refreshStatus();
                  setRetryOk(result === "done");
                  setRetrying(false);
                }}
              >
                {retrying ? t("backupPanel.autoRetrying") : t("backupPanel.autoRetry")}
              </button>
            )}
          </div>
        )}
        {isPro && autoEnabled && (
          <div className="backup-freq">
            <span className="theme-panel__label">{t("backupPanel.freqTitle")}</span>
            <div className="settings-chip-row backup-freq__chips">
              {AUTO_BACKUP_FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`settings-chip ${autoFreq === f ? "is-active" : ""}`}
                  onClick={async () => {
                    await setAutoBackupFrequency(f);
                    setAutoFreq(f);
                  }}
                >
                  {t(`backupPanel.freq.${f}`)}
                </button>
              ))}
            </div>
            <small className="backup-freq__hint">{t(`backupPanel.freqHint.${autoFreq}`)}</small>
          </div>
        )}
      </div>

      {showPremium && <PremiumScreen onClose={() => setShowPremium(false)} />}
    </div>
  );
}
