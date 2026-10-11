import { beforeEach, describe, expect, it, vi } from "vitest";
import { countBackup, isAutoBackupDue, looksLikeDataLoss } from "../autoBackup";
import type { BackupData } from "../storage";

const DAY = 24 * 60 * 60 * 1000;

describe("isAutoBackupDue", () => {
  const now = new Date("2026-10-11T12:00:00Z").getTime();

  it("serve se non c'è mai stato un backup", () => {
    expect(isAutoBackupDue(null, now)).toBe(true);
  });

  it("serve dopo 7 giorni, non prima", () => {
    expect(isAutoBackupDue(new Date(now - 6 * DAY).toISOString(), now)).toBe(false);
    expect(isAutoBackupDue(new Date(now - 7 * DAY).toISOString(), now)).toBe(true);
  });

  it("una data illeggibile non blocca il backup", () => {
    expect(isAutoBackupDue("non-una-data", now)).toBe(true);
  });
});

describe("looksLikeDataLoss", () => {
  it("senza riferimento non blocca", () => {
    expect(looksLikeDataLoss(null, { vehicles: 0, records: 0 })).toBe(false);
  });

  it("blocca se è sparito tutto", () => {
    expect(looksLikeDataLoss({ vehicles: 1, records: 3 }, { vehicles: 0, records: 0 })).toBe(true);
  });

  it("blocca se mancano più di metà dei veicoli", () => {
    expect(looksLikeDataLoss({ vehicles: 4, records: 100 }, { vehicles: 1, records: 100 })).toBe(true);
  });

  it("blocca se mancano più di metà dei dati (almeno 10 voci)", () => {
    expect(looksLikeDataLoss({ vehicles: 2, records: 120 }, { vehicles: 2, records: 40 })).toBe(true);
  });

  it("non blocca eliminazioni normali o dati in crescita", () => {
    expect(looksLikeDataLoss({ vehicles: 2, records: 120 }, { vehicles: 2, records: 110 })).toBe(false);
    expect(looksLikeDataLoss({ vehicles: 2, records: 12 }, { vehicles: 2, records: 4 })).toBe(false); // solo 8 voci in meno
    expect(looksLikeDataLoss({ vehicles: 2, records: 50 }, { vehicles: 1, records: 30 })).toBe(false); // venduta un'auto
    expect(looksLikeDataLoss({ vehicles: 1, records: 10 }, { vehicles: 3, records: 80 })).toBe(false);
  });
});

describe("countBackup", () => {
  it("conta veicoli e tutte le voci, anche con campi facoltativi assenti", () => {
    const data = {
      version: 2,
      exportedAt: "",
      vehicles: [{}, {}],
      fuelEntries: [{}, {}, {}],
      maintenanceEntries: [{}],
      reminders: [{}],
      chargingEntries: [{}],
    } as unknown as BackupData;
    expect(countBackup(data)).toEqual({ vehicles: 2, records: 6 });
  });
});

// ---- Flusso completo, con telefono, memoria e Drive simulati ----

const meta = new Map<string, string>();
let backupOnPhone = { vehicles: 2, records: 40 };
const uploads: string[] = [];
let uploadError: Error | null = null;

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("../db", () => ({
  getMeta: async (k: string) => meta.get(k) ?? null,
  setMeta: async (k: string, v: string) => void meta.set(k, v),
}));
vi.mock("../storage", () => ({
  buildBackup: async () => ({
    version: 2,
    exportedAt: "",
    vehicles: Array(backupOnPhone.vehicles).fill({}),
    fuelEntries: Array(backupOnPhone.records).fill({}),
    maintenanceEntries: [],
    reminders: [],
  }),
  getLastBackupDate: async () => meta.get("last-backup") ?? null,
  setLastBackupDate: async (iso: string) => void meta.set("last-backup", iso),
}));
vi.mock("../../services/googleDrive/driveBackup", () => ({
  uploadBackupToDrive: async (json: string, options: { interactive?: boolean }) => {
    if (options.interactive !== false) throw new Error("il backup automatico non deve mai chiedere l'accesso");
    if (uploadError) throw uploadError;
    uploads.push(json);
  },
}));

describe("runAutoBackupIfDue", async () => {
  const { runAutoBackupIfDue, markDataAsReference, setAutoBackupEnabled } = await import("../autoBackup");
  const longAgo = new Date(Date.now() - 10 * DAY).toISOString();

  beforeEach(() => {
    meta.clear();
    uploads.length = 0;
    uploadError = null;
    backupOnPhone = { vehicles: 2, records: 40 };
  });

  async function driveAlreadyUsed() {
    await markDataAsReference((await (await import("../storage")).buildBackup()) as BackupData, true);
    meta.set("last-backup", longAgo);
  }

  it("non fa nulla senza Pro o prima del primo backup manuale su Drive", async () => {
    expect(await runAutoBackupIfDue(false)).toBe("skipped");
    expect(await runAutoBackupIfDue(true)).toBe("skipped");
    expect(uploads).toHaveLength(0);
  });

  it("carica il backup in silenzio quando è passata una settimana", async () => {
    await driveAlreadyUsed();
    expect(await runAutoBackupIfDue(true)).toBe("done");
    expect(uploads).toHaveLength(1);
    // subito dopo non ne fa un altro
    expect(await runAutoBackupIfDue(true)).toBe("skipped");
    expect(uploads).toHaveLength(1);
  });

  it("non parte se un backup manuale è recente", async () => {
    await driveAlreadyUsed();
    meta.set("last-backup", new Date().toISOString());
    expect(await runAutoBackupIfDue(true)).toBe("skipped");
  });

  it("si blocca se i dati sono spariti, e riparte dopo un backup manuale", async () => {
    await driveAlreadyUsed();
    backupOnPhone = { vehicles: 0, records: 0 };
    expect(await runAutoBackupIfDue(true)).toBe("blocked");
    expect(uploads).toHaveLength(0);
    // l'utente conferma che i dati attuali sono quelli giusti (backup manuale)
    await markDataAsReference((await (await import("../storage")).buildBackup()) as BackupData, true);
    meta.set("last-backup", longAgo);
    backupOnPhone = { vehicles: 1, records: 5 };
    expect(await runAutoBackupIfDue(true)).toBe("done");
  });

  it("rispetta l'interruttore spento", async () => {
    await driveAlreadyUsed();
    await setAutoBackupEnabled(false);
    expect(await runAutoBackupIfDue(true)).toBe("skipped");
  });

  it("un errore di Drive non rompe nulla e si riprova la volta dopo", async () => {
    await driveAlreadyUsed();
    uploadError = new Error("offline");
    expect(await runAutoBackupIfDue(true)).toBe("failed");
    expect(meta.get("last-backup")).toBe(longAgo);
    uploadError = null;
    expect(await runAutoBackupIfDue(true)).toBe("done");
  });
});
