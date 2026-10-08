import type { Vehicle } from "../types";

// Palette di colori identificativi dei veicoli (leggibili su sfondo scuro e chiaro).
export const VEHICLE_COLORS = [
  "#4f9dff", // blu
  "#e8b923", // giallo
  "#2fc58c", // verde
  "#c084fc", // viola
  "#ff7a59", // arancio
  "#22c7d6", // azzurro
  "#f06292", // rosa
  "#9aa7b4", // grigio
];

/**
 * Colore di ogni veicolo: quello scelto dall'utente, altrimenti il primo della
 * palette non ancora usato, assegnando in ordine di creazione. Così il colore è
 * stabile (non cambia se riordini i veicoli) e non serve migrare i dati vecchi.
 */
export function resolveVehicleColors(vehicles: Vehicle[]): Record<string, string> {
  const result: Record<string, string> = {};
  const used = new Set<string>();
  for (const v of vehicles) {
    if (v.color) {
      result[v.id] = v.color;
      used.add(v.color.toLowerCase());
    }
  }
  const pending = vehicles
    .filter((v) => !v.color)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") || a.id.localeCompare(b.id));
  let cursor = 0;
  for (const v of pending) {
    let pick = VEHICLE_COLORS.find((c) => !used.has(c.toLowerCase()));
    if (!pick) {
      pick = VEHICLE_COLORS[cursor % VEHICLE_COLORS.length];
      cursor += 1;
    }
    result[v.id] = pick;
    used.add(pick.toLowerCase());
  }
  return result;
}
