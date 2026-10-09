import { describe, expect, it } from "vitest";
import { celsiusToDisplayTemp, displayTempToCelsius, kmToDisplayDistance } from "../settings";
import { computeDueFromCatalog } from "../reminderCatalog";

describe("conversioni di unità", () => {
  it("km → miglia", () => {
    expect(kmToDisplayDistance(100, "km")).toBe(100);
    expect(kmToDisplayDistance(100, "mi")).toBeCloseTo(62.137, 2);
  });

  it("°C ↔ °F andata e ritorno", () => {
    expect(celsiusToDisplayTemp(90, "F")).toBeCloseTo(194);
    expect(displayTempToCelsius(celsiusToDisplayTemp(90, "F"), "F")).toBeCloseTo(90);
    expect(celsiusToDisplayTemp(90, "C")).toBe(90);
  });
});

describe("computeDueFromCatalog", () => {
  it("aggiunge i km dell'intervallo ai km attuali", () => {
    expect(computeDueFromCatalog({ key: "x", km: 15000 } as never, 70100).dueKm).toBe(85100);
  });

  it("calcola la data di scadenza in mesi", () => {
    const { dueDate } = computeDueFromCatalog({ key: "x", months: 24 } as never, 0);
    const expected = new Date();
    expected.setMonth(expected.getMonth() + 24);
    expect(dueDate).toBe(expected.toISOString().slice(0, 10));
  });
});
