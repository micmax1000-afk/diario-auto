import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle, Reminder, MaintenanceEntry, FuelEntry, ChargingEntry, ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { FREE_VEHICLE_LIMIT } from "../services/billing/useProStatus";
import UpcomingReminders from "./UpcomingReminders";
import ActionGridIcon from "./ActionGridIcon";
import VehicleBodyIcon from "./VehicleBodyIcon";
import { getMeta, setMeta } from "../utils/db";
import { daysSince } from "../utils/storage";
import { resolveVehicleColors } from "../utils/vehicleColor";
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
  onQuickFuelVehicle: (vehicleId: string) => void;
  onMoveVehicle: (vehicleId: string, direction: -1 | 1) => void;
  onQuickCharge: () => void;
  onQuickKm: (vehicle: Vehicle) => void;
  onOpenReminder: (vehicleId: string) => void;
  onOpenReminders: () => void;
  onOpenBackup: () => void;
  onOpenUtilities: () => void;
  onOpenPremium: () => void;
}

type HomeView = "detailed" | "compact";
const HOME_VIEW_KEY = "home-view";
const COMPACT_FROM_VEHICLES = 3;
const BACKUP_STALE_DAYS = 30;
const BACKUP_NAG_SNOOZE_DAYS = 7;
const BACKUP_NAG_KEY = "backup-nag-snoozed";

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
  onQuickCharge,
  onQuickFuelVehicle,
  onMoveVehicle,
  onQuickKm,
  onOpenReminder,
  onOpenReminders,
  onOpenBackup,
  onOpenUtilities,
}: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit, formatMoney } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const activeVehicles = vehicles.filter((v) => !v.archived);

  // Preferenza di vista scelta dall'utente (se assente: automatica in base
  // al numero di veicoli — dettagliata con 1-2, compatta da 3 in su).
  const [viewPref, setViewPref] = useState<HomeView | null>(null);
  useEffect(() => {
    getMeta(HOME_VIEW_KEY)
      .then((v) => setViewPref(v === "compact" || v === "detailed" ? v : null))
      .catch(() => undefined);
  }, []);
  const view: HomeView = viewPref ?? (activeVehicles.length >= COMPACT_FROM_VEHICLES ? "compact" : "detailed");
  const canSwitchView = activeVehicles.length >= 2;

  function chooseView(next: HomeView) {
    setViewPref(next);
    void setMeta(HOME_VIEW_KEY, next).catch(() => undefined);
  }

  const ym = new Date().toISOString().slice(0, 7);
  const inMonth = (d: string) => d.slice(0, 7) === ym;

  function monthStats(vehicleId: string) {
    const fuel = fuelEntries.filter((e) => e.vehicleId === vehicleId);
    const monthFuel = fuel.filter((e) => inMonth(e.date));
    const spend =
      monthFuel.reduce((a, e) => a + e.totalCost, 0) +
      chargingEntries.filter((e) => e.vehicleId === vehicleId && inMonth(e.date)).reduce((a, e) => a + e.totalCost, 0) +
      maintenanceEntries.filter((e) => e.vehicleId === vehicleId && inMonth(e.date)).reduce((a, e) => a + e.cost, 0) +
      expenseEntries.filter((e) => e.vehicleId === vehicleId && inMonth(e.date)).reduce((a, e) => a + e.amount, 0);
    // Consumo del mese: solo i tratti da pieno a pieno che si chiudono in questo mese.
    const kmPerL = averageConsumption(calculateConsumption(fuel).filter((p) => inMonth(p.date)));
    return { spend, per100: kmPerL ? 100 / kmPerL : null, refuels: monthFuel.length };
  }

  const stats = new Map(activeVehicles.map((v) => [v.id, monthStats(v.id)]));
  const totalSpend = [...stats.values()].reduce((a, x) => a + x.spend, 0);
  const totalRefuels = [...stats.values()].reduce((a, x) => a + x.refuels, 0);
  const per100List = [...stats.values()].map((x) => x.per100).filter((x): x is number => x !== null);
  const avgPer100 = per100List.length ? per100List.reduce((a, x) => a + x, 0) / per100List.length : null;

  const [backupStaleDays, setBackupStaleDays] = useState<number | null>(null);
  const oldestCreated = vehicles.map((v) => v.createdAt).filter(Boolean).sort()[0];
  const hasVehicles = vehicles.length > 0;
  useEffect(() => {
    if (!hasVehicles) return;
    let cancelled = false;
    (async () => {
      try {
        const snoozed = await getMeta(BACKUP_NAG_KEY);
        if (snoozed && daysSince(snoozed) < BACKUP_NAG_SNOOZE_DAYS) return;
        const last = await getMeta("last-backup");
        // mai fatto un backup: si conta da quando è stato aggiunto il primo veicolo
        const reference = last ?? oldestCreated;
        if (!reference) return;
        const days = daysSince(reference);
        if (!cancelled && days >= BACKUP_STALE_DAYS) setBackupStaleDays(days);
      } catch {
        /* nessun avviso se non si riesce a leggere */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasVehicles, oldestCreated]);

  function snoozeBackupNag() {
    setBackupStaleDays(null);
    void setMeta(BACKUP_NAG_KEY, new Date().toISOString());
  }

  const colors = resolveVehicleColors(vehicles);
  const canCharge = activeVehicles.some((v) => v.fuelType === "elettrico" || v.fuelType === "ibrido");
  const multi = vehicles.filter((v) => !v.archived).length > 1;

  const urgentFor = (vehicle: Vehicle) =>
    reminders.filter((r) => r.vehicleId === vehicle.id && !r.completed && isReminderDue(r.dueDate, r.dueKm, vehicle.currentKm) !== "ok").length;
  const urgentCount = activeVehicles.reduce((a, v) => a + urgentFor(v), 0);

  const fmtMoney = (n: number) => formatMoney(n, 0);
  const fmtCons = (n: number | null) => (n === null ? "–" : n.toLocaleString(locale, { maximumFractionDigits: 1 }));

  function renderMoveButtons(vehicle: Vehicle, index: number) {
    if (activeVehicles.length < 2) return null;
    return (
      <span className="dash-move" onClick={(e) => e.stopPropagation()}>
        <button type="button" disabled={index === 0} onClick={() => onMoveVehicle(vehicle.id, -1)} aria-label={t("dashboardGarage.moveUp", "Sposta su")}>▲</button>
        <button type="button" disabled={index === activeVehicles.length - 1} onClick={() => onMoveVehicle(vehicle.id, 1)} aria-label={t("dashboardGarage.moveDown", "Sposta giù")}>▼</button>
      </span>
    );
  }

  function renderPills(vehicle: Vehicle) {
    return (
      <span className="dash-pills" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dash-pill" onClick={() => onQuickKm(vehicle)}>
          <ActionGridIcon name="gauge" className="dash-pill__icon" />
          {t("dashboardGarage.updateKm", "Aggiorna km")}
        </button>
        <button type="button" className="dash-pill dash-pill--fuel" onClick={() => onQuickFuelVehicle(vehicle.id)}>
          <ActionGridIcon name="fuel" className="dash-pill__icon" />
          {t("dashboardGarage.fuel", "Rifornimento")}
        </button>
      </span>
    );
  }

  function renderDetailedCard(v: Vehicle, index: number) {
    const st = stats.get(v.id);
    return (
      <div key={v.id} className="dash-vcard">
        <section
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
              <h1 className="dash-featured-vehicle__name" style={{ ["--c" as string]: colors[v.id] } as React.CSSProperties}>{multi && <span className="vdot" aria-hidden="true" />}{v.name}</h1>
              <p className="dash-featured-vehicle__km">
                {formatDistance(v.currentKm, distanceUnit, locale)}
              </p>
              <div className="dash-featured-vehicle__meta">
                <span>{t(`fuelType.${v.fuelType}`)}</span>
                {v.year && <span>{v.year}</span>}
                {v.plate && <span>{v.plate}</span>}
              </div>
              {renderPills(v)}
              {v.notes && <p className="dash-featured-vehicle__notes">{v.notes}</p>}
            </div>
            <span className="dash-featured-vehicle__chevron">›</span>
          </div>
        </section>
        <UpcomingReminders
          vehicles={[v]}
          reminders={reminders}
          distanceUnit={distanceUnit}
          onOpenReminder={onOpenReminder}
          limit={2}
          variant="attached"
        />
        {st && (
          <div className="dash-vmonth">
            <span>{t("dashboardGarage.thisMonth", "Questo mese")}</span>
            <span>
              <b>{fmtMoney(st.spend)}</b> · {fmtCons(st.per100)} {t("dashboardGarage.avgConsumptionUnit", "l/100km")} · {st.refuels}× {t("dashboardGarage.fuel", "Rifornimento").toLowerCase()}
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderCompactCard(v: Vehicle, index: number) {
    const urgent = urgentFor(v);
    return (
      <div
        key={v.id}
        className="dash-ccard"
        onClick={() => onOpenVehicle(v.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpenVehicle(v.id)}
      >
        <div className="dash-ccard__thumb" style={{ ...(v.photo ? { backgroundImage: `url(${v.photo})` } : {}), ["--c" as string]: colors[v.id] } as React.CSSProperties}>
          {!v.photo && <VehicleBodyIcon bodyType={v.bodyType ?? "hatchback"} className="dash-ccard__icon" />}
          {urgent > 0 && <span className="dash-ccard__badge">{urgent}</span>}
        </div>
        <div className="dash-ccard__body">
          <h3 className="dash-ccard__name">{v.name}</h3>
          <p className="dash-ccard__km">{formatDistance(v.currentKm, distanceUnit, locale)}</p>
          {renderPills(v)}
        </div>
        {renderMoveButtons(v, index)}
      </div>
    );
  }

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

        {canSwitchView && (
          <div className="dash-seg" role="group" aria-label={t("dashboardGarage.viewLabel", "Vista")}>
            <button type="button" className={view === "compact" ? "is-on" : ""} onClick={() => chooseView("compact")}>
              {t("dashboardGarage.viewCompact", "Compatta")}
            </button>
            <button type="button" className={view === "detailed" ? "is-on" : ""} onClick={() => chooseView("detailed")}>
              {t("dashboardGarage.viewDetailed", "Dettagliata")}
            </button>
          </div>
        )}

        {activeVehicles.length === 0 ? (
          <div className="dash-empty">
            <p>{t("dashboardGarage.emptyTitle")}</p>
            <button type="button" className="btn btn--primary" onClick={onAddVehicle}>
              + {t("dashboardGarage.emptyAddFirst")}
            </button>
          </div>
        ) : view === "detailed" ? (
          <div className="dash-vehicle-list dash-vehicle-list--featured">
            {activeVehicles.map((v, index) => renderDetailedCard(v, index))}
          </div>
        ) : (
          <>
            <UpcomingReminders
              vehicles={activeVehicles}
              reminders={reminders}
              distanceUnit={distanceUnit}
              onOpenReminder={onOpenReminder}
              onViewAll={onOpenReminders}
              title={t("dashboardGarage.fleetDeadlines", "Scadenze · tutti i veicoli")}
              showVehicleName
            />
            <div className="dash-clist">{activeVehicles.map((v, index) => renderCompactCard(v, index))}</div>
          </>
        )}
      </section>

      {activeVehicles.length > 0 && (
        <section className="dash-quick">
          <h2 className="dash-section-title">{t("dashboardGarage.quickActions", "Azioni rapide")}</h2>
          <div className={`dash-quick__row ${view === "compact" ? (canCharge ? "dash-quick__row--4" : "dash-quick__row--3") : canCharge ? "dash-quick__row--3" : "dash-quick__row--2"}`}>
            {view === "compact" && (
              <button type="button" className="dash-quick__item dash-quick__item--primary" onClick={onQuickFuel}>
                <ActionGridIcon name="fuel" className="dash-quick__icon" />
                <span>{t("dashboardGarage.fuel", "Rifornimento")}</span>
              </button>
            )}
            {canCharge && (
              <button type="button" className="dash-quick__item dash-quick__item--primary" onClick={onQuickCharge}>
                <ActionGridIcon name="bolt" className="dash-quick__icon" />
                <span>{t("dashboardGarage.charge", "Ricarica")}</span>
              </button>
            )}
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

      {backupStaleDays !== null && activeVehicles.length > 0 && (
        <section className="dash-backup-nag" role="status">
          <span>{t("dashboardGarage.backupNag", { days: backupStaleDays })}</span>
          <span className="dash-backup-nag__actions">
            <button type="button" className="dash-link" onClick={onOpenBackup}>
              {t("dashboardGarage.backupNagAction")}
            </button>
            <button type="button" className="dash-link" onClick={snoozeBackupNag}>
              {t("dashboardGarage.backupNagLater")}
            </button>
          </span>
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

      {activeVehicles.length > 0 && view === "compact" && (
        <section className="dash-month">
          <h2 className="dash-section-title">{t("dashboardGarage.monthAll", "Questo mese · tutti i veicoli")}</h2>
          <div className="dash-month__grid">
            <div className="dash-month__stat">
              <span className="dash-month__value">{fmtMoney(totalSpend)}</span>
              <span className="dash-month__label">{t("dashboardGarage.monthSpend", "Spesa totale")}</span>
            </div>
            <div className="dash-month__stat">
              <span className="dash-month__value">{fmtCons(avgPer100)}</span>
              <span className="dash-month__label">{t("dashboardGarage.avgConsumption", "L/100 km medi")}</span>
            </div>
            <div className="dash-month__stat">
              <span className="dash-month__value">{totalRefuels}</span>
              <span className="dash-month__label">{t("dashboardGarage.refuels", "Rifornimenti")}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
