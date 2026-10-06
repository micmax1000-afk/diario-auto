import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { compressImage, estimateDataUrlKb } from "../utils/imageCompression";
import { takeNativePhoto, chooseNativePhotoFromGallery } from "../utils/nativePhotoCapture";

interface Props {
  id: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Prefisso delle chiavi i18n: usa `${keyPrefix}.photo`, `.photoHint`, `.photoCompressing`, `.photoError`, `.photoPreviewAlt` — stesso schema già usato da maintenanceForm/expenseForm. */
  keyPrefix: string;
  /** Se indicato, la foto viene ritagliata al centro in questo formato (larghezza/altezza, es. 16/9). */
  aspect?: number;
}

/**
 * Allegato foto per manutenzioni/spese. Su app nativa Android offre due
 * pulsanti (Scatta foto / Scegli dalla galleria) tramite il plugin
 * ufficiale @capacitor/camera, più affidabile del semplice input file
 * dentro una WebView. Nel browser resta l'input file di sempre.
 */
export default function PhotoPicker({ id, value, onChange, keyPrefix, aspect }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kb = value ? estimateDataUrlKb(value) : null;
  const isNative = Capacitor.isNativePlatform();

  async function handleWebFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await compressImage(file, { aspect }));
    } catch {
      setError(t(`${keyPrefix}.photoError`));
    }
    setBusy(false);
    e.target.value = "";
  }

  async function handleNativeCapture(source: "camera" | "gallery") {
    setBusy(true);
    setError(null);
    try {
      const raw = source === "camera" ? await takeNativePhoto() : await chooseNativePhotoFromGallery();
      if (raw) onChange(await compressImage(raw, { aspect }));
    } catch {
      setError(t(`${keyPrefix}.photoError`));
    }
    setBusy(false);
  }

  return (
    <div className="field">
      <label htmlFor={id}>{t(`${keyPrefix}.photo`)}</label>

      {isNative ? (
        <div className="photo-picker__buttons">
          <button type="button" className="btn btn--ghost btn--small btn--icon" onClick={() => handleNativeCapture("camera")} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {t("common.takePhoto")}
          </button>
          <button type="button" className="btn btn--ghost btn--small btn--icon" onClick={() => handleNativeCapture("gallery")} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="m21 15-5-5-9 9" />
            </svg>
            {t("common.chooseFromGallery")}
          </button>
        </div>
      ) : (
        <input id={id} type="file" accept="image/*" onChange={handleWebFileChange} disabled={busy} />
      )}

      {busy && <p className="obd-hint">{t(`${keyPrefix}.photoCompressing`)}</p>}
      {error && <p className="form-error">{error}</p>}

      {value && (
        <div className={`photo-preview${aspect ? " photo-preview--wide" : ""}`}>
          <img src={value} alt={t(`${keyPrefix}.photoPreviewAlt`)} />
          <span className="photo-preview__meta">
            ~{kb} KB
            <button type="button" className="photo-preview__remove" onClick={() => onChange(null)}>
              {t("common.remove")}
            </button>
          </span>
        </div>
      )}

      <p className="obd-hint">{t(`${keyPrefix}.photoHint`)}</p>
    </div>
  );
}
