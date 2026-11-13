import type { FuelSource, FuelType, Vehicle } from "../types";

/** Doppie alimentazioni possibili (primo carburante + secondo). Le ibride e le plug-in restano "Ibrido". */
export const FUEL_COMBOS: { first: FuelSource; second: FuelSource }[] = [
  { first: "benzina", second: "gpl" },
  { first: "benzina", second: "metano" },
  { first: "diesel", second: "gpl" },
  { first: "diesel", second: "metano" },
];

export const comboValue = (c: { first: FuelSource; second: FuelSource }) => `${c.first}+${c.second}`;

/** Valore del menu "Alimentazione" per un veicolo: "benzina" oppure "benzina+gpl". */
export function fuelSelectValue(fuelType: FuelType, secondFuel?: FuelSource): string {
  return secondFuel && FUEL_COMBOS.some((c) => c.first === fuelType && c.second === secondFuel) ? `${fuelType}+${secondFuel}` : fuelType;
}

/** Dal valore del menu al tipo di alimentazione e al secondo carburante. */
export function parseFuelSelect(value: string): { fuelType: FuelType; secondFuel?: FuelSource } {
  const [first, second] = value.split("+");
  return { fuelType: first as FuelType, ...(second ? { secondFuel: second as FuelSource } : {}) };
}

/** Testo da mostrare: "Benzina" oppure "Benzina + GPL". */
export function fuelLabel(t: (key: string) => string, v: Pick<Vehicle, "fuelType" | "secondFuel">): string {
  return v.secondFuel ? `${t(`fuelType.${v.fuelType}`)} + ${t(`fuelType.${v.secondFuel}`)}` : t(`fuelType.${v.fuelType}`);
}

/** Il carburante da proporre per primo: l'ultimo usato tra i due, altrimenti il principale. */
export function defaultBifuelSource(v: Pick<Vehicle, "fuelType" | "secondFuel">, entries: { source: FuelSource; date: string }[]): FuelSource {
  const pair: FuelSource[] = [v.fuelType as FuelSource, ...(v.secondFuel ? [v.secondFuel] : [])];
  const last = [...entries].filter((e) => pair.includes(e.source)).sort((a, b) => b.date.localeCompare(a.date))[0];
  return last?.source ?? (v.fuelType as FuelSource);
}
