// Calcolo misure pneumatici basato sulle formule standard dell'industria
// (dominio pubblico, non proprietarie di nessun rivenditore): dalla sigla
// larghezza/altezza/cerchio si ricava il diametro totale della gomma, da cui
// si confrontano due misure per capire se una sostituzione è sicura.

export interface TireSize {
  width: number; // mm, es. 195
  aspectRatio: number; // %, es. 65
  rimDiameter: number; // pollici, es. 15
}

export interface TireCalculationResult {
  sidewallHeightMm: number;
  overallDiameterMm: number;
  circumferenceMm: number;
  revsPerKm: number;
}

export function calculateTire(size: TireSize): TireCalculationResult {
  const sidewallHeightMm = size.width * (size.aspectRatio / 100);
  const overallDiameterMm = size.rimDiameter * 25.4 + 2 * sidewallHeightMm;
  const circumferenceMm = Math.PI * overallDiameterMm;
  const revsPerKm = circumferenceMm > 0 ? 1_000_000 / circumferenceMm : 0;
  return { sidewallHeightMm, overallDiameterMm, circumferenceMm, revsPerKm };
}

export interface TireComparisonResult {
  original: TireCalculationResult;
  alternative: TireCalculationResult;
  diameterDiffPercent: number; // positivo se l'alternativa è più grande
  speedometerErrorPercent: number; // errore approssimativo del tachimetro alla stessa velocità reale
  safety: "safe" | "caution" | "unsafe";
}

/**
 * Tolleranza standard di settore: entro ±3% è considerato sicuro senza
 * conseguenze pratiche; tra 3% e 5% è "attenzione" (alcuni costruttori lo
 * tollerano, altri no — verificare libretto); oltre il 5% è sconsigliato
 * (tachimetro, ABS/ESP e altezza da terra possono essere significativamente
 * alterati).
 */
export function compareTires(originalSize: TireSize, alternativeSize: TireSize): TireComparisonResult {
  const original = calculateTire(originalSize);
  const alternative = calculateTire(alternativeSize);
  const diameterDiffPercent = ((alternative.overallDiameterMm - original.overallDiameterMm) / original.overallDiameterMm) * 100;
  const speedometerErrorPercent = -diameterDiffPercent; // diametro maggiore -> tachimetro sottostima la velocità reale

  const absDiff = Math.abs(diameterDiffPercent);
  const safety: TireComparisonResult["safety"] = absDiff <= 3 ? "safe" : absDiff <= 5 ? "caution" : "unsafe";

  return { original, alternative, diameterDiffPercent, speedometerErrorPercent, safety };
}

/** Parsing di una sigla tipo "205/55R16" o "205/55 R16" in TireSize, null se non valida. */
export function parseTireSizeString(input: string): TireSize | null {
  const match = input.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})\s*R?\s*(\d{2}(?:\.\d)?)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const aspectRatio = Number(match[2]);
  const rimDiameter = Number(match[3]);
  if (width <= 0 || aspectRatio <= 0 || rimDiameter <= 0) return null;
  return { width, aspectRatio, rimDiameter };
}
