import { useEffect, useState } from "react";
import {
  getBillingStatus,
  listAvailableProducts,
  purchaseProLifetime,
  isProUnlocked,
  type BillingStatus,
  type PurchaseResult,
} from "./digitalGoods";
import type { ItemDetails } from "./digitalGoodsTypes";

interface UsePremiumPurchase {
  status: BillingStatus | "checking";
  products: ItemDetails[];
  unlocked: boolean;
  purchasing: boolean;
  restoring: boolean;
  purchase: () => Promise<PurchaseResult>;
  restore: () => Promise<boolean>;
}

/**
 * Espone lo stato di Google Play Billing, il prodotto "Pro Lifetime" e se
 * risulta già sbloccato. `status === "unavailable"` copre sia il browser
 * normale sia una TWA senza Play Billing configurato: l'interfaccia deve
 * gestirlo mostrando un messaggio, mai un pulsante che poi fallisce
 * silenziosamente al click.
 */
export function usePremiumPurchase(): UsePremiumPurchase {
  const [status, setStatus] = useState<BillingStatus | "checking">("checking");
  const [products, setProducts] = useState<ItemDetails[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getBillingStatus();
      if (cancelled) return;
      setStatus(s);
      if (s === "ready") {
        const [items, alreadyUnlocked] = await Promise.all([listAvailableProducts(), isProUnlocked()]);
        if (cancelled) return;
        setProducts(items);
        setUnlocked(alreadyUnlocked);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function purchase(): Promise<PurchaseResult> {
    setPurchasing(true);
    try {
      const result = await purchaseProLifetime();
      if (result.success) setUnlocked(true);
      return result;
    } finally {
      setPurchasing(false);
    }
  }

  async function restore(): Promise<boolean> {
    setRestoring(true);
    try {
      const found = await isProUnlocked();
      setUnlocked(found);
      return found;
    } finally {
      setRestoring(false);
    }
  }

  return { status, products, unlocked, purchasing, restoring, purchase, restore };
}
