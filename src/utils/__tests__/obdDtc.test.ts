import { describe, expect, it } from "vitest";
import { decodeDtcResponse, decodeFreezeFrameDtc, isCanProtocol, isManufacturerSpecificDtc } from "../obdDtc";

describe("decodeDtcResponse", () => {
  it("CAN, un codice: salta il contatore", () => {
    expect(decodeDtcResponse("43 01 01 71 \r\r>", "43", true)).toEqual(["P0171"]);
  });

  it("CAN, protocollo non noto: riconosce il contatore dal numero dispari di byte", () => {
    expect(decodeDtcResponse("43 02 01 71 04 20\r>", "43", null)).toEqual(["P0171", "P0420"]);
  });

  it("CAN, risposta multi-riga con più di due codici", () => {
    const raw = "00A\r0: 43 04 01 71 04 20\r1: 03 00 22 02 00 00 00\r\r>";
    expect(decodeDtcResponse(raw, "43", true)).toEqual(["P0171", "P0420", "P0300", "P2202"]);
  });

  it("CAN, nessun codice", () => {
    expect(decodeDtcResponse("43 00\r>", "43", true)).toEqual([]);
  });

  it("CAN, due centraline che rispondono (motore e cambio)", () => {
    expect(decodeDtcResponse("43 01 01 71\r43 01 07 00\r>", "43", true)).toEqual(["P0171", "P0700"]);
  });

  it("protocolli vecchi: righe da 3 codici completate con zeri, senza contatore", () => {
    const raw = "43 01 71 04 20 00 00\r>";
    expect(decodeDtcResponse(raw, "43", false)).toEqual(["P0171", "P0420"]);
    expect(decodeDtcResponse(raw, "43", null)).toEqual(["P0171", "P0420"]);
  });

  it("protocolli vecchi su più righe: il secondo 43 non è un dato", () => {
    const raw = "43 01 71 04 20 03 00\r43 22 02 00 00 00 00\r>";
    expect(decodeDtcResponse(raw, "43", false)).toEqual(["P0171", "P0420", "P0300", "P2202"]);
  });

  it("risposta senza spazi tra i byte", () => {
    expect(decodeDtcResponse("4302017104 20".replace(" ", "") + "\r>", "43", true)).toEqual(["P0171", "P0420"]);
  });

  it("codici pending (47) e lettere C, B, U", () => {
    expect(decodeDtcResponse("47 03 40 35 90 01 C1 00\r>", "47", true)).toEqual(["C0035", "B1001", "U0100"]);
  });

  it("NO DATA", () => {
    expect(decodeDtcResponse("NO DATA\r>", "43", true)).toEqual([]);
  });
});

describe("isCanProtocol", () => {
  it("riconosce i protocolli CAN", () => {
    expect(isCanProtocol("6")).toBe(true);
    expect(isCanProtocol("3")).toBe(false);
    expect(isCanProtocol(null)).toBeNull();
  });
});

describe("isManufacturerSpecificDtc", () => {
  it("distingue generici e del costruttore", () => {
    expect(isManufacturerSpecificDtc("P0171")).toBe(false);
    expect(isManufacturerSpecificDtc("P2002")).toBe(false);
    expect(isManufacturerSpecificDtc("P1234")).toBe(true);
    expect(isManufacturerSpecificDtc("P3001")).toBe(true);
    expect(isManufacturerSpecificDtc("P3400")).toBe(false);
    expect(isManufacturerSpecificDtc("U0100")).toBe(false);
    expect(isManufacturerSpecificDtc("B1001")).toBe(true);
    expect(isManufacturerSpecificDtc("C2100")).toBe(true);
  });
});

describe("decodeFreezeFrameDtc", () => {
  it("legge il codice che ha causato il freeze frame", () => {
    expect(decodeFreezeFrameDtc("42 02 00 01 71\r>")).toBe("P0171");
  });
  it("null se non c'è un freeze frame", () => {
    expect(decodeFreezeFrameDtc("42 02 00 00 00\r>")).toBeNull();
    expect(decodeFreezeFrameDtc("NO DATA\r>")).toBeNull();
  });
});
