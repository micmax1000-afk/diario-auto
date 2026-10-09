import { useAppSettings } from "../contexts/AppSettingsContext";
import { getCurrencySymbol } from "./settings";

/** Simbolo della valuta scelta, da passare come {{cur}} alle etichette dei moduli (es. "Costo totale ({{cur}})"). */
export function useCurrencySymbol(): string {
  return getCurrencySymbol(useAppSettings().currency);
}
