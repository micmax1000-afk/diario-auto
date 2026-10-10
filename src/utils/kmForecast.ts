import type { Reminder } from "../types";
import { isReminderDue } from "./calculations";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface KmReading {
  date: string; // ISO
  km: number;
}

/**
 * Km percorsi in media al giorno, dalle letture degli ultimi 12 mesi
 * (rifornimenti, ricariche, manutenzioni). null se i dati non bastano:
 * servono almeno due letture a distanza di almeno 14 giorni.
 */
export function estimateKmPerDay(readings: KmReading[], now: number = Date.now()): number | null {
  const recent = readings
    .map((r) => ({ t: new Date(r.date).getTime(), km: r.km }))
    .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.km) && r.t <= now && now - r.t <= 365 * DAY_MS)
    .sort((a, b) => a.t - b.t);
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const days = (last.t - first.t) / DAY_MS;
  const km = Math.max(...recent.map((r) => r.km)) - first.km;
  if (days < 14 || km <= 0) return null;
  return km / days;
}

/** Data stimata in cui si raggiungono i km della scadenza; null se non stimabile o già superata. */
export function estimateDateForKm(dueKm: number, currentKm: number, kmPerDay: number | null | undefined, now: number = Date.now()): Date | null {
  if (!kmPerDay || kmPerDay <= 0) return null;
  const remaining = dueKm - currentKm;
  if (remaining <= 0) return null;
  return new Date(now + (remaining / kmPerDay) * DAY_MS);
}

// Km al giorno per veicolo, ricalcolati dall'app quando cambiano i dati: così
// lo stato delle scadenze a km è lo stesso in home, liste, notifiche.
let kmPerDayByVehicle = new Map<string, number>();

export function setKmPerDayRates(rates: Map<string, number>): void {
  kmPerDayByVehicle = rates;
}

export function getKmPerDay(vehicleId: string): number | null {
  return kmPerDayByVehicle.get(vehicleId) ?? null;
}

/**
 * Stato di una scadenza: come isReminderDue, in più una scadenza a km
 * diventa "in arrivo" anche quando, al ritmo di guida attuale, si
 * raggiungerà entro 30 giorni (chi fa molti km lo sa prima dei 1000 km).
 */
export function reminderStatus(r: Pick<Reminder, "vehicleId" | "dueDate" | "dueKm">, currentKm: number): "overdue" | "soon" | "ok" {
  const status = isReminderDue(r.dueDate, r.dueKm, currentKm);
  if (status !== "ok" || r.dueKm === undefined) return status;
  const estimated = estimateDateForKm(r.dueKm, currentKm, getKmPerDay(r.vehicleId));
  if (estimated && estimated.getTime() - Date.now() <= 30 * DAY_MS) return "soon";
  return status;
}
