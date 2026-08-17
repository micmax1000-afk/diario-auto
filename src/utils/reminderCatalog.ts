// Catalogo di scadenze/manutenzioni comuni con intervalli tipici suggeriti.
// Sono valori orientativi generici (non specifici per marca/modello): l'utente
// può sempre modificarli prima di salvare.

export interface CatalogEntry {
  label: string;
  months?: number;
  km?: number;
  recurring?: boolean; // se true, il promemoria si può impostare per rigenerarsi da solo al completamento
}

export const REMINDER_CATALOG: CatalogEntry[] = [
  { label: "Olio con filtro", months: 12, km: 20000, recurring: true },
  { label: "Manutenzione periodica (tagliando)", months: 12, km: 15000, recurring: true },
  { label: "Cambio pneumatici stagionali", months: 6, recurring: true },
  { label: "Filtro abitacolo", months: 24, km: 30000, recurring: true },
  { label: "Filtro aria motore", months: 24, km: 30000, recurring: true },
  { label: "Liquido dei freni", months: 24, recurring: true },
  { label: "Candele di accensione", months: 48, km: 60000, recurring: true },
  { label: "Cinghia di distribuzione", months: 60, km: 90000, recurring: true },
  { label: "Filtro del carburante", months: 60, km: 80000, recurring: true },
  { label: "Bollo auto", months: 12, recurring: true },
  { label: "Assicurazione", months: 12, recurring: true },
  { label: "Revisione", months: 24, recurring: true },
  { label: "Bollino GPL", months: 48, recurring: true },
  { label: "Liquido antigelo", months: 24, recurring: true },
  { label: "Batteria", months: 48 },
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
