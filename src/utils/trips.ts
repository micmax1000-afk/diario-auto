import type { TripEntry } from "../types";
import { isoToLocalDate, localMonthString } from "./dates";
import { toCsvRow } from "./storage";

export type TripPeriod = "month" | "lastMonth" | "year" | "all";

/** Spese del viaggio da rimborsare (pedaggio, parcheggio, altro). */
export function tripExtras(trip: TripEntry): number {
  return (trip.toll ?? 0) + (trip.parking ?? 0) + (trip.otherCost ?? 0);
}

/** Rimborso di un viaggio di lavoro: km × tariffa più le spese. I viaggi privati non si rimborsano. */
export function tripRefund(trip: TripEntry, rate: number | null): number {
  if (!trip.work) return 0;
  return trip.distanceKm * (rate ?? 0) + tripExtras(trip);
}

/** Mese (AAAA-MM) di inizio e fine del periodo; null = nessun limite. */
function periodRange(period: TripPeriod, now: Date): [string, string] | null {
  const month = localMonthString(now);
  if (period === "month") return [month, month];
  if (period === "lastMonth") {
    const prev = localMonthString(new Date(now.getFullYear(), now.getMonth() - 1, 15));
    return [prev, prev];
  }
  if (period === "year") return [`${now.getFullYear()}-01`, `${now.getFullYear()}-12`];
  return null;
}

export function tripsInPeriod(trips: TripEntry[], period: TripPeriod, now = new Date()): TripEntry[] {
  const range = periodRange(period, now);
  return trips
    .filter((tr) => {
      if (!range) return true;
      const m = isoToLocalDate(tr.date).slice(0, 7);
      return m >= range[0] && m <= range[1];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface TripTotals {
  workKm: number;
  privateKm: number;
  extras: number;
  refund: number;
  workTrips: number;
}

export function tripTotals(trips: TripEntry[], rate: number | null): TripTotals {
  const work = trips.filter((tr) => tr.work);
  return {
    workKm: work.reduce((s, tr) => s + tr.distanceKm, 0),
    privateKm: trips.filter((tr) => !tr.work).reduce((s, tr) => s + tr.distanceKm, 0),
    extras: work.reduce((s, tr) => s + tripExtras(tr), 0),
    refund: work.reduce((s, tr) => s + tripRefund(tr, rate), 0),
    workTrips: work.length,
  };
}

const money = (n: number | undefined) => (n ? n.toFixed(2) : "");

/** CSV per il rimborso: una riga per viaggio di lavoro, con le spese in colonne separate. */
export function tripsToCsv(trips: TripEntry[], vehicleName: string, rate: number | null, labels: { [k: string]: string }): string {
  const header = toCsvRow([
    labels.date, labels.vehicle, labels.from, labels.to, labels.purpose, labels.km, labels.rate, labels.kmAmount,
    labels.toll, labels.parking, labels.other, labels.otherWhat, labels.total,
  ]);
  const rows = [...trips]
    .filter((tr) => tr.work)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((tr) =>
      toCsvRow([
        isoToLocalDate(tr.date), vehicleName, tr.from ?? "", tr.to ?? "", tr.purpose ?? "", tr.distanceKm,
        rate !== null ? rate.toFixed(2) : "", rate !== null ? (tr.distanceKm * rate).toFixed(2) : "",
        money(tr.toll), money(tr.parking), money(tr.otherCost), tr.otherWhat ?? "", tripRefund(tr, rate).toFixed(2),
      ]),
    );
  return [header, ...rows].join("\n");
}
