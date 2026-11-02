import type { FuelEntry, FuelSource } from "../types";

export type EntryWarning =
  | { kind: "priceOff"; price: number; usual: number }
  | { kind: "priceOdd"; price: number }
  | { kind: "litersHigh"; liters: number }
  | { kind: "kmJump"; distance: number };

// Prezzi plausibili per unità (€/l, €/kg per il metano): fuori da qui è quasi certamente un errore di battitura.
const PRICE_RANGE: Record<string, [number, number]> = { gpl: [0.4, 1.6], metano: [0.7, 3.5] };
const DEFAULT_RANGE: [number, number] = [0.9, 3.2];

/**
 * Controlli prima di salvare un rifornimento: non bloccano, chiedono conferma.
 * Confrontano con i rifornimenti passati dello stesso veicolo (prezzo medio recente,
 * litri massimi, km dall'ultimo).
 */
export function checkFuelEntry(
  entry: { pricePerUnit: number; liters: number; km: number; source: FuelSource },
  previous: FuelEntry[],
): EntryWarning[] {
  const out: EntryWarning[] = [];
  const same = previous.filter((e) => e.source === entry.source && e.liters > 0).sort((a, b) => b.date.localeCompare(a.date));
  const recent = same.slice(0, 5).map((e) => e.totalCost / e.liters);
  const usual = recent.length >= 2 ? recent.reduce((s, p) => s + p, 0) / recent.length : null;
  const [lo, hi] = PRICE_RANGE[entry.source] ?? DEFAULT_RANGE;
  if (entry.pricePerUnit < lo || entry.pricePerUnit > hi) out.push({ kind: "priceOdd", price: entry.pricePerUnit });
  else if (usual && Math.abs(entry.pricePerUnit - usual) / usual > 0.3) out.push({ kind: "priceOff", price: entry.pricePerUnit, usual });

  const maxLiters = Math.max(0, ...same.map((e) => e.liters));
  if (entry.liters > Math.max(90, maxLiters * 1.5)) out.push({ kind: "litersHigh", liters: entry.liters });

  const lastKm = Math.max(0, ...previous.map((e) => e.km));
  if (lastKm > 0 && entry.km - lastKm > 2500) out.push({ kind: "kmJump", distance: entry.km - lastKm });
  return out;
}
