import { useCallback, useEffect, useState } from "react";
import { isProUnlocked } from "./digitalGoods";

interface UseProStatus {
  isPro: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Stato Pro leggero per gating diffuso nell'app (limite veicoli, export, ecc.),
 * separato da usePremiumPurchase (che gestisce anche prodotti/acquisto/UI).
 * Fuori da una TWA con Play Billing, isProUnlocked() ritorna sempre false —
 * quindi la versione web pubblica applica sempre i limiti Free, e il tasto
 * "Sblocca" mostrerà correttamente "disponibile solo dall'app Android"
 * invece di un blocco senza via d'uscita.
 */
export function useProStatus(): UseProStatus {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const unlocked = await isProUnlocked();
      setIsPro(unlocked);
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
