// Catalogo di scadenze/manutenzioni comuni con intervalli tipici suggeriti.
// Sono valori orientativi generici (non specifici per marca/modello): l'utente
// può sempre modificarli prima di salvare. Le etichette visualizzate vivono
// nelle traduzioni sotto la chiave reminderCatalog.<key>.

export interface CatalogEntry {
  key: string;
  months?: number;
  km?: number;
  recurring?: boolean; // se true, il promemoria si può impostare per rigenerarsi da solo al completamento
}

export const REMINDER_CATALOG: CatalogEntry[] = [
  { key: "oilFilter", months: 12, km: 20000, recurring: true },
  { key: "periodicService", months: 12, km: 15000, recurring: true },
  { key: "seasonalTires", months: 6, recurring: true },
  { key: "cabinFilter", months: 24, km: 30000, recurring: true },
  { key: "airFilter", months: 24, km: 30000, recurring: true },
  { key: "brakeFluid", months: 24, recurring: true },
  { key: "sparkPlugs", months: 48, km: 60000, recurring: true },
  { key: "timingBelt", months: 60, km: 90000, recurring: true },
  { key: "fuelFilter", months: 60, km: 80000, recurring: true },
  { key: "roadTax", months: 12, recurring: true },
  { key: "insurance", months: 12, recurring: true },
  { key: "inspection", months: 24, recurring: true },
  { key: "lpgSticker", months: 48, recurring: true },
  { key: "coolant", months: 24, recurring: true },
  { key: "battery", months: 48 },
];

/** Calcola data e km di scadenza a partire da oggi/km attuale e un intervallo del catalogo. */
export function computeDueFromCatalog(
  entry: CatalogEntry,
  currentKm: number,
): { dueDate?: string; dueKm?: number } {
  const result: { dueDate?: string; dueKm?: number } = {};
  if (entry.months) {
    const due = new Date();
    due.setMonth(due.getMonth() + entry.months);
    result.dueDate = due.toISOString().slice(0, 10);
  }
  if (entry.km) {
    result.dueKm = currentKm + entry.km;
  }
  return result;
}
