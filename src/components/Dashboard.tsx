import { useTranslation } from "react-i18next";
import type { Vehicle, Reminder, MaintenanceEntry, FuelEntry, ChargingEntry, ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { FREE_VEHICLE_LIMIT } from "../services/billing/useProStatus";
import UpcomingReminders from "./UpcomingReminders";
import ActionGridIcon from "./ActionGridIcon";
import { calculateConsumption, averageConsumption, isReminderDue } from "../utils/calculations";

interface Props {
  vehicles: Vehicle[];
  reminders: Reminder[];
  maintenanceEntries: MaintenanceEntry[];
  fuelEntries: FuelEntry[];
  chargingEntries: ChargingEntry[];
  expenseEntries: ExpenseEntry[];
  isPro: boolean;
  onOpenVehicle: (id: string) => void;
  onAddVehicle: () => void;
  onManageVehicles: () => void;
  onQuickFuel: () => void;
  onQuickCharge: () => void;
  onQuickKm: (vehicle: Vehicle) => void;
  onOpenReminder: (vehicleId: string) => void;
  onOpenReminders: () => void;
  onOpenUtilities: () => void;
  onOpenPremium: () => void;
}

export default function Dashboard({
  vehicles,
  reminders,
  maintenanceEntries,
  fuelEntries,
  chargingEntries,
  expenseEntries,
  isPro,
  onOpenVehicle,
  onAddVehicle,
  onManageVehicles,
  onQuickFuel,
  onQuickKm,
  onOpenReminder,
  onOpenReminders,
  onOpenUtilities,
}: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const activeVehicles = vehicles.filter((v) => !v.archived);
  const primaryVehicle = activeVehicles[0];

  // Riepilogo del mese per il veicolo principale
  const ym = new Date().toISOString().slice(0, 7);
  const inMonth = (d: string) => d.slice(0, 7) === ym;
  const vid = primaryVehicle?.id;
  const monthFuel = fuelEntries.filter((e) => e.vehicleId === vid && inMonth(e.date));
  const monthSpend =
    monthFuel.reduce((a, e) => a + e.totalCost, 0) +
    chargingEntries.filter((e) => e.vehicleId === vid && inMonth(e.date)).reduce((a, e) => a + e.totalCost, 0) +
    maintenanceEntries.filter((e) => e.vehicleId === vid && inMonth(e.date)).reduce((a, e) => a + e.cost, 0) +
    expenseEntries.filter((e) => e.vehicleId === vid && inMonth(e.date)).reduce((a, e) => a + e.amount, 0);
  const avgKmPerL = averageConsumption(calculateConsumption(fuelEntries.filter((e) => e.vehicleId === vid)));
  const urgentCount = reminders.filter((r) => {
    const v = activeVehicles.find((x) => x.id === r.vehicleId);
    return v && !r.completed && isReminderDue(r.dueDate, r.dueKm, v.currentKm) !== "ok";
  }).length;

  return (
    <div className="dashboard">
      {/* VEICOLI */}
      <section className="dash-vehicles">
        <div className="dash-vehicles__head">
          <h2>
            {t("dashboardGarage.yourVehicles")}
            {!isPro && (
              <span className="dash-vehicles__count">
                {" "}
                ({activeVehicles.length}/{FREE_VEHICLE_LIMIT})
              </span>
            )}
          </h2>
          <div style={{ display: "flex", gap: "0.9rem" }}>
            <button type="button" className="dash-link" onClick={onManageVehicles}>
              {t("dashboardGarage.manage")}
            </button>
            {activeVehicles.length > 0 && (
              <button type="button" className="dash-link" onClick={onAddVehicle}>
                + {t("dashboardGarage.add")}
              </button>
            )}
          </div>
        </div>

        {activeVehicles.length === 0 ? (
          <div className="dash-empty">
            <p>{t("dashboardGarage.emptyTitle")}</p>
            <button type="button" className="btn btn--primary" onClick={onAddVehicle}>
              + {t("dashboardGarage.emptyAddFirst")}
            </button>
          </div>
        ) : (
          <div className="dash-vehicle-list dash-vehicle-list--featured">
            {activeVehicles.map((v, index) => (
              <section
                key={v.id}
                className={`dash-featured-vehicle${v.photo ? " dash-featured-vehicle--hero" : ""}`}
                onClick={() => onOpenVehicle(v.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpenVehicle(v.id)}
              >
                {v.photo && <img className="dash-featured-vehicle__photo" src={v.photo} alt={v.name} />}
                <div className="dash-featured-vehicle__info">
                  <div>
                    {index === 0 && <span className="dash-featured-vehicle__badge">{t("dashboardGarage.primary", "PRINCIPALE")}</span>}
                    <h1 className="dash-featured-vehicle__name">{v.name}</h1>
                    <p className="dash-featured-vehicle__km">
                      {formatDistance(v.currentKm, distanceUnit, locale)}
                      <button
                        type="button"
                        className="dash-featured-vehicle__edit"
                        onClick={(e) => { e.stopPropagation(); onQuickKm(v); }}
                        aria-label={t("dashboardGarage.updateKm", "Aggiorna km")}
                      >
                        ✎
                      </button>
                    </p>
                    <div className="dash-featured-vehicle__meta">
                      <span>{t(`fuelType.${v.fuelType}`)}</span>
                      {v.year && <span>{v.year}</span>}
                      {v.plate && <span>{v.plate}</span>}
                    </div>
                    {v.notes && <p className="dash-featured-vehicle__notes">{v.notes}</p>}
                  </div>
                  <span className="dash-featured-vehicle__chevron">›</span>
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {activeVehicles.length > 0 && (
        <UpcomingReminders
          vehicles={activeVehicles}
          reminders={reminders}
          distanceUnit={distanceUnit}
          onOpenReminder={() => onOpenReminder(primaryVehicle?.id ?? activeVehicles[0].id)}
          onViewAll={onOpenReminders}
        />
      )}

      {activeVehicles.length > 0 && (
        <section className="dash-quick">
          <h2 className="dash-section-title">{t("dashboardGarage.quickActions", "Azioni rapide")}</h2>
          <div className="dash-quick__row">
            <button type="button" className="dash-quick__item dash-quick__item--primary" onClick={onQuickFuel}>
              <ActionGridIcon name="fuel" className="dash-quick__icon" />
              <span>{t("dashboardGarage.fuel", "Rifornimento")}</span>
            </button>
            <button type="button" className="dash-quick__item" onClick={() => primaryVehicle && onQuickKm(primaryVehicle)}>
              <ActionGridIcon name="gauge" className="dash-quick__icon dash-quick__icon--blue" />
              <span>{t("dashboardGarage.updateKm", "Aggiorna km")}</span>
            </button>
            <button type="button" className="dash-quick__item" onClick={onOpenReminders}>
              <span className="dash-quick__badgewrap">
                <ActionGridIcon name="bell" className="dash-quick__icon dash-quick__icon--red" />
                {urgentCount > 0 && <span className="dash-quick__badge">{urgentCount}</span>}
              </span>
              <span>{t("dashboardGarage.reminders", "Promemoria")}</span>
            </button>
            <button type="button" className="dash-quick__item" onClick={onOpenUtilities}>
              <ActionGridIcon name="folder" className="dash-quick__icon dash-quick__icon--yellow" />
              <span>{t("utilities.title", "Utilità")}</span>
            </button>
          </div>
        </section>
      )}

      {activeVehicles.length > 0 && urgentCount === 0 && (
        <section className="dash-allclear">
          <span className="dash-allclear__icon" aria-hidden="true">✓</span>
          <div>
            <strong>{t("dashboardGarage.allClearTitle", "Tutto in regola")}</strong>
            <span>{t("dashboardGarage.allClearBody", "Nessuna scadenza imminente.")}</span>
          </div>
        </section>
      )}

      {activeVehicles.length > 0 && (
        <section className="dash-month">
          <h2 className="dash-section-title">{t("dashboardGarage.thisMonth", "Questo mese")}</h2>
          <div className="dash-month__grid">
            <div className="dash-month__stat">
              <span className="dash-month__value">{monthSpend.toLocaleString(locale, { maximumFractionDigits: 0 })} €</span>
              <span className="dash-month__label">{t("dashboardGarage.monthSpend", "Spesa totale")}</span>
            </div>
            <div className="dash-month__stat">
              <span className="dash-month__value">{avgKmPerL ? (100 / avgKmPerL).toLocaleString(locale, { maximumFractionDigits: 1 }) : "–"}</span>
              <span className="dash-month__label">{t("dashboardGarage.avgConsumption", "L/100 km medi")}</span>
            </div>
            <div className="dash-month__stat">
              <span className="dash-month__value">{monthFuel.length}</span>
              <span className="dash-month__label">{t("dashboardGarage.refuels", "Rifornimenti")}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
