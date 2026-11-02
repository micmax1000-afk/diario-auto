import { describe, expect, it } from "vitest";
import type { FuelEntry } from "../../types";
import { checkFuelEntry } from "../entryChecks";

const prev = (i: number, price = 1.8, liters = 40, km = 10000 + i * 600): FuelEntry => ({
  id: `f${i}`, vehicleId: "v", date: new Date(2026, 9, i + 1).toISOString(), km, liters, totalCost: liters * price, source: "benzina", fullTank: true,
});
const history = [prev(1), prev(2), prev(3)];

describe("controllo errori del rifornimento", () => {
  it("nessun avviso per un rifornimento normale", () => {
    expect(checkFuelEntry({ pricePerUnit: 1.85, liters: 38, km: 12400, source: "benzina" }, history)).toEqual([]);
  });

  it("19 €/l invece di 1,9 è fuori scala", () => {
    expect(checkFuelEntry({ pricePerUnit: 19, liters: 2, km: 12400, source: "benzina" }, history)[0]).toMatchObject({ kind: "priceOdd" });
  });

  it("prezzo plausibile ma lontano dal solito", () => {
    expect(checkFuelEntry({ pricePerUnit: 2.9, liters: 30, km: 12400, source: "benzina" }, history)[0]).toMatchObject({ kind: "priceOff" });
  });

  it("troppi litri e troppi km dall'ultimo", () => {
    const w = checkFuelEntry({ pricePerUnit: 1.8, liters: 140, km: 19000, source: "benzina" }, history).map((x) => x.kind);
    expect(w).toEqual(["litersHigh", "kmJump"]);
  });

  it("il GPL ha la sua scala di prezzi", () => {
    expect(checkFuelEntry({ pricePerUnit: 0.72, liters: 30, km: 12400, source: "gpl" }, [])).toEqual([]);
  });
});
