import { useTranslation } from "react-i18next";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { CURRENCIES } from "../utils/settings";

interface Props {
  onClose: () => void;
  onOpenBackup: () => void;
}

export default function SettingsScreen({ onClose, onOpenBackup }: Props) {
  const { t } = useTranslation();
  const { currency, setCurrency, distanceUnit, setDistanceUnit, temperatureUnit, setTemperatureUnit } = useAppSettings();

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="settings-title">{t("settingsScreen.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <div className="field">
            <label htmlFor="settings-currency">{t("settingsScreen.currency")}</label>
            <select id="settings-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} — {t(c.labelKey)}
                </option>
              ))}
            </select>
            <p className="obd-hint">{t("settingsScreen.currencyHint")}</p>
          </div>

          <div className="field">
            <label htmlFor="settings-distance">{t("settingsScreen.distanceUnit")}</label>
            <select
              id="settings-distance"
              value={distanceUnit}
              onChange={(e) => setDistanceUnit(e.target.value as "km" | "mi")}
            >
              <option value="km">{t("settingsScreen.km")}</option>
              <option value="mi">{t("settingsScreen.mi")}</option>
            </select>
            <p className="obd-hint">{t("settingsScreen.distanceUnitHint")}</p>
          </div>

          <div className="field">
            <label htmlFor="settings-temperature">{t("settingsScreen.temperatureUnit")}</label>
            <select
              id="settings-temperature"
              value={temperatureUnit}
              onChange={(e) => setTemperatureUnit(e.target.value as "C" | "F")}
            >
              <option value="C">{t("settingsScreen.celsius")}</option>
              <option value="F">{t("settingsScreen.fahrenheit")}</option>
            </select>
            <p className="obd-hint">{t("settingsScreen.temperatureUnitHint")}</p>
          </div>

          <div className="field" style={{ marginTop: "1.5rem", borderTop: "1px solid var(--chrome-border)", paddingTop: "1.25rem" }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                onClose();
                onOpenBackup();
              }}
            >
              {t("nav.backup")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
