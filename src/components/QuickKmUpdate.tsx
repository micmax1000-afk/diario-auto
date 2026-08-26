import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { getNumberLocale } from "../utils/locale";

interface Props {
  vehicle: Vehicle;
  onSave: (km: number) => void;
  onClose: () => void;
}

export default function QuickKmUpdate({ vehicle, onSave, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [km, setKm] = useState(String(vehicle.currentKm));
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(km);
    if (Number.isNaN(value) || value < vehicle.currentKm) {
      setError(t("quickKm.error", { km: vehicle.currentKm.toLocaleString(getNumberLocale(i18n.language)) }));
      return;
    }
    onSave(Math.round(value));
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-km-title">
      <div className="modal modal--small">
        <div className="modal__header">
          <h2 id="quick-km-title">{t("quickKm.title", { name: vehicle.name })}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field">
            <label htmlFor="quick-km">{t("quickKm.label")}</label>
            <input
              id="quick-km"
              type="number"
              inputMode="numeric"
              autoFocus
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn btn--primary">
              {t("quickKm.update")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
