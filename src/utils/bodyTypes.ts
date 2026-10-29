import type { BodyType } from "../types";

export const BODY_TYPES: BodyType[] = ["citycar", "hatchback", "sedan", "wagon", "suv", "van", "coupe", "convertible", "pickup"];

/** Schiarisce (amt > 0) o scurisce (amt < 0) un colore esadecimale. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (c: number) => Math.round((target - c) * p + c);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
