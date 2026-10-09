import { describe, expect, it } from "vitest";
import type { DtcReading } from "../../types";
import { addDtcReading, previousOccurrences, sameCodes } from "../dtcHistory";

function reading(id: string, date: string, km: number, codes: string[], mode: DtcReading["mode"] = "03"): DtcReading {
  return { id, date, km, mode, codes };
}

describe("addDtcReading", () => {
  it("non salva una lettura senza codici se prima non ce n'erano", () => {
    expect(addDtcReading([], reading("a", "2026-10-01T10:00:00Z", 100, []))).toBeNull();
  });

  it("salva una lettura con codici", () => {
    expect(addDtcReading([], reading("a", "2026-10-01T10:00:00Z", 100, ["P0171"]))).toHaveLength(1);
  });

  it("salva la lettura senza codici che segue una con codici, una volta sola", () => {
    let h = addDtcReading([], reading("a", "2026-10-01T10:00:00Z", 100, ["P0171"]))!;
    h = addDtcReading(h, reading("b", "2026-10-05T10:00:00Z", 300, []))!;
    expect(h).toHaveLength(2);
    expect(addDtcReading(h, reading("c", "2026-10-06T10:00:00Z", 310, []))).toBeNull();
  });

  it("rileggere gli stessi codici nello stesso giorno aggiorna invece di duplicare", () => {
    const h = addDtcReading([], reading("a", "2026-10-01T10:00:00Z", 100, ["P0171", "P0420"]))!;
    expect(addDtcReading(h, reading("b", "2026-10-01T11:00:00Z", 100, ["P0420", "P0171"]))).toBeNull();
    const updated = addDtcReading(h, reading("b", "2026-10-01T11:00:00Z", 120, ["P0171", "P0420"]))!;
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ id: "a", km: 120 });
  });

  it("tiene separati i tipi di lettura (memorizzati / pending)", () => {
    let h = addDtcReading([], reading("a", "2026-10-01T10:00:00Z", 100, ["P0171"], "03"))!;
    h = addDtcReading(h, reading("b", "2026-10-01T10:05:00Z", 100, ["P0171"], "07"))!;
    expect(h).toHaveLength(2);
    // nessuna lettura "pending" con codici prima di questa → la vuota non si salva
    expect(addDtcReading(h, reading("c", "2026-10-02T10:00:00Z", 110, [], "0A"))).toBeNull();
  });

  it("non supera le 200 letture", () => {
    let h: DtcReading[] = [];
    for (let i = 0; i < 205; i++) {
      h = addDtcReading(h, reading(`r${i}`, new Date(Date.UTC(2020, 0, 1 + i)).toISOString(), i, ["P0171"]))!;
    }
    expect(h).toHaveLength(200);
    expect(h[0].id).toBe("r5");
  });
});

describe("previousOccurrences", () => {
  const h = [
    reading("a", "2026-03-12T10:00:00Z", 68400, ["P0171"]),
    reading("b", "2026-04-02T10:00:00Z", 68900, []),
    reading("c", "2026-07-20T10:00:00Z", 69900, ["P0171", "P0420"]),
  ];

  it("conta le letture precedenti e indica la prima", () => {
    const occ = previousOccurrences(h, "P0171", "c")!;
    expect(occ.count).toBe(1);
    expect(occ.first.id).toBe("a");
  });

  it("null se il codice non era mai comparso prima", () => {
    expect(previousOccurrences(h, "P0420", "c")).toBeNull();
  });
});

describe("sameCodes", () => {
  it("ignora l'ordine", () => {
    expect(sameCodes(["P0420", "P0171"], ["P0171", "P0420"])).toBe(true);
    expect(sameCodes(["P0171"], ["P0171", "P0420"])).toBe(false);
  });
});
