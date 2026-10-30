import { describe, expect, it } from "vitest";
import { CAR_CATALOG, guessBrandModel } from "../carCatalog";

describe("guessBrandModel", () => {
  it("riconosce marca e modello dal nome", () => {
    expect(guessBrandModel("Fiat 500L")).toEqual({ brand: "Fiat", model: "500L" });
    expect(guessBrandModel("fiat panda")).toEqual({ brand: "Fiat", model: "Panda" });
  });

  it("marca di più parole e modello con spazi", () => {
    expect(guessBrandModel("Alfa Romeo Stelvio")).toEqual({ brand: "Alfa Romeo", model: "Stelvio" });
    expect(guessBrandModel("Land Rover Range Rover Evoque")).toEqual({ brand: "Land Rover", model: "Range Rover Evoque" });
    expect(guessBrandModel("Tesla Model 3")).toEqual({ brand: "Tesla", model: "Model 3" });
  });

  it("solo la marca quando il resto del nome non è un modello dell'elenco", () => {
    expect(guessBrandModel("Fiat Panda di Marco")).toEqual({ brand: "Fiat", model: "" });
    expect(guessBrandModel("Fiat")).toEqual({ brand: "Fiat", model: "" });
  });

  it("niente se il nome non comincia con una marca", () => {
    expect(guessBrandModel("La mia auto")).toEqual({ brand: "", model: "" });
    expect(guessBrandModel("Fiatella 2000")).toEqual({ brand: "", model: "" });
    expect(guessBrandModel("")).toEqual({ brand: "", model: "" });
  });
});

describe("CAR_CATALOG", () => {
  it("marche senza doppioni e ognuna con almeno un modello", () => {
    const names = CAR_CATALOG.map((b) => b.brand.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const b of CAR_CATALOG) expect(b.models.length).toBeGreaterThan(0);
  });
});
