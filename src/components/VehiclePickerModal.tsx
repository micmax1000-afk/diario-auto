import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";

interface Props {
  vehicles: Vehicle[];
  onSelect: (vehicleId: string) => void;
  onClose: () => void;
}

/**
 * Forza la scelta esplicita del veicolo prima di procedere con un'azione
 * rapida globale (es. "Aggiungi rifornimento" dalla Dashboard): senza
 * questo passaggio, con più di un veicolo attivo il rischio è registrare
 * dati sul veicolo sbagliato in silenzio.
 */
export default function VehiclePickerModal({ vehicles, onSelect, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vehicle-picker-title">
      <div className="modal modal--small">
        <div className="modal__header">
          <h2 id="vehicle-picker-title">{t("vehiclePicker.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>
        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <div className="vehicle-picker__list">
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                className="vehicle-picker__item"
                onClick={() => onSelect(v.id)}
              >
                <span className="vehicle-picker__name">{v.name}</span>
                <span className="vehicle-picker__km">
                  {formatDistance(v.currentKm, distanceUnit, getNumberLocale(i18n.language))}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
