import type { Vehicle } from "../types";

/** Cosa si capisce da una frase come "20 euro sulla Golf a 1,90 al litro, 92.900 km, pieno". */
export interface VoiceFuel {
  /** Ricarica se si parla di kWh, colonnina o "ricarica"; rifornimento se di litri o "pieno". */
  kind?: "fuel" | "charge";
  vehicleId?: string;
  kWh?: number;
  atHome?: boolean;
  totalCost?: number;
  pricePerUnit?: number;
  liters?: number;
  km?: number;
  fullTank?: boolean;
}

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const toNum = (s: string) => Number(s.replace(",", "."));

/** Interpreta la frase detta (in italiano) senza servizi esterni: solo regole sul testo. */
export function parseVoiceFuel(text: string, vehicles: Pick<Vehicle, "id" | "name" | "plate">[]): VoiceFuel {
  let s = ` ${text.toLowerCase()} `
    .replace(/€/g, " euro ")
    .replace(/\s+/g, " ")
    // "1 euro e 90" / "1 e 90" → 1,90 (prezzo detto a voce)
    .replace(/\b(\d)\s*(?:euro\s*)?e\s*(\d{2,3})\b/g, "$1,$2");
  const out: VoiceFuel = {};

  // km: "92.900 km", "92900 chilometri"
  const km = s.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,7})\s*(?:km|chilometri|kilometri)\b/);
  if (km) {
    out.km = Number(km[1].replace(/[.\s]/g, ""));
    s = s.replace(km[0], " ");
  }

  // ricarica: "0,59 euro al kWh", poi "30 kWh"
  const kwhPrice = s.match(new RegExp(`(${NUM})\\s*(?:euro\\s*)?(?:al\\s*|/\\s*)(?:kwh|kw\\s*h|chilowattora|kilowattora)\\b`));
  if (kwhPrice && toNum(kwhPrice[1]) > 0 && toNum(kwhPrice[1]) < 5) {
    out.pricePerUnit = toNum(kwhPrice[1]);
    out.kind = "charge";
    s = s.replace(kwhPrice[0], " ");
  }
  const kwh = s.match(new RegExp(`(${NUM})\\s*(?:kwh|kw\\s*h|chilowattora|kilowattora)\\b`));
  if (kwh) {
    out.kWh = toNum(kwh[1]);
    out.kind = "charge";
    s = s.replace(kwh[0], " ");
  }
  if (/\b(?:a|da|in)\s+casa\b|wallbox|garage/.test(s)) out.atHome = true;
  else if (/colonnin|supercharger|fuori casa/.test(s)) out.atHome = false;
  if (out.atHome !== undefined || /\bricaric/.test(s)) out.kind = "charge";

  // prezzo al litro: "1,90 euro al litro", "a 1,90 al litro", "1.90 €/l", "prezzo 1,90"
  const price = out.pricePerUnit !== undefined ? null :
    s.match(new RegExp(`(${NUM})\\s*(?:euro\\s*)?(?:al\\s*litro|/\\s*l\\b|al\\s*kg)`)) ??
    s.match(new RegExp(`prezzo\\s*(?:di\\s*)?(${NUM})`)) ??
    s.match(new RegExp(`\\ba\\s*(${NUM})\\b(?!\\s*(?:litri|euro))`));
  if (price && toNum(price[1]) > 0 && toNum(price[1]) < 5) {
    out.pricePerUnit = toNum(price[1]);
    s = s.replace(price[0], " ");
  }

  const liters = s.match(new RegExp(`(${NUM})\\s*(?:litri|litro|lt|l)\\b`));
  if (liters) {
    out.kind = "fuel";
    out.liters = toNum(liters[1]);
    s = s.replace(liters[0], " ");
  }

  const total = s.match(new RegExp(`(${NUM})\\s*euro\\b`)) ?? s.match(new RegExp(`\\bdi\\s*(${NUM})\\b`));
  if (total && toNum(total[1]) > 0) out.totalCost = toNum(total[1]);

  if (/\bnon\s+(?:il\s+)?pieno\b|\bparziale\b/.test(s)) out.fullTank = false;
  else if (/\bpieno\b/.test(s)) out.fullTank = true;
  if (out.kind === undefined && (out.fullTank !== undefined || /\brifornimento\b|\bbenzina\b|\bdiesel\b|\bgasolio\b/.test(s))) out.kind = "fuel";

  // completa la terza grandezza se ne mancano solo una
  if (out.totalCost === undefined && out.kWh && out.pricePerUnit) out.totalCost = Math.round(out.kWh * out.pricePerUnit * 100) / 100;
  if (out.pricePerUnit === undefined && out.kWh && out.totalCost) out.pricePerUnit = Math.round((out.totalCost / out.kWh) * 1000) / 1000;
  if (out.totalCost === undefined && out.liters && out.pricePerUnit) out.totalCost = Math.round(out.liters * out.pricePerUnit * 100) / 100;
  if (out.pricePerUnit === undefined && out.liters && out.totalCost) out.pricePerUnit = Math.round((out.totalCost / out.liters) * 1000) / 1000;

  // veicolo: la targa o una parola del nome (es. "golf" in "Volkswagen Golf")
  let best = 0;
  for (const v of vehicles) {
    const plate = v.plate?.toLowerCase().replace(/\s/g, "");
    let score = plate && s.replace(/\s/g, "").includes(plate) ? 10 : 0;
    for (const w of v.name.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (w.length >= 3 && new RegExp(`\\b${w}\\b`, "u").test(s)) score += w.length;
    }
    if (score > best) {
      best = score;
      out.vehicleId = v.id;
    }
  }
  return out;
}
