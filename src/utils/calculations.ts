import type { FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry, FuelSource } from "../types";

export interface ConsumptionPoint {
  fromKm: number;
  toKm: number;
  date: string;
  liters: number;
  kmPerLiter: number;
  litersPer100Km: number;
  source: FuelSource;
  costPerKm: number;
}

/**
 * Calcola il consumo tra rifornimenti "pieno" consecutivi con la stessa alimentazione.
 * Il consumo tra il pieno N-1 e il pieno N usa i litri versati AL pieno N
 * (metodo standard: il pieno precedente segna il punto di partenza, il litraggio
 * del pieno successivo rappresenta quanto consumato per percorrere la distanza).
 */
export function calculateConsumption(entries: FuelEntry[]): ConsumptionPoint[] {
  const sorted = [...entries].sort((a, b) => a.km - b.km);
  const points: ConsumptionPoint[] = [];

  // raggruppa per fonte energetica, perché il consumo va confrontato entro la stessa alimentazione
  const bySource = new Map<FuelSource, FuelEntry[]>();
  for (const e of sorted) {
    if (!bySource.has(e.source)) bySource.set(e.source, []);
    bySource.get(e.source)!.push(e);
  }

  for (const [source, list] of bySource) {
    const fullTanks = list.filter((e) => e.fullTank);
    for (let i = 1; i < fullTanks.length; i++) {
      const prev = fullTanks[i - 1];
      const curr = fullTanks[i];
      const distance = curr.km - prev.km;
      if (distance <= 0) continue;
      const kmPerLiter = distance / curr.liters;
      const litersPer100Km = (curr.liters / distance) * 100;
      const costPerKm = curr.totalCost / distance;
      points.push({
        fromKm: prev.km,
        toKm: curr.km,
        date: curr.date,
        liters: curr.liters,
        kmPerLiter,
        litersPer100Km,
        source,
        costPerKm,
      });
    }
  }

  return points.sort((a, b) => a.toKm - b.toKm);
}

export function averageConsumption(points: ConsumptionPoint[], source?: FuelSource): number | null {
  const filtered = source ? points.filter((p) => p.source === source) : points;
  if (filtered.length === 0) return null;
  const totalDistance = filtered.reduce((sum, p) => sum + (p.toKm - p.fromKm), 0);
  const totalLiters = filtered.reduce((sum, p) => sum + p.liters, 0);
  if (totalLiters === 0) return null;
  return totalDistance / totalLiters;
}

export interface VehicleCostSummary {
  fuelCost: number;
  chargingCost: number;
  maintenanceCost: number;
  expensesCost: number;
  totalCost: number;
  totalKm: number;
  costPerKm: number | null;
}

export function calculateVehicleCosts(
  fuelEntries: FuelEntry[],
  maintenanceEntries: MaintenanceEntry[],
  currentKm: number,
  expenseEntries: ExpenseEntry[] = [],
  chargingEntries: ChargingEntry[] = [],
): VehicleCostSummary {
  const fuelCost = fuelEntries.reduce((sum, e) => sum + e.totalCost, 0);
  const chargingCost = chargingEntries.reduce((sum, e) => sum + e.totalCost, 0);
  const maintenanceCost = maintenanceEntries.reduce((sum, e) => sum + e.cost, 0);
  const expensesCost = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalCost = fuelCost + chargingCost + maintenanceCost + expensesCost;

  const allKm = [
    ...fuelEntries.map((e) => e.km),
    ...maintenanceEntries.map((e) => e.km),
    ...chargingEntries.map((e) => e.km),
  ];
  const minKm = allKm.length > 0 ? Math.min(...allKm) : currentKm;
  const totalKm = Math.max(currentKm - minKm, 0);

  return {
    fuelCost,
    chargingCost,
    maintenanceCost,
    expensesCost,
    totalCost,
    totalKm,
    costPerKm: totalKm > 0 ? totalCost / totalKm : null,
  };
}

export interface CommuteCostResult {
  costPerTrip: number;
  costPerDay: number;
  costPerWeek: number;
  costPerMonth: number;
}

/**
 * Calcola il costo del tragitto casa-lavoro dato il consumo (km percorribili
 * con 1 litro/kWh) e il prezzo per litro/kWh. Usato sia per il costo reale
 * (consumo medio calcolato dai rifornimenti) sia per gli scenari ipotetici
 * (consumo dichiarato per un veicolo alternativo).
 */
export function calculateCommuteCost(
  kmPerTrip: number,
  tripsPerDay: number,
  workDaysPerWeek: number,
  kmPerUnit: number,
  pricePerUnit: number,
): CommuteCostResult | null {
  if (kmPerTrip <= 0 || kmPerUnit <= 0 || pricePerUnit < 0) return null;
  const costPerKm = pricePerUnit / kmPerUnit;
  const costPerTrip = kmPerTrip * costPerKm;
  const costPerDay = costPerTrip * tripsPerDay;
  const costPerWeek = costPerDay * workDaysPerWeek;
  const costPerMonth = costPerWeek * (52 / 12); // media settimane/mese
  return { costPerTrip, costPerDay, costPerWeek, costPerMonth };
}

export function isReminderDue(dueDate?: string, dueKm?: number, currentKm?: number, warningDays = 30, warningKm = 1000): "overdue" | "soon" | "ok" {
  let status: "overdue" | "soon" | "ok" = "ok";

  if (dueDate) {
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const diffDays = (due - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) status = "overdue";
    else if (diffDays <= warningDays) status = "soon";
  }

  if (dueKm !== undefined && currentKm !== undefined) {
    const diffKm = dueKm - currentKm;
    if (diffKm < 0) status = "overdue";
    else if (diffKm <= warningKm && status === "ok") status = "soon";
  }

  return status;
}

// ---------- Raggruppamento mensile (liste rifornimenti/ricarica) ----------

export interface MonthGroup<T> {
  key: string; // "2026-08"
  label: string; // "Agosto 2026"
  entries: T[];
}

export function groupByMonth<T>(entries: T[], getDate: (e: T) => string): MonthGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const entry of entries) {
    const d = new Date(getDate(entry));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  const groups = Array.from(map.entries()).map(([key, groupEntries]) => {
    const [year, month] = key.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return {
      key,
      label: d.toLocaleDateString("it-IT", { month: "long", year: "numeric" }),
      entries: groupEntries,
    };
  });
  return groups.sort((a, b) => b.key.localeCompare(a.key));
}
