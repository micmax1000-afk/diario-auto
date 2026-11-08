import type { BodyType, CarColor, Vehicle } from "../types";

// Ogni carrozzeria esiste in più colori: "<carrozzeria>-<colore>.webp" (già scontornata).
const FILES = import.meta.glob<string>("../assets/cars/*.webp", { eager: true, import: "default" });

/** Colore di partenza (e di chi non ne ha mai scelto uno): grigio scuro. */
export const DEFAULT_CAR_COLOR: CarColor = "grigio";

/** Colori neutri, disponibili per tutte le carrozzerie. */
export const NEUTRAL_CAR_COLORS: CarColor[] = ["bianco", "argento", "grigio", "nero"];
/** Colori vivaci, disponibili solo per le carrozzerie che hanno la vernice adatta. */
export const VIVID_CAR_COLORS: CarColor[] = ["rosso", "arancione", "giallo", "verde", "blu", "viola"];
const VIVID_BODIES: BodyType[] = ["citycar", "convertible", "coupe", "mpv", "sedan", "suvlarge"];

/** Colori tra cui scegliere per una carrozzeria. */
export function availableCarColors(body: BodyType): CarColor[] {
  return VIVID_BODIES.includes(body) ? [...NEUTRAL_CAR_COLORS, ...VIVID_CAR_COLORS] : NEUTRAL_CAR_COLORS;
}

/** Il colore scelto, se la carrozzeria lo ha; altrimenti il grigio scuro. */
export function resolveCarColor(body: BodyType, color: CarColor | undefined): CarColor {
  return color && availableCarColors(body).includes(color) ? color : DEFAULT_CAR_COLOR;
}

/** Immagine di una carrozzeria nel colore scelto (grigio scuro se non indicato). */
export function carImage(body: BodyType, color?: CarColor): string {
  return FILES[`../assets/cars/${body}-${resolveCarColor(body, color)}.webp`];
}

/** Cosa mostrare per un veicolo: la sua foto, altrimenti l'immagine del tipo scelto, altrimenti niente. */
export function vehicleVisual(v: Pick<Vehicle, "photo" | "bodyType" | "carColor">): { src: string; isPhoto: boolean } | null {
  if (v.photo) return { src: v.photo, isPhoto: true };
  if (v.bodyType) {
    const src = carImage(v.bodyType, v.carColor);
    if (src) return { src, isPhoto: false };
  }
  return null;
}
