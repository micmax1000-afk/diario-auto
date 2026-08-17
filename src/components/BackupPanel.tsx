import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Vehicle, FuelEntry, MaintenanceEntry, ExpenseEntry } from "../types";
import {
  buildBackup,
  restoreBackup,
  getLastBackupDate,
  setLastBackupDate,
  daysSince,
  downloadTextFile,
  fuelEntriesToCsv,
  maintenanceEntriesToCsv,
  expenseEntriesToCsv,
  type BackupData,
} from "../utils/storage";

interface Props {
  vehicles: Vehicle[];
  fuelEntries: FuelEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries: ExpenseEntry[];
  onRestored: () => void;
}

export default function BackupPanel({ vehicles, fuelEntries, maintenanceEntries, expenseEntries, onRestored }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastBackup = getLastBackupDate();
  const daysAgo = lastBackup ? daysSince(lastBackup) : null;

  const storageUsedKb = (() => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("diario-auto:")) {
          total += (localStorage.getItem(key)?.length ?? 0) * 2; // UTF-16, ~2 byte/carattere
        }
      }
      return Math.round(total / 1024);
    } catch {
      return null;
    }
  })();

  function handleExportJson() {
    const backup = buildBackup();
    const filename = `diario-auto-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadTextFile(filename, JSON.stringify(backup, null, 2), "application/json");
    setLastBackupDate(new Date().toISOString());
    setMessage("Backup esportato correttamente.");
    setError(null);
  }

  function handleExportFuelCsv() {
    if (fuelEntries.length === 0) {
      setError("Nessun rifornimento da esportare.");
      return;
    }
    const csv = fuelEntriesToCsv(fuelEntries, vehicles);
    downloadTextFile(`rifornimenti-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    setMessage("Rifornimenti esportati in CSV.");
    setError(null);
  }

  function handleExportMaintenanceCsv() {
    if (maintenanceEntries.length === 0) {
      setError("Nessuna manutenzione da esportare.");
      return;
    }
    const csv = maintenanceEntriesToCsv(maintenanceEntries, vehicles);
    downloadTextFile(`manutenzioni-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    setMessage("Manutenzioni esportate in CSV.");
    setError(null);
  }

  function handleExportExpensesCsv() {
    if (expenseEntries.length === 0) {
      setError("Nessuna spesa da esportare.");
      return;
    }
    const csv = expenseEntriesToCsv(expenseEntries, vehicles);
    downloadTextFile(`spese-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    setMessage("Spese esportate in CSV.");
    setError(null);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as BackupData;
        if (!data.vehicles) throw new Error("Formato non valido");
        restoreBackup(data);
        setMessage("Backup ripristinato correttamente.");
        setError(null);
        onRestored();
      } catch {
        setError("File di backup non valido o corrotto.");
        setMessage(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="backup-panel">
      <div className={`backup-panel__status ${daysAgo !== null && daysAgo > 14 ? "is-warning" : ""}`}>
        {lastBackup ? (
          <>
            Ultimo backup: {new Date(lastBackup).toLocaleDateString("it-IT")}
            {daysAgo !== null && (
              <span className="backup-panel__days"> · {daysAgo} giorni fa</span>
            )}
          </>
        ) : (
          "Non hai ancora fatto un backup"
        )}
      </div>

      {message && <p className="backup-panel__message backup-panel__message--ok">{message}</p>}
      {error && <p className="backup-panel__message backup-panel__message--error">{error}</p>}

      {storageUsedKb !== null && (
        <p className={`backup-panel__status ${storageUsedKb > 4000 ? "is-warning" : ""}`}>
          Spazio occupato: ~{(storageUsedKb / 1024).toFixed(1)} MB
          {storageUsedKb > 4000 && " — ti stai avvicinando al limite tipico del browser (5-10MB). Elimina foto vecchie o esporta e ripulisci."}
        </p>
      )}

      <div className="backup-panel__actions">
        <button type="button" className="btn btn--primary" onClick={handleExportJson}>
          Esporta backup completo (JSON)
        </button>
        <button type="button" className="btn btn--ghost" onClick={handleImportClick}>
          Ripristina da backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      <p className="backup-panel__hint">
        Dopo l'esportazione, sposta il file su Drive o un'altra app: se resta solo nella cartella Download di
        questo dispositivo non è al sicuro in caso di problemi al telefono.
      </p>

      <div className="backup-panel__csv">
        <span className="backup-panel__csv-label">Esporta per foglio di calcolo</span>
        <div className="backup-panel__actions">
          <button type="button" className="btn btn--ghost" onClick={handleExportFuelCsv}>
            Rifornimenti (CSV)
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleExportMaintenanceCsv}>
            Manutenzioni (CSV)
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleExportExpensesCsv}>
            Spese (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}
