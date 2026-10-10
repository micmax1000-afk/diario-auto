import { describe, expect, it } from "vitest";
import { convertRows, detectMapping, findTable, parseCsv, parseDate, parseKm, parseNumber, withoutDuplicates } from "../csvImport";

function importText(text: string) {
  const table = findTable(parseCsv(text))!;
  return convertRows(table, detectMapping(table.headers));
}

describe("formati riconosciuti", () => {
  it("Fuelio: salta la sezione del veicolo e legge il registro", () => {
    const text = [
      '"## Vehicle"',
      '"Name","Description","DistUnit","FuelUnit"',
      '"Panda","","0","0"',
      '"## Log"',
      '"Data","Odo (km)","Fuel (litres)","Full","Price (optional)","l/100km (optional)","latitude (optional)","longitude (optional)","City (optional)","Notes (optional)","Missed","TankNumber","FuelType","VolumePrice"',
      '"2026-03-01 08:30","152000","30.5","1","54.29","0","0","0","","primo","0","1","110","1.78"',
      '"2026-03-20 18:10","152520","12.0","0","21.36","0","0","0","","","0","1","110","1.78"',
      '"## CostCategories"',
      '"CostTypeID","Name"',
    ].join("\n");
    const { rows, skipped } = importText(text);
    expect(skipped).toBe(0);
    expect(rows).toEqual([
      { date: "2026-03-01", km: 152000, liters: 30.5, totalCost: 54.29, fullTank: true, notes: "primo" },
      { date: "2026-03-20", km: 152520, liters: 12, totalCost: 21.36, fullTank: false },
    ]);
  });

  it("CSV esportato da Diario Auto (punto e virgola, Sì/No)", () => {
    const text = "Data;Veicolo;Km;Litri/kWh;Costo (EUR);Alimentazione;Pieno;Note\n2026-05-02;Stelvio;68000;45;78.75;diesel;Sì;\n2026-05-20;Stelvio;68650;20;35.00;diesel;No;mezzo pieno";
    const { rows } = importText(text);
    expect(rows).toEqual([
      { date: "2026-05-02", km: 68000, liters: 45, totalCost: 78.75, fullTank: true },
      { date: "2026-05-20", km: 68650, liters: 20, totalCost: 35, fullTank: false, notes: "mezzo pieno" },
    ]);
  });

  it("foglio all'italiana con date gg/mm/aaaa, virgola decimale e prezzo al litro", () => {
    const text = "Data;Chilometraggio;Litri;Prezzo al litro\n15/01/2026;1.250;40,20;1,799\n02/02/2026;1.900;38,00;1,759";
    const { rows } = importText(text);
    expect(rows[0]).toEqual({ date: "2026-01-15", km: 1250, liters: 40.2, totalCost: 72.32, fullTank: true });
    expect(rows[1].totalCost).toBeCloseTo(66.84);
  });

  it("intestazioni in inglese stile Drivvo", () => {
    const text = "Odometer,Date,Price,Total cost,Liters,Full tank?\n34000,2026-04-10,1.85,74.00,40,Yes";
    expect(importText(text).rows).toEqual([{ date: "2026-04-10", km: 34000, liters: 40, totalCost: 74, fullTank: true }]);
  });

  it("scarta le righe senza dati validi", () => {
    const text = "Data;Km;Litri;Costo\n2026-01-01;1000;40;70\n;;;\nsbagliata;abc;0;0";
    const r = importText(text);
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });

  it("null se non c'è una tabella con data e km", () => {
    expect(findTable(parseCsv("nome,colore\nPanda,rossa"))).toBeNull();
  });
});

describe("numeri e date", () => {
  it("numeri in vari formati", () => {
    expect(parseNumber("1.234,56")).toBeCloseTo(1234.56);
    expect(parseNumber("1,234.56")).toBeCloseTo(1234.56);
    expect(parseNumber("152.300")).toBe(152.3);
    expect(parseNumber("1.152.300")).toBe(1152300);
    expect(parseNumber("€ 54,29")).toBeCloseTo(54.29);
    expect(parseNumber("")).toBeNull();
    expect(parseKm("1.250")).toBe(1250);
    expect(parseKm("152,300")).toBe(152300);
    expect(parseKm("152300.4")).toBeCloseTo(152300.4);
  });
  it("date in vari formati", () => {
    expect(parseDate("2026-03-01 08:30")).toBe("2026-03-01");
    expect(parseDate("01.03.2026")).toBe("2026-03-01");
    expect(parseDate("03/25/2026")).toBe("2026-03-25");
    expect(parseDate("5/3/26")).toBe("2026-03-05");
    expect(parseDate("ieri")).toBeNull();
  });
});

describe("withoutDuplicates", () => {
  it("salta i rifornimenti già presenti con stessa data e km", () => {
    const rows = [
      { date: "2026-03-01", km: 1000, liters: 30, totalCost: 50, fullTank: true },
      { date: "2026-03-10", km: 1400, liters: 30, totalCost: 50, fullTank: true },
    ];
    const existing = [{ date: "2026-03-01T11:00:00.000Z", km: 1000 }];
    expect(withoutDuplicates(rows, existing, (iso) => iso.slice(0, 10))).toHaveLength(1);
  });
});
