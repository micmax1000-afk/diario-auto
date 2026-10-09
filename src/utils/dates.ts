// Date "di calendario" secondo l'ora del telefono, non quella di Greenwich:
// new Date().toISOString().slice(0, 10) tra mezzanotte e le 2 in Italia dà
// ancora la data di ieri.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Data locale in formato AAAA-MM-GG (quello dei campi <input type="date">). */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Mese locale in formato AAAA-MM. */
export function localMonthString(d: Date = new Date()): string {
  return localDateString(d).slice(0, 7);
}

/** Giorno locale di una data salvata in formato ISO. */
export function isoToLocalDate(iso: string): string {
  return localDateString(new Date(iso));
}

/**
 * Converte la data scelta nel modulo in ISO da salvare. Se è lo stesso
 * giorno della data originale (modifica senza cambiare data) tiene quella;
 * altrimenti usa mezzogiorno locale, così il giorno resta lo stesso in
 * qualunque fuso orario.
 */
export function localDateToIso(date: string, original?: string): string {
  if (original && isoToLocalDate(original) === date) return original;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}
