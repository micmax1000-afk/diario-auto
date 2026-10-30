import { useCallback, useEffect, useState } from "react";
import { isProUnlocked } from "./digitalGoods";
import { getMeta, setMeta } from "../../utils/db";

interface UseProStatus {
  isPro: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Interruttore dei pagamenti. Finché è false tutte le funzioni Pro sono gratis
 * per tutti e l'app non mostra né lucchetti né richieste di acquisto.
 * Per attivare il Pro: crea il prodotto in Play Console, metti true e pubblica.
 */
export const PRO_ENABLED = false;

/**
 * Chi usa l'app prima che il Pro sia attivo viene segnato come "utente della
 * prima ora": quando i pagamenti si accendono, per lui il Pro resta sbloccato.
 */
const EARLY_USER_KEY = "early-user";
export const EARLY_USERS_KEEP_PRO = true;

/**
 * Stato Pro leggero per gating diffuso nell'app (limite veicoli, export, ecc.),
 * separato da usePremiumPurchase (che gestisce anche prodotti/acquisto/UI).
 * Fuori da una TWA con Play Billing, isProUnlocked() ritorna sempre false —
 * quindi la versione web pubblica applica sempre i limiti Free, e il tasto
 * "Sblocca" mostrerà correttamente "disponibile solo dall'app Android"
 * invece di un blocco senza via d'uscita.
 */
export function useProStatus(): UseProStatus {
  const [isPro, setIsPro] = useState(!PRO_ENABLED);
  const [loading, setLoading] = useState(PRO_ENABLED);

  const refresh = useCallback(async () => {
    if (!PRO_ENABLED) {
      setIsPro(true);
      setLoading(false);
      void setMeta(EARLY_USER_KEY, "1").catch(() => undefined);
      return;
    }
    setLoading(true);
    try {
      const early = EARLY_USERS_KEEP_PRO && (await getMeta(EARLY_USER_KEY).catch(() => null)) === "1";
      setIsPro(early || (await isProUnlocked()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { isPro, loading, refresh };
}

/** Limite veicoli attivi per chi non ha ancora sbloccato Pro. */
export const FREE_VEHICLE_LIMIT = 2;
