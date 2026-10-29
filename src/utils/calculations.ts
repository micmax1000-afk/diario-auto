import type { FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry, FuelSource, FuelType } from "../types";

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
 * Metodo standard "da pieno a pieno": il pieno precedente segna il punto di
 * partenza; il carburante consumato per percorrere la distanza è quello
 * versato in tutti i rifornimenti successivi fino al pieno attuale compreso
 * (anche i parziali fatti in mezzo, altrimenti il consumo risulterebbe più
 * basso del reale).
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
    let prevFull: FuelEntry | null = null;
    let liters = 0;
    let cost = 0;
    for (const curr of list) {
      if (!prevFull) {
        if (curr.fullTank) prevFull = curr;
        continue;
      }
      liters += curr.liters;
      cost += curr.totalCost;
      if (!curr.fullTank) continue;

      const distance = curr.km - prevFull.km;
      if (distance > 0 && liters > 0) {
        points.push({
          fromKm: prevFull.km,
          toKm: curr.km,
          date: curr.date,
          liters,
          kmPerLiter: distance / liters,
          litersPer100Km: (liters / distance) * 100,
          source,
          costPerKm: cost / distance,
        });
      }
      prevFull = curr;
      liters = 0;
      cost = 0;
    }
  }

  return points.sort((a, b) => a.toKm - b.toKm);
}

export interface ElectricConsumptionPoint {
  fromKm: number;
  toKm: number;
  date: string;
  kWh: number;
}

/**
 * Consumo delle elettriche tra una ricarica e la successiva: l'energia
 * caricata a una ricarica è quella usata dalla ricarica precedente.
 */
export function calculateElectricConsumption(entries: ChargingEntry[]): ElectricConsumptionPoint[] {
  const sorted = [...entries].filter((e) => e.kWh > 0).sort((a, b) => a.km - b.km);
  const points: ElectricConsumptionPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const distance = sorted[i].km - sorted[i - 1].km;
    if (distance > 0) points.push({ fromKm: sorted[i - 1].km, toKm: sorted[i].km, date: sorted[i].date, kWh: sorted[i].kWh });
  }
  return points;
}

/** kWh ogni 100 km (null senza dati). */
export function averageElectricConsumption(points: ElectricConsumptionPoint[]): number | null {
  const distance = points.reduce((sum, p) => sum + (p.toKm - p.fromKm), 0);
  if (distance <= 0) return null;
  return (points.reduce((sum, p) => sum + p.kWh, 0) / distance) * 100;
}

/**
 * Alimentazione su cui calcolare il consumo "principale" di un veicolo.
 * Le auto a GPL o metano fanno anche qualche pieno di benzina: mescolare i
 * litri delle due alimentazioni darebbe un numero senza senso, quindi si usa
 * solo il GPL (o il metano). Per le altre nessun filtro.
 */
export function mainFuelSource(fuelType: FuelType | undefined): FuelSource | undefined {
  return fuelType === "gpl" || fuelType === "metano" ? fuelType : undefined;
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

export function groupByMonth<T>(entries: T[], getDate: (e: T) => string, locale = "it-IT"): MonthGroup<T>[] {
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
      label: d.toLocaleDateString(locale, { month: "long", year: "numeric" }),
      entries: groupEntries,
    };
  });
  return groups.sort((a, b) => b.key.localeCompare(a.key));
}
