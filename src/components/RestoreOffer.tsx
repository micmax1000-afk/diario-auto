import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { isValidBackupData, restoreBackup, type BackupData } from "../utils/storage";
import { markDataAsReference } from "../utils/autoBackup";
import { isGoogleDriveConfigured } from "../services/googleDrive/config";
import { DriveError, downloadBackupFromDrive, listBackupsOnDrive, type DriveBackupFile } from "../services/googleDrive/driveBackup";
import { getNumberLocale } from "../utils/locale";

interface Props {
  /** Ripristino riuscito: l'app ricarica i dati. */
  onRestored: () => void;
  /** "Inizio da zero": si prosegue con la guida iniziale. */
  onSkip: () => void;
}

/**
 * Primo avvio senza dati: prima della guida chiede se c'è già un backup
 * (Google Drive o file) e lo ripristina subito, così su un telefono nuovo
 * non serve andare a cercarlo nel menu Backup.
 */
export default function RestoreOffer({ onRestored, onSkip }: Props) {
  const { t, i18n } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveBackupFile[] | null>(null);
  const drive = isGoogleDriveConfigured();

  async function apply(data: BackupData, viaDrive: boolean) {
    await restoreBackup(data);
    await markDataAsReference(data, viaDrive);
    onRestored();
  }

  function driveError(err: unknown): string {
    if (err instanceof DriveError && err.reason === "cancelled") return t("backupPanel.driveCancelled");
    if (err instanceof DriveError && err.reason === "not_configured") return t("backupPanel.driveNotConfigured");
    return t("backupPanel.driveGenericError");
  }

  async function listDrive() {
    setBusy(true);
    setError(null);
    try {
      const list = await listBackupsOnDrive();
      if (list.length === 0) setError(t("restoreOffer.noDriveBackups"));
      setFiles(list);
    } catch (err) {
      setError(driveError(err));
    } finally {
      setBusy(false);
    }
  }

  async function restoreDrive(file: DriveBackupFile) {
    setBusy(true);
    setError(null);
    try {
      const parsed: unknown = JSON.parse(await downloadBackupFromDrive(file.id));
      if (!isValidBackupData(parsed)) throw new Error("invalid");
      await apply(parsed, true);
    } catch (err) {
      setError(err instanceof DriveError ? driveError(err) : t("backupPanel.invalidFile"));
      setBusy(false);
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isValidBackupData(parsed)) throw new Error("invalid");
        setBusy(true);
        await apply(parsed, false);
      } catch {
        setError(t("backupPanel.invalidFile"));
        setBusy(false);
      }
    };
    reader.readAsText(file);
  }

  const locale = getNumberLocale(i18n.language);

  return (
    <>
      <div className="sheet-scrim" />
      <div className="sheet restore-offer" role="dialog" aria-modal="true" aria-labelledby="restore-offer-title">
        <span className="sheet__grab" aria-hidden="true" />
        <span className="restore-offer__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4a5 5 0 0 0-4.9 4.02A4 4 0 0 0 6 16h11a4 4 0 0 0 1-7.87A5 5 0 0 0 12 4z" />
            <path d="M12 10v6M9.5 13.5 12 16l2.5-2.5" />
          </svg>
        </span>
        <h2 id="restore-offer-title" className="sheet__title">{t("restoreOffer.title")}</h2>
        <p className="sheet__sub">{t("restoreOffer.body")}</p>

        {files && files.length > 0 ? (
          <div className="restore-offer__files">
            <p className="restore-offer__pick">{t("restoreOffer.pick")}</p>
            {files.slice(0, 5).map((f) => (
              <button key={f.id} type="button" className="restore-offer__file" disabled={busy} onClick={() => restoreDrive(f)}>
                <span>{new Date(f.createdTime).toLocaleString(locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        ) : (
          drive && (
            <button type="button" className="btn btn--primary restore-offer__btn" disabled={busy} onClick={listDrive}>
              {busy ? t("restoreOffer.searching") : t("restoreOffer.drive")}
            </button>
          )
        )}
        <button type="button" className="btn restore-offer__btn restore-offer__btn--ghost" disabled={busy} onClick={onSkip}>
          {t("restoreOffer.skip")}
        </button>
        {error && <p className="restore-offer__error">{error}</p>}
        <p className="sheet__hint">
          {t("restoreOffer.fileQuestion")}{" "}
          <button type="button" className="sheet__link" disabled={busy} onClick={() => fileRef.current?.click()}>
            {t("restoreOffer.file")}
          </button>
        </p>
        <input ref={fileRef} type="file" accept="application/json" onChange={onFile} style={{ display: "none" }} />
      </div>
    </>
  );
}
