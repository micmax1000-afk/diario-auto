import type { CommuteFuelType } from "../types";

/** Icona (emoji) di ogni tipo di scenario nel confronto del tragitto. */
export const SCENARIO_ICONS: Record<CommuteFuelType, string> = {
  elettrico: "⚡",
  gpl: "🔥",
  metano: "💨",
  ibrido: "🌿",
  ibrido_plugin: "🔌",
  benzina: "⛽",
  diesel: "⛽",
  mezzi: "🚆",
  carpooling: "👥",
  bici: "🚲",
};
