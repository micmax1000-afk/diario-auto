import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle, FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry, Reminder } from "../types";
import { calculateVehicleCosts, isReminderDue } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { isRtlLanguage } from "../i18n";
import { generateMaintenancePassportPdf, downloadPdfBytes } from "../utils/vehiclePassport";
import { useProStatus } from "../services/billing/useProStatus";
import {
  areNotificationsEnabled,
  disableNotifications,
  enableNotifications,
  isNotificationSupported,
} from "../utils/notifications";
import FuelForm from "./FuelForm";
import FuelList from "./FuelList";
import ChargingForm from "./ChargingForm";
import ChargingList from "./ChargingList";
import MaintenanceForm from "./MaintenanceForm";
import MaintenanceList from "./MaintenanceList";
import PremiumScreen from "./PremiumScreen";
import CategoryIcon from "./CategoryIcon";
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
  | "ricarica"
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
}

const TAB_IDS: DetailTab[] = ["live", "rifornimenti", "ricarica", "manutenzioni", "spese", "scadenze", "tragitto", "riepilogo"];
const TAB_I18N_KEYS: Record<DetailTab, string> = {
  live: "detail.tabs.live",
  rifornimenti: "detail.tabs.fuel",
  ricarica: "detail.tabs.charging",
  manutenzioni: "detail.tabs.maintenance",
  spese: "detail.tabs.expenses",
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
}: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, distanceUnit } = useAppSettings();
  const { isPro } = useProStatus();
  const [showPassportPremium, setShowPassportPremium] = useState(false);
  const [generatingPassport, setGeneratingPassport] = useState(false);
  const [tab, setTab] = useState<DetailTab>(initialTab ?? "live");
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [editingFuel, setEditingFuel] = useState<FuelEntry | null>(null);
  const [showChargingForm, setShowChargingForm] = useState(false);
  const [editingCharging, setEditingCharging] = useState<ChargingEntry | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [period, setPeriod] = useState<Period>("sempre");
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
    setNotificationMsg(granted ? null : t("detail.notificationsDenied"));
  }

  async function handleGeneratePassport() {
    if (!isPro) {
      setShowPassportPremium(true);
      return;
    }
    setGeneratingPassport(true);
    try {
      const locale = getNumberLocale(i18n.language);
      const sorted = [...maintenanceEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
        },
      });

      downloadPdfBytes(`passaporto-manutenzione-${vehicle.name.replace(/\s+/g, "-").toLowerCase()}.pdf`, bytes);
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

  return (
    <section className="vehicle-detail-page">
      <button type="button" className="back-link" onClick={onBack}>
        {isRtlLanguage(i18n.language) ? "→ " : "← "}
        {t("detail.back")}
      </button>

      <div className="section-head">
        <h1>{vehicle.name}</h1>
        <span className="detail-km">{formatDistance(vehicle.currentKm, distanceUnit, getNumberLocale(i18n.language))}</span>
      </div>

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

      <div className="detail-content" key={tab}>
        {tab === "live" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("detail.liveData")}</h2>
            </div>
            <LiveDataPanel vehicle={vehicle} />
          </>
        )}

        {tab === "rifornimenti" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("fuel.title")}</h2>
              <button type="button" className="btn btn--primary" onClick={() => setShowFuelForm(true)}>
                {t("fuel.add")}
              </button>
            </div>
            <FuelList entries={fuelEntries} onEdit={setEditingFuel} onDelete={onDeleteFuel} />
          </>
        )}

        {tab === "ricarica" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("charging.title")}</h2>
              <button type="button" className="btn btn--primary" onClick={() => setShowChargingForm(true)}>
                {t("charging.add")}
              </button>
            </div>
            <ChargingList entries={chargingEntries} onEdit={setEditingCharging} onDelete={onDeleteCharging} />
          </>
        )}

        {tab === "manutenzioni" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("maintenance.title")}</h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={handleGeneratePassport}
                  disabled={generatingPassport}
                >
                  {generatingPassport ? t("passport.generating") : `📄 ${t("passport.generate")}`}
                  {!isPro && " 🔒"}
                </button>
                <button type="button" className="btn btn--primary" onClick={() => setShowMaintenanceForm(true)}>
                  {t("maintenance.add")}
                </button>
              </div>
            </div>
            <MaintenanceList entries={maintenanceEntries} onDelete={onDeleteMaintenance} />
          </>
        )}

        {tab === "spese" && (
          <>
            <div className="section-head section-head--tight">
              <h2>{t("expenses.title")}</h2>
              <button type="button" className="btn btn--primary" onClick={() => setShowExpenseForm(true)}>
                {t("expenses.add")}
              </button>
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
                {notificationsOn ? t("detail.notificationsOnHint") : t("detail.notificationsOffHint")}
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
