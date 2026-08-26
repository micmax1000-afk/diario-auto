import type {
  Vehicle,
  FuelEntry,
  ChargingEntry,
  MaintenanceEntry,
  ExpenseEntry,
  Reminder,
  LogSession,
  ObdVehicleProfile,
  CommuteSettings,
  CommuteScenario,
} from "../types";
import {
  getAll,
  getAllByVehicle,
  replaceAll,
  putOne,
  softDeleteOne,
  getByVehicleKey,
  putByVehicleKey,
  replaceAllByVehicleKey,
  getAllValues,
  getMeta,
  setMeta,
  runLocalStorageMigrationIfNeeded,
} from "./db";

// Ricorda l'ultimo prezzo/potenza usati per la ricarica a casa di ogni veicolo,
// così il form si precompila da solo dalle volte successive.
export interface HomeChargingDefaults {
  vehicleId: string;
  pricePerKWh: number;
  powerKW?: number;
}

/**
 * Da chiamare una volta all'avvio dell'app (es. in App.tsx prima del primo
 * caricamento dati): importa in IndexedDB eventuali dati salvati in
 * localStorage da versioni precedenti. Non fa nulla se già eseguita in passato
 * o se non c'è nulla da migrare.
 */
export async function initStorage(): Promise<void> {
  await runLocalStorageMigrationIfNeeded();
}

// ---------- Veicoli ----------

export async function loadVehicles(): Promise<Vehicle[]> {
  return getAll<Vehicle>("vehicles");
}
export async function saveVehicles(vehicles: Vehicle[]): Promise<void> {
  return replaceAll("vehicles", vehicles);
}
export async function putVehicle(vehicle: Vehicle): Promise<void> {
  return putOne("vehicles", vehicle);
}
export async function deleteVehicle(id: string): Promise<void> {
  return softDeleteOne("vehicles", id);
}

// ---------- Rifornimenti ----------

export async function loadFuelEntries(): Promise<FuelEntry[]> {
  return getAll<FuelEntry>("fuelEntries");
}
export async function saveFuelEntries(entries: FuelEntry[]): Promise<void> {
  return replaceAll("fuelEntries", entries);
}
export async function putFuelEntry(entry: FuelEntry): Promise<void> {
  return putOne("fuelEntries", entry);
}
export async function deleteFuelEntry(id: string): Promise<void> {
  return softDeleteOne("fuelEntries", id);
}

// ---------- Ricariche elettriche ----------

export async function loadChargingEntries(): Promise<ChargingEntry[]> {
  return getAll<ChargingEntry>("chargingEntries");
}
export async function saveChargingEntries(entries: ChargingEntry[]): Promise<void> {
  return replaceAll("chargingEntries", entries);
}
export async function putChargingEntry(entry: ChargingEntry): Promise<void> {
  return putOne("chargingEntries", entry);
}
export async function deleteChargingEntry(id: string): Promise<void> {
  return softDeleteOne("chargingEntries", id);
}

export async function getHomeChargingDefaults(vehicleId: string): Promise<HomeChargingDefaults | null> {
  return getByVehicleKey<HomeChargingDefaults>("homeChargingDefaults", vehicleId);
}
export async function setHomeChargingDefaults(vehicleId: string, pricePerKWh: number, powerKW?: number): Promise<void> {
  return putByVehicleKey<HomeChargingDefaults>("homeChargingDefaults", { vehicleId, pricePerKWh, powerKW });
}

// ---------- Manutenzioni ----------

export async function loadMaintenanceEntries(): Promise<MaintenanceEntry[]> {
  return getAll<MaintenanceEntry>("maintenanceEntries");
}
export async function saveMaintenanceEntries(entries: MaintenanceEntry[]): Promise<void> {
  return replaceAll("maintenanceEntries", entries);
}
export async function putMaintenanceEntry(entry: MaintenanceEntry): Promise<void> {
  return putOne("maintenanceEntries", entry);
}
export async function deleteMaintenanceEntry(id: string): Promise<void> {
  return softDeleteOne("maintenanceEntries", id);
}

// ---------- Spese ----------

export async function loadExpenseEntries(): Promise<ExpenseEntry[]> {
  return getAll<ExpenseEntry>("expenseEntries");
}
export async function saveExpenseEntries(entries: ExpenseEntry[]): Promise<void> {
  return replaceAll("expenseEntries", entries);
}
export async function putExpenseEntry(entry: ExpenseEntry): Promise<void> {
  return putOne("expenseEntries", entry);
}
export async function deleteExpenseEntry(id: string): Promise<void> {
  return softDeleteOne("expenseEntries", id);
}

// ---------- Scadenze ----------

export async function loadReminders(): Promise<Reminder[]> {
  return getAll<Reminder>("reminders");
}
export async function saveReminders(reminders: Reminder[]): Promise<void> {
  return replaceAll("reminders", reminders);
}
export async function putReminder(reminder: Reminder): Promise<void> {
  return putOne("reminders", reminder);
}
export async function deleteReminder(id: string): Promise<void> {
  return softDeleteOne("reminders", id);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------- Sessioni di log OBD ----------

export async function loadLogSessions(): Promise<LogSession[]> {
  return getAll<LogSession>("logSessions");
}
export async function loadLogSessionsForVehicle(vehicleId: string): Promise<LogSession[]> {
  return getAllByVehicle<LogSession>("logSessions", vehicleId);
}
export async function saveLogSessions(sessions: LogSession[]): Promise<void> {
  return replaceAll("logSessions", sessions);
}
export async function putLogSession(session: LogSession): Promise<void> {
  return putOne("logSessions", session);
}
export async function deleteLogSession(id: string): Promise<void> {
  return softDeleteOne("logSessions", id);
}

export function logSessionToCsv(session: LogSession): string {
  const header = "t_ms;rpm;speed_kmh;coolant_temp_c";
  const rows = session.samples.map(
    (s) => `${s.t};${s.rpm ?? ""};${s.speedKmh ?? ""};${s.coolantTempC ?? ""}`,
  );
  return [header, ...rows].join("\n");
}

// ---------- Profili OBD per veicolo (protocollo, ultimo device, allarmi) ----------

export async function loadObdProfiles(): Promise<ObdVehicleProfile[]> {
  return getAllValues<ObdVehicleProfile>("obdProfiles");
}
export async function getObdProfile(vehicleId: string): Promise<ObdVehicleProfile | null> {
  return getByVehicleKey<ObdVehicleProfile>("obdProfiles", vehicleId);
}
export async function upsertObdProfile(vehicleId: string, patch: Partial<ObdVehicleProfile>): Promise<ObdVehicleProfile> {
  const existing = await getObdProfile(vehicleId);
  const merged: ObdVehicleProfile = { vehicleId, ...(existing ?? {}), ...patch };
  await putByVehicleKey("obdProfiles", merged);
  return merged;
}

// ---------- Costo reale del tragitto ----------

export async function loadCommuteSettings(): Promise<CommuteSettings[]> {
  return getAllValues<CommuteSettings>("commuteSettings");
}
export async function getCommuteSettings(vehicleId: string): Promise<CommuteSettings | null> {
  return getByVehicleKey<CommuteSettings>("commuteSettings", vehicleId);
}
export async function upsertCommuteSettings(vehicleId: string, patch: Partial<CommuteSettings>): Promise<CommuteSettings> {
  const existing = await getCommuteSettings(vehicleId);
  const defaults: CommuteSettings = {
    vehicleId,
    kmPerTrip: 0,
    tripsPerDay: 2,
    workDaysPerWeek: 6,
    fuelPricePerLiter: 0,
  };
  const merged: CommuteSettings = { ...defaults, ...(existing ?? {}), ...patch };
  await putByVehicleKey("commuteSettings", merged);
  return merged;
}

export async function loadCommuteScenarios(): Promise<CommuteScenario[]> {
  return getAll<CommuteScenario>("commuteScenarios");
}
export async function getCommuteScenarios(vehicleId: string): Promise<CommuteScenario[]> {
  return getAllByVehicle<CommuteScenario>("commuteScenarios", vehicleId);
}
export async function addCommuteScenario(scenario: CommuteScenario): Promise<void> {
  return putOne("commuteScenarios", scenario);
}
export async function deleteCommuteScenario(id: string): Promise<void> {
  return softDeleteOne("commuteScenarios", id);
}

// ---------- Backup completo ----------

export interface BackupData {
  version: 2;
  exportedAt: string;
  vehicles: Vehicle[];
  fuelEntries: FuelEntry[];
  chargingEntries?: ChargingEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries?: ExpenseEntry[];
  reminders: Reminder[];
  logSessions?: LogSession[];
  obdProfiles?: ObdVehicleProfile[];
  commuteSettings?: CommuteSettings[];
  commuteScenarios?: CommuteScenario[];
  homeChargingDefaults?: HomeChargingDefaults[];
}

export async function buildBackup(): Promise<BackupData> {
  const [
    vehicles,
    fuelEntries,
    chargingEntries,
    maintenanceEntries,
    expenseEntries,
    reminders,
    logSessions,
    obdProfiles,
    commuteSettings,
    commuteScenarios,
    homeChargingDefaults,
  ] = await Promise.all([
    loadVehicles(),
    loadFuelEntries(),
    loadChargingEntries(),
    loadMaintenanceEntries(),
    loadExpenseEntries(),
    loadReminders(),
    loadLogSessions(),
    loadObdProfiles(),
    loadCommuteSettings(),
    loadCommuteScenarios(),
    getAllValues<HomeChargingDefaults>("homeChargingDefaults"),
  ]);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    vehicles,
    fuelEntries,
    chargingEntries,
    maintenanceEntries,
    expenseEntries,
    reminders,
    logSessions,
    obdProfiles,
    commuteSettings,
    commuteScenarios,
    homeChargingDefaults,
  };
}

/**
 * Controlla che l'oggetto abbia davvero la forma di un backup di Diario Auto
 * prima di tentare il ripristino — non un controllo di verità generica
 * (es. "vehicles esiste"), ma che i campi chiave siano effettivamente array,
 * così un file corrotto o di un'altra app non arriva a metà del ripristino.
 */
export function isValidBackupData(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.version === "number" &&
    Array.isArray(d.vehicles) &&
    Array.isArray(d.fuelEntries) &&
    Array.isArray(d.maintenanceEntries) &&
    Array.isArray(d.reminders)
  );
}

export async function restoreBackup(data: BackupData): Promise<void> {
  await Promise.all([
    saveVehicles(data.vehicles ?? []),
    saveFuelEntries(data.fuelEntries ?? []),
    saveChargingEntries(data.chargingEntries ?? []),
    saveMaintenanceEntries(data.maintenanceEntries ?? []),
    saveExpenseEntries(data.expenseEntries ?? []),
    saveReminders(data.reminders ?? []),
    saveLogSessions(data.logSessions ?? []),
  ]);
  // Sostituzione completa (svuota+reinserisce), non upsert: un profilo OBD o
  // un'impostazione tragitto presenti solo sul dispositivo ma assenti dal
  // backup non devono sopravvivere al ripristino.
  await replaceAllByVehicleKey("obdProfiles", data.obdProfiles ?? []);
  await replaceAllByVehicleKey("commuteSettings", data.commuteSettings ?? []);
  await replaceAllByVehicleKey("homeChargingDefaults", data.homeChargingDefaults ?? []);
  await replaceAll("commuteScenarios", data.commuteScenarios ?? []);
}

export async function getLastBackupDate(): Promise<string | null> {
  return getMeta("last-backup");
}

export async function setLastBackupDate(iso: string): Promise<void> {
  return setMeta("last-backup", iso);
}

export function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// ---------- Export CSV ----------

function toCsvRow(values: (string | number)[]): string {
  return values
    .map((v) => {
      const s = String(v ?? "");
      if (s.includes(";") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(";");
}

export function fuelEntriesToCsv(entries: FuelEntry[], vehicles: Vehicle[]): string {
  const header = toCsvRow(["Data", "Veicolo", "Km", "Litri/kWh", "Costo (EUR)", "Alimentazione", "Pieno", "Note"]);
  const rows = entries.map((e) => {
    const vehicleName = vehicles.find((v) => v.id === e.vehicleId)?.name ?? "";
    return toCsvRow([
      e.date.slice(0, 10),
      vehicleName,
      e.km,
      e.liters,
      e.totalCost.toFixed(2),
      e.source,
      e.fullTank ? "Sì" : "No",
      e.notes ?? "",
    ]);
  });
  return [header, ...rows].join("\n");
}

export function maintenanceEntriesToCsv(entries: MaintenanceEntry[], vehicles: Vehicle[]): string {
  const header = toCsvRow([
    "Data",
    "Veicolo",
    "Km",
    "Categoria",
    "Descrizione",
    "Costo totale (EUR)",
    "Ricambi (EUR)",
    "Manodopera (EUR)",
    "Officina",
    "Note",
  ]);
  const rows = entries.map((e) => {
    const vehicleName = vehicles.find((v) => v.id === e.vehicleId)?.name ?? "";
    return toCsvRow([
      e.date.slice(0, 10),
      vehicleName,
      e.km,
      e.category,
      e.description,
      e.cost.toFixed(2),
      e.partsCost !== undefined ? e.partsCost.toFixed(2) : "",
      e.laborCost !== undefined ? e.laborCost.toFixed(2) : "",
      e.workshop ?? "",
      e.notes ?? "",
    ]);
  });
  return [header, ...rows].join("\n");
}

export function expenseEntriesToCsv(entries: ExpenseEntry[], vehicles: Vehicle[]): string {
  const header = toCsvRow(["Data", "Veicolo", "Categoria", "Descrizione", "Importo (EUR)", "Note"]);
  const rows = entries.map((e) => {
    const vehicleName = vehicles.find((v) => v.id === e.vehicleId)?.name ?? "";
    return toCsvRow([e.date.slice(0, 10), vehicleName, e.category, e.description, e.amount.toFixed(2), e.notes ?? ""]);
  });
  return [header, ...rows].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
