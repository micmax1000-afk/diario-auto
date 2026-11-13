import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import type { Vehicle, FuelEntry, ChargingEntry, MaintenanceEntry, MaintenanceCategory, ExpenseEntry, Reminder, TripEntry } from "../types";
import { fuelLabel } from "../utils/fuelCombos";
import { calculateVehicleCosts, vehicleConsumptionPoints, bifuelSources, averageConsumption as averageConsumptionKmPerL, calculateElectricConsumption, averageElectricConsumption, mainFuelSource } from "../utils/calculations";
import { formatNumber, getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { generateMaintenancePassportPdf } from "../utils/vehiclePassport";
import { generateAnnualReportPdf, imageToPng } from "../utils/annualReportPdf";
import { describeDtc } from "../utils/dtcCodes";
import { isManufacturerSpecificDtc } from "../utils/obdDtc";
import { exportPdfBytes } from "../utils/nativeFileExport";
import { getObdProfile } from "../utils/storage";
import { useProStatus } from "../services/billing/useProStatus";
import {
  disableNotifications,
  enableNotificationsDetailed,
  isNotificationSupported,
  onNotificationsChange,
  openNotificationSettings,
  notificationsShownAsOn,
} from "../utils/notifications";
import { useBackButtonClose } from "../utils/backButtonStack";
import FuelForm from "./FuelForm";
import FuelChargeList from "./FuelChargeList";
import ChargingForm from "./ChargingForm";
import MaintenanceForm from "./MaintenanceForm";
import MaintenanceList from "./MaintenanceList";
import MaintenanceOverview from "./MaintenanceOverview";
import PremiumScreen from "./PremiumScreen";
import VehicleHeader from "./VehicleHeader";
import ActionGridIcon from "./ActionGridIcon";
import ExpenseForm from "./ExpenseForm";
import ExpenseList from "./ExpenseList";
import ReminderForm from "./ReminderForm";
import ReminderList from "./ReminderList";
import CostChart from "./CostChart";
import FuelPriceChart from "./FuelPriceChart";
import LiveDataPanel from "./LiveDataPanel";
import CommutePanel from "./CommutePanel";
import TripsPanel from "./TripsPanel";
import { reminderStatus } from "../utils/kmForecast";
import { vehicleVisual } from "../utils/carImages";
import { getMeta } from "../utils/db";
import { tripTotals } from "../utils/trips";

type DetailTab =
  | "live"
  | "rifornimenti"
  | "manutenzioni"
  | "spese"
  | "scadenze"
  | "tragitto"
  | "viaggi"
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
  /** Apre subito il modulo per aggiungere una voce (dal tasto + della barra in basso). */
  autoOpenForm?: "maintenance" | "expense" | "reminder";
  onAutoOpenHandled?: () => void;
  onOpenAdapters?: () => void;
  onBack: () => void;
  onSaveFuel: (entry: FuelEntry) => void;
  onDeleteFuel: (id: string) => void;
  onSaveCharging: (entry: ChargingEntry) => void;
  onDeleteCharging: (id: string) => void;
  onAddMaintenance: (entry: MaintenanceEntry) => void;
  onDeleteMaintenance: (id: string) => void;
  onAddExpense: (entry: ExpenseEntry) => void;
  onDeleteExpense: (id: string) => void;
  tripEntries: TripEntry[];
  onSaveTrip: (trip: TripEntry, alsoExpense: boolean) => void;
  onDeleteTrip: (id: string) => void;
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
  /** Apre la pagina Scadenze di questo veicolo (usato quando la scheda mostra una sola sezione). */
  onOpenRemindersTab?: () => void;
}

const TAB_IDS: DetailTab[] = ["live", "rifornimenti", "manutenzioni", "spese", "scadenze", "tragitto", "viaggi", "riepilogo"];
// Scadenze del catalogo → cosa registrare quando si segnano come fatte.
const REMINDER_FOLLOW_UP: Record<
  string,
  { kind: "maintenance"; category: MaintenanceCategory } | { kind: "expense"; category: "bollo" | "assicurazione" }
> = {
  oilFilter: { kind: "maintenance", category: "olio" },
  periodicService: { kind: "maintenance", category: "tagliando" },
  seasonalTires: { kind: "maintenance", category: "gomme" },
  cabinFilter: { kind: "maintenance", category: "tagliando" },
  airFilter: { kind: "maintenance", category: "tagliando" },
  brakeFluid: { kind: "maintenance", category: "freni" },
  sparkPlugs: { kind: "maintenance", category: "tagliando" },
  timingBelt: { kind: "maintenance", category: "tagliando" },
  fuelFilter: { kind: "maintenance", category: "tagliando" },
  inspection: { kind: "maintenance", category: "revisione" },
  lpgSticker: { kind: "maintenance", category: "revisione" },
  coolant: { kind: "maintenance", category: "raffreddamento" },
  battery: { kind: "maintenance", category: "batteria" },
  roadTax: { kind: "expense", category: "bollo" },
  insurance: { kind: "expense", category: "assicurazione" },
};

const TAB_I18N_KEYS: Record<DetailTab, string> = {
  live: "detail.tabs.live",
  rifornimenti: "detail.tabs.fuel",
  manutenzioni: "detail.tabs.maintenance",
  spese: "expenses.title",
  scadenze: "detail.tabs.reminders",
  tragitto: "detail.tabs.commute",
  viaggi: "trips.title",
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
  autoOpenForm,
  onAutoOpenHandled,
  onOpenAdapters,
  onBack,
  onSaveFuel,
  onDeleteFuel,
  onSaveCharging,
  onDeleteCharging,
  onAddMaintenance,
  onDeleteMaintenance,
  onAddExpense,
  onDeleteExpense,
  tripEntries,
  onSaveTrip,
  onDeleteTrip,
  onAddReminder,
  onToggleReminder,
  onDeleteReminder,
  restrictToTab,
  allVehicles,
  colors,
  urgentCounts,
  onSwitchVehicle,
  onOpenFleet,
  onOpenRemindersTab,
  onOdometerKm,
}: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, distanceUnit } = useAppSettings();
  const { isPro } = useProStatus();
  const [showPassportPremium, setShowPassportPremium] = useState(false);
  const [generatingPassport, setGeneratingPassport] = useState(false);
  const [passportError, setPassportError] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>(restrictToTab ?? initialTab ?? "live");
  const [maintenanceCategoryFilter, setMaintenanceCategoryFilter] = useState<MaintenanceCategory | "all">("all");

  // In modalità "vista singola" (raggiunta dalla barra inferiore o dal
  // click sul veicolo) il tab resta bloccato: nessuna navigazione interna
  // può cambiarlo, anche se qualche azione prova a farlo.
  const openRemindersTab = restrictToTab ? onOpenRemindersTab : () => changeTab("scadenze");

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
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  // Modulo aperto dal tasto +: lo apre una volta e lo segnala, così la stessa richiesta può ripetersi.
  useEffect(() => {
    if (!autoOpenForm) return;
    if (autoOpenForm === "maintenance") setShowMaintenanceForm(true);
    else if (autoOpenForm === "expense") setShowExpenseForm(true);
    else if (autoOpenForm === "reminder") setShowReminderForm(true);
    onAutoOpenHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenForm]);
  // Dopo "Fatto" su una scadenza del catalogo: modulo manutenzione o spesa già compilato.
  const [doneFollowUp, setDoneFollowUp] = useState<
    | { kind: "maintenance"; category: MaintenanceCategory; description: string }
    | { kind: "expense"; category: "bollo" | "assicurazione"; description: string }
    | null
  >(null);
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
  useBackButtonClose(editingMaintenance !== null, () => setEditingMaintenance(null));
  useBackButtonClose(editingExpense !== null, () => setEditingExpense(null));
  useBackButtonClose(editingReminder !== null, () => setEditingReminder(null));
  useBackButtonClose(doneFollowUp !== null, () => setDoneFollowUp(null));

  function handleReminderDone(id: string) {
    const reminder = reminders.find((r) => r.id === id);
    onToggleReminder(id);
    if (!reminder || reminder.completed || !reminder.catalogKey) return;
    const followUp = REMINDER_FOLLOW_UP[reminder.catalogKey];
    if (followUp?.kind === "maintenance") setDoneFollowUp({ kind: "maintenance", category: followUp.category, description: reminder.label });
    if (followUp?.kind === "expense") setDoneFollowUp({ kind: "expense", category: followUp.category, description: reminder.label });
  }
  useBackButtonClose(showPassportPremium, () => setShowPassportPremium(false));
  const [notificationsOn, setNotificationsOn] = useState(() => notificationsShownAsOn());
  // Si aggiorna anche quando le notifiche si attivano da sole (prima scadenza salvata).
  useEffect(() => onNotificationsChange(() => setNotificationsOn(notificationsShownAsOn())), []);
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
    const result = await enableNotificationsDetailed();
    setNotificationsOn(result === "granted");
    setNotificationMsg(
      result === "granted"
        ? null
        : result === "error"
          ? t("detail.notificationsError")
          : t(Capacitor.isNativePlatform() ? "detail.notificationsDeniedNative" : "detail.notificationsDenied"),
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
        fuelTypeLabel: fuelLabel(t, vehicle),
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
          codes: r.codes.map((code) => ({ code, description: describeDtc(code, i18n.language) ?? t(isManufacturerSpecificDtc(code) ? "passport.dtcUnknown" : "passport.dtcUnknownGeneric") })),
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

  /** Riepilogo del periodo scelto in Statistiche (un anno o "Sempre") come PDF da condividere. */
  async function handleAnnualReport() {
    setReportBusy(true);
    setReportError(null);
    try {
      // Il PDF usa un carattere solo latino: in russo, arabo e hindi le scritte del PDF sono in inglese.
      const latin = !["ru", "ar", "hi"].includes(i18n.language.split("-")[0]);
      const tp = latin ? t : i18n.getFixedT("en");
      const locale = latin ? getNumberLocale(i18n.language) : "en";
      const year = period === "sempre" ? null : period === "anno-corrente" ? currentYear : period === "anno-scorso" ? currentYear - 1 : period;
      const yearOf = (d: string) => new Date(d).getFullYear();
      const costItems = [
        ...filteredFuel.map((e) => ({ d: e.date, v: e.totalCost })),
        ...filteredCharging.map((e) => ({ d: e.date, v: e.totalCost })),
        ...filteredMaintenance.map((e) => ({ d: e.date, v: e.cost })),
        ...filteredExpenses.map((e) => ({ d: e.date, v: e.amount })),
      ];
      const bars =
        year !== null
          ? Array.from({ length: 12 }, (_, m) => ({
              label: new Date(year, m, 1).toLocaleDateString(locale, { month: "narrow" }),
              value: costItems.filter((c) => new Date(c.d).getMonth() === m).reduce((s, c) => s + c.v, 0),
            }))
          : Array.from(new Set(costItems.map((c) => yearOf(c.d))))
              .sort((a, b) => a - b)
              .slice(-12)
              .map((y) => ({ label: String(y), value: costItems.filter((c) => yearOf(c.d) === y).reduce((s, c) => s + c.v, 0) }));
      const expenseCats = ["assicurazione", "bollo", "multa", "documenti", "altro"] as const;
      const expColors: Record<(typeof expenseCats)[number], [number, number, number]> = {
        assicurazione: [0.55, 0.36, 0.96],
        bollo: [0.23, 0.5, 0.96],
        multa: [0.84, 0.27, 0.27],
        documenti: [0.42, 0.45, 0.5],
        altro: [0.91, 0.31, 0.54],
      };
      const categories = [
        { label: tp("summary.fuel"), value: costs.fuelCost, color: [0.96, 0.56, 0.12] as [number, number, number] },
        { label: tp("summary.charging"), value: costs.chargingCost, color: [0.08, 0.72, 0.65] as [number, number, number] },
        { label: tp("summary.maintenance"), value: costs.maintenanceCost, color: [0.13, 0.65, 0.4] as [number, number, number] },
        ...expenseCats.map((c) => ({
          label: tp(`expenseCategory.${c}`),
          value: filteredExpenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
          color: expColors[c],
        })),
      ]
        .filter((c) => c.value > 0)
        .map((c) => ({ ...c, valueLabel: formatMoney(c.value) }));
      const rawRate = await getMeta("trip-rate").catch(() => null);
      const rate = rawRate ? Number(rawRate) : null;
      const trips = tripTotals(tripEntries.filter((tr) => year === null || yearOf(tr.date) === year), rate !== null && Number.isFinite(rate) ? rate : null);
      const visual = vehicleVisual(vehicle);
      const [carPng, iconBytes] = await Promise.all([
        visual ? imageToPng(visual.src) : Promise.resolve(null),
        fetch(new URL("icons/icon-192.png", document.baseURI)).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? new Uint8Array(b) : undefined)).catch(() => undefined),
      ]);
      const consumptionLabel = isElectric
        ? averageElectric !== null ? `${formatNumber(averageElectric, 1, locale)} kWh/100` : "—"
        : averageConsumption !== null ? `${formatNumber(averageConsumption, 1, locale)} l/100` : "—";
      const bytes = await generateAnnualReportPdf({
        title: tp(year !== null ? "annualReport.title" : "annualReport.titleAll"),
        subtitle: tp("annualReport.subtitle", { date: new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) }),
        periodLabel: year !== null ? String(year) : tp("summary.periodAlways"),
        vehicleName: vehicle.name,
        vehicleInfo: [vehicle.plate, fuelLabel(tp, vehicle), formatDistance(vehicle.currentKm, distanceUnit, locale)].filter(Boolean).join(" · "),
        vehicleImage: carPng ? { bytes: carPng, type: "png" } : undefined,
        icon: iconBytes,
        kpis: [
          { label: tp("summary.total"), value: formatMoney(costs.totalCost) },
          { label: tp("summary.distance"), value: totalRecordedKm > 0 ? formatDistance(totalRecordedKm, distanceUnit, locale) : "—" },
          { label: tp("summary.costPerKm"), value: costs.costPerKm !== null ? formatMoney(costs.costPerKm, 3) : "—" },
          { label: tp("home.consumption"), value: consumptionLabel },
        ],
        chartTitle: tp(year !== null ? "annualReport.chartMonths" : "annualReport.chartYears"),
        bars,
        categoriesTitle: tp("annualReport.categories"),
        categories,
        maintenanceTitle: tp("annualReport.maintenance"),
        maintenanceColumns: { date: tp("passport.columnDate"), description: tp("passport.columnDescription"), km: tp("passport.columnKm"), cost: tp("passport.columnCost") },
        maintenance: [...filteredMaintenance]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => ({
            date: new Date(e.date).toLocaleDateString(locale, { day: "numeric", month: "short", ...(year === null ? { year: "numeric" } : {}) }),
            description: e.description || tp(`maintenanceCategory.${e.category}`),
            km: formatDistance(e.km, distanceUnit, locale),
            cost: formatMoney(e.cost),
          })),
        noMaintenance: tp("annualReport.noMaintenance"),
        footerNote: trips.workTrips > 0 ? tp("annualReport.trips", { km: formatDistance(trips.workKm, distanceUnit, locale), amount: formatMoney(trips.refund + trips.extras) }) : undefined,
        pageLabel: (n, total) => tp("annualReport.page", { n, total }),
      });
      const slug = vehicle.name.replace(/\s+/g, "-").toLowerCase();
      await exportPdfBytes(`riepilogo-${year ?? "completo"}-${slug}.pdf`, bytes);
    } catch {
      setReportError(t("annualReport.failed"));
    } finally {
      setReportBusy(false);
    }
  }

  // Ricarica e filtri carburante/elettrico solo per veicoli che si ricaricano
  // (o che hanno già ricariche registrate, così non spariscono dalla vista).
  const canCharge = vehicle.fuelType === "elettrico" || vehicle.fuelType === "ibrido" || chargingEntries.length > 0;
  // Un'auto solo elettrica non fa rifornimenti (a meno che non ne abbia già registrati).
  const showFuelButton = vehicle.fuelType !== "elettrico" || fuelEntries.length > 0;

  const activeRemindersCount = reminders.filter((r) => !r.completed && reminderStatus(r, vehicle.currentKm) !== "ok").length;

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

  // Consumo reale da pieno a pieno (con i parziali in mezzo), lo stesso calcolo
  // usato nel resto dell'app; per le elettriche in kWh/100 km dalle ricariche.
  const isElectric = vehicle.fuelType === "elettrico";
  const fuelPoints = vehicleConsumptionPoints(filteredFuel, vehicle);
  const electricPoints = calculateElectricConsumption(filteredCharging);
  const kmPerL = averageConsumptionKmPerL(fuelPoints, mainFuelSource(vehicle.fuelType));
  const averageConsumption = kmPerL ? 100 / kmPerL : null;
  const averageElectric = averageElectricConsumption(electricPoints);
  const consumptionSamples = isElectric ? electricPoints.length : fuelPoints.length;
  const totalChargingKwh = filteredCharging.reduce((sum, e) => sum + (Number(e.kWh) || 0), 0);
  const averageChargingPrice = totalChargingKwh > 0 ? costs.chargingCost / totalChargingKwh : null;
  const totalRecordedKm = costs.totalKm;

  const vehicleColor = colors?.[vehicle.id];

  return (
    <section
      className={`vehicle-detail-page${vehicleColor ? " vehicle-detail-page--colored" : ""}`}
      style={vehicleColor ? ({ ["--c" as string]: vehicleColor } as CSSProperties) : undefined}
    >
      <VehicleHeader
        vehicle={vehicle}
        vehicles={allVehicles}
        urgentCounts={urgentCounts}
        onBack={onBack}
        onSelect={onSwitchVehicle}
        leading={
          restrictToTab === "riepilogo" && onOpenFleet
            ? { label: t("fleet.all", "Tutti"), sub: t("vehicleHeader.fleetSub"), onClick: onOpenFleet, badge: isPro ? undefined : "PRO" }
            : undefined
        }
      />

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
            <div className="screen-head">
              <h2 className="screen-title">{t("bottomNav.obd")}</h2>
            </div>
            <LiveDataPanel vehicle={vehicle} onOdometerKm={onOdometerKm} onOpenAdapters={onOpenAdapters} />
          </>
        )}

        {tab === "rifornimenti" && (
          <>
            <div className="screen-head">
              <h2 className="screen-title">{t(isElectric ? "detail.chargesTitle" : "detail.fuelTitle")}</h2>
              <p className="screen-sub">{t(isElectric ? "detail.chargesSubtitle" : canCharge ? "detail.fuelSubtitleBoth" : "detail.fuelSubtitleFuel")}</p>
            </div>
            <FuelChargeList
              fuelEntries={fuelEntries}
              chargingEntries={chargingEntries}
              vehicleFuelType={vehicle.fuelType}
              bifuel={bifuelSources(vehicle)}
              showSourceFilters={canCharge && showFuelButton}
              onEditFuel={setEditingFuel}
              onEditCharging={setEditingCharging}
              actions={
                <div className="screen-actions">
                  {showFuelButton && (
                    <button type="button" className="big-btn big-btn--green" onClick={() => setShowFuelForm(true)}>
                      <ActionGridIcon name="fuel" />
                      {t("detail.newFuel")}
                    </button>
                  )}
                  {canCharge && (
                    <button type="button" className="big-btn big-btn--blue" onClick={() => setShowChargingForm(true)}>
                      <ActionGridIcon name="bolt" />
                      {t("detail.newCharge")}
                    </button>
                  )}
                </div>
              }
            />
          </>
        )}

        {tab === "manutenzioni" && (
          <>
            <div className="screen-head screen-head--row">
              <h2 className="screen-title">{t("maintenance.title")}</h2>
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
                    <ActionGridIcon name="folder" /> {t("passport.short")}
                  </>
                )}
                {!isPro && " 🔒"}
              </button>
            </div>
            {passportError && <p className="form-error">{passportError}</p>}
            <div className="screen-sect">
              <h3>{t("reminders.title")}</h3>
              {openRemindersTab && (
                <button type="button" onClick={openRemindersTab}>
                  {t("home.all")} ›
                </button>
              )}
            </div>
            <MaintenanceOverview
              vehicle={vehicle}
              entries={maintenanceEntries}
              reminders={reminders}
              onOpenReminders={openRemindersTab}
            />
            <div className="screen-sect">
              <h3>{t("maintenance.history")}</h3>
            </div>
            {restrictToTab === "manutenzioni" && maintenanceEntries.length > 0 && (
              <div className="maintenance-category-filter">
                <label htmlFor="maintenance-category-select" className="visually-hidden">{t("maintenance.filterByCategory", "Filtra per categoria")}</label>
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
              onEdit={setEditingMaintenance}
            />
            <div className="screen-actions">
              <button type="button" className="big-btn" onClick={() => setShowMaintenanceForm(true)}>
                + {t("maintenance.newIntervention")}
              </button>
            </div>
          </>
        )}

        {tab === "spese" && (
          <>
            <div className="screen-head">
              <h2 className="screen-title">{t("detail.expensesTitle")}</h2>
              <p className="screen-sub">{t("detail.expensesSubtitle")}</p>
            </div>
            <div className="screen-actions">
              <button type="button" className="big-btn big-btn--purple" onClick={() => setShowExpenseForm(true)}>
                + {t("detail.newExpense")}
              </button>
            </div>
            <ExpenseList entries={expenseEntries} onEdit={setEditingExpense} />
          </>
        )}


        {tab === "scadenze" && (
          <>
            <div className="screen-head">
              <h2 className="screen-title">{t("reminders.title")}</h2>
            </div>
            <div className="screen-actions">
              <button type="button" className="big-btn" onClick={() => setShowReminderForm(true)}>
                + {t("detail.newReminder")}
              </button>
            </div>

            {/* Le notifiche si gestiscono dalle Impostazioni (attive per default): qui solo un avviso se spente. */}
            {!notificationsOn && (
              <p className="notif-status">
                <span aria-hidden="true">🔕</span>
                <span>{t("detail.notifAutoOff")}</span>
                <button type="button" className="notif-status__toggle" onClick={handleToggleNotifications}>
                  {t("detail.notifEnable")}
                </button>
              </p>
            )}
            {notificationMsg && <p className="form-error" style={{ margin: "0 0 0.75rem" }}>{notificationMsg}</p>}
            {notificationMsg && Capacitor.isNativePlatform() && (
              <button type="button" className="btn btn--ghost btn--small" style={{ margin: "0 0 0.75rem" }} onClick={() => void openNotificationSettings()}>
                {t("settingsScreen.openNotificationSettings")}
              </button>
            )}

            <ReminderList
              reminders={reminders}
              currentKm={vehicle.currentKm}
              onToggleComplete={handleReminderDone}
              onEdit={setEditingReminder}
              onDelete={onDeleteReminder}
            />
          </>
        )}

        {tab === "viaggi" && <TripsPanel vehicle={vehicle} trips={tripEntries} onSave={onSaveTrip} onDelete={onDeleteTrip} />}
        {tab === "tragitto" && <CommutePanel vehicle={vehicle} fuelEntries={fuelEntries} chargingEntries={chargingEntries} maintenanceEntries={maintenanceEntries} expenseEntries={expenseEntries} />}

        {tab === "riepilogo" && (
          <>
            <div className="screen-head">
              <h2 className="screen-title">{t("bottomNav.stats")}</h2>
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

            <section className="stotal">
              <span className="stotal__label">{t("summary.total")}</span>
              <div className="stotal__value">{formatMoney(costs.totalCost)}</div>
              <div className="stotal__kpis">
                <div>
                  <span>{t("summary.distance")}</span>
                  <b>{totalRecordedKm > 0 ? formatDistance(totalRecordedKm, distanceUnit, getNumberLocale(i18n.language)) : "—"}</b>
                </div>
                <div>
                  <span>{t("summary.costPerKm")}</span>
                  <b>{costs.costPerKm !== null ? formatMoney(costs.costPerKm, 3) : "—"}</b>
                </div>
                <div>
                  <span>{t("home.consumption")}</span>
                  <b>
                    {isElectric
                      ? averageElectric !== null
                        ? <>{formatNumber(averageElectric, 1, getNumberLocale(i18n.language))} <small>kWh/100</small></>
                        : "—"
                      : averageConsumption !== null
                        ? <>{formatNumber(averageConsumption, 1, getNumberLocale(i18n.language))} <small>l/100</small></>
                        : "—"}
                  </b>
                </div>
              </div>
            </section>

            <section className="sbreak">
              {[
                { key: "fuel", label: t("summary.fuel"), value: costs.fuelCost, color: "var(--warn)", show: vehicle.fuelType !== "elettrico" || costs.fuelCost > 0 },
                { key: "charging", label: t("summary.charging"), value: costs.chargingCost, color: "var(--blue)", show: costs.chargingCost > 0 },
                { key: "maintenance", label: t("summary.maintenance"), value: costs.maintenanceCost, color: "var(--green)", show: true },
                { key: "expenses", label: t("summary.expensesLong"), value: costs.expensesCost, color: "var(--purple)", show: true },
              ]
                .filter((c) => c.show)
                .map((c) => {
                  const pct = costs.totalCost > 0 ? (c.value / costs.totalCost) * 100 : 0;
                  return (
                    <div key={c.key} className="sbreak__row">
                      <span className="sbreak__name">
                        <i style={{ background: c.color }} aria-hidden="true" />
                        {c.label}
                      </span>
                      <span className="sbreak__value">
                        {formatMoney(c.value, 0)}
                        <small>{Math.round(pct)}%</small>
                      </span>
                      <span className="sbreak__bar" aria-hidden="true">
                        <i style={{ width: `${pct}%`, background: c.color }} />
                      </span>
                    </div>
                  );
                })}
            </section>

            <button type="button" className="btn report-btn" onClick={handleAnnualReport} disabled={reportBusy}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h4" />
              </svg>
              {reportBusy
                ? t("annualReport.creating")
                : t("annualReport.button", {
                    period:
                      period === "sempre" ? t("summary.periodAlways").toLowerCase() : String(period === "anno-corrente" ? currentYear : period === "anno-scorso" ? currentYear - 1 : period),
                  })}
            </button>
            {reportError && <p className="report-btn__error">{reportError}</p>}

            {canCharge && (
              <div className="skgrid">
                <div className="skgrid__item">
                  <span className="skgrid__icon skgrid__icon--blue"><ActionGridIcon name="bolt" /></span>
                  <div>
                    <span>{t("summary.energy")}</span>
                    <b>{totalChargingKwh > 0 ? `${formatNumber(totalChargingKwh, 1, getNumberLocale(i18n.language))} kWh` : "—"}</b>
                  </div>
                </div>
                <div className="skgrid__item">
                  <span className="skgrid__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 8a5 5 0 1 0 0 8M6 10h6M6 14h5" /></svg>
                  </span>
                  <div>
                    <span>{t("summary.averageEnergyPrice")}</span>
                    <b>{averageChargingPrice !== null ? formatMoney(averageChargingPrice, 3) + "/kWh" : "—"}</b>
                  </div>
                </div>
              </div>
            )}

            <CostChart
              fuelEntries={filteredFuel}
              chargingEntries={filteredCharging}
              maintenanceEntries={filteredMaintenance}
              expenseEntries={filteredExpenses}
              kmReadings={[...fuelEntries, ...chargingEntries, ...maintenanceEntries]}
            />
            <FuelPriceChart fuelEntries={filteredFuel} />
            <div className="summary-insight">
              <strong>{t("summary.dataQualityTitle")}</strong>
              <span>{
                consumptionSamples > 0
                  ? t(isElectric ? "summary.dataQualityElectric" : "summary.dataQualityConsumption", { count: consumptionSamples })
                  : t(isElectric ? "summary.dataQualityHintElectric" : "summary.dataQualityHint")
              }</span>
            </div>
          </>
        )}
      </div>

      {showFuelForm && (
        <FuelForm
          vehicle={vehicle}
          existingEntries={fuelEntries}
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
          existingEntries={fuelEntries}
          initialEntry={editingFuel}
          onSave={(entry) => {
            onSaveFuel(entry);
            setEditingFuel(null);
          }}
          onClose={() => setEditingFuel(null)}
          onDelete={() => {
            onDeleteFuel(editingFuel.id);
            setEditingFuel(null);
          }}
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
          onDelete={() => {
            onDeleteCharging(editingCharging.id);
            setEditingCharging(null);
          }}
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

      {doneFollowUp?.kind === "maintenance" && (
        <MaintenanceForm
          vehicle={vehicle}
          defaults={{ category: doneFollowUp.category, description: doneFollowUp.description }}
          notice={t("reminders.doneFollowUp")}
          onSave={(entry) => {
            onAddMaintenance(entry);
            setDoneFollowUp(null);
          }}
          onClose={() => setDoneFollowUp(null)}
        />
      )}

      {doneFollowUp?.kind === "expense" && (
        <ExpenseForm
          vehicle={vehicle}
          defaults={{ category: doneFollowUp.category, description: doneFollowUp.description }}
          notice={t("reminders.doneFollowUp")}
          onSave={(entry) => {
            onAddExpense(entry);
            setDoneFollowUp(null);
          }}
          onClose={() => setDoneFollowUp(null)}
        />
      )}

      {editingMaintenance && (
        <MaintenanceForm
          vehicle={vehicle}
          initialEntry={editingMaintenance}
          onSave={(entry) => {
            onAddMaintenance(entry);
            setEditingMaintenance(null);
          }}
          onClose={() => setEditingMaintenance(null)}
          onDelete={() => {
            onDeleteMaintenance(editingMaintenance.id);
            setEditingMaintenance(null);
          }}
        />
      )}

      {editingExpense && (
        <ExpenseForm
          vehicle={vehicle}
          initialEntry={editingExpense}
          onSave={(entry) => {
            onAddExpense(entry);
            setEditingExpense(null);
          }}
          onClose={() => setEditingExpense(null)}
          onDelete={() => {
            onDeleteExpense(editingExpense.id);
            setEditingExpense(null);
          }}
        />
      )}

      {editingReminder && (
        <ReminderForm
          vehicle={vehicle}
          initialReminder={editingReminder}
          onSave={(reminder) => {
            onAddReminder(reminder);
            setEditingReminder(null);
          }}
          onClose={() => setEditingReminder(null)}
          onDelete={() => {
            onDeleteReminder(editingReminder.id);
            setEditingReminder(null);
          }}
        />
      )}
    </section>
  );
}
