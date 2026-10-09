import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import type { Vehicle, FuelEntry, ChargingEntry, MaintenanceEntry, MaintenanceCategory, ExpenseEntry, Reminder } from "../types";
import { calculateVehicleCosts, isReminderDue } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { isRtlLanguage } from "../i18n";
import { generateMaintenancePassportPdf } from "../utils/vehiclePassport";
import { describeDtc } from "../utils/dtcCodes";
import { exportPdfBytes } from "../utils/nativeFileExport";
import { getObdProfile } from "../utils/storage";
import { useProStatus } from "../services/billing/useProStatus";
import {
  areNotificationsEnabled,
  disableNotifications,
  enableNotifications,
  isNotificationSupported,
} from "../utils/notifications";
import { useBackButtonClose } from "../utils/backButtonStack";
import FuelForm from "./FuelForm";
import FuelChargeList from "./FuelChargeList";
import ChargingForm from "./ChargingForm";
import MaintenanceForm from "./MaintenanceForm";
import MaintenanceList from "./MaintenanceList";
import MaintenanceOverview from "./MaintenanceOverview";
import PremiumScreen from "./PremiumScreen";
import VehicleSwitcher from "./VehicleSwitcher";
import CategoryIcon from "./CategoryIcon";
import ActionGridIcon from "./ActionGridIcon";
import ExpenseForm from "./ExpenseForm";
import ExpenseList from "./ExpenseList";
import ReminderForm from "./ReminderForm";
import ReminderList from "./ReminderList";
import CostChart from "./CostChart";
import LiveDataPanel from "./LiveDataPanel";
import CommutePanel from "./CommutePanel";

type DetailTab =
  | "live"
  | "rifornimenti"
  | "manutenzioni"
  | "spese"
  | "scadenze"
  | "tragitto"
  | "riepilogo";
type Period = "sempre" | "anno-scorso" | "anno-corrente" | number;

interface Props {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  chargingEntries: ChargingEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries: ExpenseEntry[];
  reminders: Reminder[];
  initialTab?: DetailTab;
  onBack: () => void;
  onSaveFuel: (entry: FuelEntry) => void;
  onDeleteFuel: (id: string) => void;
  onSaveCharging: (entry: ChargingEntry) => void;
  onDeleteCharging: (id: string) => void;
  onAddMaintenance: (entry: MaintenanceEntry) => void;
  onDeleteMaintenance: (id: string) => void;
  onAddExpense: (entry: ExpenseEntry) => void;
  onDeleteExpense: (id: string) => void;
  onAddReminder: (reminder: Reminder) => void;
  onToggleReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  restrictToTab?: DetailTab;
  onOdometerKm?: (km: number) => void;
  /** Elenco veicoli attivi + colori: abilita la fascia per cambiare veicolo senza tornare al garage. */
  allVehicles?: Vehicle[];
  colors?: Record<string, string>;
  urgentCounts?: Record<string, number>;
  onSwitchVehicle?: (vehicleId: string) => void;
  /** Solo nella scheda Statistiche: apre il confronto "Tutti i veicoli". */
  onOpenFleet?: () => void;
}

const TAB_IDS: DetailTab[] = ["live", "rifornimenti", "manutenzioni", "spese", "scadenze", "tragitto", "riepilogo"];
const TAB_I18N_KEYS: Record<DetailTab, string> = {
  live: "detail.tabs.live",
  rifornimenti: "detail.tabs.fuel",
  manutenzioni: "detail.tabs.maintenance",
  spese: "expenses.title",
  scadenze: "detail.tabs.reminders",
  tragitto: "detail.tabs.commute",
  riepilogo: "detail.tabs.summary",
};

export default function VehicleDetail({
  vehicle,
  fuelEntries,
  chargingEntries,
  maintenanceEntries,
  expenseEntries,
  reminders,
  initialTab,
  onBack,
  onSaveFuel,
  onDeleteFuel,
  onSaveCharging,
  onDeleteCharging,
  onAddMaintenance,
  onDeleteMaintenance,
  onAddExpense,
  onDeleteExpense,
  onAddReminder,
  onToggleReminder,
  onDeleteReminder,
  restrictToTab,
  allVehicles,
  colors,
  urgentCounts,
  onSwitchVehicle,
  onOpenFleet,
  onOdometerKm,
}: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, distanceUnit } = useAppSettings();
  const { isPro } = useProStatus();
  const [showPassportPremium, setShowPassportPremium] = useState(false);
  const [generatingPassport, setGeneratingPassport] = useState(false);
  const [passportError, setPassportError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>(restrictToTab ?? initialTab ?? "live");
  const [maintenanceCategoryFilter, setMaintenanceCategoryFilter] = useState<MaintenanceCategory | "all">("all");

  // In modalità "vista singola" (raggiunta dalla barra inferiore o dal
  // click sul veicolo) il tab resta bloccato: nessuna navigazione interna
  // può cambiarlo, anche se qualche azione prova a farlo.
  function changeTab(next: DetailTab) {
    if (restrictToTab) return;
    setTab(next);
  }
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [editingFuel, setEditingFuel] = useState<FuelEntry | null>(null);
  const [showChargingForm, setShowChargingForm] = useState(false);
  const [editingCharging, setEditingCharging] = useState<ChargingEntry | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [period, setPeriod] = useState<Period>("sempre");

  // Tasto indietro Android: chiude il modulo aperto più di recente invece di
  // uscire dall'app — vedi backButtonStack.ts.
  useBackButtonClose(showFuelForm, () => setShowFuelForm(false));
  useBackButtonClose(editingFuel !== null, () => setEditingFuel(null));
  useBackButtonClose(showChargingForm, () => setShowChargingForm(false));
  useBackButtonClose(editingCharging !== null, () => setEditingCharging(null));
  useBackButtonClose(showMaintenanceForm, () => setShowMaintenanceForm(false));
  useBackButtonClose(showExpenseForm, () => setShowExpenseForm(false));
  useBackButtonClose(showReminderForm, () => setShowReminderForm(false));
  useBackButtonClose(showPassportPremium, () => setShowPassportPremium(false));
  const [notificationsOn, setNotificationsOn] = useState(() => areNotificationsEnabled());
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  async function handleToggleNotifications() {
    if (notificationsOn) {
      disableNotifications();
      setNotificationsOn(false);
      setNotificationMsg(null);
      return;
    }
    if (!isNotificationSupported()) {
      setNotificationMsg(t("detail.notificationsNotSupported"));
      return;
    }
    const granted = await enableNotifications();
    setNotificationsOn(granted);
    setNotificationMsg(
      granted ? null : t(Capacitor.isNativePlatform() ? "detail.notificationsDeniedNative" : "detail.notificationsDenied"),
    );
  }

  async function handleGeneratePassport() {
    if (!isPro) {
      setShowPassportPremium(true);
      return;
    }
    setGeneratingPassport(true);
    setPassportError(null);
    try {
      const locale = getNumberLocale(i18n.language);
      const sorted = [...maintenanceEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const dtcHistory = (await getObdProfile(vehicle.id))?.dtcHistory ?? [];
      const dtcModeKeys = { "03": "live.dtcModes.stored", "07": "live.dtcModes.pending", "0A": "live.dtcModes.permanent" } as const;

      const bytes = await generateMaintenancePassportPdf({
        vehicleName: vehicle.name,
        vehiclePlate: vehicle.plate,
        vehicleYear: vehicle.year,
        fuelTypeLabel: t(`fuelType.${vehicle.fuelType}`),
        currentKmLabel: formatDistance(vehicle.currentKm, distanceUnit, locale),
        totalCostLabel: formatMoney(sorted.reduce((sum, e) => sum + e.cost, 0)),
        generatedOnLabel: new Date().toLocaleDateString(locale),
        entries: sorted.map((e) => ({
          dateLabel: new Date(e.date).toLocaleDateString(locale),
          kmLabel: formatDistance(e.km, distanceUnit, locale),
          categoryLabel: t(`maintenanceCategory.${e.category}`),
          description: e.description,
          costLabel: formatMoney(e.cost),
          workshop: e.workshop ?? "",
        })),
        dtcReadings: dtcHistory.map((r) => ({
          dateLabel: new Date(r.date).toLocaleDateString(locale),
          kmLabel: formatDistance(r.km, distanceUnit, locale),
          modeLabel: t(dtcModeKeys[r.mode]),
          codes: r.codes.map((code) => ({ code, description: describeDtc(code, i18n.language) ?? t("passport.dtcUnknown") })),
        })),
        labels: {
          title: t("passport.title"),
          subtitle: t("passport.subtitle"),
          plate: t("passport.plate"),
          year: t("passport.year"),
          fuelType: t("passport.fuelType"),
          currentKm: t("passport.currentKm"),
          columnDate: t("passport.columnDate"),
          columnKm: t("passport.columnKm"),
          columnCategory: t("passport.columnCategory"),
          columnDescription: t("passport.columnDescription"),
          columnCost: t("passport.columnCost"),
          columnWorkshop: t("passport.columnWorkshop"),
          totalInterventions: t("passport.totalInterventions"),
          totalCost: t("passport.totalCost"),
          generatedBy: t("passport.generatedBy"),
          noEntries: t("passport.noEntries"),
          dtcTitle: t("passport.dtcTitle"),
          dtcCleared: t("passport.dtcCleared"),
        },
      });

      await exportPdfBytes(`passaporto-manutenzione-${vehicle.name.replace(/\s+/g, "-").toLowerCase()}.pdf`, bytes);
    } catch {
      setPassportError(t("passport.exportFailed"));
    } finally {
      setGeneratingPassport(false);
    }
  }

  const activeRemindersCount = reminders.filter((r) => !r.completed && isReminderDue(r.dueDate, r.dueKm, vehicle.currentKm) !== "ok").length;

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    new Set(
      [...fuelEntries, ...maintenanceEntries, ...expenseEntries].map((e) => new Date(e.date).getFullYear()),
    ),
  )
    .sort((a, b) => b - a)
    .slice(0, 4);

  function inPeriod(dateIso: string): boolean {
    const year = new Date(dateIso).getFullYear();
    if (period === "sempre") return true;
    if (period === "anno-corrente") return year === currentYear;
    if (period === "anno-scorso") return year === currentYear - 1;
    return year === period;
  }

  const filteredFuel = fuelEntries.filter((e) => inPeriod(e.date));
  const filteredCharging = chargingEntries.filter((e) => inPeriod(e.date));
  const filteredMaintenance = maintenanceEntries.filter((e) => inPeriod(e.date));
  const filteredExpenses = expenseEntries.filter((e) => inPeriod(e.date));
  const costs = calculateVehicleCosts(
    filteredFuel,
    filteredMaintenance,
    vehicle.currentKm,
    filteredExpenses,
    filteredCharging,
  );

  // Consumo reale: usiamo solo i rifornimenti segnati come "pieno",
  // evitando di presentare come preciso un dato ricavato da rabbocchi parziali.
  const fullFuel = [...filteredFuel]
    .filter((e) => e.fullTank && e.liters > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let consumptionSum = 0;
  let consumptionSamples = 0;
  for (let i = 1; i < fullFuel.length; i += 1) {
    const distance = fullFuel[i].km - fullFuel[i - 1].km;
    if (distance > 0) {
      consumptionSum += (fullFuel[i].liters / distance) * 100;
      consumptionSamples += 1;
    }
  }
  const averageConsumption = consumptionSamples > 0 ? consumptionSum / consumptionSamples : null;
  const totalChargingKwh = filteredCharging.reduce((sum, e) => sum + (Number(e.kWh) || 0), 0);
  const averageChargingPrice = totalChargingKwh > 0 ? costs.chargingCost / totalChargingKwh : null;
  const totalRecordedKm = costs.totalKm;

  const vehicleColor = colors?.[vehicle.id];

  return (
    <section
      className={`vehicle-detail-page${vehicleColor ? " vehicle-detail-page--colored" : ""}`}
      style={vehicleColor ? ({ ["--c" as string]: vehicleColor } as CSSProperties) : undefined}
    >
      <button type="button" className="back-link" onClick={onBack}>
        {isRtlLanguage(i18n.language) ? "→ " : "← "}
        {t("detail.back")}
      </button>

      <div className="section-head">
        <h1>
          {vehicleColor && allVehicles && allVehicles.length > 1 && <span className="vdot" aria-hidden="true" />}
          {vehicle.name}
        </h1>
        <span className="detail-km">{formatDistance(vehicle.currentKm, distanceUnit, getNumberLocale(i18n.language))}</span>
      </div>

      {allVehicles && allVehicles.length > 1 && onSwitchVehicle && colors && (
        <VehicleSwitcher
          vehicles={allVehicles}
          currentId={vehicle.id}
          colors={colors}
          urgentCounts={urgentCounts}
          onSelect={onSwitchVehicle}
          leading={
            restrictToTab === "riepilogo" && onOpenFleet
              ? { label: t("fleet.all", "Tutti"), active: false, onClick: onOpenFleet, badge: isPro ? undefined : "PRO" }
              : undefined
          }
        />
      )}

      {!restrictToTab && (
        <nav className="subtabbar">
          {TAB_IDS.map((tabId) => (
            <button
              key={tabId}
              type="button"
              className={`subtabbar__item ${tab === tabId ? "is-active" : ""}`}
              onClick={() => setTab(tabId)}
            >
              {t(TAB_I18N_KEYS[tabId])}
              {tabId === "scadenze" && activeRemindersCount > 0 && (
                <span className="subtabbar__badge">{activeRemindersCount}</span>
              )}
            </button>
          ))}
        </nav>
      )}

      <div className="detail-content" key={tab}>
        {tab === "live" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("detail.liveData")}</h2>
            </div>
            <LiveDataPanel vehicle={vehicle} onOdometerKm={onOdometerKm} />
          </>
        )}

        {tab === "rifornimenti" && (
          <>
            <div className="section-head section-head--tight">
              <div><h2>Rifornimento</h2><p className="section-subtitle">Carburante e ricarica elettrica</p></div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="btn btn--primary btn--icon" onClick={() => setShowFuelForm(true)}><ActionGridIcon name="fuel" /> Rifornimento</button>
                <button type="button" className="btn btn--ghost btn--icon" onClick={() => setShowChargingForm(true)}><ActionGridIcon name="bolt" /> Ricarica</button>
              </div>
            </div>
            <FuelChargeList
              fuelEntries={fuelEntries}
              chargingEntries={chargingEntries}
              onEditFuel={setEditingFuel}
              onDeleteFuel={onDeleteFuel}
              onEditCharging={setEditingCharging}
              onDeleteCharging={onDeleteCharging}
            />
          </>
        )}

        {tab === "manutenzioni" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("maintenance.title")}</h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--small btn--icon"
                  onClick={handleGeneratePassport}
                  disabled={generatingPassport}
                >
                  {generatingPassport ? (
                    t("passport.generating")
                  ) : (
                    <>
                      <ActionGridIcon name="folder" /> {t("passport.generate")}
                    </>
                  )}
                  {!isPro && " 🔒"}
                </button>
                <button type="button" className="btn btn--primary" onClick={() => setShowMaintenanceForm(true)}>
                  {t("maintenance.add")}
                </button>
              </div>
            </div>
            {passportError && <p className="form-error">{passportError}</p>}
            <MaintenanceOverview
              entries={maintenanceEntries}
              reminders={reminders}
              currentKm={vehicle.currentKm}
              onOpenReminders={restrictToTab ? undefined : () => changeTab("scadenze")}
            />
            {restrictToTab === "manutenzioni" && (
              <div className="maintenance-category-filter">
                <label htmlFor="maintenance-category-select">{t("maintenance.filterByCategory", "Filtra per categoria")}</label>
                <select
                  id="maintenance-category-select"
                  value={maintenanceCategoryFilter}
                  onChange={(e) => setMaintenanceCategoryFilter(e.target.value as MaintenanceCategory | "all")}
                >
                  <option value="all">{t("maintenance.allCategories", "Tutte le categorie")}</option>
                  {(["tagliando", "gomme", "freni", "olio", "batteria", "raffreddamento", "software", "carrozzeria", "revisione", "altro"] as MaintenanceCategory[]).map((cat) => (
                    <option key={cat} value={cat}>{t(`maintenanceCategory.${cat}`)}</option>
                  ))}
                </select>
              </div>
            )}
            <MaintenanceList
              entries={
                restrictToTab === "manutenzioni" && maintenanceCategoryFilter !== "all"
                  ? maintenanceEntries.filter((m) => m.category === maintenanceCategoryFilter)
                  : maintenanceEntries
              }
              onDelete={onDeleteMaintenance}
            />
          </>
        )}

        {tab === "spese" && (
          <>
            <div className="section-head section-head--tight">
              <div><h2>{t("expenses.title")}</h2><p className="section-subtitle">Spese collegate alla gestione dell'auto (bollo, assicurazione, ecc.)</p></div>
              <button type="button" className="btn btn--primary" onClick={() => setShowExpenseForm(true)}>{t("expenses.add")}</button>
            </div>
            <ExpenseList entries={expenseEntries} onDelete={onDeleteExpense} />
          </>
        )}


        {tab === "scadenze" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("reminders.title")}</h2>
              <button type="button" className="btn btn--primary" onClick={() => setShowReminderForm(true)}>
                {t("reminders.add")}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", margin: "0 0 0.75rem" }}>
              <button type="button" className="btn btn--ghost btn--small" onClick={handleToggleNotifications}>
                {notificationsOn ? t("detail.notificationsOn") : t("detail.notificationsOff")}
              </button>
              <p className="empty-state__body" style={{ margin: 0 }}>
                {notificationsOn
                  ? t(Capacitor.isNativePlatform() ? "detail.notificationsOnHintNative" : "detail.notificationsOnHint")
                  : t("detail.notificationsOffHint")}
              </p>
            </div>
            {notificationMsg && <p className="form-error" style={{ margin: "0 0 0.75rem" }}>{notificationMsg}</p>}

            <ReminderList
              reminders={reminders}
              currentKm={vehicle.currentKm}
              onToggleComplete={onToggleReminder}
              onDelete={onDeleteReminder}
            />
          </>
        )}

        {tab === "tragitto" && <CommutePanel vehicle={vehicle} fuelEntries={fuelEntries} />}

        {tab === "riepilogo" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("summary.title")}</h2>
            </div>

            <div className="period-filter">
              <button
                type="button"
                className={`period-filter__btn ${period === "sempre" ? "is-active" : ""}`}
                onClick={() => setPeriod("sempre")}
              >
                {t("summary.periodAlways")}
              </button>
              <button
                type="button"
                className={`period-filter__btn ${period === "anno-corrente" ? "is-active" : ""}`}
                onClick={() => setPeriod("anno-corrente")}
              >
                {currentYear}
              </button>
              <button
                type="button"
                className={`period-filter__btn ${period === "anno-scorso" ? "is-active" : ""}`}
                onClick={() => setPeriod("anno-scorso")}
              >
                {currentYear - 1}
              </button>
              {availableYears
                .filter((y) => y !== currentYear && y !== currentYear - 1)
                .map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`period-filter__btn ${period === y ? "is-active" : ""}`}
                    onClick={() => setPeriod(y)}
                  >
                    {y}
                  </button>
                ))}
            </div>

            <div className="stat-row">
              <div className="stat-chip stat-chip--icon">
                <CategoryIcon kind="fuel" category="benzina" size="small" />
                <div>
                  <span className="stat-chip__label">{t("summary.fuel")}</span>
                  <span className="stat-chip__value">{formatMoney(costs.fuelCost)}</span>
                </div>
              </div>
              {costs.chargingCost > 0 && (
                <div className="stat-chip stat-chip--icon">
                  <CategoryIcon kind="charging" category="" size="small" />
                  <div>
                    <span className="stat-chip__label">{t("summary.charging")}</span>
                    <span className="stat-chip__value">{formatMoney(costs.chargingCost)}</span>
                  </div>
                </div>
              )}
              <div className="stat-chip stat-chip--icon">
                <CategoryIcon kind="maintenance" category="tagliando" size="small" />
                <div>
                  <span className="stat-chip__label">{t("summary.maintenance")}</span>
                  <span className="stat-chip__value">{formatMoney(costs.maintenanceCost)}</span>
                </div>
              </div>
              <div className="stat-chip stat-chip--icon">
                <CategoryIcon kind="expense" category="altro" size="small" />
                <div>
                  <span className="stat-chip__label">{t("summary.expenses")}</span>
                  <span className="stat-chip__value">{formatMoney(costs.expensesCost)}</span>
                </div>
              </div>
              <div className="stat-chip stat-chip--icon">
                <div className="record-card__icon record-card__icon--amber record-card__icon--sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="6" width="18" height="13" rx="2" />
                    <path d="M3 10h18M7 14h3" />
                  </svg>
                </div>
                <div>
                  <span className="stat-chip__label">{t("summary.total")}</span>
                  <span className="stat-chip__value">{formatMoney(costs.totalCost)}</span>
                </div>
              </div>
              <div className="stat-chip stat-chip--icon">
                <div className="record-card__icon record-card__icon--cyan record-card__icon--sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 17 9 8l4 5 8-11" />
                    <path d="M15 2h6v6" />
                  </svg>
                </div>
                <div>
                  <span className="stat-chip__label">{t("summary.costPerKm")}</span>
                  <span className="stat-chip__value">
                    {costs.costPerKm !== null ? formatMoney(costs.costPerKm, 3) : "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className="stat-row stat-row--secondary">
              <div className="stat-chip stat-chip--icon">
                <div className="record-card__icon record-card__icon--cyan record-card__icon--sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="9" width="20" height="6" rx="1" transform="rotate(-45 12 12)" />
                    <path d="M8 12l1.5 1.5M11 9l1.5 1.5M14 6l1.5 1.5" />
                  </svg>
                </div>
                <div>
                  <span className="stat-chip__label">{t("summary.distance")}</span>
                  <span className="stat-chip__value">
                    {totalRecordedKm > 0 ? `${Math.round(totalRecordedKm).toLocaleString(getNumberLocale(i18n.language))} ${distanceUnit}` : "—"}
                  </span>
                </div>
              </div>
              <div className="stat-chip stat-chip--icon">
                <div className="record-card__icon record-card__icon--amber record-card__icon--sm">
                  <ActionGridIcon name="fuel" />
                </div>
                <div>
                  <span className="stat-chip__label">{t("summary.consumption")}</span>
                  <span className="stat-chip__value">
                    {averageConsumption !== null ? `${averageConsumption.toFixed(1)} L/100 km` : "—"}
                  </span>
                </div>
              </div>
              <div className="stat-chip stat-chip--icon">
                <div className="record-card__icon record-card__icon--cyan record-card__icon--sm">
                  <ActionGridIcon name="bolt" />
                </div>
                <div>
                  <span className="stat-chip__label">{t("summary.energy")}</span>
                  <span className="stat-chip__value">
                    {totalChargingKwh > 0 ? `${totalChargingKwh.toFixed(1)} kWh` : "—"}
                  </span>
                </div>
              </div>
              <div className="stat-chip stat-chip--icon">
                <div className="record-card__icon record-card__icon--amber record-card__icon--sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17 8a5 5 0 1 0 0 8M6 10h6M6 14h5" />
                  </svg>
                </div>
                <div>
                  <span className="stat-chip__label">{t("summary.averageEnergyPrice")}</span>
                  <span className="stat-chip__value">
                    {averageChargingPrice !== null ? formatMoney(averageChargingPrice, 3) + "/kWh" : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="summary-insight">
              <strong>{t("summary.dataQualityTitle")}</strong>
              <span>{
                averageConsumption !== null
                  ? t("summary.dataQualityConsumption", { count: consumptionSamples })
                  : t("summary.dataQualityHint")
              }</span>
            </div>

            <CostChart fuelEntries={filteredFuel} maintenanceEntries={filteredMaintenance} expenseEntries={filteredExpenses} />
          </>
        )}
      </div>

      {showFuelForm && (
        <FuelForm
          vehicle={vehicle}
          onSave={(entry) => {
            onSaveFuel(entry);
            setShowFuelForm(false);
          }}
          onClose={() => setShowFuelForm(false)}
        />
      )}

      {editingFuel && (
        <FuelForm
          vehicle={vehicle}
          initialEntry={editingFuel}
          onSave={(entry) => {
            onSaveFuel(entry);
            setEditingFuel(null);
          }}
          onClose={() => setEditingFuel(null)}
        />
      )}

      {showChargingForm && (
        <ChargingForm
          vehicle={vehicle}
          onSave={(entry) => {
            onSaveCharging(entry);
            setShowChargingForm(false);
          }}
          onClose={() => setShowChargingForm(false)}
        />
      )}

      {editingCharging && (
        <ChargingForm
          vehicle={vehicle}
          initialEntry={editingCharging}
          onSave={(entry) => {
            onSaveCharging(entry);
            setEditingCharging(null);
          }}
          onClose={() => setEditingCharging(null)}
        />
      )}

      {showMaintenanceForm && (
        <MaintenanceForm
          vehicle={vehicle}
          onSave={(entry) => {
            onAddMaintenance(entry);
            setShowMaintenanceForm(false);
          }}
          onClose={() => setShowMaintenanceForm(false)}
        />
      )}

      {showPassportPremium && <PremiumScreen onClose={() => setShowPassportPremium(false)} />}

      {showExpenseForm && (
        <ExpenseForm
          vehicle={vehicle}
          onSave={(entry) => {
            onAddExpense(entry);
            setShowExpenseForm(false);
          }}
          onClose={() => setShowExpenseForm(false)}
        />
      )}

      {showReminderForm && (
        <ReminderForm
          vehicle={vehicle}
          onSave={(reminder) => {
            onAddReminder(reminder);
            setShowReminderForm(false);
          }}
          onClose={() => setShowReminderForm(false)}
        />
      )}
    </section>
  );
}
