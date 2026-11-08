import { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import type { Vehicle, FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry, Reminder, TripEntry } from "./types";
import {
  initStorage,
  loadVehicles,
  putVehicle,
  deleteVehicle,
  loadFuelEntries,
  putFuelEntry,
  deleteFuelEntry,
  loadChargingEntries,
  putChargingEntry,
  deleteChargingEntry,
  loadMaintenanceEntries,
  putMaintenanceEntry,
  deleteMaintenanceEntry,
  loadExpenseEntries,
  putExpenseEntry,
  deleteExpenseEntry,
  loadTripEntries,
  putTripEntry,
  deleteTripEntry,
  loadReminders,
  putReminder,
  deleteReminder,
  generateId,
} from "./utils/storage";
import {
  areNotificationsEnabled,
  autoEnableNotifications,
  notifyDueReminders,
  onNotificationsChange,
  scheduleUpcomingReminders,
  type NotifiableReminder,
} from "./utils/notifications";
import { formatNumber, getNumberLocale } from "./utils/locale";
import { averageConsumption, averageElectricConsumption, calculateConsumption, calculateElectricConsumption, mainFuelSource } from "./utils/calculations";
import { formatDistance } from "./utils/settings";
import { useAppSettings } from "./contexts/AppSettingsContext";
import { applyTheme, getStoredThemeMode, onSystemThemeChange, resolveTheme, setStoredThemeMode, type ThemeMode } from "./utils/theme";
import { isRtlLanguage } from "./i18n";
import { triggerTopBackHandler, useBackButtonClose } from "./utils/backButtonStack";
import { updateDeadlinesWidget, updateWidgetData } from "./utils/widgetData";
import VehicleCard from "./components/VehicleCard";
import VehicleForm from "./components/VehicleForm";
import Dashboard, { type ActivityKind } from "./components/Dashboard";
import QuickEntryHeader from "./components/QuickEntryHeader";
import ObdAdapters from "./components/ObdAdapters";
import VoiceFuelSheet from "./components/VoiceFuelSheet";
import FuelStations from "./components/FuelStations";
import AddSheet, { type AddAction } from "./components/AddSheet";
import MenuSections from "./components/MenuSections";
import BottomTabBar, { type TabId } from "./components/BottomTabBar";
import VehiclePickerModal from "./components/VehiclePickerModal";
import LanguagePicker from "./components/LanguagePicker";
import DisclaimerGate from "./components/DisclaimerGate";
import WelcomeGuide from "./components/WelcomeGuide";
import RestoreOffer from "./components/RestoreOffer";
import { getMeta, setMeta } from "./utils/db";
import { resolveVehicleColors, VEHICLE_COLORS } from "./utils/vehicleColor";
import QuickFuelForm from "./components/QuickFuelForm";
import QuickChargeForm from "./components/QuickChargeForm";
import UndoToast from "./components/UndoToast";
import { runAutoBackupIfDue } from "./utils/autoBackup";
import { useProStatus, FREE_VEHICLE_LIMIT } from "./services/billing/useProStatus";
import { estimateKmPerDay, reminderStatus, setKmPerDayRates } from "./utils/kmForecast";

// Schermate raggiunte solo dopo un'azione dell'utente (mai visibili al primo
// avvio): caricate solo quando servono davvero, invece di appesantire il
// bundle iniziale che ogni utente scarica per aprire semplicemente il Garage.
const VehicleDetail = lazy(() => import("./components/VehicleDetail"));
const QuickKmUpdate = lazy(() => import("./components/QuickKmUpdate"));
const BackupPanel = lazy(() => import("./components/BackupPanel"));
const FleetStats = lazy(() => import("./components/FleetStats"));
const SettingsScreen = lazy(() => import("./components/SettingsScreen"));
const PremiumScreen = lazy(() => import("./components/PremiumScreen"));
const KmHistory = lazy(() => import("./components/KmHistory"));

// Mappa il tab della bottom bar alla scheda di dettaglio veicolo da aprire
type DetailTabTarget = "live" | "rifornimenti" | "manutenzioni" | "spese" | "scadenze" | "tragitto" | "viaggi" | "riepilogo";

type PendingAction =
  | { kind: "navigate"; tab: DetailTabTarget }
  | { kind: "quickFuel" }
  | { kind: "quickCharge" };

const MAIN_TAB_TO_DETAIL_TAB: Record<"manutenzione" | "statistiche" | "movimenti" | "obd", DetailTabTarget> = {
  obd: "live",
  manutenzione: "manutenzioni",
  statistiche: "riepilogo",
  movimenti: "rifornimenti",
};

function LazyFallback() {
  return (
    <div className="app-loading">
      <div className="app-loading__spinner" />
    </div>
  );
}

// Cambia la versione se il testo delle avvertenze cambia in modo sostanziale: verranno riproposte a tutti.
const DISCLAIMER_META_KEY = "disclaimer:accepted";
const DISCLAIMER_VERSION = "v1";
const GUIDE_META_KEY = "welcome-guide:seen";
const RESTORE_OFFER_KEY = "restore-offer:seen";

export default function App() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true);
  const [guideSeen, setGuideSeen] = useState(true);
  const [restoreOfferSeen, setRestoreOfferSeen] = useState(true);
  // Scorciatoia scelta tenendo premuta l'icona (diarioauto://shortcut/...), eseguita appena i dati sono pronti.
  const [pendingShortcut, setPendingShortcut] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [chargingEntries, setChargingEntries] = useState<ChargingEntry[]>([]);
  const [maintenanceEntries, setMaintenanceEntries] = useState<MaintenanceEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [tripEntries, setTripEntries] = useState<TripEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [vehicleOrder, setVehicleOrder] = useState<string[]>([]);

  const [mainTab, setMainTab] = useState<TabId>("garage");
  const [quickFuelVehicleId, setQuickFuelVehicleId] = useState<string | null>(null);
  const [quickChargeVehicleId, setQuickChargeVehicleId] = useState<string | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  // Veicolo in primo piano nella Home (si cambia scorrendo le schede): è anche
  // quello usato dal tasto + e dalle schede della barra in basso.
  const [homeVehicleId, setHomeVehicleId] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [quickFuelPrefill, setQuickFuelPrefill] = useState<{ pricePerUnit: number; totalCost: number; km?: number; fullTank?: boolean } | undefined>(undefined);
  const [voiceFuelVehicleId, setVoiceFuelVehicleId] = useState<string | null>(null);
  const [quickChargePrefill, setQuickChargePrefill] = useState<{ pricePerKWh?: number; totalCost?: number; atHome?: boolean; km?: number } | undefined>(undefined);
  useBackButtonClose(!!voiceFuelVehicleId, () => setVoiceFuelVehicleId(null));
  const [detailAutoOpen, setDetailAutoOpen] = useState<"maintenance" | "expense" | "reminder" | undefined>(undefined);
  const [showManageVehicles, setShowManageVehicles] = useState(false);
  const [openVehicleId, setOpenVehicleId] = useState<string | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTabTarget>("live");
  const [pendingVehicleAction, setPendingVehicleAction] = useState<PendingAction | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showAdapters, setShowAdapters] = useState(false);
  const [showStations, setShowStations] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [theme, setTheme] = useState(() => resolveTheme(getStoredThemeMode()));
  const { isPro, refresh: refreshProStatus } = useProStatus();
  // Backup automatico su Drive bloccato per sicurezza (molti meno dati dell'ultimo backup).
  const [autoBackupBlocked, setAutoBackupBlocked] = useState(false);
  // Chiuso l'avviso, non si ripropone a ogni ritorno nell'app (solo alla prossima apertura).
  const autoBackupAlertDismissed = useRef(false);

  // All'apertura (e quando lo stato Pro diventa noto) prova il backup settimanale su Drive.
  // Anche al ritorno in primo piano: su Android l'app resta spesso aperta per giorni.
  useEffect(() => {
    if (loading || !isPro) return;
    const check = () =>
      void runAutoBackupIfDue(true).then((result) => setAutoBackupBlocked(result === "blocked" && !autoBackupAlertDismissed.current));
    check();
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapacitorApp.addListener("resume", check);
    // anche quando si esce dall'app: spesso si chiude subito dopo aver inserito un dato
    const subPause = CapacitorApp.addListener("pause", check);
    return () => {
      void sub.then((h) => h.remove());
      void subPause.then((h) => h.remove());
    };
  }, [loading, isPro]);

  // "Dopo ogni modifica": qualche minuto dopo l'ultimo cambiamento prova un backup
  // (parte solo se è scelta quella frequenza e i dati sono davvero cambiati).
  useEffect(() => {
    if (loading || !isPro || !Capacitor.isNativePlatform()) return;
    const timer = window.setTimeout(() => {
      void runAutoBackupIfDue(true).then((result) => setAutoBackupBlocked(result === "blocked" && !autoBackupAlertDismissed.current));
    }, 3 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [loading, isPro, vehicles, fuelEntries, chargingEntries, maintenanceEntries, expenseEntries, tripEntries, reminders]);
  const { distanceUnit } = useAppSettings();
  const [quickKmVehicle, setQuickKmVehicle] = useState<Vehicle | null>(null);
  const [kmHistoryVehicleId, setKmHistoryVehicleId] = useState<string | null>(null);
  const [showFleet, setShowFleet] = useState(false);
  // Ultima cancellazione annullabile: il messaggio "Eliminato · Annulla" resta qualche secondo.
  const [undoable, setUndoable] = useState<{ id: number; restore: () => Promise<void> } | null>(null);

  // Km al giorno di ogni veicolo (ultimi 12 mesi): servono a stimare quando
  // si raggiungeranno le scadenze a km. Impostati prima del render dei figli.
  const kmPerDayRates = useMemo(() => {
    const rates = new Map<string, number>();
    for (const v of vehicles) {
      const readings = [...fuelEntries, ...chargingEntries, ...maintenanceEntries].filter((e) => e.vehicleId === v.id);
      const rate = estimateKmPerDay(readings);
      if (rate) rates.set(v.id, rate);
    }
    return rates;
  }, [vehicles, fuelEntries, chargingEntries, maintenanceEntries]);
  setKmPerDayRates(kmPerDayRates);

  // Ogni schermata/modulo "chiudibile" si registra per il tasto indietro
  // hardware di Android — vedi backButtonStack.ts. L'ordine qui non conta:
  // chiude sempre solo quello aperto più di recente.
  useBackButtonClose(showNewVehicleForm, () => setShowNewVehicleForm(false));
  useBackButtonClose(editingVehicle !== null, () => setEditingVehicle(null));
  useBackButtonClose(showManageVehicles, () => setShowManageVehicles(false));
  useBackButtonClose(showBackup, () => { setShowBackup(false); setMainTab("impostazioni"); });
  useBackButtonClose(showPremium, () => setShowPremium(false));
  useBackButtonClose(showAdapters, () => setShowAdapters(false));
  useBackButtonClose(showStations, () => setShowStations(false));
  useBackButtonClose(showFleet, () => setShowFleet(false));
  useBackButtonClose(quickKmVehicle !== null, () => setQuickKmVehicle(null));
  useBackButtonClose(kmHistoryVehicleId !== null, () => setKmHistoryVehicleId(null));
  useBackButtonClose(quickFuelVehicleId !== null, () => setQuickFuelVehicleId(null));
  useBackButtonClose(quickChargeVehicleId !== null, () => setQuickChargeVehicleId(null));
  useBackButtonClose(openVehicleId !== null, () => handleBackFromDetail());
  useBackButtonClose(mainTab === "impostazioni", () => setMainTab("garage"));

  // Applica il tema al <html> e alla barra di stato del browser subito
  // all'avvio: senza questo, il tema salvato/di sistema resta "scritto"
  // solo nello stato React finché l'utente non tocca il selettore in
  // Impostazioni, e l'app parte sempre con lo stile scuro di default.
  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Con "Automatico" segue il telefono anche quando cambia da chiaro a scuro con l'app aperta.
  useEffect(() => {
    if (themeMode !== "auto") return;
    return onSystemThemeChange(() => {
      const next = resolveTheme("auto");
      setTheme(next);
      applyTheme(next);
    });
  }, [themeMode]);

  function handleThemeMode(mode: ThemeMode) {
    const next = resolveTheme(mode);
    setThemeMode(mode);
    setTheme(next);
    applyTheme(next);
    setStoredThemeMode(mode);
  }

  async function reloadAll() {
    const [vehiclesData, fuelData, chargingData, maintenanceData, expensesData, remindersData, tripsData] = await Promise.all([
      loadVehicles(),
      loadFuelEntries(),
      loadChargingEntries(),
      loadMaintenanceEntries(),
      loadExpenseEntries(),
      loadReminders(),
      loadTripEntries(),
    ]);
    setVehicles(vehiclesData);
    setFuelEntries(fuelData);
    setChargingEntries(chargingData);
    setMaintenanceEntries(maintenanceData);
    setExpenseEntries(expensesData);
    setReminders(remindersData);
    setTripEntries(tripsData);
  }

  useEffect(() => {
    (async () => {
      // migra eventuali dati da localStorage (versioni precedenti dell'app) prima del primo caricamento
      await initStorage();
      await reloadAll();
      try {
        const rawOrder = await getMeta("vehicle-order");
        if (rawOrder) setVehicleOrder(JSON.parse(rawOrder) as string[]);
      } catch { /* ordine non leggibile: si usa quello di default */ }
      const seen = await getMeta("onboarding:seen");
      setShowOnboarding(seen !== "true");
      setDisclaimerAccepted((await getMeta(DISCLAIMER_META_KEY)) === DISCLAIMER_VERSION);
      setGuideSeen((await getMeta(GUIDE_META_KEY)) === "true");
      setRestoreOfferSeen((await getMeta(RESTORE_OFFER_KEY)) === "true");
      setLoading(false);
    })();
  }, []);

  async function handleDisclaimerAccepted() {
    await setMeta(DISCLAIMER_META_KEY, DISCLAIMER_VERSION);
    setDisclaimerAccepted(true);
  }

  async function handleRestoreOfferDone(restored: boolean) {
    await setMeta(RESTORE_OFFER_KEY, "true");
    setRestoreOfferSeen(true);
    if (restored) {
      // con i dati ripristinati la guida iniziale non serve; il backup può riportare anche il tema
      await handleGuideDone();
      setThemeMode(getStoredThemeMode());
      setTheme(resolveTheme(getStoredThemeMode()));
      await reloadAll();
    }
  }

  async function handleGuideDone() {
    await setMeta(GUIDE_META_KEY, "true");
    setGuideSeen(true);
  }

  async function handleLanguagePickerDone() {
    await setMeta("onboarding:seen", "true");
    setShowOnboarding(false);
  }

  // Notifiche delle scadenze: sull'app Android si attivano da sole la prima
  // volta che c'è una scadenza (chiedendo il permesso), senza pulsanti da trovare.
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => areNotificationsEnabled());
  useEffect(() => onNotificationsChange(() => setNotificationsEnabled(areNotificationsEnabled())), []);
  useEffect(() => {
    if (loading || !reminders.some((r) => !r.completed)) return;
    void autoEnableNotifications();
  }, [loading, reminders]);

  // Controlla le scadenze imminenti/scadute e invia notifiche del browser,
  // se l'utente le ha attivate. Al massimo una per promemoria al giorno.
  useEffect(() => {
    if (!notificationsEnabled || vehicles.length === 0 || reminders.length === 0) return;

    const items: NotifiableReminder[] = [];
    for (const reminder of reminders) {
      if (reminder.completed) continue;
      const vehicle = vehicles.find((v) => v.id === reminder.vehicleId);
      if (!vehicle) continue;
      const status = reminderStatus(reminder, vehicle.currentKm);
      if (status === "ok") continue;
      items.push({
        id: reminder.id,
        label: reminder.label,
        vehicleName: vehicle.name,
        status,
        dueDate: reminder.dueDate,
      });
    }
    notifyDueReminders(
      items,
      { overdue: t("notif.overdue"), soon: t("notif.soon"), dueOnPrefix: t("notif.dueOnPrefix") },
      getNumberLocale(i18n.language),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, reminders, notificationsEnabled]);

  // Aggiorna il widget nella home con il veicolo principale e la scadenza
  // più urgente — indipendente dalle notifiche: deve aggiornarsi anche se
  // l'utente non le ha mai attivate.
  useEffect(() => {
    const primaryVehicle = activeOrderedVehicles[0] ?? vehicles.find((v) => !v.archived);
    if (!primaryVehicle) return;
    const locale = getNumberLocale(i18n.language);
    const active = vehicles.filter((v) => !v.archived);

    // Scadenze aperte di tutte le auto, dalla più urgente: scadute prima, poi per data o km.
    const open = reminders
      .filter((r) => !r.completed)
      .map((r) => {
        const v = active.find((x) => x.id === r.vehicleId);
        return v ? { r, v, s: reminderStatus(r, v.currentKm) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.s !== "ok")
      .sort((a, b) => (a.s === "overdue" ? 0 : 1) - (b.s === "overdue" ? 0 : 1) || (a.r.dueDate ?? "9999").localeCompare(b.r.dueDate ?? "9999"));
    const status = (s: string) => t(s === "overdue" ? "home.overdue" : "home.soon");
    const mine = open.find((x) => x.v.id === primaryVehicle.id);

    const vFuel = fuelEntries.filter((e) => e.vehicleId === primaryVehicle.id);
    const electric = primaryVehicle.fuelType === "elettrico";
    let consumption: string | null = null;
    if (electric) {
      const kwh = averageElectricConsumption(calculateElectricConsumption(chargingEntries.filter((e) => e.vehicleId === primaryVehicle.id)));
      if (kwh) consumption = `${formatNumber(kwh, 1, locale)} kWh/100`;
    } else {
      const kmPerL = averageConsumption(calculateConsumption(vFuel), mainFuelSource(primaryVehicle.fuelType));
      if (kmPerL) consumption = `${formatNumber(100 / kmPerL, 1, locale)} l/100`;
    }

    void updateWidgetData({
      vehicleName: primaryVehicle.name,
      plate: primaryVehicle.plate,
      km: formatDistance(primaryVehicle.currentKm, distanceUnit, locale),
      reminderLabel: mine ? `${mine.r.label} · ${status(mine.s)}` : null,
      reminderOverdue: mine?.s === "overdue",
      consumption,
      voice: i18n.language.startsWith("it") && !electric,
      labels: {
        deadline: t("home.upcoming"),
        consumption: t("home.consumption"),
        noDeadline: t("home.allClear"),
        fuel: t(electric ? "addSheet.charge" : "addSheet.fuel"),
        voice: t("widget.voice"),
      },
    });
    void updateDeadlinesWidget({
      title: t("reminders.title"),
      empty: t("home.allClear"),
      items: open.slice(0, 3).map((x) => ({
        label: active.length > 1 ? `${x.r.label} · ${x.v.name}` : x.r.label,
        when: x.s === "overdue"
          ? status(x.s)
          : x.r.dueDate
            ? new Date(x.r.dueDate).toLocaleDateString(locale, { day: "numeric", month: "short" })
            : x.r.dueKm
              ? formatDistance(x.r.dueKm, distanceUnit, locale)
              : status(x.s),
        overdue: x.s === "overdue",
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, reminders, fuelEntries, chargingEntries, i18n.language, vehicleOrder]);

  // Sull'app nativa, programma anche le notifiche future per i promemoria
  // con data: a differenza del controllo sopra (solo ad app aperta), queste
  // arrivano dal sistema operativo anche se l'app resta chiusa fino a quel giorno.
  useEffect(() => {
    const schedulable = reminders
      .filter((r) => !r.completed && r.dueDate)
      .map((r) => {
        const vehicle = vehicles.find((v) => v.id === r.vehicleId);
        if (!vehicle) return null;
        return { id: r.id, label: r.label, vehicleName: vehicle.name, dueDate: r.dueDate! };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    scheduleUpcomingReminders(
      schedulable,
      { dueOnPrefix: t("notif.dueOnPrefix"), inDays: (count) => t("notif.inDays", { count }) },
      getNumberLocale(i18n.language),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, reminders, notificationsEnabled]);

  // Tasto/gesto "indietro" hardware di Android: chiude il modulo o la
  // schermata aperta più di recente (vedi backButtonStack.ts), invece di
  // uscire di colpo dall'app — che rischierebbe di perdere dati non salvati
  // in un form aperto. Se non c'è nulla da chiudere (siamo alla schermata
  // principale), serve un secondo tocco entro 2 secondi per uscire davvero.
  const [showExitHint, setShowExitHint] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let lastPressAt = 0;
    let exitHintTimeout: ReturnType<typeof setTimeout> | undefined;

    const listenerPromise = CapacitorApp.addListener("backButton", () => {
      const handled = triggerTopBackHandler();
      if (handled) return;

      const now = Date.now();
      if (now - lastPressAt < 2000) {
        CapacitorApp.exitApp();
        return;
      }
      lastPressAt = now;
      setShowExitHint(true);
      clearTimeout(exitHintTimeout);
      exitHintTimeout = setTimeout(() => setShowExitHint(false), 2000);
    });

    return () => {
      clearTimeout(exitHintTimeout);
      listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  // Aggiorna il km del veicolo in stato locale + storage se un nuovo record lo supera
  // (rifornimento, ricarica o manutenzione più recente del km salvato sul veicolo).
  async function bumpVehicleKmIfNeeded(vehicleId: string, newKm: number) {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || newKm <= vehicle.currentKm) return;
    const updated = { ...vehicle, currentKm: newKm };
    setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? updated : v)));
    await putVehicle(updated);
  }

  // ---------- Veicoli ----------

  async function handleSaveVehicle(vehicle: Vehicle) {
    const exists = vehicles.some((v) => v.id === vehicle.id);
    // difesa in profondità: anche se il form fosse aperto senza passare da
    // handleRequestAddVehicle, non permettere comunque di superare il limite
    if (!exists && !isPro && activeVehicleCount >= FREE_VEHICLE_LIMIT) {
      setShowNewVehicleForm(false);
      setShowPremium(true);
      return;
    }
    setVehicles((prev) => (exists ? prev.map((v) => (v.id === vehicle.id ? vehicle : v)) : [...prev, vehicle]));
    setShowNewVehicleForm(false);
    setEditingVehicle(null);
    await putVehicle(vehicle);
  }

  async function handleArchiveVehicle(id: string) {
    const target = vehicles.find((v) => v.id === id);
    if (!target) return;
    const updated: Vehicle = { ...target, archived: true, archivedAt: new Date().toISOString() };
    setVehicles((prev) => prev.map((v) => (v.id === id ? updated : v)));
    if (openVehicleId === id) setOpenVehicleId(null);
    await putVehicle(updated);
  }

  async function handleRestoreVehicle(id: string) {
    const target = vehicles.find((v) => v.id === id);
    if (!target) return;
    const updated: Vehicle = { ...target, archived: false, archivedAt: undefined };
    setVehicles((prev) => prev.map((v) => (v.id === id ? updated : v)));
    await putVehicle(updated);
  }

  async function handleDeleteVehicle(id: string) {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    const relatedFuel = fuelEntries.filter((e) => e.vehicleId === id);
    const relatedCharging = chargingEntries.filter((e) => e.vehicleId === id);
    const relatedMaint = maintenanceEntries.filter((e) => e.vehicleId === id);
    const relatedExpenses = expenseEntries.filter((e) => e.vehicleId === id);
    const relatedReminders = reminders.filter((r) => r.vehicleId === id);
    const relatedTrips = tripEntries.filter((e) => e.vehicleId === id);

    setFuelEntries((prev) => prev.filter((e) => e.vehicleId !== id));
    setChargingEntries((prev) => prev.filter((e) => e.vehicleId !== id));
    setMaintenanceEntries((prev) => prev.filter((e) => e.vehicleId !== id));
    setExpenseEntries((prev) => prev.filter((e) => e.vehicleId !== id));
    setReminders((prev) => prev.filter((r) => r.vehicleId !== id));
    setTripEntries((prev) => prev.filter((e) => e.vehicleId !== id));
    if (openVehicleId === id) setOpenVehicleId(null);

    await Promise.all([
      ...relatedTrips.map((e) => deleteTripEntry(e.id)),
      deleteVehicle(id),
      ...relatedFuel.map((e) => deleteFuelEntry(e.id)),
      ...relatedCharging.map((e) => deleteChargingEntry(e.id)),
      ...relatedMaint.map((e) => deleteMaintenanceEntry(e.id)),
      ...relatedExpenses.map((e) => deleteExpenseEntry(e.id)),
      ...relatedReminders.map((r) => deleteReminder(r.id)),
    ]);
  }

  async function handleQuickKmSave(km: number) {
    if (!quickKmVehicle) return;
    const updated: Vehicle = { ...quickKmVehicle, currentKm: km };
    setQuickKmVehicle(null);
    await handleSaveVehicle(updated);
  }

  // ---------- Rifornimenti ----------

  async function handleSaveFuel(entry: FuelEntry) {
    const exists = fuelEntries.some((e) => e.id === entry.id);
    setFuelEntries((prev) => (exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [...prev, entry]));
    await putFuelEntry(entry);
    await bumpVehicleKmIfNeeded(entry.vehicleId, entry.km);
  }

  /** Mostra "Eliminato · Annulla": restore rimette il record nello stato e nel database. */
  function offerUndo<T extends { id: string; deletedAt?: string }>(
    item: T | undefined,
    setList: (update: (prev: T[]) => T[]) => void,
    put: (item: T) => Promise<void>,
  ) {
    if (!item) return;
    const restored = { ...item, deletedAt: undefined };
    setUndoable({
      id: Date.now(),
      restore: async () => {
        setList((prev) => (prev.some((e) => e.id === item.id) ? prev : [...prev, restored]));
        await put(restored);
      },
    });
  }

  async function handleDeleteFuel(id: string) {
    offerUndo(fuelEntries.find((e) => e.id === id), setFuelEntries, putFuelEntry);
    setFuelEntries((prev) => prev.filter((e) => e.id !== id));
    await deleteFuelEntry(id);
  }

  // ---------- Ricariche elettriche ----------

  async function handleSaveCharging(entry: ChargingEntry) {
    const exists = chargingEntries.some((e) => e.id === entry.id);
    setChargingEntries((prev) => (exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [...prev, entry]));
    await putChargingEntry(entry);
    await bumpVehicleKmIfNeeded(entry.vehicleId, entry.km);
  }

  async function handleDeleteCharging(id: string) {
    offerUndo(chargingEntries.find((e) => e.id === id), setChargingEntries, putChargingEntry);
    setChargingEntries((prev) => prev.filter((e) => e.id !== id));
    await deleteChargingEntry(id);
  }

  // ---------- Manutenzioni ----------

  async function handleAddMaintenance(entry: MaintenanceEntry) {
    setMaintenanceEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev.map((e) => (e.id === entry.id ? entry : e)) : [...prev, entry]));
    await putMaintenanceEntry(entry);
    await bumpVehicleKmIfNeeded(entry.vehicleId, entry.km);
  }

  async function handleDeleteMaintenance(id: string) {
    offerUndo(maintenanceEntries.find((e) => e.id === id), setMaintenanceEntries, putMaintenanceEntry);
    setMaintenanceEntries((prev) => prev.filter((e) => e.id !== id));
    await deleteMaintenanceEntry(id);
  }

  // ---------- Spese ----------

  async function handleAddExpense(entry: ExpenseEntry) {
    setExpenseEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev.map((e) => (e.id === entry.id ? entry : e)) : [...prev, entry]));
    await putExpenseEntry(entry);
  }

  async function handleDeleteExpense(id: string) {
    offerUndo(expenseEntries.find((e) => e.id === id), setExpenseEntries, putExpenseEntry);
    setExpenseEntries((prev) => prev.filter((e) => e.id !== id));
    await deleteExpenseEntry(id);
  }

  // ---------- Viaggi ----------

  /** Salva il viaggio; pedaggio e parcheggio diventano (se richiesto) anche spese dell'auto. */
  async function handleSaveTrip(trip: TripEntry, alsoExpense: boolean) {
    const oldIds = trip.linkedExpenseIds ?? [];
    if (oldIds.length) {
      setExpenseEntries((prev) => prev.filter((e) => !oldIds.includes(e.id)));
      await Promise.all(oldIds.map((id) => deleteExpenseEntry(id)));
    }
    const where = [trip.from, trip.to].filter(Boolean).join(" → ");
    const linked: ExpenseEntry[] = [];
    if (alsoExpense) {
      for (const [amount, label] of [[trip.toll, t("tripForm.toll")], [trip.parking, t("tripForm.parking")]] as const) {
        if (!amount) continue;
        linked.push({ id: generateId(), vehicleId: trip.vehicleId, date: trip.date, category: "altro", description: where ? `${label} · ${where}` : label, amount });
      }
    }
    const saved: TripEntry = { ...trip, linkedExpenseIds: linked.length ? linked.map((e) => e.id) : undefined };
    if (linked.length) setExpenseEntries((prev) => [...prev, ...linked]);
    setTripEntries((prev) => (prev.some((e) => e.id === saved.id) ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved]));
    await Promise.all([putTripEntry(saved), ...linked.map((e) => putExpenseEntry(e))]);
    if (saved.kmEnd) await bumpVehicleKmIfNeeded(saved.vehicleId, saved.kmEnd);
  }

  async function handleDeleteTrip(id: string) {
    const trip = tripEntries.find((e) => e.id === id);
    if (!trip) return;
    const linked = expenseEntries.filter((e) => trip.linkedExpenseIds?.includes(e.id));
    setUndoable({
      id: Date.now(),
      restore: async () => {
        const restored = { ...trip, deletedAt: undefined };
        setTripEntries((prev) => (prev.some((e) => e.id === id) ? prev : [...prev, restored]));
        setExpenseEntries((prev) => [...prev, ...linked.filter((l) => !prev.some((e) => e.id === l.id)).map((l) => ({ ...l, deletedAt: undefined }))]);
        await Promise.all([putTripEntry(restored), ...linked.map((l) => putExpenseEntry({ ...l, deletedAt: undefined }))]);
      },
    });
    setTripEntries((prev) => prev.filter((e) => e.id !== id));
    setExpenseEntries((prev) => prev.filter((e) => !trip.linkedExpenseIds?.includes(e.id)));
    await Promise.all([deleteTripEntry(id), ...linked.map((l) => deleteExpenseEntry(l.id))]);
  }

  // ---------- Scadenze ----------

  async function handleAddReminder(reminder: Reminder) {
    setReminders((prev) => (prev.some((r) => r.id === reminder.id) ? prev.map((r) => (r.id === reminder.id ? reminder : r)) : [...prev, reminder]));
    await putReminder(reminder);
  }

  async function handleToggleReminder(id: string) {
    const target = reminders.find((r) => r.id === id);
    if (!target) return;
    const updated: Reminder = { ...target, completed: !target.completed };
    const toPut: Reminder[] = [updated];

    // se viene completata (non riattivata) e ha un intervallo di ripetizione, crea la prossima occorrenza
    if (!target.completed && (target.repeatMonths || target.repeatKm)) {
      const vehicle = vehicles.find((v) => v.id === target.vehicleId);
      const nextReminder: Reminder = { ...target, id: generateId(), completed: false };
      if (target.type === "data" && target.repeatMonths) {
        const due = new Date();
        due.setMonth(due.getMonth() + target.repeatMonths);
        nextReminder.dueDate = due.toISOString();
      }
      if (target.type === "km" && target.repeatKm && vehicle) {
        nextReminder.dueKm = vehicle.currentKm + target.repeatKm;
      }
      toPut.push(nextReminder);
    }

    setReminders((prev) => {
      const withUpdated = prev.map((r) => (r.id === id ? updated : r));
      return toPut.length > 1 ? [...withUpdated, toPut[1]] : withUpdated;
    });

    await Promise.all(toPut.map((r) => putReminder(r)));
  }

  async function handleDeleteReminder(id: string) {
    offerUndo(reminders.find((r) => r.id === id), setReminders, putReminder);
    setReminders((prev) => prev.filter((r) => r.id !== id));
    await deleteReminder(id);
  }

  const openVehicle = vehicles.find((v) => v.id === openVehicleId) ?? null;
  const activeVehicleCount = vehicles.filter((v) => !v.archived).length;

  // Punto unico da cui passa ogni "+ Aggiungi veicolo" dell'app: se il limite
  // gratuito è raggiunto e Pro non è sbloccato, mostra la schermata di
  // acquisto invece del form — non un vicolo cieco silenzioso.
  function handleRequestAddVehicle() {
    if (!isPro && activeVehicleCount >= FREE_VEHICLE_LIMIT) {
      setShowPremium(true);
      return;
    }
    setShowNewVehicleForm(true);
  }

  // Punto unico da cui passa ogni azione globale che deve coinvolgere un
  // veicolo specifico (navigazione a una scheda, o inserimento rapido
  // rifornimento/ricarica): con 0 veicoli propone di aggiungerne uno, con 1
  // lo usa direttamente, con 2+ FORZA la scelta esplicita — mai un
  // vehicles[0] silenzioso, per non rischiare di registrare dati sul
  // veicolo sbagliato.
  function requestVehicleAction(action: PendingAction) {
    const active = vehicles.filter((v) => !v.archived);
    if (active.length === 0) {
      setShowNewVehicleForm(true);
      return;
    }
    if (active.length === 1) {
      completeVehicleAction(active[0].id, action);
      return;
    }
    // Rifornimento rapido e navigazione alle schede: si apre sul veicolo usato più di
    // recente. Il modulo/la schermata mostra la striscia dei veicoli per cambiarlo,
    // quindi niente domanda preliminare.
    if (action.kind === "quickFuel" || action.kind === "quickCharge" || action.kind === "navigate") {
      // Per la ricarica si preferiscono i veicoli che possono ricaricare (elettrico/ibrido).
      const pool =
        action.kind === "quickCharge"
          ? active.filter((v) => v.fuelType === "elettrico" || v.fuelType === "ibrido")
          : active;
      const candidates = pool.length > 0 ? pool : active;
      const activeIds = new Set(candidates.map((v) => v.id));
      const latest = [...fuelEntries, ...chargingEntries]
        .filter((e) => activeIds.has(e.vehicleId))
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const fallback = orderedVehicles.find((v) => activeIds.has(v.id) && !v.archived) ?? candidates[0];
      completeVehicleAction(latest?.vehicleId ?? fallback.id, action);
      return;
    }
    setPendingVehicleAction(action);
  }

  function completeVehicleAction(vehicleId: string, action: PendingAction, autoOpen?: "maintenance" | "expense" | "reminder") {
    setHomeVehicleId(vehicleId);
    setDetailAutoOpen(autoOpen);
    if (action.kind === "navigate") {
      setDetailInitialTab(action.tab);
      setOpenVehicleId(vehicleId);
    } else if (action.kind === "quickFuel") {
      setQuickFuelVehicleId(vehicleId);
    } else if (action.kind === "quickCharge") {
      setQuickChargeVehicleId(vehicleId);
    }
  }

  const orderedVehicles = useMemo(() => {
    const rank = (id: string) => {
      const i = vehicleOrder.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...vehicles].sort((a, b) => rank(a.id) - rank(b.id));
  }, [vehicles, vehicleOrder]);

  const vehicleColors = useMemo(() => resolveVehicleColors(vehicles), [vehicles]);
  const activeOrderedVehicles = useMemo(() => orderedVehicles.filter((v) => !v.archived), [orderedVehicles]);
  const urgentByVehicle = useMemo(() => {
    const out: Record<string, number> = {};
    for (const v of vehicles) {
      out[v.id] = reminders.filter(
        (r) => r.vehicleId === v.id && !r.completed && reminderStatus(r, v.currentKm) !== "ok",
      ).length;
    }
    return out;
  }, [vehicles, reminders]);

  function moveVehicle(vehicleId: string, direction: -1 | 1) {
    const ids = orderedVehicles.filter((v) => !v.archived).map((v) => v.id);
    const i = ids.indexOf(vehicleId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const rest = orderedVehicles.filter((v) => v.archived).map((v) => v.id);
    const next = [...ids, ...rest];
    setVehicleOrder(next);
    void setMeta("vehicle-order", JSON.stringify(next));
  }

  function handleVehiclePicked(vehicleId: string) {
    if (pendingVehicleAction) {
      completeVehicleAction(vehicleId, pendingVehicleAction);
    }
    setPendingVehicleAction(null);
  }

  const currentVehicle =
    (openVehicleId ? vehicles.find((v) => v.id === openVehicleId && !v.archived) : undefined) ??
    activeOrderedVehicles.find((v) => v.id === homeVehicleId) ??
    activeOrderedVehicles[0];

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const take = (url?: string) => {
      const m = url?.match(/^diarioauto:\/\/shortcut\/(\w+)/);
      if (m) setPendingShortcut(m[1]);
    };
    void CapacitorApp.getLaunchUrl().then((r) => take(r?.url)).catch(() => undefined);
    const sub = CapacitorApp.addListener("appUrlOpen", (e) => take(e.url));
    return () => void sub.then((h) => h.remove());
  }, []);

  useEffect(() => {
    if (!pendingShortcut || loading || showOnboarding || !disclaimerAccepted) return;
    const action = pendingShortcut;
    setPendingShortcut(null);
    setShowAddSheet(false);
    if (action === "stations") {
      setShowStations(true);
      return;
    }
    const v = currentVehicle;
    if (!v) return;
    const electric = v.fuelType === "elettrico";
    if (action === "voice") handleAddAction(i18n.language.startsWith("it") ? "fuelVoice" : electric ? "charge" : "fuel");
    else if (action === "fuel") handleAddAction(electric ? "charge" : "fuel");
    else if (action === "km") handleAddAction("km");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShortcut, loading, showOnboarding, disclaimerAccepted]);

  function handleAddAction(action: AddAction) {
    const v = currentVehicle;
    setShowAddSheet(false);
    if (!v) return;
    if (action === "fuelVoice") {
      setVoiceFuelVehicleId(v.id);
    } else if (action === "fuel" || action === "fuelRepeat") {
      const last = [...fuelEntries].filter((e) => e.vehicleId === v.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      setQuickFuelPrefill(action === "fuelRepeat" && last && last.liters > 0 ? { pricePerUnit: last.totalCost / last.liters, totalCost: last.totalCost, fullTank: last.fullTank } : undefined);
      setQuickFuelVehicleId(v.id);
    } else if (action === "charge") {
      setQuickChargeVehicleId(v.id);
    } else if (action === "km") {
      setQuickKmVehicle(v);
    } else if (action === "maintenance") {
      setMainTab("manutenzione");
      completeVehicleAction(v.id, { kind: "navigate", tab: "manutenzioni" }, "maintenance");
    } else if (action === "reminder") {
      setMainTab("manutenzione");
      completeVehicleAction(v.id, { kind: "navigate", tab: "scadenze" }, "reminder");
    } else if (action === "expense") {
      completeVehicleAction(v.id, { kind: "navigate", tab: "spese" }, "expense");
    }
  }

  function handleOpenActivity(vehicleId: string, kind: ActivityKind) {
    if (kind === "maintenance") {
      setMainTab("manutenzione");
      completeVehicleAction(vehicleId, { kind: "navigate", tab: "manutenzioni" });
    } else if (kind === "expense") {
      completeVehicleAction(vehicleId, { kind: "navigate", tab: "spese" });
    } else {
      setMainTab("movimenti");
      completeVehicleAction(vehicleId, { kind: "navigate", tab: "rifornimenti" });
    }
  }

  const urgentTotalCount = reminders.filter((r) => {
    if (r.completed) return false;
    const vehicle = vehicles.find((v) => v.id === r.vehicleId);
    if (!vehicle || vehicle.archived) return false;
    return reminderStatus(r, vehicle.currentKm) !== "ok";
  }).length;

  // Navigazione principale mobile: 5 aree, con le funzioni secondarie raccolte in "Altro".
  function handleMainTabChange(tab: TabId) {
    setShowFleet(false);
    setShowBackup(false);
    setShowManageVehicles(false);
    setShowAddSheet(false);
    if (tab === "garage") {
      setMainTab("garage");
      setOpenVehicleId(null);
      return;
    }
    if (tab === "movimenti" || tab === "manutenzione" || tab === "statistiche" || tab === "obd") {
      setMainTab(tab);
      const action: PendingAction = { kind: "navigate", tab: MAIN_TAB_TO_DETAIL_TAB[tab] };
      // Si resta sul veicolo in uso (scheda aperta o quello in primo piano nella Home):
      // niente domanda "su quale veicolo?" ad ogni cambio di scheda.
      const current = currentVehicle;
      if (current) {
        completeVehicleAction(current.id, action);
      } else {
        requestVehicleAction(action);
      }
      return;
    }
    if (tab === "impostazioni") {
      setMainTab("impostazioni");
      setOpenVehicleId(null);
      return;
    }
    setMainTab("garage");
    setOpenVehicleId(null);
  }

  function handleBackFromDetail() {
    setOpenVehicleId(null);
    setMainTab("garage");
  }

  function urgentRemindersCount(vehicleId: string, currentKm: number): number {
    return reminders.filter(
      (r) => r.vehicleId === vehicleId && !r.completed && reminderStatus(r, currentKm) !== "ok",
    ).length;
  }

  function hasUrgentReminder(vehicleId: string, currentKm: number): boolean {
    return reminders.some(
      (r) =>
        r.vehicleId === vehicleId &&
        !r.completed &&
        reminderStatus(r, currentKm) !== "ok",
    );
  }

  if (loading) {
    return (
      <div className="app">
        <div className="app-loading">
          <span className="app-loading__spinner" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <LanguagePicker onDone={handleLanguagePickerDone} />;
  }

  if (!disclaimerAccepted) {
    return <DisclaimerGate onAccept={handleDisclaimerAccepted} />;
  }

  // Guida iniziale: solo per chi parte da zero (chi aggiorna l'app ha già i suoi veicoli).
  if (!guideSeen && vehicles.length === 0) {
    return (
      <>
        <WelcomeGuide onDone={handleGuideDone} />
        {!restoreOfferSeen && (
          <RestoreOffer onRestored={() => void handleRestoreOfferDone(true)} onSkip={() => void handleRestoreOfferDone(false)} />
        )}
      </>
    );
  }

  return (
    <div className="app">
      <main
        className="content"
        key={`${mainTab}-${showBackup ? "backup" : "app"}-${openVehicleId ?? "list"}-${detailInitialTab}`}
      >
        {showBackup && (
          <section style={{ paddingBottom: "3rem" }}>
            <QuickEntryHeader title={t("backup.title")} onBack={() => { setShowBackup(false); setMainTab("impostazioni"); }} />
            <Suspense fallback={<LazyFallback />}>
              <BackupPanel
                vehicles={vehicles}
                fuelEntries={fuelEntries}
                maintenanceEntries={maintenanceEntries}
                expenseEntries={expenseEntries}
                chargingEntries={chargingEntries}
                onRestored={() => {
                  void reloadAll();
                  // il backup può riportare anche tema e colori
                  setThemeMode(getStoredThemeMode());
                  setTheme(resolveTheme(getStoredThemeMode()));
                }}
              />
            </Suspense>
          </section>
        )}

        {!showBackup && showManageVehicles && !openVehicle && (
          <section>
            <div className="section-head">
              <h1>{t("vehicles.title")}</h1>
              <button type="button" className="btn btn--ghost" onClick={() => setShowManageVehicles(false)}>
                {isRtlLanguage(i18n.language) ? "→ " : "← "}
                {t("detail.back")}
              </button>
            </div>

            {vehicles.filter((v) => !v.archived).length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">{t("vehicles.emptyActiveTitle")}</p>
                <p className="empty-state__body">
                  {vehicles.length === 0 ? t("vehicles.emptyNoneBody") : t("vehicles.emptyAllArchivedBody")}
                </p>
                <button type="button" className="btn btn--primary" onClick={handleRequestAddVehicle}>
                  {t("vehicles.add")}
                </button>
              </div>
            ) : (
              <div className="vehicle-grid">
                {activeOrderedVehicles
                  .map((v, index) => (
                    <div key={v.id} className="vehicle-grid__item">
                      {activeOrderedVehicles.length > 1 && (
                        <span className="vehicle-grid__move">
                          <button type="button" disabled={index === 0} onClick={() => moveVehicle(v.id, -1)} aria-label={t("dashboardGarage.moveUp", "Sposta su")}>▲</button>
                          <button type="button" disabled={index === activeOrderedVehicles.length - 1} onClick={() => moveVehicle(v.id, 1)} aria-label={t("dashboardGarage.moveDown", "Sposta giù")}>▼</button>
                        </span>
                      )}
                      {hasUrgentReminder(v.id, v.currentKm) && (
                        <span className="vehicle-grid__alert" title={t("vehicles.urgentReminderTitle")}>
                          ⚠ {urgentRemindersCount(v.id, v.currentKm)}
                        </span>
                      )}
                      <VehicleCard
                        vehicle={v}
                        onOpen={(id) => {
                          setOpenVehicleId(id);
                          setDetailInitialTab("live");
                        }}
                        onEdit={(id) => setEditingVehicle(vehicles.find((veh) => veh.id === id) ?? null)}
                        onQuickKm={(id) => setQuickKmVehicle(vehicles.find((veh) => veh.id === id) ?? null)}
                        onDelete={handleArchiveVehicle}
                      />
                    </div>
                  ))}
              </div>
            )}

            {vehicles.some((v) => v.archived) && (
              <div className="archived-section">
                <h2 className="archived-section__title">{t("vehicles.soldSection")}</h2>
                <div className="archived-list">
                  {vehicles
                    .filter((v) => v.archived)
                    .map((v) => (
                      <div key={v.id} className="archived-item">
                        <div className="archived-item__info">
                          <span className="archived-item__name">{v.name}</span>
                          <span className="archived-item__meta">
                            {formatDistance(v.currentKm, distanceUnit, getNumberLocale(i18n.language))}
                            {v.archivedAt
                              ? ` · ${t("vehicles.soldOn", { date: new Date(v.archivedAt).toLocaleDateString(getNumberLocale(i18n.language)) })}`
                              : ""}
                          </span>
                        </div>
                        <div className="archived-item__actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--small"
                            onClick={() => handleRestoreVehicle(v.id)}
                          >
                            {t("vehicles.restore")}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--danger btn--small"
                            onClick={() => {
                              if (window.confirm(t("vehicles.deleteForeverConfirm", { name: v.name }))) {
                                handleDeleteVehicle(v.id);
                              }
                            }}
                          >
                            {t("vehicles.deleteForever")}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>
        )}

        {!showBackup && !showManageVehicles && !openVehicle && mainTab === "impostazioni" && (
          <Suspense fallback={<LazyFallback />}>
            <SettingsScreen
              onClose={() => setMainTab("garage")}
              onOpenBackup={() => setShowBackup(true)}
              themeMode={themeMode}
              onThemeMode={handleThemeMode}
              title={t("menu.title")}
              beforeList={
                <MenuSections
                  vehicles={activeOrderedVehicles}
                  isPro={isPro}
                  onEditVehicle={(v) => setEditingVehicle(v)}
                  onAddVehicle={handleRequestAddVehicle}
                  onManageVehicles={() => setShowManageVehicles(true)}
                  onOpenCommute={() => requestVehicleAction({ kind: "navigate", tab: "tragitto" })}
                  onOpenTrips={() => requestVehicleAction({ kind: "navigate", tab: "viaggi" })}
                  onOpenExpenses={() => requestVehicleAction({ kind: "navigate", tab: "spese" })}
                  onOpenReminders={() => requestVehicleAction({ kind: "navigate", tab: "scadenze" })}
                  onOpenKmHistory={() => {
                    if (currentVehicle) setKmHistoryVehicleId(currentVehicle.id);
                  }}
                  onOpenAdapters={() => setShowAdapters(true)}
                  onOpenStations={() => setShowStations(true)}
                />
              }
            />
          </Suspense>
        )}

        {!showBackup && !showManageVehicles && !openVehicle && mainTab !== "impostazioni" && (
          <Dashboard
            vehicles={orderedVehicles}
            reminders={reminders}
            maintenanceEntries={maintenanceEntries}
            fuelEntries={fuelEntries}
            chargingEntries={chargingEntries}
            expenseEntries={expenseEntries}
            currentVehicleId={currentVehicle?.id ?? null}
            onSelectVehicle={setHomeVehicleId}
            onAddVehicle={handleRequestAddVehicle}
            onOpenReminder={(vehicleId) => {
              setMainTab("manutenzione");
              completeVehicleAction(vehicleId, { kind: "navigate", tab: "scadenze" });
            }}
            onOpenReminders={() => {
              if (!currentVehicle) return;
              setMainTab("manutenzione");
              completeVehicleAction(currentVehicle.id, { kind: "navigate", tab: "scadenze" });
            }}
            onOpenStats={() => handleMainTabChange("statistiche")}
            onOpenActivity={handleOpenActivity}
            onOpenSettings={() => handleMainTabChange("impostazioni")}
          />
        )}

        {!showBackup && openVehicle && showFleet && (
          <Suspense fallback={<LazyFallback />}>
            <FleetStats
              vehicles={activeOrderedVehicles}
              colors={vehicleColors}
              fuelEntries={fuelEntries}
              chargingEntries={chargingEntries}
              maintenanceEntries={maintenanceEntries}
              expenseEntries={expenseEntries}
              reminders={reminders}
              onOpenVehicle={(id) => {
                setShowFleet(false);
                setOpenVehicleId(id);
              }}
            />
          </Suspense>
        )}

        {!showBackup && openVehicle && !showFleet && (
          <Suspense fallback={<LazyFallback />}>
            <VehicleDetail
              vehicle={openVehicle}
              fuelEntries={fuelEntries.filter((e) => e.vehicleId === openVehicle.id)}
              chargingEntries={chargingEntries.filter((e) => e.vehicleId === openVehicle.id)}
              maintenanceEntries={maintenanceEntries.filter((e) => e.vehicleId === openVehicle.id)}
              expenseEntries={expenseEntries.filter((e) => e.vehicleId === openVehicle.id)}
              reminders={reminders.filter((r) => r.vehicleId === openVehicle.id)}
              initialTab={detailInitialTab}
              restrictToTab={detailInitialTab}
              autoOpenForm={detailAutoOpen}
              onAutoOpenHandled={() => setDetailAutoOpen(undefined)}
              onOpenAdapters={() => setShowAdapters(true)}
              onBack={handleBackFromDetail}
              onSaveFuel={handleSaveFuel}
              onDeleteFuel={handleDeleteFuel}
              onSaveCharging={handleSaveCharging}
              onDeleteCharging={handleDeleteCharging}
              onAddMaintenance={handleAddMaintenance}
              onDeleteMaintenance={handleDeleteMaintenance}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              tripEntries={tripEntries.filter((e) => e.vehicleId === openVehicle.id)}
              onSaveTrip={handleSaveTrip}
              onDeleteTrip={handleDeleteTrip}
              onAddReminder={handleAddReminder}
              onToggleReminder={handleToggleReminder}
              onDeleteReminder={handleDeleteReminder}
              onOdometerKm={(km) => bumpVehicleKmIfNeeded(openVehicle.id, km)}
              allVehicles={activeOrderedVehicles}
              colors={vehicleColors}
              urgentCounts={urgentByVehicle}
              onSwitchVehicle={(id) => {
                setOpenVehicleId(id);
                setHomeVehicleId(id);
                setDetailAutoOpen(undefined);
              }}
              onOpenFleet={() => (isPro ? setShowFleet(true) : setShowPremium(true))}
              onOpenRemindersTab={() => completeVehicleAction(openVehicle.id, { kind: "navigate", tab: "scadenze" })}
            />
          </Suspense>
        )}
      </main>

      {!showManageVehicles && (
        <BottomTabBar
          active={mainTab}
          onChange={handleMainTabChange}
          urgentCount={urgentTotalCount}
          addOpen={showAddSheet}
          onAdd={() => {
            if (!currentVehicle) {
              handleRequestAddVehicle();
              return;
            }
            setShowAddSheet((open) => !open);
          }}
        />
      )}

      {showAddSheet && currentVehicle && (
        <AddSheet
          vehicle={currentVehicle}
          vehicles={activeOrderedVehicles}
          lastFuel={[...fuelEntries].filter((e) => e.vehicleId === currentVehicle.id).sort((a, b) => b.date.localeCompare(a.date))[0]}
          onPick={handleAddAction}
          onChangeVehicle={(id) => {
            setHomeVehicleId(id);
            if (openVehicleId) setOpenVehicleId(id);
          }}
          onClose={() => setShowAddSheet(false)}
        />
      )}

      {showNewVehicleForm && (
        <VehicleForm
          autoColor={VEHICLE_COLORS.find((c) => !Object.values(vehicleColors).some((u) => u.toLowerCase() === c.toLowerCase()))}
          onSave={handleSaveVehicle}
          onClose={() => setShowNewVehicleForm(false)}
        />
      )}

      {editingVehicle && (
        <VehicleForm
          initialVehicle={editingVehicle}
          autoColor={vehicleColors[editingVehicle.id]}
          onSave={handleSaveVehicle}
          onClose={() => setEditingVehicle(null)}
          onArchive={(id) => {
            handleArchiveVehicle(id);
            setEditingVehicle(null);
          }}
        />
      )}

      {quickKmVehicle && (
        <Suspense fallback={<LazyFallback />}>
          <QuickKmUpdate
            vehicle={quickKmVehicle}
            onSave={handleQuickKmSave}
            onClose={() => setQuickKmVehicle(null)}
          />
        </Suspense>
      )}

      {showPremium && (
        <Suspense fallback={<LazyFallback />}>
          <PremiumScreen
            onClose={() => {
              setShowPremium(false);
              refreshProStatus();
            }}
          />
        </Suspense>
      )}

      {pendingVehicleAction && (
        <VehiclePickerModal
          vehicles={vehicles.filter((v) => !v.archived)}
          onSelect={handleVehiclePicked}
          onClose={() => setPendingVehicleAction(null)}
        />
      )}

      {showAdapters && <ObdAdapters onBack={() => setShowAdapters(false)} />}
      {showStations && (
        <FuelStations
          defaultFuel={currentVehicle?.fuelType === "diesel" ? "gasolio" : currentVehicle?.fuelType === "gpl" ? "gpl" : currentVehicle?.fuelType === "metano" ? "metano" : "benzina"}
          onBack={() => setShowStations(false)}
          onUsePrice={(price) => {
            const v = currentVehicle;
            setShowStations(false);
            if (!v) return;
            setQuickFuelPrefill({ pricePerUnit: price, totalCost: 0 });
            setQuickFuelVehicleId(v.id);
          }}
        />
      )}

      {kmHistoryVehicleId &&
        (() => {
          const v = vehicles.find((veh) => veh.id === kmHistoryVehicleId);
          if (!v) return null;
          return (
            <Suspense fallback={<LazyFallback />}>
              <KmHistory
                vehicle={v}
                fuelEntries={fuelEntries.filter((f) => f.vehicleId === v.id)}
                chargingEntries={chargingEntries.filter((c) => c.vehicleId === v.id)}
                onBack={() => setKmHistoryVehicleId(null)}
                onUpdateKm={() => {
                  setKmHistoryVehicleId(null);
                  setQuickKmVehicle(v);
                }}
              />
            </Suspense>
          );
        })()}

      {voiceFuelVehicleId && (
        <VoiceFuelSheet
          vehicles={activeOrderedVehicles}
          currentVehicleId={voiceFuelVehicleId}
          onClose={() => setVoiceFuelVehicleId(null)}
          onContinue={(vehicleId, data, kind) => {
            setVoiceFuelVehicleId(null);
            if (kind === "charge") {
              setQuickChargePrefill({ pricePerKWh: data.pricePerUnit, totalCost: data.totalCost, atHome: data.atHome, km: data.km });
              setQuickChargeVehicleId(vehicleId);
            } else {
              setQuickFuelPrefill({ pricePerUnit: data.pricePerUnit ?? 0, totalCost: data.totalCost ?? 0, km: data.km, fullTank: data.fullTank });
              setQuickFuelVehicleId(vehicleId);
            }
          }}
        />
      )}

      {quickFuelVehicleId &&
        (() => {
          const v = vehicles.find((veh) => veh.id === quickFuelVehicleId);
          if (!v) return null;
          return (
            <QuickFuelForm
              key={v.id}
              vehicle={v}
              vehicles={activeOrderedVehicles}
              colors={vehicleColors}
              urgentCounts={urgentByVehicle}
              onChangeVehicle={(id) => setQuickFuelVehicleId(id)}
              existingEntries={fuelEntries.filter((f) => f.vehicleId === v.id)}
              prefill={quickFuelPrefill}
              onSave={(entry) => {
                handleSaveFuel(entry);
                setQuickFuelVehicleId(null);
                setQuickFuelPrefill(undefined);
              }}
              onClose={() => {
                setQuickFuelVehicleId(null);
                setQuickFuelPrefill(undefined);
              }}
            />
          );
        })()}

      {quickChargeVehicleId &&
        (() => {
          const v = vehicles.find((veh) => veh.id === quickChargeVehicleId);
          if (!v) return null;
          return (
            <QuickChargeForm
              key={v.id}
              vehicle={v}
              vehicles={activeOrderedVehicles}
              colors={vehicleColors}
              urgentCounts={urgentByVehicle}
              onChangeVehicle={(id) => setQuickChargeVehicleId(id)}
              existingEntries={chargingEntries.filter((c) => c.vehicleId === v.id)}
              prefill={quickChargePrefill}
              onSave={(entry) => {
                handleSaveCharging(entry);
                setQuickChargeVehicleId(null);
                setQuickChargePrefill(undefined);
              }}
              onClose={() => {
                setQuickChargeVehicleId(null);
                setQuickChargePrefill(undefined);
              }}
            />
          );
        })()}

      {undoable && (
        <UndoToast
          key={undoable.id}
          onUndo={() => {
            void undoable.restore();
            setUndoable(null);
          }}
          onDismiss={() => setUndoable(null)}
        />
      )}

      {autoBackupBlocked && !showBackup && (
        <div className="auto-backup-alert" role="alert">
          <p>{t("backupPanel.autoBlocked")}</p>
          <div>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                autoBackupAlertDismissed.current = true;
                setAutoBackupBlocked(false);
              }}
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => {
                setAutoBackupBlocked(false);
                setMainTab("impostazioni");
                setShowBackup(true);
              }}
            >
              {t("backupPanel.autoBlockedOpen")}
            </button>
          </div>
        </div>
      )}

      {showExitHint && (
        <div className="exit-hint-toast" role="status">
          {t("common.pressBackAgainToExit")}
        </div>
      )}
    </div>
  );
}
