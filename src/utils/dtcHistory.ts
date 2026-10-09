import type { DtcReading } from "../types";

/** Oltre questo numero le letture più vecchie vengono scartate. */
const MAX_READINGS = 200;

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function sameCodes(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/**
 * Aggiunge una lettura allo storico, se serve. Si salvano le letture con
 * almeno un codice; una lettura senza codici solo se la precedente dello
 * stesso tipo ne aveva (così si vede quando sono spariti). Rileggere gli
 * stessi codici nello stesso giorno aggiorna la lettura esistente invece
 * di aggiungerne una nuova.
 * Restituisce null se lo storico non cambia.
 */
export function addDtcReading(history: DtcReading[], reading: DtcReading): DtcReading[] | null {
  const previous = [...history].reverse().find((r) => r.mode === reading.mode);

  if (reading.codes.length === 0 && (!previous || previous.codes.length === 0)) return null;

  if (previous && sameDay(previous.date, reading.date) && sameCodes(previous.codes, reading.codes)) {
    if (previous.km === reading.km) return null;
    return history.map((r) => (r.id === previous.id ? { ...r, date: reading.date, km: reading.km } : r));
  }

  return [...history, reading].slice(-MAX_READINGS);
}

export interface DtcOccurrence {
  /** Letture precedenti in cui il codice era presente. */
  count: number;
  first: DtcReading;
}

/** Quante volte un codice è comparso nelle letture, esclusa quella indicata. */
export function previousOccurrences(history: DtcReading[], code: string, excludeId?: string): DtcOccurrence | null {
  const matches = history.filter((r) => r.id !== excludeId && r.codes.includes(code));
  if (matches.length === 0) return null;
  return { count: matches.length, first: matches[0] };
}
