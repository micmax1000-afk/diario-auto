import { describe, expect, it } from "vitest";
import type { ConsumptionPoint } from "../calculations";
import { consumptionAlert } from "../calculations";

const pt = (i: number, l100: number): ConsumptionPoint => ({
  fromKm: i * 500, toKm: (i + 1) * 500, date: "", liters: (l100 * 500) / 100, kmPerLiter: 100 / l100, litersPer100Km: l100, source: "benzina", costPerKm: 0,
});

describe("allarme consumo", () => {
  it("avvisa se gli ultimi due pieni consumano il 15% in più", () => {
    const a = consumptionAlert([pt(0, 6), pt(1, 6), pt(2, 6), pt(3, 7.2), pt(4, 7.2)]);
    expect(a).toMatchObject({ increasePct: 20, atKm: 2500 });
    expect(a!.recent).toBeCloseTo(7.2);
    expect(a!.usual).toBeCloseTo(6);
  });

  it("niente avviso per piccole variazioni o pochi dati", () => {
    expect(consumptionAlert([pt(0, 6), pt(1, 6), pt(2, 6), pt(3, 6.5), pt(4, 6.6)])).toBeNull();
    expect(consumptionAlert([pt(0, 6), pt(1, 9)])).toBeNull();
  });
});

describe("promemoria Pieno", () => {
  it("compare dopo 3 rifornimenti senza pieno", async () => {
    const { needsFullTankHint } = await import("../calculations");
    const f = (km: number, fullTank: boolean) => ({ km, fullTank });
    expect(needsFullTankHint([f(100, false), f(200, false)])).toBe(false);
    expect(needsFullTankHint([f(100, false), f(200, false), f(300, false)])).toBe(true);
    expect(needsFullTankHint([f(100, true), f(200, false), f(300, false)])).toBe(false);
    expect(needsFullTankHint([f(400, false), f(100, true), f(200, false), f(300, false)])).toBe(true);
    expect(needsFullTankHint([f(100, false), f(200, false), f(300, true)])).toBe(false);
  });
});

describe("rifornimento saltato", () => {
  const e = (km: number, liters: number, fullTank = true, missedBefore = false) => ({
    id: String(km), vehicleId: "v", date: "2026-01-01", km, liters, totalCost: liters * 1.8, source: "diesel" as const, fullTank, missedBefore,
  });

  it("il tratto con un rifornimento dimenticato non entra nel consumo", async () => {
    const { calculateConsumption } = await import("../calculations");
    // 1000 → 1700 normale; poi saltato uno: 1700 → 2900 con solo 40 l (falso 3,3 l/100)
    const pts = calculateConsumption([e(1000, 40), e(1700, 42), e(2900, 40, true, true), e(3600, 41)]);
    expect(pts.map((p) => [p.fromKm, p.toKm])).toEqual([[1000, 1700], [2900, 3600]]);
  });

  it("se il rifornimento dopo il salto è parziale, si riparte dal pieno successivo", async () => {
    const { calculateConsumption } = await import("../calculations");
    const pts = calculateConsumption([e(1000, 40), e(2500, 20, false, true), e(3000, 30), e(3700, 42)]);
    expect(pts.map((p) => [p.fromKm, p.toKm])).toEqual([[3000, 3700]]);
  });

  it("segnala un salto di km molto più lungo del solito", async () => {
    const { suspectMissedFill } = await import("../calculations");
    const hist = [{ km: 1000 }, { km: 1650 }, { km: 2300 }, { km: 2950 }];
    expect(suspectMissedFill(hist, 3600)).toBeNull();
    expect(suspectMissedFill(hist, 4300)).toBe(1350);
    expect(suspectMissedFill(hist.slice(0, 2), 4300)).toBeNull();
  });
});
