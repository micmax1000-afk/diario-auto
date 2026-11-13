import { describe, expect, it } from "vitest";
import { bifuelSources, isBifuel, vehicleConsumptionPoints, calculateConsumption } from "../calculations";
import { FUEL_COMBOS, comboValue, defaultBifuelSource, fuelLabel, fuelSelectValue, parseFuelSelect } from "../fuelCombos";
import type { FuelEntry } from "../../types";

const entry = (id: string, km: number, source: FuelEntry["source"], liters = 40): FuelEntry => ({ id, vehicleId: "v", date: `2026-0${id}-01`, km, liters, totalCost: liters * 1.5, source, fullTank: true });

describe("doppia alimentazione", () => {
  it("riconosce le bifuel e i due carburanti", () => {
    expect(isBifuel({ secondFuel: "gpl" })).toBe(true);
    expect(isBifuel({})).toBe(false);
    expect(bifuelSources({ fuelType: "benzina", secondFuel: "gpl" })).toEqual(["benzina", "gpl"]);
    expect(bifuelSources({ fuelType: "benzina" })).toBeNull();
    expect(bifuelSources({ fuelType: "ibrido", secondFuel: "gpl" })).toBeNull();
  });

  it("per le bifuel il consumo in litri non si calcola, per le altre sì", () => {
    const entries = [entry("1", 1000, "benzina"), entry("2", 1500, "benzina"), entry("3", 2000, "gpl")];
    expect(calculateConsumption(entries).length).toBeGreaterThan(0);
    expect(vehicleConsumptionPoints(entries, { secondFuel: "gpl" })).toEqual([]);
    expect(vehicleConsumptionPoints(entries, {})).toEqual(calculateConsumption(entries));
  });

  it("ci sono le quattro combinazioni e il menu le converte avanti e indietro", () => {
    expect(FUEL_COMBOS.map(comboValue)).toEqual(["benzina+gpl", "benzina+metano", "diesel+gpl", "diesel+metano"]);
    expect(parseFuelSelect("benzina+gpl")).toEqual({ fuelType: "benzina", secondFuel: "gpl" });
    expect(parseFuelSelect("diesel")).toEqual({ fuelType: "diesel" });
    expect(fuelSelectValue("benzina", "gpl")).toBe("benzina+gpl");
    expect(fuelSelectValue("benzina", undefined)).toBe("benzina");
    expect(fuelSelectValue("elettrico", "gpl")).toBe("elettrico");
  });

  it("propone l'ultimo carburante usato, altrimenti il principale", () => {
    const v = { fuelType: "benzina" as const, secondFuel: "gpl" as const };
    expect(defaultBifuelSource(v, [])).toBe("benzina");
    expect(defaultBifuelSource(v, [entry("1", 1000, "benzina"), entry("2", 1500, "gpl")])).toBe("gpl");
    expect(defaultBifuelSource(v, [entry("1", 1000, "diesel")])).toBe("benzina");
  });

  it("l'etichetta unisce i due carburanti", () => {
    const t = (k: string) => k.replace("fuelType.", "");
    expect(fuelLabel(t, { fuelType: "benzina", secondFuel: "gpl" })).toBe("benzina + gpl");
    expect(fuelLabel(t, { fuelType: "diesel" })).toBe("diesel");
  });
});
