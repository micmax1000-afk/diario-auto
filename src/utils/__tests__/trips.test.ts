import { describe, expect, it } from "vitest";
import type { TripEntry } from "../../types";
import { tripRefund, tripTotals, tripsInPeriod, tripsToCsv } from "../trips";

const trip = (p: Partial<TripEntry>): TripEntry => ({ id: "x", vehicleId: "v", date: new Date(2026, 10, 5, 12).toISOString(), work: true, distanceKm: 100, ...p });

describe("viaggi", () => {
  it("rimborso: km × tariffa più le spese, zero per i privati", () => {
    expect(tripRefund(trip({ toll: 4.6, parking: 3, otherCost: 12.5 }), 0.3)).toBeCloseTo(50.1);
    expect(tripRefund(trip({ work: false, toll: 5 }), 0.3)).toBe(0);
  });

  it("senza tariffa conta solo le spese", () => {
    expect(tripRefund(trip({ toll: 4 }), null)).toBe(4);
  });

  it("totali separano lavoro e privato", () => {
    const t = tripTotals([trip({}), trip({ work: false, distanceKm: 40 }), trip({ distanceKm: 20, parking: 2 })], 0.5);
    expect(t).toEqual({ workKm: 120, privateKm: 40, extras: 2, refund: 62, workTrips: 2 });
  });

  it("filtra per mese corrente, mese scorso e anno", () => {
    const now = new Date(2026, 10, 20);
    const nov = trip({ id: "n" });
    const oct = trip({ id: "o", date: new Date(2026, 9, 31, 12).toISOString() });
    const old = trip({ id: "p", date: new Date(2025, 11, 31, 12).toISOString() });
    expect(tripsInPeriod([nov, oct, old], "month", now).map((t) => t.id)).toEqual(["n"]);
    expect(tripsInPeriod([nov, oct, old], "lastMonth", now).map((t) => t.id)).toEqual(["o"]);
    expect(tripsInPeriod([nov, oct, old], "year", now).map((t) => t.id)).toEqual(["n", "o"]);
    expect(tripsInPeriod([nov, oct, old], "all", now)).toHaveLength(3);
  });

  it("il CSV contiene solo i viaggi di lavoro, in ordine di data", () => {
    const labels = Object.fromEntries(["date", "vehicle", "from", "to", "purpose", "km", "rate", "kmAmount", "toll", "parking", "other", "otherWhat", "total"].map((k) => [k, k]));
    const csv = tripsToCsv([trip({ from: "Milano", to: "Bergamo", toll: 4.6 }), trip({ work: false })], "Golf", 0.3, labels).split("\n");
    expect(csv).toHaveLength(2);
    expect(csv[1]).toBe("2026-11-05;Golf;Milano;Bergamo;;100;0.30;30.00;4.60;;;;34.60");
  });
});
