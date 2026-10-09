import { afterEach, describe, expect, it, vi } from "vitest";
import { isoToLocalDate, localDateString, localDateToIso, localMonthString } from "../dates";

describe("date locali", () => {
  afterEach(() => vi.useRealTimers());

  it("all'una di notte la data è quella di oggi, non di ieri", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 1, 30)); // 10 ottobre, 01:30 locali
    expect(localDateString()).toBe("2026-10-10");
    expect(localMonthString()).toBe("2026-10");
  });

  it("andata e ritorno tra campo data e ISO salvato", () => {
    expect(isoToLocalDate(localDateToIso("2026-03-29"))).toBe("2026-03-29");
  });

  it("modificando senza cambiare giorno tiene l'ora originale", () => {
    const original = new Date(2026, 4, 5, 8, 15).toISOString();
    expect(localDateToIso("2026-05-05", original)).toBe(original);
    expect(localDateToIso("2026-05-06", original)).not.toBe(original);
  });
});
