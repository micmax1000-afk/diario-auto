export type FuelType = "benzina" | "diesel" | "gpl" | "metano" | "elettrico" | "ibrido";

// ---------- Campi di sincronizzazione (base per cloud sync futuro) ----------
// Ogni entità li eredita in modo opzionale e additivo: il codice esistente che
// non li imposta continua a funzionare, ma la struttura è già pronta per la
// sincronizzazione bidirezionale (last-write-wins su updatedAt, soft-delete
// tramite deletedAt invece di rimuovere fisicamente il record).
export interface SyncFields {
  createdAt?: string; // ISO date, quando il record è stato creato la prima volta
  updatedAt?: string; // ISO date, ultima modifica: usato per risolvere i conflitti di sync
  deletedAt?: string; // ISO date, soft-delete: se presente il record è "cancellato" ma non rimosso fisicamente
}

export type BodyType = "citycar" | "hatchback" | "sedan" | "suv" | "pickup" | "van" | "coupe" | "wagon";

export interface Vehicle extends SyncFields {
  id: string;
  name: string; // nome scelto dall'utente per il veicolo
  plate?: string; // targa
  fuelType: FuelType;
  currentKm: number;
  year?: number;
  notes?: string;
  bodyType?: BodyType; // categoria di carrozzeria, per l'icona mostrata nelle card
  createdAt: string; // ISO date
  archived?: boolean; // true = venduto/non più posseduto, ma dati mantenuti nello storico
  archivedAt?: string; // ISO date
}

// Per veicoli benzina/GPL/metano bifuel: traccia quale alimentazione è stata usata
export type FuelSource = "benzina" | "diesel" | "gpl" | "metano" | "elettrico";

export interface FuelEntry extends SyncFields {
  id: string;
  vehicleId: string;
  date: string; // ISO date
  km: number; // km al momento del rifornimento
  liters: number; // litri (o kWh per elettrico)
  totalCost: number; // euro
  source: FuelSource; // alimentazione usata in questo rifornimento
  fullTank: boolean; // pieno o parziale (serve per calcolo consumo affidabile)
  notes?: string;
}

export interface ChargingEntry extends SyncFields {
  id: string;
  vehicleId: string;
  date: string; // ISO date
  km: number; // km al momento della ricarica
  kWh: number; // energia caricata
  pricePerKWh: number; // euro per kWh
  totalCost: number; // euro
  powerKW?: number; // potenza della colonnina/wallbox, informativa
  atHome?: boolean; // ricarica domestica (wallbox/presa di casa)
  location?: string; // nome/indirizzo colonnina, se scelta dalla mappa
  notes?: string;
}

export type MaintenanceCategory =
  | "tagliando"
  | "gomme"
  | "freni"
  | "olio"
  | "batteria"
  | "raffreddamento"
  | "software"
  | "carrozzeria"
  | "revisione"
  | "altro";

export interface MaintenanceEntry extends SyncFields {
  id: string;
  vehicleId: string;
  date: string; // ISO date
  km: number;
  category: MaintenanceCategory;
  description: string;
  cost: number; // euro, totale (= partsCost + laborCost se entrambi presenti, altrimenti inserito manualmente)
  partsCost?: number; // euro, solo ricambi
  laborCost?: number; // euro, solo manodopera
  workshop?: string; // officina
  notes?: string;
  photo?: string; // immagine allegata, come data URL già compressa lato client
}

// ---------- Spese (assicurazione, multe, tasse, documenti) ----------
// Tenute separate dalla manutenzione, come nelle app di riferimento: i costi di
// servizio/officina sono più interessanti da monitorare a parte da bollo/assicurazione/multe.

export type ExpenseCategory = "assicurazione" | "bollo" | "multa" | "documenti" | "altro";

export interface ExpenseEntry extends SyncFields {
  id: string;
  vehicleId: string;
  date: string; // ISO date
  category: ExpenseCategory;
  description: string;
  amount: number; // euro
  notes?: string;
  photo?: string; // immagine allegata (es. foto della bolletta), come data URL già compressa lato client
}

export type ReminderType = "data" | "km";

export interface Reminder extends SyncFields {
  id: string;
  vehicleId: string;
  label: string; // es. "Bollo", "Assicurazione", "Revisione", "Tagliando"
  type: ReminderType;
  dueDate?: string; // ISO date, se type === "data"
  dueKm?: number; // se type === "km"
  notes?: string;
  completed: boolean;
  repeatMonths?: number; // se impostato, al completamento si rigenera +N mesi
  repeatKm?: number; // se impostato, al completamento si rigenera +N km dal km attuale del veicolo
  catalogKey?: string; // chiave di REMINDER_CATALOG se creata dal catalogo, usata per le spie del cruscotto
}

// ---------- OBD2 / Live ----------

export interface LogSample {
  t: number; // millisecondi trascorsi dall'inizio della sessione
  rpm?: number;
  speedKmh?: number;
  coolantTempC?: number;
}

export interface LogSession extends SyncFields {
  id: string;
  vehicleId: string;
  startedAt: string; // ISO date
  durationMs: number;
  samples: LogSample[];
  maxRpm?: number;
  maxSpeedKmh?: number;
  maxCoolantTempC?: number;
}

export interface AlarmThresholds {
  maxRpm?: number;
  maxCoolantTempC?: number;
}

export interface ObdVehicleProfile extends SyncFields {
  vehicleId: string;
  protocol?: string; // es. "6" per ISO 15765-4 CAN, salvato con ATSP
  lastDeviceId?: string; // per il tentativo di riconnessione automatica
  alarms?: AlarmThresholds;
}

// ---------- Costo reale del tragitto ----------

export interface CommuteSettings extends SyncFields {
  vehicleId: string;
  kmPerTrip: number; // km di una singola tratta (es. andata casa-lavoro)
  tripsPerDay: number; // es. 2 = andata + ritorno
  workDaysPerWeek: number; // giorni lavorativi a settimana
  fuelPricePerLiter: number; // prezzo attuale al litro (o per kWh se elettrico), aggiornabile manualmente
  estimatedKmPerLiter?: number; // consumo stimato, usato finché non ci sono abbastanza rifornimenti per calcolare quello reale
}

// Scenario ipotetico per confrontare veicoli/alimentazioni alternative (es. GPL, elettrico)
export type CommuteFuelType = "benzina" | "diesel" | "gpl" | "elettrico" | "ibrido" | "ibrido_plugin";

export interface CommuteScenario extends SyncFields {
  id: string;
  vehicleId: string; // veicolo "di riferimento" a cui è associato il confronto (per km/giorni tratta)
  fuelType: CommuteFuelType;
  note?: string; // nota personale opzionale (es. "usata, 3 anni")
  kmPerUnit: number; // km percorribili con 1 litro (o 1 kWh)
  pricePerUnit: number; // prezzo di 1 litro (o 1 kWh)
  unit: "litro" | "kWh";
}
