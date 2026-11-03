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

const UNITS: Record<string, number> = {
  zero: 0, uno: 1, due: 2, tre: 3, "tré": 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16,
  diciassette: 17, diciotto: 18, diciannove: 19,
};
const TENS: [string, number][] = [
  ["vent", 20], ["trent", 30], ["quarant", 40], ["cinquant", 50], ["sessant", 60], ["settant", 70], ["ottant", 80], ["novant", 90],
];

/** Numero italiano scritto in lettere ("trentacinque", "duecentoventi", "novantaduemila"), o null. */
export function italianNumber(w: string): number | null {
  if (!w) return null;
  if (w in UNITS) return UNITS[w];
  if (w.startsWith("mille")) {
    const rest = w.slice(5);
    const r = rest ? italianNumber(rest) : 0;
    return r === null ? null : 1000 + r;
  }
  const mila = w.indexOf("mila");
  if (mila > 0) {
    const left = italianNumber(w.slice(0, mila));
    const rest = w.slice(mila + 4);
    const right = rest ? italianNumber(rest) : 0;
    return left === null || right === null ? null : left * 1000 + right;
  }
  const cento = w.indexOf("cento");
  if (cento >= 0) {
    const left = cento === 0 ? 1 : italianNumber(w.slice(0, cento));
    const rest = w.slice(cento + 5);
    const right = rest ? italianNumber(rest) : 0;
    return left === null || right === null || left > 9 ? null : left * 100 + right;
  }
  for (const [stem, n] of TENS) {
    if (!w.startsWith(stem)) continue;
    const rest = w.slice(stem.length);
    if (rest === "i" || rest === "a") return n; // venti, trenta
    const unit = rest.replace(/^[ia]/, ""); // ventidue, trentatré, ventuno, trentotto
    if (unit in UNITS && UNITS[unit] > 0 && UNITS[unit] < 10) return n + UNITS[unit];
  }
  return null;
}

/** Sostituisce i numeri detti a parole con le cifre: "venti euro a uno virgola ottantanove" → "20 euro a 1,89". */
function wordsToDigits(s: string): string {
  const out = s.split(" ").map((w) => {
    const n = italianNumber(w);
    return n === null ? w : String(n);
  });
  return out.join(" ").replace(/(\d+) virgola (\d+)/g, "$1,$2");
}

/** Quanti dati utili contiene un'interpretazione: serve a scegliere la migliore tra quelle proposte dal telefono. */
export function voiceScore(v: VoiceFuel): number {
  return [v.totalCost, v.pricePerUnit, v.liters ?? v.kWh, v.km, v.vehicleId].filter((x) => x !== undefined).length;
}

/** Interpreta la frase detta (in italiano) senza servizi esterni: solo regole sul testo. */
export function parseVoiceFuel(text: string, vehicles: Pick<Vehicle, "id" | "name" | "plate">[]): VoiceFuel {
  let s = wordsToDigits(` ${text.toLowerCase()} `.replace(/€/g, " euro ").replace(/[,;](?=\s)/g, " ").replace(/\s+/g, " "))
    // "20 euro e 50" → 20,50 euro
    .replace(/\b(\d{2,3})\s*euro\s*e\s*(\d{1,2})\b(?!\s*(?:km|litri|kwh))/g, "$1,$2 euro")
    // "1 euro e 90" / "1 e 90" → 1,90 (prezzo detto a voce)
    .replace(/\b(\d)\s*(?:euro\s*)?e\s*(\d{2,3})\b/g, "$1,$2");
  const out: VoiceFuel = {};

  // km: "92.900 km", "92900 chilometri"
  const km =
    s.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,7})\s*(?:km|chilometri|kilometri)\b/) ??
    // "km 92.900", "contachilometri 92900"
    s.match(/\b(?:km|chilometri|kilometri|contachilometri|contakm)\s*(?:a\s*|di\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})\b/);
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
    if (/litro|\/\s*l\b/.test(price[0])) out.kind ??= "fuel";
    s = s.replace(price[0], " ");
  }

  const liters = s.match(new RegExp(`(${NUM})\\s*(?:litri|litro|lt|l)\\b`));
  if (liters) {
    out.kind = "fuel";
    out.liters = toNum(liters[1]);
    s = s.replace(liters[0], " ");
  }

  // "20 euro", "20 €", ma anche "€20" / "euro 20" come scrive il riconoscimento vocale
  const total =
    s.match(new RegExp(`(${NUM})\\s*euro\\b`)) ??
    s.match(new RegExp(`\\beuro\\s*(${NUM})`)) ??
    s.match(new RegExp(`\\bdi\\s*(${NUM})\\b`));
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
