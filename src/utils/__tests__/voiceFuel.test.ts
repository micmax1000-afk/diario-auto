import { describe, expect, it } from "vitest";
import { parseVoiceFuel } from "../voiceFuel";

const V = [
  { id: "g", name: "Volkswagen Golf", plate: "AB123CD" },
  { id: "p", name: "Fiat Panda" },
];

describe("rifornimento a voce", () => {
  it("importo, veicolo e prezzo al litro", () => {
    expect(parseVoiceFuel("Inserisci rifornimento di 20 euro su Golf 1,90 euro al litro", V)).toEqual({ vehicleId: "g", totalCost: 20, pricePerUnit: 1.9 });
  });

  it("forma del riconoscimento vocale con € e km", () => {
    expect(parseVoiceFuel("20 € sulla Panda a 1,85 €/l 152.300 km pieno", V)).toEqual({ vehicleId: "p", totalCost: 20, pricePerUnit: 1.85, km: 152300, fullTank: true });
  });

  it("prezzo detto a parole: 1 e 90", () => {
    expect(parseVoiceFuel("30 euro a 1 e 90", V)).toMatchObject({ totalCost: 30, pricePerUnit: 1.9 });
  });

  it("litri e prezzo: calcola l'importo", () => {
    expect(parseVoiceFuel("40 litri a 1,80 golf parziale", V)).toEqual({ vehicleId: "g", liters: 40, pricePerUnit: 1.8, totalCost: 72, fullTank: false });
  });

  it("riconosce la targa", () => {
    expect(parseVoiceFuel("50 euro sulla AB 123 CD", V).vehicleId).toBe("g");
  });

  it("senza veicolo né dati non inventa nulla", () => {
    expect(parseVoiceFuel("ciao", V)).toEqual({});
  });
});
