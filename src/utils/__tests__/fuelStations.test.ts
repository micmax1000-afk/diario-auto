import { describe, expect, it } from "vitest";
import { buildStations, distanceKm, parseMimitCsv } from "../fuelStations";

const registry = `Estrazione del 2026-11-01
idImpianto;Gestore;Bandiera;Tipo Impianto;Nome Impianto;Indirizzo;Comune;Provincia;Latitudine;Longitudine
1;ROSSI SRL;Agip Eni;Stradale;ENI VIA ROMA;VIA ROMA 1;MILANO;MI;45.4642;9.1900
2;BIANCHI;Pompe Bianche;Stradale;DISTRIBUTORE BIANCHI;VIALE MONZA 10;MILANO;MI;45.4900;9.2100
3;LONTANO;Q8;Stradale;Q8 TORINO;CORSO FRANCIA 3;TORINO;TO;45.0703;7.6869`;
const prices = `Estrazione del 2026-11-01
idImpianto|descCarburante|prezzo|isSelf|dtComu
1|Benzina|1.789|1|31/10/2026 07:10:00
1|Benzina|1.949|0|31/10/2026 07:10:00
1|Blue Diesel|1.899|1|31/10/2026 07:10:00
2|Benzina|1.729|1|31/10/2026 06:00:00
2|GPL|0.699|0|31/10/2026 06:00:00
3|Benzina|1.699|1|31/10/2026 06:00:00`;

describe("distributori del Ministero", () => {
  it("legge i CSV con ; o | e salta la riga di estrazione", () => {
    expect(parseMimitCsv(registry)).toHaveLength(3);
    expect(parseMimitCsv(prices)[0]).toMatchObject({ idimpianto: "1", desccarburante: "Benzina", prezzo: "1.789", isself: "1" });
  });

  it("tiene solo gli impianti vicini e i carburanti normali", () => {
    const st = buildStations(parseMimitCsv(registry), parseMimitCsv(prices), 45.4642, 9.19, 10);
    expect(st.map((s) => s.id).sort()).toEqual(["1", "2"]);
    const eni = st.find((s) => s.id === "1")!;
    expect(eni.prices.benzina).toMatchObject({ self: 1.789, served: 1.949 });
    expect(eni.prices.gasolio).toBeUndefined();
    expect(st.find((s) => s.id === "2")!.prices.gpl).toMatchObject({ served: 0.699 });
    expect(eni.address).toBe("VIA ROMA 1, MILANO");
  });

  it("distanza in km", () => {
    expect(distanceKm(45.4642, 9.19, 45.0703, 7.6869)).toBeCloseTo(126, -1);
  });
});
