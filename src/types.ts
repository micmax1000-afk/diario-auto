export type FuelType = "benzina" | "diesel" | "gpl" | "metano" | "elettrico" | "ibrido";

export interface Vehicle {
  id: string;
  name: string; // es. "Fiat 500L"
  plate?: string; // targa
  fuelType: FuelType;
  currentKm: number;
  year?: number;
  notes?: string;
  createdAt: string; // ISO date
  archived?: boolean; // true = venduto/non più posseduto, ma dati mantenuti nello storico
  archivedAt?: string; // ISO date
}

// Per veicoli benzina/GPL/metano bifuel: traccia quale alimentazione è stata usata
export type FuelSource = "benzina" | "diesel" | "gpl" | "metano" | "elettrico";

export interface FuelEntry {
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

export type MaintenanceCategory =
  | "tagliando"
  | "gomme"
  | "freni"
  | "olio"
  | "batteria"
  | "carrozzeria"
  | "revisione"
  | "altro";

export interface MaintenanceEntry {
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

export interface ExpenseEntry {
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

export interface Reminder {
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
}

// ---------- OBD2 / Live ----------

export interface LogSample {
  t: number; // millisecondi trascorsi dall'inizio della sessione
  rpm?: number;
  speedKmh?: number;
  coolantTempC?: number;
}

export interface LogSession {
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

export interface ObdVehicleProfile {
  vehicleId: string;
  protocol?: string; // es. "6" per ISO 15765-4 CAN, salvato con ATSP
  lastDeviceId?: string; // per il tentativo di riconnessione automatica
  alarms?: AlarmThresholds;
}

// ---------- Costo reale del tragitto ----------

export interface CommuteSettings {
  vehicleId: string;
  kmPerTrip: number; // km di una singola tratta (es. andata casa-lavoro)
  tripsPerDay: number; // es. 2 = andata + ritorno
  workDaysPerWeek: number; // giorni lavorativi a settimana
  fuelPricePerLiter: number; // prezzo attuale al litro (o per kWh se elettrico), aggiornabile manualmente
}

// Scenario ipotetico per confrontare veicoli/alimentazioni alternative (es. GPL, elettrico)
export interface CommuteScenario {
  id: string;
  vehicleId: string; // veicolo "di riferimento" a cui è associato il confronto (per km/giorni tratta)
  label: string; // es. "Dacia Sandero GPL", "Renault Zoe"
  kmPerUnit: number; // km percorribili con 1 litro (o 1 kWh)
  pricePerUnit: number; // prezzo di 1 litro (o 1 kWh)
  unit: "litro" | "kWh";
}
