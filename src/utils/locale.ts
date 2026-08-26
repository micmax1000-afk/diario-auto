/**
 * Ritorna il codice locale da usare per Intl/toLocaleString.
 * Per l'arabo forza le cifre latine (0-9) invece di quelle arabo-indiane (٠-٩):
 * chilometraggi e importi restano più leggibili e coerenti con il resto dell'interfaccia.
 */
export function getNumberLocale(lang: string): string {
  const code = lang.split("-")[0];
  return code === "ar" ? "ar-u-nu-latn" : lang;
}
