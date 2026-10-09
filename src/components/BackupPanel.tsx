import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle, FuelEntry, MaintenanceEntry, ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { useProStatus } from "../services/billing/useProStatus";
import { exportTextFile } from "../utils/nativeFileExport";
import PremiumScreen from "./PremiumScreen";
import {
  uploadBackupToDrive,
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
  onRestored: () => void;
}

export default function BackupPanel({ vehicles, fuelEntries, maintenanceEntries, expenseEntries, onRestored }: Props) {
  const { t, i18n } = useTranslation();
  const { isPro } = useProStatus();
  const [showPremium, setShowPremium] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [storageUsedKb, setStorageUsedKb] = useState<number | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveBackupFile[] | null>(null);
  // Ripristino in attesa di conferma: sostituisce TUTTI i dati attuali, quindi mai senza un "sei sicuro?"
  const [pendingRestore, setPendingRestore] = useState<{ data: BackupData; label: string; source: "file" | "drive" } | null>(null);

  async function refreshStatus() {
    setLastBackup(await getLastBackupDate());
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
    const filename = `diario-auto-backup-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      await exportTextFile(filename, JSON.stringify(backup, null, 2), "application/json");
    } catch {
      setError(t("backupPanel.exportFailed"));
      return;
    }
    await setLastBackupDate(new Date().toISOString());
    await refreshStatus();
    setMessage(t("backupPanel.exportedOk"));
    setError(null);
  }

  async function handleExportFuelCsv() {
    if (!isPro) {
      setShowPremium(true);
      return;
    }
    if (fuelEntries.length === 0) {
      setError(t("backupPanel.noFuelToExport"));
      return;
    }
    const csv = fuelEntriesToCsv(fuelEntries, vehicles);
    try {
      await exportTextFile(`rifornimenti-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    } catch {
      setError(t("backupPanel.exportFailed"));
      return;
    }
    setMessage(t("backupPanel.fuelExportedOk"));
    setError(null);
  }

  async function handleExportMaintenanceCsv() {
    if (!isPro) {
      setShowPremium(true);
      return;
    }
    if (maintenanceEntries.length === 0) {
      setError(t("backupPanel.noMaintenanceToExport"));
      return;
    }
    const csv = maintenanceEntriesToCsv(maintenanceEntries, vehicles);
    try {
      await exportTextFile(`manutenzioni-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    } catch {
      setError(t("backupPanel.exportFailed"));
      return;
    }
    setMessage(t("backupPanel.maintenanceExportedOk"));
    setError(null);
  }

  async function handleExportExpensesCsv() {
    if (!isPro) {
      setShowPremium(true);
      return;
    }
    if (expenseEntries.length === 0) {
      setError(t("backupPanel.noExpensesToExport"));
      return;
    }
    const csv = expenseEntriesToCsv(expenseEntries, vehicles);
    try {
      await exportTextFile(`spese-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    } catch {
      setError(t("backupPanel.exportFailed"));
      return;
    }
    setMessage(t("backupPanel.expensesExportedOk"));
    setError(null);
  }

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
      await setLastBackupDate(new Date().toISOString());
      await refreshStatus();
      setMessage(t("backupPanel.driveSavedOk"));
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
          {t("backupPanel.storageUsed", { mb: (storageUsedKb / 1024).toFixed(1) })}
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
      </div>

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
      </div>

      {showPremium && <PremiumScreen onClose={() => setShowPremium(false)} />}
    </div>
  );
}
