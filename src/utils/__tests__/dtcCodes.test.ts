import { describe, expect, it } from "vitest";
import { DTC_DESCRIPTIONS, describeDtc } from "../dtcCodes";
import { DTC_DESCRIPTIONS_EN } from "../dtcCodes.en";
import { isManufacturerSpecificDtc } from "../obdDtc";

describe("dizionario dei codici errore", () => {
  it("italiano e inglese hanno gli stessi codici", () => {
    expect(Object.keys(DTC_DESCRIPTIONS).sort()).toEqual(Object.keys(DTC_DESCRIPTIONS_EN).sort());
  });

  it("solo codici nel formato standard e solo generici (non del costruttore)", () => {
    for (const code of Object.keys(DTC_DESCRIPTIONS)) {
      expect(code).toMatch(/^[PCBU][0-3][0-9A-F]{3}$/);
      expect(isManufacturerSpecificDtc(code)).toBe(false);
    }
  });

  it("nessuna descrizione vuota", () => {
    for (const d of [...Object.values(DTC_DESCRIPTIONS), ...Object.values(DTC_DESCRIPTIONS_EN)]) expect(d.trim().length).toBeGreaterThan(5);
  });

  it("italiano per it, inglese per le altre lingue, null se sconosciuto", () => {
    expect(describeDtc("p0420", "it")).toBe(DTC_DESCRIPTIONS.P0420);
    expect(describeDtc("P0420", "de")).toBe(DTC_DESCRIPTIONS_EN.P0420);
    expect(describeDtc("P1234", "it")).toBeNull();
  });
});
