// Calcoli del costo del tragitto casa-lavoro: costo annuo con pedaggi,
// parcheggio e altre spese, scenari di confronto (altra auto, car pooling,
// mezzi pubblici, bici) e prezzo del carburante preso dagli ultimi rifornimenti.

import type {
  ChargingEntry,
  CommuteCarFuelType,
  CommuteFuelType,
  CommuteScenario,
  CommuteSettings,
  ExpenseEntry,
  FuelEntry,
  FuelSource,
  MaintenanceEntry,
} from "../types";

export const DEFAULT_WEEKS_PER_YEAR = 46;

type CommuteRoute = Pick<CommuteSettings, "kmPerTrip" | "tripsPerDay" | "workDaysPerWeek" | "weeksPerYear">;
type CommuteExtras = Pick<CommuteSettings, "tollPerDay" | "parkingPerDay" | "otherPerMonth">;

export function weeksPerYear(s: Pick<CommuteSettings, "weeksPerYear">): number {
  return s.weeksPerYear && s.weeksPerYear > 0 ? s.weeksPerYear : DEFAULT_WEEKS_PER_YEAR;
}

export function commuteDaysPerYear(s: CommuteRoute): number {
  return s.workDaysPerWeek * weeksPerYear(s);
}

export function commuteKmPerYear(s: CommuteRoute): number {
  return s.kmPerTrip * s.tripsPerDay * commuteDaysPerYear(s);
}

export interface CommuteYearCost {
  fuel: number; // carburante o energia
  toll: number;
  parking: number;
  other: number;
  total: number;
}

/** Costo annuo del tragitto con un'auto che fa kmPerUnit km con 1 litro/kWh/kg a pricePerUnit. */
export function commuteYearCost(
  s: CommuteRoute & CommuteExtras,
  kmPerUnit: number,
  pricePerUnit: number,
): CommuteYearCost | null {
  if (s.kmPerTrip <= 0 || s.tripsPerDay <= 0 || s.workDaysPerWeek <= 0 || kmPerUnit <= 0 || pricePerUnit < 0) return null;
  const days = commuteDaysPerYear(s);
  const fuel = (commuteKmPerYear(s) / kmPerUnit) * pricePerUnit;
  const toll = (s.tollPerDay ?? 0) * days;
  const parking = (s.parkingPerDay ?? 0) * days;
  const other = (s.otherPerMonth ?? 0) * 12;
  return { fuel, toll, parking, other, total: fuel + toll + parking + other };
}

export interface CommutePeriods {
  perTrip: number;
  perDay: number;
  perWeek: number;
  perMonth: number;
  perYear: number;
}

/** Ripartisce un costo annuo su tratta, giorno di lavoro, settimana e mese. */
export function commutePeriods(yearTotal: number, s: CommuteRoute): CommutePeriods {
  const days = commuteDaysPerYear(s);
  const perDay = days > 0 ? yearTotal / days : 0;
  return {
    perTrip: s.tripsPerDay > 0 ? perDay / s.tripsPerDay : 0,
    perDay,
    perWeek: perDay * s.workDaysPerWeek,
    perMonth: yearTotal / 12,
    perYear: yearTotal,
  };
}

const CAR_TYPES: readonly CommuteFuelType[] = ["benzina", "diesel", "gpl", "metano", "elettrico", "ibrido", "ibrido_plugin"];

export function isCarScenario(type: CommuteFuelType): type is CommuteCarFuelType {
  return CAR_TYPES.includes(type);
}

/**
 * Costo annuo di uno scenario, solo viaggio.
 * - Altra auto: stesso percorso, stessi pedaggi e parcheggio, carburante diverso.
 * - Car pooling: il costo dell'auto attuale diviso per le persone a bordo.
 * - Mezzi pubblici, bici: il costo mensile (abbonamento, noleggio...).
 */
export function scenarioYearCost(
  scenario: CommuteScenario,
  settings: CommuteRoute & CommuteExtras,
  current: CommuteYearCost | null,
): number | null {
  if (isCarScenario(scenario.fuelType)) {
    return commuteYearCost(settings, scenario.kmPerUnit, scenario.pricePerUnit)?.total ?? null;
  }
  if (scenario.fuelType === "carpooling") {
    return current ? current.total / Math.max(scenario.people ?? 2, 1) : null;
  }
  return Math.max(scenario.monthlyCost ?? 0, 0) * 12;
}

/** Anni per rientrare della differenza di prezzo dell'auto (null se non si risparmia). */
export function paybackYears(priceDifference: number | undefined, yearlySaving: number): number | null {
  if (!priceDifference || priceDifference <= 0 || yearlySaving <= 0) return null;
  return priceDifference / yearlySaving;
}

/** Ore in più all'anno con uno scenario più lento dell'auto. */
export function extraHoursPerYear(minutesPerTrip: number | undefined, s: CommuteRoute): number {
  if (!minutesPerTrip || minutesPerTrip <= 0) return 0;
  return (minutesPerTrip * s.tripsPerDay * commuteDaysPerYear(s)) / 60;
}

export interface AutoPrice {
  price: number;
  date: string; // ISO, rifornimento/ricarica più recente usato
}

/**
 * Prezzo al litro dell'ultimo rifornimento (dell'alimentazione indicata, o di
 * qualunque alimentazione non elettrica).
 */
export function latestFuelPrice(entries: FuelEntry[], source?: FuelSource): AutoPrice | null {
  const latest = entries
    .filter((e) => e.liters > 0 && e.totalCost > 0 && (source ? e.source === source : e.source !== "elettrico"))
    .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)[0];
  return latest ? { price: latest.totalCost / latest.liters, date: latest.date } : null;
}

/**
 * Prezzo medio per kWh delle ultime ricariche: casa e colonnina hanno prezzi
 * molto diversi, quindi una sola ricarica direbbe poco.
 */
export function latestChargingPrice(entries: ChargingEntry[], count = 5): AutoPrice | null {
  const recent = entries
    .filter((e) => e.kWh > 0 && e.totalCost >= 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)
    .slice(0, count);
  const kWh = recent.reduce((sum, e) => sum + e.kWh, 0);
  const cost = recent.reduce((sum, e) => sum + e.totalCost, 0);
  if (recent.length === 0 || kWh <= 0 || cost <= 0) return null;
  return { price: cost / kWh, date: recent[0].date };
}

export interface FixedCosts {
  perYear: number;
  /** lastYear = spese degli ultimi 12 mesi; average = media annua di tutte le spese (nessuna negli ultimi 12 mesi). */
  basis: "lastYear" | "average" | "none";
}

/**
 * Spese dell'auto all'anno che non dipendono dal tragitto: manutenzioni,
 * assicurazione, bollo, documenti... (le multe no). Si usano quelle degli
 * ultimi 12 mesi; se non ce ne sono, la media annua di quelle registrate prima.
 */
export function fixedCostsPerYear(
  maintenance: MaintenanceEntry[],
  expenses: ExpenseEntry[],
  now = Date.now(),
): FixedCosts {
  const year = 365 * 24 * 60 * 60 * 1000;
  // Le date si salvano a mezzogiorno: conta tutto fino alla fine di oggi.
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const items = [
    ...maintenance.map((e) => ({ t: new Date(e.date).getTime(), amount: e.cost || 0 })),
    ...expenses.filter((e) => e.category !== "multa").map((e) => ({ t: new Date(e.date).getTime(), amount: e.amount || 0 })),
  ].filter((i) => i.amount > 0 && !Number.isNaN(i.t) && i.t <= endOfToday.getTime());

  const lastYear = items.filter((i) => i.t >= now - year).reduce((sum, i) => sum + i.amount, 0);
  if (lastYear > 0) return { perYear: lastYear, basis: "lastYear" };
  if (items.length === 0) return { perYear: 0, basis: "none" };
  const first = Math.min(...items.map((i) => i.t));
  const years = Math.max((now - first) / year, 1);
  return { perYear: items.reduce((sum, i) => sum + i.amount, 0) / years, basis: "average" };
}

export const SCENARIO_UNITS: Record<CommuteCarFuelType, CommuteScenario["unit"]> = {
  benzina: "litro",
  diesel: "litro",
  gpl: "litro",
  metano: "kg",
  elettrico: "kWh",
  ibrido: "litro",
  ibrido_plugin: "litro",
};

/**
 * Valori tipici per compilare subito uno scenario: consumo (km per unità) e,
 * solo per chi usa l'euro, un prezzo indicativo. Sono modificabili.
 */
export const SCENARIO_PRESETS: Record<CommuteCarFuelType, { kmPerUnit: number; priceEur: number }> = {
  benzina: { kmPerUnit: 15, priceEur: 1.8 },
  diesel: { kmPerUnit: 18, priceEur: 1.7 },
  gpl: { kmPerUnit: 12, priceEur: 0.72 },
  metano: { kmPerUnit: 20, priceEur: 1.4 },
  elettrico: { kmPerUnit: 100 / 16, priceEur: 0.3 },
  ibrido: { kmPerUnit: 22, priceEur: 1.8 },
  ibrido_plugin: { kmPerUnit: 30, priceEur: 1.8 },
};

export const TRANSIT_PRESET_EUR = { monthlyCost: 45, extraMinutesPerTrip: 20 };
