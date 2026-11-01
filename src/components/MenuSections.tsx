import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { FREE_VEHICLE_LIMIT } from "../services/billing/useProStatus";
import VehicleThumb from "./VehicleThumb";

interface Props {
  vehicles: Vehicle[];
  isPro: boolean;
  onEditVehicle: (vehicle: Vehicle) => void;
  onAddVehicle: () => void;
  onManageVehicles: () => void;
  onOpenCommute: () => void;
  onOpenExpenses: () => void;
  onOpenKmHistory: () => void;
  onOpenReminders: () => void;
  onOpenAdapters: () => void;
  onOpenTrips: () => void;
  onOpenStations: () => void;
}

const ICONS = {
  // percorso: partenza, strada tratteggiata, bandierina d'arrivo
  route: (
    <>
      <circle cx="4.6" cy="19" r="2.6" />
      <path d="M7.4 18.3c3.6-.5 5-2.6 5-4.9 0-2.4 2.3-3.6 5.9-3.6" strokeDasharray="2.4 2.6" />
      <path d="M19.6 11V2.4l3.6 1.8-3.6 1.8" />
    </>
  ),
  wallet: <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM3 10h18M15 14h3" />,
  chart: <path d="M4 20V10M11 20V4M18 20v-7" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  briefcase: <path d="M4 8h16v11H4zM9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M4 13h16" />,
  obd: (
    <>
      <path d="M3 7.5h18l-1.8 8.6a2 2 0 0 1-2 1.6H6.8a2 2 0 0 1-2-1.6L3 7.5z" />
      <path d="M7.5 11h.01M10.5 11h.01M13.5 11h.01M16.5 11h.01M9 14.3h.01M12 14.3h.01M15 14.3h.01" strokeWidth="2.6" />
    </>
  ),
  calendar: <path d="M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />,
};

/** Garage e Utilità in cima al Menu che si apre dall'ingranaggio della Home. */
export default function MenuSections({
  vehicles,
  isPro,
  onEditVehicle,
  onAddVehicle,
  onManageVehicles,
  onOpenCommute,
  onOpenExpenses,
  onOpenKmHistory,
  onOpenReminders,
  onOpenAdapters,
  onOpenTrips,
  onOpenStations,
}: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const row = (icon: keyof typeof ICONS, label: string, sub: string, onClick: () => void) => (
    <button type="button" className="settings-row" onClick={onClick}>
      <span className="settings-row__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
      </span>
      <span className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        <span className="settings-row__value">{sub}</span>
      </span>
      <span className="settings-row__chevron">›</span>
    </button>
  );

  return (
    <>
      <h2 className="menu-sect">
        {t("menu.garage")}
        {!isPro && vehicles.length <= FREE_VEHICLE_LIMIT && <span className="menu-sect__count"> {vehicles.length}/{FREE_VEHICLE_LIMIT}</span>}
      </h2>
      <div className="menu-garage">
        {vehicles.map((v) => (
          <button key={v.id} type="button" className="menu-garage__item" onClick={() => onEditVehicle(v)}>
            <VehicleThumb vehicle={v} className="menu-garage__thumb" />
            <span className="menu-garage__text">
              <span className="menu-garage__name">{v.name}</span>
              <span className="menu-garage__sub">
                {[v.plate, formatDistance(v.currentKm, distanceUnit, locale)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="settings-row__chevron">›</span>
          </button>
        ))}
        <div className="menu-garage__actions">
          <button type="button" className="btn btn--primary btn--small" onClick={onAddVehicle}>
            + {t("menu.addVehicle")}
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={onManageVehicles}>
            {t("menu.manageVehicles")}
          </button>
        </div>
      </div>

      {vehicles.length > 0 && (
        <>
          <h2 className="menu-sect">{t("utilities.title")}</h2>
          <div className="menu-list">
            {row("route", t("detail.tabs.commute"), t("menu.commuteSub"), onOpenCommute)}
            {row("pin", t("stations.title"), t("stations.menuSub"), onOpenStations)}
            {row("briefcase", t("trips.title"), t("menu.tripsSub"), onOpenTrips)}
            {row("wallet", t("detail.expensesTitle"), t("menu.expensesSub"), onOpenExpenses)}
            {row("chart", t("kmHistory.title"), t("menu.kmSub"), onOpenKmHistory)}
            {row("calendar", t("dashboardGarage.deadlines"), t("menu.remindersSub"), onOpenReminders)}
            {row("obd", t("obdAdapters.menuTitle"), t("obdAdapters.menuSub"), onOpenAdapters)}
          </div>
        </>
      )}
    </>
  );
}
