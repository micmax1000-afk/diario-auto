import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: {} }));

const { plannedReminderNotifications } = await import("../notifications");

describe("plannedReminderNotifications", () => {
  const now = new Date(2026, 9, 16, 12, 0).getTime(); // 16 ottobre 2026, ore 12

  it("30 e 7 giorni prima e il giorno stesso, alle 9", () => {
    const planned = plannedReminderNotifications(new Date(2026, 11, 31, 12).toISOString(), now);
    expect(planned.map((p) => p.daysBefore)).toEqual([30, 7, 0]);
    expect(planned.map((p) => [p.at.getMonth() + 1, p.at.getDate(), p.at.getHours()])).toEqual([
      [12, 1, 9],
      [12, 24, 9],
      [12, 31, 9],
    ]);
  });

  it("salta gli avvisi già passati", () => {
    // scadenza tra 10 giorni: niente avviso a 30 giorni
    const planned = plannedReminderNotifications(new Date(2026, 9, 26, 12).toISOString(), now);
    expect(planned.map((p) => p.daysBefore)).toEqual([7, 0]);
  });

  it("niente per una scadenza già passata", () => {
    expect(plannedReminderNotifications(new Date(2026, 9, 1).toISOString(), now)).toEqual([]);
  });
});
