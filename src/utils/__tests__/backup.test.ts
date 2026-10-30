import { describe, expect, it } from "vitest";
import { isValidBackupData } from "../storage";

describe("isValidBackupData", () => {
  const minimal = { version: 1, vehicles: [], fuelEntries: [], maintenanceEntries: [], reminders: [] };

  it("accetta un backup minimo", () => {
    expect(isValidBackupData(minimal)).toBe(true);
  });

  it("accetta un backup di una versione precedente senza i campi nuovi (OBD, tragitto, storico codici)", () => {
    expect(isValidBackupData({ ...minimal, vehicles: [{ id: "v1", name: "Auto", currentKm: 1000 }] })).toBe(true);
  });

  it("accetta i veicoli con le carrozzerie nuove (es. cabrio)", () => {
    expect(isValidBackupData({ ...minimal, vehicles: [{ id: "v1", name: "Spider", currentKm: 1000, bodyType: "convertible", color: "#f06292" }] })).toBe(true);
  });

  it("rifiuta file che non sono backup di Diario Auto", () => {
    expect(isValidBackupData(null)).toBe(false);
    expect(isValidBackupData("testo")).toBe(false);
    expect(isValidBackupData({ vehicles: [] })).toBe(false);
    expect(isValidBackupData({ ...minimal, version: "1" })).toBe(false);
    expect(isValidBackupData({ ...minimal, fuelEntries: {} })).toBe(false);
  });
});
