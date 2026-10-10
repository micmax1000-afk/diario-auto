import { afterEach, describe, expect, it } from "vitest";
import { estimateDateForKm, estimateKmPerDay, reminderStatus, setKmPerDayRates } from "../kmForecast";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-10T12:00:00Z").getTime();
const ago = (d: number) => new Date(now - d * DAY).toISOString();

describe("estimateKmPerDay", () => {
  it("media dei km al giorno sugli ultimi 12 mesi", () => {
    expect(estimateKmPerDay([{ date: ago(100), km: 60000 }, { date: ago(0), km: 63000 }], now)).toBeCloseTo(30);
  });
  it("ignora le letture più vecchie di un anno", () => {
    const r = estimateKmPerDay([{ date: ago(800), km: 10000 }, { date: ago(60), km: 61000 }, { date: ago(0), km: 63000 }], now);
    expect(r).toBeCloseTo(2000 / 60);
  });
  it("null con dati insufficienti", () => {
    expect(estimateKmPerDay([{ date: ago(1), km: 100 }], now)).toBeNull();
    expect(estimateKmPerDay([{ date: ago(5), km: 100 }, { date: ago(0), km: 300 }], now)).toBeNull();
  });
});

describe("estimateDateForKm", () => {
  it("stima la data in base al ritmo di guida", () => {
    const d = estimateDateForKm(70600, 70100, 50, now)!;
    expect(Math.round((d.getTime() - now) / DAY)).toBe(10);
  });
  it("null se la scadenza è superata o il ritmo non è noto", () => {
    expect(estimateDateForKm(70000, 70100, 50, now)).toBeNull();
    expect(estimateDateForKm(80000, 70100, null, now)).toBeNull();
  });
});

describe("reminderStatus", () => {
  afterEach(() => setKmPerDayRates(new Map()));
  it("in arrivo se al ritmo attuale si raggiunge entro 30 giorni, anche oltre i 1000 km", () => {
    const r = { vehicleId: "v1", dueKm: 72500 };
    expect(reminderStatus(r, 70100)).toBe("ok");
    setKmPerDayRates(new Map([["v1", 100]]));
    expect(reminderStatus(r, 70100)).toBe("soon");
  });
});
