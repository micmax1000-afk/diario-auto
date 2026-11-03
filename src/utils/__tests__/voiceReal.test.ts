import { describe, expect, it } from "vitest";
import { parseVoiceFuel, type VoiceFuel } from "../voiceFuel";

const V = [
  { id: "g", name: "Volkswagen Golf", plate: "AB123CD" },
  { id: "p", name: "Fiat Panda" },
  { id: "t", name: "Tesla Model 3" },
];

// Frasi come le scrive il riconoscimento vocale di Google in italiano
const CASES: [string, Partial<VoiceFuel>][] = [
  ["20 € a 1,89 al litro", { totalCost: 20, pricePerUnit: 1.89 }],
  ["€20 a 1,89 al litro", { totalCost: 20, pricePerUnit: 1.89 }],
  ["rifornimento 20 € prezzo 1,89", { totalCost: 20, pricePerUnit: 1.89 }],
  ["ho messo 30 € di benzina a 1,79", { totalCost: 30, pricePerUnit: 1.79 }],
  ["40 l a 1,85", { liters: 40, pricePerUnit: 1.85, totalCost: 74 }],
  ["40 litri a 1,85 €", { liters: 40, pricePerUnit: 1.85 }],
  ["pieno 55,30 € 1,849 al litro", { totalCost: 55.3, pricePerUnit: 1.849, fullTank: true }],
  ["25 € gasolio 1,75 €", { totalCost: 25, pricePerUnit: 1.75 }],
  ["25 € 1,75 € al litro sulla Panda", { totalCost: 25, pricePerUnit: 1.75, vehicleId: "p" }],
  ["20 € 1,89", { totalCost: 20, pricePerUnit: 1.89 }],
  ["20 euro un euro e 89", { totalCost: 20, pricePerUnit: 1.89 }],
  ["venti euro a un euro e novanta", { totalCost: 20, pricePerUnit: 1.9 }],
  ["ho fatto il pieno di 50 € a 1,799", { totalCost: 50, pricePerUnit: 1.799, fullTank: true }],
  ["30 euro e 50 centesimi a 1,80", { totalCost: 30.5, pricePerUnit: 1.8 }],
  ["a €1,89 al litro €20", { totalCost: 20, pricePerUnit: 1.89 }],
  ["20 € a 1.89 al litro", { totalCost: 20, pricePerUnit: 1.89 }],
  ["20 € a 1,89 al litro 92.900 km", { km: 92900 }],
  ["20 € a 1,89 al litro 92 900 km", { km: 92900 }],
  ["20 € a 1,89 al litro 92mila 900 km", { km: 92900 }],
  ["20 € a 1,89 al litro 92 mila 900 km", { km: 92900 }],
  ["20 € a 1,89 al litro chilometri 92900", { km: 92900 }],
  ["Golf 30 € 1,85 al litro non pieno", { vehicleId: "g", totalCost: 30, pricePerUnit: 1.85, fullTank: false }],
  ["ricarica 30 kWh 0,25 € a casa", { kind: "charge", kWh: 30, pricePerUnit: 0.25, totalCost: 7.5, atHome: true }],
  ["ricarica 30 chilowatt a 0,59 alla colonnina", { kind: "charge", kWh: 30, pricePerUnit: 0.59, atHome: false }],
  ["ho speso 45,60 € per 25 litri", { totalCost: 45.6, liters: 25, pricePerUnit: 1.824 }],
  ["Panda 20 euro metano 1,49 al chilo", { vehicleId: "p", totalCost: 20, pricePerUnit: 1.49, kind: "fuel" }],
  ["35 € 1,72 €/litro", { totalCost: 35, pricePerUnit: 1.72 }],
  ["50 €", { totalCost: 50 }],
  ["targa AB 123 CD 40 € a 1,80", { vehicleId: "g", totalCost: 40, pricePerUnit: 1.8 }],
  ["Tesla 15 € 25 kWh", { vehicleId: "t", totalCost: 15, kWh: 25, pricePerUnit: 0.6 }],
];

describe("frasi reali del riconoscimento vocale", () => {
  for (const [phrase, expected] of CASES) {
    it(phrase, () => {
      expect(parseVoiceFuel(phrase, V)).toMatchObject(expected);
    });
  }
});
