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

/** Prepara la frase: minuscole, € e kWh scritti in un solo modo, numeri a parole in cifre. */
function normalize(text: string): string {
  let s = ` ${text.toLowerCase()} `
    .replace(/€/g, " euro ")
    .replace(/\b(?:kilowatt|chilowatt)\s*(?:ora|ore)?\b|\bkw\s*h\b|\bkwh\b/g, " kwh ")
    .replace(/[,;](?=\s)/g, " ")
    .replace(/\s+/g, " ");
  // "un euro e 89", "un virgola 85": qui "un" è il numero 1
  s = s.replace(/\bun(?=\s+(?:euro|e|virgola)\b)/g, "uno");
  s = wordsToDigits(s);
  return (
    s
      // "92 mila 900", "92mila 900", "92mila" → 92900 / 92000
      .replace(/\b(\d{1,3})\s*mila(?:\s+(\d{1,3}))?\b/g, (_m, a: string, b?: string) => String(Number(a) * 1000 + Number(b ?? 0)))
      // "20 euro e 50 (centesimi)" → 20,50 euro
      .replace(/\b(\d{2,3})\s*euro\s*e\s*(\d{1,2})(?:\s*centesimi)?\b(?!\s*(?:km|litri|kwh))/g, "$1,$2 euro")
      // "1 euro e 90" / "1 e 90" → 1,90 (prezzo detto a voce)
      .replace(/\b(\d)\s*(?:euro\s*)?e\s*(\d{2,3})\b/g, "$1,$2")
      .replace(/\s+/g, " ")
  );
}

const PRICE_MAX = 4.5; // €/l, €/kg, €/kWh: sopra è un importo
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Interpreta la frase detta (in italiano) senza servizi esterni.
 * Prima trova tutti i numeri, poi decide cos'è ognuno guardando le parole vicine
 * (euro, litri, kWh, km, "al litro", "prezzo"...) e il valore.
 */
export function parseVoiceFuel(text: string, vehicles: Pick<Vehicle, "id" | "name" | "plate">[]): VoiceFuel {
  const full = normalize(text);
  let s = full;
  const out: VoiceFuel = {};
  const cut = (m: RegExpMatchArray) => {
    s = s.replace(m[0], " ");
  };

  // km: "92.900 km", "92 900 km", "km 92.900", "contachilometri 92900"
  const km =
    s.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{2,7})\s*(?:km|chilometri|kilometri)\b/) ??
    s.match(/\b(?:km|chilometri|kilometri|contachilometri|contakm)\s*(?:a\s*|di\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d{2,7})\b(?![.,]\d)/);
  if (km) {
    out.km = Number(km[1].replace(/[.\s]/g, ""));
    cut(km);
  }

  // prezzo dichiarato: "1,89 (euro) al litro", "0,25 al kwh", "1,89 €/l", "prezzo (di) 1,89"
  const priceUnit = s.match(new RegExp(`(${NUM})\\s*(?:euro\\s*)?(?:al\\s*(?:litro|lt|kg|chilo|kilo|kwh)\\b|/\\s*(?:l|litro|kg|kwh)\\b|per\\s*litro)`));
  const priceWord = s.match(new RegExp(`\\bprezzo\\s*(?:di\\s*|a\\s*)?(?:euro\\s*)?(${NUM})`));
  const priceDecl = priceUnit ?? priceWord;
  if (priceDecl && toNum(priceDecl[1]) > 0 && toNum(priceDecl[1]) <= PRICE_MAX) {
    out.pricePerUnit = toNum(priceDecl[1]);
    if (priceUnit && /kwh/.test(priceUnit[0])) out.kind = "charge";
    if (priceUnit && /litro|lt\b|\/\s*l\b|kg|chilo|kilo/.test(priceUnit[0])) out.kind = "fuel";
    cut(priceDecl);
  }

  // quantità: "40 litri", "40 l", "30 kwh"
  const kwh = s.match(new RegExp(`(${NUM})\\s*kwh\\b`));
  if (kwh) {
    out.kWh = toNum(kwh[1]);
    out.kind = "charge";
    cut(kwh);
  }
  const liters = s.match(new RegExp(`(${NUM})\\s*(?:litri|litro|lt|l)\\b`));
  if (liters) {
    out.liters = toNum(liters[1]);
    out.kind ??= "fuel";
    cut(liters);
  }

  // i numeri rimasti: importo o prezzo, secondo il valore e le parole vicine
  const nums = [...s.matchAll(new RegExp(`(?:\\b(euro)\\s*|\\b(a)\\s+)?(${NUM})(\\s*euro)?`, "g"))].map((m) => ({
    value: toNum(m[3]),
    euro: !!m[1] || !!m[4],
    afterA: !!m[2],
    decimal: /[.,]\d/.test(m[3]),
  }));
  if (out.pricePerUnit === undefined) {
    // un prezzo ha i decimali ed è piccolo; "a 1,89" o "1,89 €" lo rendono certo
    const cand = nums.filter((n) => n.value > 0 && n.value <= PRICE_MAX && (n.decimal || n.afterA));
    const pick = cand.find((n) => n.afterA) ?? cand.find((n) => n.decimal);
    if (pick) {
      out.pricePerUnit = pick.value;
      nums.splice(nums.indexOf(pick), 1);
    }
  }
  // importo: il più grande tra i numeri con "euro", altrimenti il più grande rimasto
  const amounts = nums.filter((n) => n.value > 0 && (n.euro || n.value > PRICE_MAX));
  const amount = (amounts.filter((n) => n.euro).length ? amounts.filter((n) => n.euro) : amounts).sort((a, b) => b.value - a.value)[0];
  if (amount) out.totalCost = amount.value;

  if (/\b(?:a|da|in)\s+casa\b|wallbox|garage/.test(full)) out.atHome = true;
  else if (/colonnin|supercharger|fuori casa/.test(full)) out.atHome = false;
  if (out.atHome !== undefined || /\bricaric/.test(full)) out.kind = "charge";

  if (/\bnon\s+(?:il\s+)?pieno\b|\bparziale\b/.test(full)) out.fullTank = false;
  else if (/\bpieno\b/.test(full)) out.fullTank = true;
  if (out.kind === undefined && (out.fullTank !== undefined || /\brifornimento\b|\bbenzina\b|\bdiesel\b|\bgasolio\b|\bgpl\b|\bmetano\b/.test(full))) out.kind = "fuel";

  // completa la terza grandezza se ne mancano solo una
  const qty = out.kWh ?? out.liters;
  if (out.totalCost === undefined && qty && out.pricePerUnit) out.totalCost = round(qty * out.pricePerUnit, 2);
  if (out.pricePerUnit === undefined && qty && out.totalCost) out.pricePerUnit = round(out.totalCost / qty, 3);

  // veicolo: la targa o una parola del nome (es. "golf" in "Volkswagen Golf")
  let best = 0;
  for (const v of vehicles) {
    const plate = v.plate?.toLowerCase().replace(/\s/g, "");
    let score = plate && full.replace(/\s/g, "").includes(plate) ? 10 : 0;
    for (const w of v.name.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (w.length >= 3 && new RegExp(`\\b${w}\\b`, "u").test(full)) score += w.length;
    }
    if (score > best) {
      best = score;
      out.vehicleId = v.id;
    }
  }
  return out;
}

export type VoiceKmCheck =
  | { status: "ok" }
  | { status: "lower" } // più bassi dei km attuali: non usabili
  | { status: "suffix"; suggestion: number } // detti solo gli ultimi numeri: "900" con 92.850 attuali → 92.900
  | { status: "jump"; distance: number }; // molto più alti del solito: possibile errore

/** Controlla i km detti a voce rispetto a quelli attuali del veicolo. */
export function checkVoiceKm(km: number, currentKm: number): VoiceKmCheck {
  if (km >= currentKm) {
    const distance = km - currentKm;
    return currentKm > 0 && distance > 2500 ? { status: "jump", distance } : { status: "ok" };
  }
  const digits = String(Math.round(km)).length;
  if (digits < String(Math.round(currentKm)).length) {
    // il primo valore sopra i km attuali che finisce con le cifre dette
    const base = 10 ** digits;
    let suggestion = Math.floor(currentKm / base) * base + km;
    if (suggestion < currentKm) suggestion += base;
    if (suggestion - currentKm <= 2500) return { status: "suffix", suggestion };
  }
  return { status: "lower" };
}
