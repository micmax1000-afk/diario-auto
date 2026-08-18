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

const VEHICLES_KEY = "diario-auto:vehicles";
const FUEL_KEY = "diario-auto:fuel-entries";
const CHARGING_KEY = "diario-auto:charging-entries";
const MAINTENANCE_KEY = "diario-auto:maintenance-entries";
const EXPENSES_KEY = "diario-auto:expense-entries";
const REMINDERS_KEY = "diario-auto:reminders";
const LAST_BACKUP_KEY = "diario-auto:last-backup";
const LOG_SESSIONS_KEY = "diario-auto:log-sessions";
const OBD_PROFILES_KEY = "diario-auto:obd-profiles";
const COMMUTE_SETTINGS_KEY = "diario-auto:commute-settings";
const COMMUTE_SCENARIOS_KEY = "diario-auto:commute-scenarios";

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function save<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export function loadVehicles(): Vehicle[] {
  return load<Vehicle>(VEHICLES_KEY);
}
export function saveVehicles(vehicles: Vehicle[]): void {
  save(VEHICLES_KEY, vehicles);
}

export function loadFuelEntries(): FuelEntry[] {
  return load<FuelEntry>(FUEL_KEY);
}
export function saveFuelEntries(entries: FuelEntry[]): void {
  save(FUEL_KEY, entries);
}

export function loadChargingEntries(): ChargingEntry[] {
  return load<ChargingEntry>(CHARGING_KEY);
}
export function saveChargingEntries(entries: ChargingEntry[]): void {
  save(CHARGING_KEY, entries);
}

// Ricorda l'ultimo prezzo/potenza usati per la ricarica a casa di ogni veicolo,
// così il form si precompila da solo dalle volte successive.
export interface HomeChargingDefaults {
  vehicleId: string;
  pricePerKWh: number;
  powerKW?: number;
}
const HOME_CHARGING_DEFAULTS_KEY = "diario-auto:home-charging-defaults";

export function getHomeChargingDefaults(vehicleId: string): HomeChargingDefaults | null {
  return load<HomeChargingDefaults>(HOME_CHARGING_DEFAULTS_KEY).find((d) => d.vehicleId === vehicleId) ?? null;
}
export function setHomeChargingDefaults(vehicleId: string, pricePerKWh: number, powerKW?: number): void {
  const list = load<HomeChargingDefaults>(HOME_CHARGING_DEFAULTS_KEY);
  const idx = list.findIndex((d) => d.vehicleId === vehicleId);
  const entry: HomeChargingDefaults = { vehicleId, pricePerKWh, powerKW };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  save(HOME_CHARGING_DEFAULTS_KEY, list);
}

// Chiave API gratuita di Open Charge Map (richiesta obbligatoriamente
// dall'API), salvata localmente sul dispositivo dell'utente.
const OCM_API_KEY_KEY = "diario-auto:ocm-api-key";

export function getOcmApiKey(): string | null {
  try {
    return localStorage.getItem(OCM_API_KEY_KEY);
  } catch {
    return null;
  }
}

export function setOcmApiKey(key: string): void {
  try {
    localStorage.setItem(OCM_API_KEY_KEY, key);
  } catch {
    // storage non disponibile, ignorato
  }
}

export function loadMaintenanceEntries(): MaintenanceEntry[] {
  return load<MaintenanceEntry>(MAINTENANCE_KEY);
}
export function saveMaintenanceEntries(entries: MaintenanceEntry[]): void {
  save(MAINTENANCE_KEY, entries);
}

export function loadExpenseEntries(): ExpenseEntry[] {
  return load<ExpenseEntry>(EXPENSES_KEY);
}
export function saveExpenseEntries(entries: ExpenseEntry[]): void {
  save(EXPENSES_KEY, entries);
}

export function loadReminders(): Reminder[] {
  return load<Reminder>(REMINDERS_KEY);
}
export function saveReminders(reminders: Reminder[]): void {
  save(REMINDERS_KEY, reminders);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------- Sessioni di log OBD ----------

export function loadLogSessions(): LogSession[] {
  return load<LogSession>(LOG_SESSIONS_KEY);
}
export function saveLogSessions(sessions: LogSession[]): void {
  save(LOG_SESSIONS_KEY, sessions);
}

export function logSessionToCsv(session: LogSession): string {
  const header = "t_ms;rpm;speed_kmh;coolant_temp_c";
  const rows = session.samples.map(
    (s) => `${s.t};${s.rpm ?? ""};${s.speedKmh ?? ""};${s.coolantTempC ?? ""}`,
  );
  return [header, ...rows].join("\n");
}

// ---------- Profili OBD per veicolo (protocollo, ultimo device, allarmi) ----------

export function loadObdProfiles(): ObdVehicleProfile[] {
  return load<ObdVehicleProfile>(OBD_PROFILES_KEY);
}
export function saveObdProfiles(profiles: ObdVehicleProfile[]): void {
  save(OBD_PROFILES_KEY, profiles);
}
export function getObdProfile(vehicleId: string): ObdVehicleProfile | null {
  return loadObdProfiles().find((p) => p.vehicleId === vehicleId) ?? null;
}
export function upsertObdProfile(vehicleId: string, patch: Partial<ObdVehicleProfile>): ObdVehicleProfile {
  const profiles = loadObdProfiles();
  const idx = profiles.findIndex((p) => p.vehicleId === vehicleId);
  const merged: ObdVehicleProfile = { vehicleId, ...(idx >= 0 ? profiles[idx] : {}), ...patch };
  if (idx >= 0) profiles[idx] = merged;
  else profiles.push(merged);
  saveObdProfiles(profiles);
  return merged;
}

// ---------- Costo reale del tragitto ----------

export function loadCommuteSettings(): CommuteSettings[] {
  return load<CommuteSettings>(COMMUTE_SETTINGS_KEY);
}
export function saveCommuteSettings(settings: CommuteSettings[]): void {
  save(COMMUTE_SETTINGS_KEY, settings);
}
export function getCommuteSettings(vehicleId: string): CommuteSettings | null {
  return loadCommuteSettings().find((s) => s.vehicleId === vehicleId) ?? null;
}
export function upsertCommuteSettings(vehicleId: string, patch: Partial<CommuteSettings>): CommuteSettings {
  const list = loadCommuteSettings();
  const idx = list.findIndex((s) => s.vehicleId === vehicleId);
  const defaults: CommuteSettings = {
    vehicleId,
    kmPerTrip: 0,
    tripsPerDay: 2,
    workDaysPerWeek: 6,
    fuelPricePerLiter: 0,
  };
  const merged: CommuteSettings = { ...defaults, ...(idx >= 0 ? list[idx] : {}), ...patch };
  if (idx >= 0) list[idx] = merged;
  else list.push(merged);
  saveCommuteSettings(list);
  return merged;
}

export function loadCommuteScenarios(): CommuteScenario[] {
  return load<CommuteScenario>(COMMUTE_SCENARIOS_KEY);
}
export function saveCommuteScenarios(scenarios: CommuteScenario[]): void {
  save(COMMUTE_SCENARIOS_KEY, scenarios);
}
export function getCommuteScenarios(vehicleId: string): CommuteScenario[] {
  return loadCommuteScenarios().filter((s) => s.vehicleId === vehicleId);
}
export function addCommuteScenario(scenario: CommuteScenario): void {
  saveCommuteScenarios([...loadCommuteScenarios(), scenario]);
}
export function deleteCommuteScenario(id: string): void {
  saveCommuteScenarios(loadCommuteScenarios().filter((s) => s.id !== id));
}

// ---------- Backup completo ----------

export interface BackupData {
  version: 1;
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
}

export function buildBackup(): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    vehicles: loadVehicles(),
    fuelEntries: loadFuelEntries(),
    chargingEntries: loadChargingEntries(),
    maintenanceEntries: loadMaintenanceEntries(),
    expenseEntries: loadExpenseEntries(),
    reminders: loadReminders(),
    logSessions: loadLogSessions(),
    obdProfiles: loadObdProfiles(),
    commuteSettings: loadCommuteSettings(),
    commuteScenarios: loadCommuteScenarios(),
  };
}

export function restoreBackup(data: BackupData): void {
  saveVehicles(data.vehicles ?? []);
  saveFuelEntries(data.fuelEntries ?? []);
  saveChargingEntries(data.chargingEntries ?? []);
  saveMaintenanceEntries(data.maintenanceEntries ?? []);
  saveExpenseEntries(data.expenseEntries ?? []);
  saveReminders(data.reminders ?? []);
  saveLogSessions(data.logSessions ?? []);
  saveObdProfiles(data.obdProfiles ?? []);
  saveCommuteSettings(data.commuteSettings ?? []);
  saveCommuteScenarios(data.commuteScenarios ?? []);
}

export function getLastBackupDate(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY);
}

export function setLastBackupDate(iso: string): void {
  localStorage.setItem(LAST_BACKUP_KEY, iso);
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
