import { openDB, type DBSchema, type IDBPDatabase } from "idb";
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
import type { HomeChargingDefaults } from "./storage";

const DB_NAME = "diario-auto";
const DB_VERSION = 1;

interface DiarioAutoDB extends DBSchema {
  vehicles: { key: string; value: Vehicle };
  fuelEntries: { key: string; value: FuelEntry; indexes: { vehicleId: string } };
  chargingEntries: { key: string; value: ChargingEntry; indexes: { vehicleId: string } };
  maintenanceEntries: { key: string; value: MaintenanceEntry; indexes: { vehicleId: string } };
  expenseEntries: { key: string; value: ExpenseEntry; indexes: { vehicleId: string } };
  reminders: { key: string; value: Reminder; indexes: { vehicleId: string } };
  logSessions: { key: string; value: LogSession; indexes: { vehicleId: string } };
  obdProfiles: { key: string; value: ObdVehicleProfile }; // keyPath: vehicleId
  commuteSettings: { key: string; value: CommuteSettings }; // keyPath: vehicleId
  commuteScenarios: { key: string; value: CommuteScenario; indexes: { vehicleId: string } };
  homeChargingDefaults: { key: string; value: HomeChargingDefaults }; // keyPath: vehicleId
  meta: { key: string; value: { key: string; value: string } };
}

// Object store con `id` come chiave primaria e indice secondario su vehicleId
const ID_KEYED_STORES_WITH_VEHICLE_INDEX = [
  "fuelEntries",
  "chargingEntries",
  "maintenanceEntries",
  "expenseEntries",
  "reminders",
  "logSessions",
  "commuteScenarios",
] as const;

let dbPromise: Promise<IDBPDatabase<DiarioAutoDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<DiarioAutoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DiarioAutoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("vehicles", { keyPath: "id" });

        for (const name of ID_KEYED_STORES_WITH_VEHICLE_INDEX) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("vehicleId", "vehicleId");
        }

        db.createObjectStore("obdProfiles", { keyPath: "vehicleId" });
        db.createObjectStore("commuteSettings", { keyPath: "vehicleId" });
        db.createObjectStore("homeChargingDefaults", { keyPath: "vehicleId" });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

// ---------- CRUD generico per gli store con id proprio ----------

type IdKeyedStoreName = (typeof ID_KEYED_STORES_WITH_VEHICLE_INDEX)[number] | "vehicles";

export async function getAll<T>(storeName: IdKeyedStoreName): Promise<T[]> {
  const db = await getDb();
  const all = (await db.getAll(storeName)) as T[];
  // il soft-delete (deletedAt) filtra qui: i record "cancellati" restano nel
  // DB per una futura sincronizzazione, ma non vengono mai mostrati nell'app
  return all.filter((item) => !(item as { deletedAt?: string }).deletedAt);
}

export async function getAllByVehicle<T>(
  storeName: (typeof ID_KEYED_STORES_WITH_VEHICLE_INDEX)[number],
  vehicleId: string,
): Promise<T[]> {
  const db = await getDb();
  const all = (await db.getAllFromIndex(storeName, "vehicleId", vehicleId)) as T[];
  return all.filter((item) => !(item as { deletedAt?: string }).deletedAt);
}

/** Sostituisce l'intero contenuto di uno store con l'array fornito (comportamento equivalente al vecchio saveX() su localStorage). */
export async function replaceAll<T extends { id: string }>(storeName: IdKeyedStoreName, items: T[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(storeName, "readwrite");
  await tx.store.clear();
  for (const item of items) {
    await tx.store.put(stampUpdatedAt(item) as never);
  }
  await tx.done;
}

export async function putOne<T extends { id: string }>(storeName: IdKeyedStoreName, item: T): Promise<void> {
  const db = await getDb();
  await db.put(storeName, stampUpdatedAt(item) as never);
}

export async function deleteOne(storeName: IdKeyedStoreName, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(storeName, id);
}

/** Cancellazione "morbida": marca deletedAt invece di rimuovere fisicamente il record (pronta per la sync cloud futura). */
export async function softDeleteOne<T extends { id: string }>(storeName: IdKeyedStoreName, id: string): Promise<void> {
  const db = await getDb();
  const existing = (await db.get(storeName, id)) as (T & { deletedAt?: string }) | undefined;
  if (!existing) return;
  existing.deletedAt = new Date().toISOString();
  await db.put(storeName, existing as never);
}

function stampUpdatedAt<T>(item: T): T {
  const now = new Date().toISOString();
  const withMeta = item as T & { createdAt?: string; updatedAt?: string };
  if (!withMeta.createdAt) withMeta.createdAt = now;
  withMeta.updatedAt = now;
  return withMeta;
}

// ---------- Store a chiave singola per veicolo (obdProfiles, commuteSettings, homeChargingDefaults) ----------

export async function getByVehicleKey<T>(
  storeName: "obdProfiles" | "commuteSettings" | "homeChargingDefaults",
  vehicleId: string,
): Promise<T | null> {
  const db = await getDb();
  const value = await db.get(storeName, vehicleId);
  return (value as T) ?? null;
}

export async function putByVehicleKey<T>(
  storeName: "obdProfiles" | "commuteSettings" | "homeChargingDefaults",
  value: T,
): Promise<void> {
  const db = await getDb();
  await db.put(storeName, stampUpdatedAt(value) as never);
}

export async function getAllValues<T>(
  storeName: "obdProfiles" | "commuteSettings" | "homeChargingDefaults",
): Promise<T[]> {
  const db = await getDb();
  return (await db.getAll(storeName)) as T[];
}

/**
 * Sostituisce l'intero contenuto di uno store a chiave-veicolo (svuota prima
 * di reinserire): usata dal restore backup, così un profilo presente solo sul
 * dispositivo ma non nel backup non sopravvive erroneamente al ripristino.
 */
export async function replaceAllByVehicleKey<T>(
  storeName: "obdProfiles" | "commuteSettings" | "homeChargingDefaults",
  items: T[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(storeName, "readwrite");
  await tx.store.clear();
  for (const item of items) {
    await tx.store.put(stampUpdatedAt(item) as never);
  }
  await tx.done;
}

// ---------- Store meta (chiave-valore singolo, es. data ultimo backup) ----------

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get("meta", key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key, value });
}

// ---------- Migrazione una tantum da localStorage ----------

const MIGRATION_FLAG_KEY = "migration:localStorage-v1-complete";
const LOCALSTORAGE_KEYS: Record<string, IdKeyedStoreName | null> = {
  "diario-auto:vehicles": "vehicles",
  "diario-auto:fuel-entries": "fuelEntries",
  "diario-auto:charging-entries": "chargingEntries",
  "diario-auto:maintenance-entries": "maintenanceEntries",
  "diario-auto:expense-entries": "expenseEntries",
  "diario-auto:reminders": "reminders",
  "diario-auto:log-sessions": "logSessions",
  "diario-auto:commute-scenarios": "commuteScenarios",
};

/**
 * Importa in IndexedDB tutti i dati precedentemente salvati in localStorage,
 * una volta sola. Fondamentale: chi aggiorna l'app da una versione precedente
 * non deve perdere nulla. Il localStorage NON viene svuotato dopo la
 * migrazione (resta come backup silenzioso finché non siamo sicuri che tutto
 * funzioni), ma non viene più letto una volta completata.
 */
export async function runLocalStorageMigrationIfNeeded(): Promise<void> {
  const alreadyDone = await getMeta(MIGRATION_FLAG_KEY);
  if (alreadyDone === "true") return;

  try {
    for (const [lsKey, storeName] of Object.entries(LOCALSTORAGE_KEYS)) {
      if (!storeName) continue;
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      const items = JSON.parse(raw) as { id: string }[];
      if (!Array.isArray(items) || items.length === 0) continue;
      const db = await getDb();
      const tx = db.transaction(storeName, "readwrite");
      for (const item of items) {
        // non tocca updatedAt/createdAt esistenti: preserva la cronologia originale
        await tx.store.put(item as never);
      }
      await tx.done;
    }

    // store a chiave-veicolo singola
    await migrateVehicleKeyedStore("diario-auto:obd-profiles", "obdProfiles");
    await migrateVehicleKeyedStore("diario-auto:commute-settings", "commuteSettings");
    await migrateVehicleKeyedStore("diario-auto:home-charging-defaults", "homeChargingDefaults");

    const lastBackup = localStorage.getItem("diario-auto:last-backup");
    if (lastBackup) await setMeta("last-backup", lastBackup);

    await setMeta(MIGRATION_FLAG_KEY, "true");
  } catch (err) {
    // se la migrazione fallisce a metà, NON marchiamo il flag come completato:
    // ci si riprova al prossimo avvio invece di perdere silenziosamente dati
    console.error("Migrazione da localStorage a IndexedDB non riuscita, verrà ritentata al prossimo avvio.", err);
  }
}

async function migrateVehicleKeyedStore(
  lsKey: string,
  storeName: "obdProfiles" | "commuteSettings" | "homeChargingDefaults",
): Promise<void> {
  const raw = localStorage.getItem(lsKey);
  if (!raw) return;
  const items = JSON.parse(raw) as { vehicleId: string }[];
  if (!Array.isArray(items)) return;
  const db = await getDb();
  const tx = db.transaction(storeName, "readwrite");
  for (const item of items) {
    await tx.store.put(item as never);
  }
  await tx.done;
}
