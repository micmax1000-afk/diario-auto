import { describe, expect, it } from "vitest";
import { parseVoiceFuel } from "../voiceFuel";

const V = [
  { id: "t", name: "Tesla Model 3" },
  { id: "g", name: "Volkswagen Golf", plate: "AB123CD" },
  { id: "p", name: "Fiat Panda" },
];

describe("rifornimento a voce", () => {
  it("importo, veicolo e prezzo al litro", () => {
    expect(parseVoiceFuel("Inserisci rifornimento di 20 euro su Golf 1,90 euro al litro", V)).toEqual({ kind: "fuel", vehicleId: "g", totalCost: 20, pricePerUnit: 1.9 });
  });

  it("forma del riconoscimento vocale con € e km", () => {
    expect(parseVoiceFuel("20 € sulla Panda a 1,85 €/l 152.300 km pieno", V)).toEqual({ kind: "fuel", vehicleId: "p", totalCost: 20, pricePerUnit: 1.85, km: 152300, fullTank: true });
  });

  it("simbolo dell'euro davanti, come lo scrive il riconoscimento vocale", () => {
    expect(parseVoiceFuel("€20 a 1,89 al litro", V)).toMatchObject({ kind: "fuel", totalCost: 20, pricePerUnit: 1.89 });
    expect(parseVoiceFuel("rifornimento €35,50 a €1,79 al litro", V)).toMatchObject({ totalCost: 35.5, pricePerUnit: 1.79 });
  });

  it("prezzo detto a parole: 1 e 90", () => {
    expect(parseVoiceFuel("30 euro a 1 e 90", V)).toMatchObject({ totalCost: 30, pricePerUnit: 1.9 });
  });

  it("litri e prezzo: calcola l'importo", () => {
    expect(parseVoiceFuel("40 litri a 1,80 golf parziale", V)).toEqual({ kind: "fuel", vehicleId: "g", liters: 40, pricePerUnit: 1.8, totalCost: 72, fullTank: false });
  });

  it("riconosce la targa", () => {
    expect(parseVoiceFuel("50 euro sulla AB 123 CD", V).vehicleId).toBe("g");
  });

  it("ricarica: kWh, prezzo al kWh e a casa", () => {
    expect(parseVoiceFuel("Ricarica di 30 kWh sulla Tesla a 0,25 euro al kWh a casa", V)).toEqual({ kind: "charge", vehicleId: "t", kWh: 30, pricePerUnit: 0.25, totalCost: 7.5, atHome: true });
  });

  it("ricarica alla colonnina con importo e kWh", () => {
    expect(parseVoiceFuel("15 euro alla colonnina, 25 kWh", V)).toEqual({ kind: "charge", totalCost: 15, kWh: 25, pricePerUnit: 0.6, atHome: false });
  });

  it("senza veicolo né dati non inventa nulla", () => {
    expect(parseVoiceFuel("ciao", V)).toEqual({});
  });
});
