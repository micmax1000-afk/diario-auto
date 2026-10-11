import { describe, expect, it, vi, afterEach } from "vitest";
import type { FuelEntry } from "../../types";
import { averageConsumption, averageElectricConsumption, calculateCommuteCost, calculateConsumption, calculateElectricConsumption, calculateVehicleCosts, isReminderDue, mainFuelSource } from "../calculations";

let n = 0;
function fuel(km: number, liters: number, fullTank: boolean, totalCost = liters * 2, source: FuelEntry["source"] = "benzina"): FuelEntry {
  return { id: `f${n++}`, vehicleId: "v1", date: "2026-01-01", km, liters, totalCost, source, fullTank };
}

describe("calculateConsumption", () => {
  it("calcola il consumo tra due pieni", () => {
    const [p] = calculateConsumption([fuel(1000, 40, true), fuel(1500, 30, true)]);
    expect(p.fromKm).toBe(1000);
    expect(p.toKm).toBe(1500);
    expect(p.liters).toBe(30);
    expect(p.litersPer100Km).toBeCloseTo(6);
  });

  it("conta anche i rifornimenti parziali fatti tra due pieni", () => {
    const points = calculateConsumption([fuel(1000, 40, true), fuel(1300, 10, false), fuel(1500, 20, true)]);
    expect(points).toHaveLength(1);
    expect(points[0].liters).toBe(30);
    expect(points[0].litersPer100Km).toBeCloseTo(6);
    expect(points[0].costPerKm).toBeCloseTo(60 / 500);
  });

  it("ignora i parziali prima del primo pieno e quelli dopo l'ultimo", () => {
    const points = calculateConsumption([fuel(500, 15, false), fuel(1000, 40, true), fuel(1500, 30, true), fuel(1700, 10, false)]);
    expect(points).toHaveLength(1);
    expect(points[0].liters).toBe(30);
  });

  it("non mescola alimentazioni diverse", () => {
    const points = calculateConsumption([
      fuel(1000, 40, true, 80, "benzina"),
      fuel(1200, 20, true, 20, "gpl"),
      fuel(1500, 30, true, 60, "benzina"),
      fuel(1600, 25, true, 25, "gpl"),
    ]);
    expect(points.map((p) => [p.source, p.fromKm, p.toKm, p.liters])).toEqual([
      ["benzina", 1000, 1500, 30],
      ["gpl", 1200, 1600, 25],
    ]);
  });

  it("ordina per km anche se le voci arrivano in disordine", () => {
    const points = calculateConsumption([fuel(1500, 30, true), fuel(1000, 40, true)]);
    expect(points[0].fromKm).toBe(1000);
  });

  it("salta i pieni con la stessa lettura dei km", () => {
    expect(calculateConsumption([fuel(1000, 40, true), fuel(1000, 5, true)])).toEqual([]);
  });
});

describe("averageConsumption", () => {
  it("restituisce null senza dati", () => {
    expect(averageConsumption([])).toBeNull();
  });

  it("fa la media pesata sui km, non la media dei consumi", () => {
    const points = calculateConsumption([fuel(0, 40, true), fuel(100, 10, true), fuel(1100, 50, true)]);
    // 1100 km con 60 litri
    expect(averageConsumption(points)).toBeCloseTo(1100 / 60);
  });
});

describe("calculateVehicleCosts", () => {
  it("somma le spese e calcola il costo al km dal primo km registrato", () => {
    const res = calculateVehicleCosts(
      [fuel(1000, 40, true, 80)],
      [{ id: "m1", vehicleId: "v1", date: "2026-01-01", km: 1200, category: "tagliando", description: "", cost: 120 } as never],
      2000,
      [{ id: "e1", vehicleId: "v1", date: "2026-01-01", category: "assicurazione", amount: 300 } as never],
    );
    expect(res.totalCost).toBe(500);
    expect(res.totalKm).toBe(1000);
    expect(res.costPerKm).toBeCloseTo(0.5);
  });

  it("senza km percorsi il costo al km è null", () => {
    expect(calculateVehicleCosts([], [], 5000).costPerKm).toBeNull();
  });
});

describe("calculateCommuteCost", () => {
  it("calcola il costo per tratta e al mese", () => {
    const res = calculateCommuteCost(20, 2, 5, 15, 1.8)!;
    expect(res.costPerTrip).toBeCloseTo(2.4);
    expect(res.costPerDay).toBeCloseTo(4.8);
    expect(res.costPerWeek).toBeCloseTo(24);
    expect(res.costPerMonth).toBeCloseTo(24 * (52 / 12));
  });

  it("rifiuta valori non validi", () => {
    expect(calculateCommuteCost(0, 2, 5, 15, 1.8)).toBeNull();
    expect(calculateCommuteCost(20, 2, 5, 0, 1.8)).toBeNull();
  });
});

describe("isReminderDue", () => {
  afterEach(() => vi.useRealTimers());

  function at(today: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(today));
  }

  it("scaduta per data", () => {
    at("2026-10-09T12:00:00Z");
    expect(isReminderDue("2026-10-01")).toBe("overdue");
  });

  it("in arrivo entro 30 giorni", () => {
    at("2026-10-09T12:00:00Z");
    expect(isReminderDue("2026-10-30")).toBe("soon");
    expect(isReminderDue("2026-12-30")).toBe("ok");
  });

  it("scaduta per km anche se la data è lontana", () => {
    at("2026-10-09T12:00:00Z");
    expect(isReminderDue("2027-10-01", 70000, 70100)).toBe("overdue");
  });

  it("in arrivo entro 1000 km", () => {
    expect(isReminderDue(undefined, 71000, 70100)).toBe("soon");
    expect(isReminderDue(undefined, 75000, 70100)).toBe("ok");
  });

  it("la scadenza per data prevale su 'in arrivo' per km", () => {
    at("2026-10-09T12:00:00Z");
    expect(isReminderDue("2026-10-01", 71000, 70100)).toBe("overdue");
  });
});

describe("consumo delle elettriche", () => {
  const charge = (km: number, kWh: number) => ({ id: `c${km}`, vehicleId: "v1", date: "2026-01-01", km, kWh, pricePerKWh: 0.3, totalCost: kWh * 0.3 });
  it("kWh ogni 100 km tra una ricarica e l'altra", () => {
    const points = calculateElectricConsumption([charge(1000, 50), charge(1300, 48), charge(1500, 32)]);
    expect(points).toHaveLength(2);
    expect(averageElectricConsumption(points)).toBeCloseTo(16);
  });
  it("null senza almeno due ricariche", () => {
    expect(averageElectricConsumption(calculateElectricConsumption([charge(1000, 50)]))).toBeNull();
  });
});

describe("auto a GPL con qualche pieno di benzina", () => {
  const e = (km: number, liters: number, source: "gpl" | "benzina") => fuel(km, liters, true, liters, source);
  // GPL ogni 500 km (7 l/100km); due piccoli pieni di benzina (usata solo all'avvio)
  const entries = [e(500, 35, "gpl"), e(600, 5, "benzina"), e(1000, 35, "gpl"), e(1500, 35, "gpl"), e(1900, 5, "benzina"), e(2000, 35, "gpl")];

  it("il consumo principale conta solo il GPL", () => {
    const points = calculateConsumption(entries);
    expect(100 / averageConsumption(points, mainFuelSource("gpl"))!).toBeCloseTo(7, 5);
    // mescolando le due alimentazioni verrebbe un numero senza senso
    expect(100 / averageConsumption(points)!).toBeLessThan(4);
  });

  it("per benzina e diesel nessun filtro", () => {
    expect(mainFuelSource("benzina")).toBeUndefined();
    expect(mainFuelSource("diesel")).toBeUndefined();
    expect(mainFuelSource("metano")).toBe("metano");
  });
});
