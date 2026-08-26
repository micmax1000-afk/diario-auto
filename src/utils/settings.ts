import { getMeta, setMeta } from "./db";

// ---------- Valuta ----------
// Solo il simbolo/formato cambia: i numeri salvati restano invariati.
// Cambiare valuta NON converte gli importi storici (sarebbe fuorviante senza
// un tasso di cambio storico reale) — è un'etichetta di visualizzazione,
// non una conversione.

export interface CurrencyOption {
  code: string;
  symbol: string;
  labelKey: string; // chiave i18n per il nome esteso nel selettore
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "EUR", symbol: "€", labelKey: "currency.EUR" },
  { code: "USD", symbol: "$", labelKey: "currency.USD" },
  { code: "GBP", symbol: "£", labelKey: "currency.GBP" },
  { code: "CHF", symbol: "CHF", labelKey: "currency.CHF" },
  { code: "PLN", symbol: "zł", labelKey: "currency.PLN" },
  { code: "RON", symbol: "lei", labelKey: "currency.RON" },
  { code: "CZK", symbol: "Kč", labelKey: "currency.CZK" },
  { code: "HUF", symbol: "Ft", labelKey: "currency.HUF" },
  { code: "SEK", symbol: "kr", labelKey: "currency.SEK" },
  { code: "NOK", symbol: "kr", labelKey: "currency.NOK" },
  { code: "DKK", symbol: "kr", labelKey: "currency.DKK" },
  { code: "TRY", symbol: "₺", labelKey: "currency.TRY" },
  { code: "JPY", symbol: "¥", labelKey: "currency.JPY" },
  { code: "CNY", symbol: "¥", labelKey: "currency.CNY" },
  { code: "KRW", symbol: "₩", labelKey: "currency.KRW" },
  { code: "RUB", symbol: "₽", labelKey: "currency.RUB" },
  { code: "INR", symbol: "₹", labelKey: "currency.INR" },
  { code: "IDR", symbol: "Rp", labelKey: "currency.IDR" },
  { code: "THB", symbol: "฿", labelKey: "currency.THB" },
  { code: "VND", symbol: "₫", labelKey: "currency.VND" },
  { code: "PHP", symbol: "₱", labelKey: "currency.PHP" },
  { code: "BRL", symbol: "R$", labelKey: "currency.BRL" },
  { code: "MXN", symbol: "$", labelKey: "currency.MXN" },
  { code: "ARS", symbol: "$", labelKey: "currency.ARS" },
  { code: "CAD", symbol: "$", labelKey: "currency.CAD" },
  { code: "AUD", symbol: "$", labelKey: "currency.AUD" },
  { code: "AED", symbol: "د.إ", labelKey: "currency.AED" },
];

const DEFAULT_CURRENCY = "EUR";
const CURRENCY_META_KEY = "settings:currency";

// Mappa regione (parte finale del locale del dispositivo, es. "PL" da "pl-PL")
// -> valuta più probabile. Usata solo come stima ragionevole alla primissima
// apertura, quando l'utente non ha ancora scelto nulla — resta comunque
// modificabile a mano in qualunque momento dalle Impostazioni.
const REGION_TO_CURRENCY: Record<string, string> = {
  IT: "EUR", ES: "EUR", PT: "EUR", DE: "EUR", FR: "EUR", NL: "EUR", AT: "EUR", IE: "EUR", GR: "EUR",
  PL: "PLN", RO: "RON", CZ: "CZK", HU: "HUF", SE: "SEK", NO: "NOK", DK: "DKK", TR: "TRY",
  GB: "GBP", CH: "CHF",
  RU: "RUB", IN: "INR", ID: "IDR", BR: "BRL", TH: "THB", VN: "VND", PH: "PHP",
  MX: "MXN", AR: "ARS", CA: "CAD", AU: "AUD",
  CN: "CNY", KR: "KRW",
  AE: "AED", SA: "AED", JP: "JPY", US: "USD",
};

function guessCurrencyFromDeviceLocale(): string {
  try {
    const locale = navigator.language || "";
    const region = locale.split("-")[1]?.toUpperCase();
    if (region && REGION_TO_CURRENCY[region]) return REGION_TO_CURRENCY[region];
  } catch {
    // navigator non disponibile (es. rendering lato server) - ignora e usa il default
  }
  return DEFAULT_CURRENCY;
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "€";
}

/** Formatta un importo con il simbolo scelto, es. "€ 42.50" oppure "$ 42.50". */
export function formatCurrency(value: number, code: string, decimals = 2): string {
  const symbol = getCurrencySymbol(code);
  return `${symbol} ${value.toFixed(decimals)}`;
}

export async function loadCurrencyPreference(): Promise<string> {
  const stored = await getMeta(CURRENCY_META_KEY);
  return stored ?? guessCurrencyFromDeviceLocale();
}

export async function saveCurrencyPreference(code: string): Promise<void> {
  await setMeta(CURRENCY_META_KEY, code);
}

// ---------- Unità di distanza ----------
// I dati restano SEMPRE salvati in km (nessuna ambiguità nello storico o
// nei calcoli). La scelta "miglia" converte solo ciò che viene mostrato,
// non cambia ancora i campi di inserimento dei form, che restano in km.

export type DistanceUnit = "km" | "mi";

const DISTANCE_UNIT_META_KEY = "settings:distanceUnit";
const KM_TO_MILES = 0.621371;

export function kmToDisplayDistance(km: number, unit: DistanceUnit): number {
  return unit === "mi" ? km * KM_TO_MILES : km;
}

/** Formatta una distanza in km convertendola nell'unità scelta, con etichetta. es. "128 mi" o "206 km". */
export function formatDistance(km: number, unit: DistanceUnit, locale: string): string {
  const converted = kmToDisplayDistance(km, unit);
  return `${converted.toLocaleString(locale, { maximumFractionDigits: 0 })} ${unit}`;
}

export async function loadDistanceUnitPreference(): Promise<DistanceUnit> {
  const stored = await getMeta(DISTANCE_UNIT_META_KEY);
  return stored === "mi" ? "mi" : "km";
}

export async function saveDistanceUnitPreference(unit: DistanceUnit): Promise<void> {
  await setMeta(DISTANCE_UNIT_META_KEY, unit);
}

// ---------- Unità di temperatura (dati OBD) ----------
// I dati OBD sono sempre letti e salvati in Celsius (è l'unità nativa dei PID
// standard) — questa impostazione converte solo ciò che viene mostrato
// nell'interfaccia, stesso principio delle distanze.

export type TemperatureUnit = "C" | "F";

const TEMPERATURE_UNIT_META_KEY = "settings:temperatureUnit";

export function celsiusToDisplayTemp(celsius: number, unit: TemperatureUnit): number {
  return unit === "F" ? celsius * 1.8 + 32 : celsius;
}

/** Converte dal valore mostrato (nell'unità scelta dall'utente) di nuovo in Celsius, per confronti/soglie interne. */
export function displayTempToCelsius(value: number, unit: TemperatureUnit): number {
  return unit === "F" ? (value - 32) / 1.8 : value;
}

export function formatTemp(celsius: number, unit: TemperatureUnit): string {
  return `${Math.round(celsiusToDisplayTemp(celsius, unit))}°${unit}`;
}

export async function loadTemperatureUnitPreference(): Promise<TemperatureUnit> {
  const stored = await getMeta(TEMPERATURE_UNIT_META_KEY);
  return stored === "F" ? "F" : "C";
}

export async function saveTemperatureUnitPreference(unit: TemperatureUnit): Promise<void> {
  await setMeta(TEMPERATURE_UNIT_META_KEY, unit);
}
