import { describe, expect, it } from "vitest";
import type { CommuteScenario, ExpenseEntry, FuelEntry, ChargingEntry, MaintenanceEntry } from "../../types";
import {
  commuteYearCost,
  commutePeriods,
  scenarioYearCost,
  paybackYears,
  extraHoursPerYear,
  latestFuelPrice,
  latestChargingPrice,
  fixedCostsLastYear,
} from "../commute";

// Esempio dell'anteprima: 35 km a tratta, 2 tratte, 5 giorni, 46 settimane, 4,9 l/100 km a 1,779 €/l.
const route = { kmPerTrip: 35, tripsPerDay: 2, workDaysPerWeek: 5, weeksPerYear: 46 };
const extras = { tollPerDay: 4.2, parkingPerDay: 3, otherPerMonth: 10 };
const kmPerLiter = 100 / 4.9;

const scenario = (s: Partial<CommuteScenario>): CommuteScenario => ({
  id: "s",
  vehicleId: "v",
  fuelType: "elettrico",
  kmPerUnit: 0,
  pricePerUnit: 0,
  unit: "litro",
  ...s,
});

describe("commuteYearCost", () => {
  it("somma carburante, pedaggi, parcheggio e altro su un anno", () => {
    const y = commuteYearCost({ ...route, ...extras }, kmPerLiter, 1.779)!;
    expect(y.fuel).toBeCloseTo(1403.4, 0);
    expect(y.toll).toBeCloseTo(966, 5);
    expect(y.parking).toBeCloseTo(690, 5);
    expect(y.other).toBe(120);
    expect(y.total).toBeCloseTo(3179.4, 0);
  });

  it("senza settimane usa 46, e senza dati validi non calcola", () => {
    expect(commuteYearCost({ ...route, weeksPerYear: undefined }, kmPerLiter, 1.779)!.total).toBeCloseTo(1403.4, 0);
    expect(commuteYearCost({ ...route, kmPerTrip: 0 }, kmPerLiter, 1.779)).toBeNull();
    expect(commuteYearCost(route, 0, 1.779)).toBeNull();
  });
});

describe("commutePeriods", () => {
  it("ripartisce il costo annuo su tratta, giorno, settimana e mese", () => {
    const p = commutePeriods(3179.4, route);
    expect(p.perTrip).toBeCloseTo(6.91, 2);
    expect(p.perDay).toBeCloseTo(13.82, 2);
    expect(p.perWeek).toBeCloseTo(69.12, 2);
    expect(p.perMonth).toBeCloseTo(264.95, 2);
  });
});

describe("scenarioYearCost", () => {
  const settings = { ...route, ...extras };
  const current = commuteYearCost(settings, kmPerLiter, 1.779);

  it("altra auto: stessi pedaggi e parcheggio, energia diversa", () => {
    const ev = scenario({ fuelType: "elettrico", kmPerUnit: 100 / 16, pricePerUnit: 0.3, unit: "kWh" });
    expect(scenarioYearCost(ev, settings, current)).toBeCloseTo(1776 + 772.8, 0);
  });

  it("car pooling divide il costo attuale, mezzi e bici usano il costo mensile", () => {
    expect(scenarioYearCost(scenario({ fuelType: "carpooling", people: 2 }), settings, current)).toBeCloseTo(current!.total / 2, 5);
    expect(scenarioYearCost(scenario({ fuelType: "mezzi", monthlyCost: 45 }), settings, current)).toBe(540);
    expect(scenarioYearCost(scenario({ fuelType: "bici" }), settings, current)).toBe(0);
    expect(scenarioYearCost(scenario({ fuelType: "carpooling", people: 3 }), settings, null)).toBeNull();
  });
});

describe("paybackYears ed extraHoursPerYear", () => {
  it("anni per rientrare solo se si risparmia", () => {
    expect(paybackYears(5000, 631)).toBeCloseTo(7.92, 2);
    expect(paybackYears(5000, -100)).toBeNull();
    expect(paybackYears(undefined, 631)).toBeNull();
  });

  it("ore in più all'anno", () => {
    expect(extraHoursPerYear(20, route)).toBeCloseTo((20 * 2 * 5 * 46) / 60, 5);
    expect(extraHoursPerYear(undefined, route)).toBe(0);
  });
});

describe("prezzi automatici", () => {
  const fuel = (date: string, liters: number, totalCost: number, source: FuelEntry["source"] = "diesel"): FuelEntry => ({
    id: date + source,
    vehicleId: "v",
    date,
    km: 0,
    liters,
    totalCost,
    source,
    fullTank: true,
  });

  it("prende l'ultimo rifornimento dell'alimentazione giusta", () => {
    const entries = [fuel("2026-10-01", 40, 70), fuel("2026-10-12", 40, 71.16), fuel("2026-10-14", 30, 24, "gpl")];
    expect(latestFuelPrice(entries, "diesel")).toEqual({ price: 1.779, date: "2026-10-12" });
    expect(latestFuelPrice(entries, "gpl")!.price).toBeCloseTo(0.8, 5);
    expect(latestFuelPrice([], "diesel")).toBeNull();
  });

  it("per le elettriche fa la media delle ultime ricariche", () => {
    const charge = (date: string, kWh: number, totalCost: number): ChargingEntry => ({
      id: date,
      vehicleId: "v",
      date,
      km: 0,
      kWh,
      pricePerKWh: totalCost / kWh,
      totalCost,
    });
    const p = latestChargingPrice([charge("2026-10-01", 30, 6), charge("2026-10-05", 20, 12)]);
    expect(p!.price).toBeCloseTo(18 / 50, 5);
    expect(p!.date).toBe("2026-10-05");
  });
});

describe("fixedCostsLastYear", () => {
  it("somma manutenzioni e spese degli ultimi 12 mesi, senza multe", () => {
    const now = new Date("2026-10-16").getTime();
    const m = (date: string, cost: number) => ({ date, cost }) as MaintenanceEntry;
    const e = (date: string, amount: number, category: ExpenseEntry["category"]) => ({ date, amount, category }) as ExpenseEntry;
    const total = fixedCostsLastYear(
      [m("2026-05-01", 300), m("2025-01-01", 999)],
      [e("2026-03-01", 600, "assicurazione"), e("2026-04-01", 200, "bollo"), e("2026-06-01", 80, "multa")],
      now,
    );
    expect(total).toBe(1100);
  });
});
