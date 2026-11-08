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
