import { describe, expect, it } from "vitest";
import {
  celsiusToDisplayTemp,
  displayTempToCelsius,
  formatCurrency,
  formatDistance,
  guessCurrencyFromDeviceLocale,
  guessTemperatureUnitFromDeviceLocale,
  kmToDisplayDistance,
} from "../settings";
import { computeDueFromCatalog } from "../reminderCatalog";
import { localDateString } from "../dates";

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
    expect(dueDate).toBe(localDateString(expected));
  });
});

describe("formattazione importi e distanze", () => {
  it("usa il simbolo della valuta scelta e i separatori della lingua", () => {
    expect(formatCurrency(12345.5, "EUR", 2, "it-IT")).toBe("€ 12.345,50");
    expect(formatCurrency(0.0523, "USD", 3, "en-US")).toBe("$ 0.052");
  });

  it("converte e etichetta le distanze", () => {
    expect(formatDistance(45000, "km", "it-IT")).toBe("45.000 km");
    expect(formatDistance(1000, "mi", "en-US")).toBe("621 mi");
  });
});

describe("stima da regione del telefono", () => {
  it("valuta", () => {
    expect(guessCurrencyFromDeviceLocale("it-IT")).toBe("EUR");
    expect(guessCurrencyFromDeviceLocale("en-GB")).toBe("GBP");
    expect(guessCurrencyFromDeviceLocale("en-US")).toBe("USD");
    expect(guessCurrencyFromDeviceLocale("nl-BE")).toBe("EUR");
    expect(guessCurrencyFromDeviceLocale("hr-HR")).toBe("EUR");
    expect(guessCurrencyFromDeviceLocale("ar-SA")).toBe("SAR");
    expect(guessCurrencyFromDeviceLocale("zh-Hans-CN")).toBe("CNY");
    // senza regione o regione sconosciuta: euro
    expect(guessCurrencyFromDeviceLocale("it")).toBe("EUR");
    expect(guessCurrencyFromDeviceLocale("es-419")).toBe("EUR");
  });

  it("temperatura", () => {
    expect(guessTemperatureUnitFromDeviceLocale("en-US")).toBe("F");
    expect(guessTemperatureUnitFromDeviceLocale("en-GB")).toBe("C");
    expect(guessTemperatureUnitFromDeviceLocale("it-IT")).toBe("C");
    expect(guessTemperatureUnitFromDeviceLocale("es")).toBe("C");
  });
});
