import { useEffect, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { CURRENCIES, MILES_ENABLED } from "../utils/settings";
import type { Theme } from "../utils/theme";
import { SUPPORTED_LANGUAGES, changeLanguage } from "../i18n";
import { isGoogleDriveConfigured } from "../services/googleDrive/config";
import QuickEntryHeader from "./QuickEntryHeader";
import {
  disableNotifications,
  enableNotificationsDetailed,
  isNotificationSupported,
  notificationsShownAsOn,
  onNotificationsChange,
  openNotificationSettings,
} from "../utils/notifications";

interface Props {
  onClose: () => void;
  onOpenBackup: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

type RowId = "language" | "units" | "theme" | "notifications" | null;

const PRIVACY_URL = "https://micmax-apps.netlify.app/privacy-diario-auto.html";

const ROW_ICONS: Record<string, string> = {
  language: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10m0-20c-2.5 2.7-4 6.2-4 10s1.5 7.3 4 10M2.5 9h19M2.5 15h19",
  units: "M4 7h16M4 12h16M4 17h10",
  theme: "M12 3a9 9 0 1 0 9 9c0-.5-.05-1-.14-1.45A5.5 5.5 0 0 1 12 3z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 0 1-3.46 0",
  tire: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5.5 5.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-8-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm2.5 4.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  calendar: "M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  route: "M4 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm16-16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 18C6 12 10 12 12 9s4-3 4-3M8 20h8a2 2 0 0 0 2-2v-1",
  backup: "M12 4a5 5 0 0 0-4.9 4.02A4 4 0 0 0 6 16h11a4 4 0 0 0 1-7.87A5 5 0 0 0 12 4z",
  privacy: "M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3zm-3 9l2.2 2.2L15.5 10",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v.01M11 11h1.5v6H11",
};

export default function SettingsScreen({ onClose, onOpenBackup, theme, onToggleTheme }: Props) {
  // Versione reale dell'app installata (versionName + versionCode di Android),
  // così si capisce subito se l'aggiornamento è arrivato.
  const [appVersion, setAppVersion] = useState("");
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setAppVersion("web");
      return;
    }
    CapacitorApp.getInfo()
      .then((info) => setAppVersion(`${info.version} (${info.build})`))
      .catch(() => setAppVersion(""));
  }, []);
  const { t, i18n } = useTranslation();
  const { currency, setCurrency, distanceUnit, setDistanceUnit, temperatureUnit, setTemperatureUnit } = useAppSettings();
  const [openRow, setOpenRow] = useState<RowId>(null);
  const [notificationsOn, setNotificationsOn] = useState(() => notificationsShownAsOn());
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  useEffect(() => onNotificationsChange(() => setNotificationsOn(notificationsShownAsOn())), []);

  async function setNotifications(on: boolean) {
    setNotificationMsg(null);
    if (!on) {
      disableNotifications();
      return;
    }
    if (!isNotificationSupported()) {
      setNotificationMsg(t("detail.notificationsNotSupported"));
      return;
    }
    setNotificationBusy(true);
    const result = await enableNotificationsDetailed();
    setNotificationBusy(false);
    if (result === "error") setNotificationMsg(t("detail.notificationsError"));
    else if (result !== "granted") {
      setNotificationMsg(t(Capacitor.isNativePlatform() ? "detail.notificationsDeniedNative" : "detail.notificationsDenied"));
    }
  }

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language.split("-")[0]);
  const backupActive = isGoogleDriveConfigured();

  function toggleRow(row: RowId) {
    setOpenRow((prev) => (prev === row ? null : row));
  }

  return (
    <div className="settings-embedded">
      <QuickEntryHeader title={t("settingsScreen.title")} onBack={onClose} tone="blue" />

      <div className="settings-list">
        {/* Lingua */}
        <div className="settings-row" onClick={() => toggleRow("language")} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.language} /></svg></span>
          <span className="settings-row__text">
            <span className="settings-row__label">{t("settingsScreen.language")}</span>
            <span className="settings-row__value">{currentLang?.label ?? i18n.language}</span>
          </span>
          <span className={`settings-row__chevron ${openRow === "language" ? "is-open" : ""}`}>›</span>
        </div>
        {openRow === "language" && (
          <div className="settings-row__panel">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`settings-chip ${i18n.language.split("-")[0] === lang.code ? "is-active" : ""}`}
                onClick={() => { changeLanguage(lang.code); setOpenRow(null); }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        )}

        {/* Unità di misura */}
        <div className="settings-row" onClick={() => toggleRow("units")} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.units} /></svg></span>
          <span className="settings-row__text">
            <span className="settings-row__label">{t("settingsScreen.units")}</span>
            <span className="settings-row__value">{distanceUnit} · l/100km · °{temperatureUnit}</span>
          </span>
          <span className={`settings-row__chevron ${openRow === "units" ? "is-open" : ""}`}>›</span>
        </div>
        {openRow === "units" && (
          <div className="settings-row__panel settings-row__panel--stacked">
            <div className="settings-subfield">
              <label>{t("settingsScreen.currency")}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} — {t(c.labelKey)}</option>
                ))}
              </select>
            </div>
            {MILES_ENABLED && (
            <div className="settings-subfield">
              <label>{t("settingsScreen.distanceUnit")}</label>
              <div className="settings-chip-row">
                <button type="button" className={`settings-chip ${distanceUnit === "km" ? "is-active" : ""}`} onClick={() => setDistanceUnit("km")}>{t("settingsScreen.km")}</button>
                <button type="button" className={`settings-chip ${distanceUnit === "mi" ? "is-active" : ""}`} onClick={() => setDistanceUnit("mi")}>{t("settingsScreen.mi")}</button>
              </div>
            </div>
            )}
            <div className="settings-subfield">
              <label>{t("settingsScreen.temperatureUnit")}</label>
              <div className="settings-chip-row">
                <button type="button" className={`settings-chip ${temperatureUnit === "C" ? "is-active" : ""}`} onClick={() => setTemperatureUnit("C")}>{t("settingsScreen.celsius")}</button>
                <button type="button" className={`settings-chip ${temperatureUnit === "F" ? "is-active" : ""}`} onClick={() => setTemperatureUnit("F")}>{t("settingsScreen.fahrenheit")}</button>
              </div>
            </div>
          </div>
        )}

        {/* Tema */}
        <div className="settings-row" onClick={() => toggleRow("theme")} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.theme} /></svg></span>
          <span className="settings-row__text">
            <span className="settings-row__label">{t("settingsScreen.theme")}</span>
            <span className="settings-row__value">{theme === "dark" ? t("settingsScreen.themeDark") : t("settingsScreen.themeLight")}</span>
          </span>
          <span className={`settings-row__chevron ${openRow === "theme" ? "is-open" : ""}`}>›</span>
        </div>
        {openRow === "theme" && (
          <div className="settings-row__panel">
            <button type="button" className={`settings-chip ${theme === "dark" ? "is-active" : ""}`} onClick={() => theme !== "dark" && onToggleTheme()}>{t("settingsScreen.themeDark")}</button>
            <button type="button" className={`settings-chip ${theme === "light" ? "is-active" : ""}`} onClick={() => theme !== "light" && onToggleTheme()}>{t("settingsScreen.themeLight")}</button>
          </div>
        )}

        {/* Notifiche delle scadenze: attive per default, qui si possono spegnere */}
        <div className="settings-row" onClick={() => toggleRow("notifications")} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.bell} /></svg></span>
          <span className="settings-row__text">
            <span className="settings-row__label">{t("settingsScreen.notifications")}</span>
            <span className={`settings-row__value ${notificationsOn ? "is-positive" : ""}`}>
              {notificationsOn ? t("settingsScreen.notificationsOn") : t("settingsScreen.notificationsOff")}
            </span>
          </span>
          <span className={`settings-row__chevron ${openRow === "notifications" ? "is-open" : ""}`}>›</span>
        </div>
        {openRow === "notifications" && (
          <div className="settings-row__panel settings-row__panel--stacked">
            <div className="settings-chip-row">
              <button type="button" className={`settings-chip ${notificationsOn ? "is-active" : ""}`} disabled={notificationBusy} onClick={() => !notificationsOn && setNotifications(true)}>
                {t("settingsScreen.notificationsOn")}
              </button>
              <button type="button" className={`settings-chip ${!notificationsOn ? "is-active" : ""}`} onClick={() => notificationsOn && setNotifications(false)}>
                {t("settingsScreen.notificationsOff")}
              </button>
            </div>
            <p className="settings-row__hint">
              {t(Capacitor.isNativePlatform() ? "settingsScreen.notificationsHintNative" : "settingsScreen.notificationsHintWeb")}
            </p>
            {notificationMsg && <p className="form-error" style={{ margin: 0 }}>{notificationMsg}</p>}
            {notificationMsg && Capacitor.isNativePlatform() && (
              <button type="button" className="btn btn--ghost btn--small" style={{ alignSelf: "flex-start" }} onClick={() => void openNotificationSettings()}>
                {t("settingsScreen.openNotificationSettings")}
              </button>
            )}
          </div>
        )}

        {/* Backup */}
        <div className="settings-row" onClick={onOpenBackup} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.backup} /></svg></span>
          <span className="settings-row__text">
            <span className="settings-row__label">{t("settingsScreen.backupSync")}</span>
            <span className={`settings-row__value ${backupActive ? "is-positive" : ""}`}>
              {backupActive ? t("settingsScreen.backupActive") : t("settingsScreen.backupNotConfigured")}
            </span>
          </span>
          <span className="settings-row__chevron">›</span>
        </div>

        {/* Privacy */}
        <a
          className="settings-row"
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.privacy} /></svg></span>
          <span className="settings-row__text">
            <span className="settings-row__label">{t("settingsScreen.privacy")}</span>
            <span className="settings-row__value">micmax-apps.netlify.app</span>
          </span>
          <span className="settings-row__chevron">↗</span>
        </a>

        {/* Info */}
        <div className="settings-row settings-row--static">
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.info} /></svg></span>
          <span className="settings-row__text">
            <span className="settings-row__label">{t("settingsScreen.infoSupport")}</span>
            <span className="settings-row__value">{t("settingsScreen.version")} {appVersion}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
