import { Capacitor } from "@capacitor/core";
import type { DigitalGoodsService, ItemDetails, PurchaseDetails } from "./digitalGoodsTypes";
import NativePlayBilling from "./nativePlayBilling";

// Identificatore del metodo di pagamento richiesto sia da PaymentRequest che
// da getDigitalGoodsService: è una costante fissa definita dalla spec, non
// un URL da modificare. Usata solo nel percorso TWA (vedi sotto).
const PLAY_BILLING_METHOD = "https://play.google.com/billing";

// L'ID prodotto va definito IDENTICO nella Play Console (Prodotti in app →
// tipo "Prodotto gestito", NON abbonamento — è un acquisto singolo, non
// ricorrente) prima che le query/acquisti funzionino.
export const PRODUCT_IDS = {
  proLifetime: "diario_auto_pro_lifetime",
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// ---------------------------------------------------------------------
// Percorso nativo (Capacitor + plugin Kotlin PlayBillingPlugin) — quello
// realmente usato dall'app pubblicata su Play Store. Parla direttamente con
// la libreria ufficiale di Google Play Billing.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Percorso TWA (Digital Goods API + PaymentRequest) — tenuto come riserva
// per un eventuale futuro pacchetto TWA, ma NON è il percorso usato oggi:
// questa API esiste solo dentro una Trusted Web Activity, mai in un'app
// Capacitor né nel browser normale.
// ---------------------------------------------------------------------

let cachedService: DigitalGoodsService | null | undefined;

/** true SOLO dentro una Trusted Web Activity (TWA) Android con Play Billing disponibile. */
export function isDigitalGoodsAvailable(): boolean {
  return typeof window !== "undefined" && "getDigitalGoodsService" in window;
}

async function getTwaService(): Promise<DigitalGoodsService | null> {
  if (cachedService !== undefined) return cachedService;
  if (!isDigitalGoodsAvailable() || !window.getDigitalGoodsService) {
    cachedService = null;
    return null;
  }
  try {
    cachedService = await window.getDigitalGoodsService(PLAY_BILLING_METHOD);
  } catch {
    cachedService = null;
  }
  return cachedService;
}

// ---------------------------------------------------------------------
// Interfaccia pubblica unificata: usata dal resto dell'app (usePremiumPurchase,
// useProStatus) senza che sappiano quale dei due percorsi sopra è attivo.
// ---------------------------------------------------------------------

export type BillingStatus =
  | "unavailable" // browser normale, o né nativo né TWA con Play Billing configurato
  | "ready"; // pronto per interrogare/acquistare prodotti

export async function getBillingStatus(): Promise<BillingStatus> {
  if (isNative()) {
    try {
      const { status } = await NativePlayBilling.getStatus();
      return status;
    } catch {
      return "unavailable";
    }
  }
  const service = await getTwaService();
  return service ? "ready" : "unavailable";
}

/** Recupera prezzo/descrizione del prodotto "Pro Lifetime". Vuoto se non disponibile. */
export async function listAvailableProducts(): Promise<ItemDetails[]> {
  if (isNative()) {
    try {
      const { products } = await NativePlayBilling.queryProducts();
      return products.map((p) => ({
        itemId: p.itemId,
        title: p.title,
        description: p.description,
        // Google restituisce il prezzo già formattato per la lingua/valuta
        // dell'utente (es. "4,99 €"): lo teniamo intero in "value" e
        // lasciamo "currency" vuota per non duplicarla a schermo.
        price: { currency: "", value: p.priceValue },
      }));
    } catch {
      return [];
    }
  }
  const service = await getTwaService();
  if (!service) return [];
  try {
    return await service.getDetails(Object.values(PRODUCT_IDS));
  } catch {
    return [];
  }
}

/** Acquisti attivi dell'utente secondo Google Play. Usato per verificare l'entitlement all'avvio e per "Ripristina acquisto". */
export async function listActivePurchases(): Promise<PurchaseDetails[]> {
  if (isNative()) {
    try {
      const { purchases } = await NativePlayBilling.queryPurchases();
      return purchases ?? [];
    } catch {
      return [];
    }
  }
  const service = await getTwaService();
  if (!service) return [];
  try {
    return await service.listPurchases();
  } catch {
    return [];
  }
}

/**
 * true se Google Play conferma che questo dispositivo/account ha già
 * acquistato lo sblocco Pro. Per un acquisto singolo (non abbonamento) senza
 * backend di verifica, questo è il modo più affidabile disponibile: il dato
 * arriva comunque dal servizio Play, non da un flag locale manipolabile.
 * Non è forte quanto una verifica server-side col purchaseToken, ma è
 * adeguato per la Fase 1 (nessuna infrastruttura backend).
 */
export async function isProUnlocked(): Promise<boolean> {
  const purchases = await listActivePurchases();
  return purchases.some((p) => p.itemId === PRODUCT_IDS.proLifetime);
}

export interface PurchaseResult {
  success: boolean;
  purchaseToken?: string;
  errorReason?: "unavailable" | "cancelled" | "failed";
}

/**
 * Avvia l'acquisto singolo (non ricorrente) dello sblocco Pro. Per la Fase 1
 * (nessun backend) l'app considera l'acquisto valido non appena Google Play
 * lo conferma — vedi isProUnlocked(). Se in futuro si aggiungono funzioni con
 * costi ricorrenti (cloud/AI), quelle richiederanno una verifica
 * server-side del purchaseToken prima di sbloccarle: non riusare questa
 * stessa logica "client-trust" per quelle.
 */
export async function purchaseProLifetime(): Promise<PurchaseResult> {
  if (isNative()) {
    try {
      return await NativePlayBilling.purchase();
    } catch {
      return { success: false, errorReason: "failed" };
    }
  }

  if (!isDigitalGoodsAvailable() || typeof PaymentRequest === "undefined") {
    return { success: false, errorReason: "unavailable" };
  }

  try {
    const request = new PaymentRequest(
      [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku: PRODUCT_IDS.proLifetime } }],
      { total: { label: "Diario Auto Pro", amount: { currency: "EUR", value: "0" } } },
    );

    const response = await request.show();
    const purchaseToken = (response.details as { purchaseToken?: string } | undefined)?.purchaseToken;
    await response.complete("success");

    if (!purchaseToken) {
      return { success: false, errorReason: "failed" };
    }
    return { success: true, purchaseToken };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, errorReason: "cancelled" };
    }
    return { success: false, errorReason: "failed" };
  }
}

/**
 * ATTENZIONE: consume() è per prodotti CONSUMABILI (es. valuta di gioco
 * riacquistabile) — segna il prodotto come "usato" e permette un nuovo
 * acquisto dello stesso SKU. Per "diario_auto_pro_lifetime", che è uno
 * sblocco permanente NON consumabile, questa funzione non va mai chiamata:
 * richiamarla farebbe ridiventare il prodotto acquistabile, vanificando lo
 * sblocco a vita. Lasciata qui solo come riferimento per eventuali futuri
 * prodotti consumabili (es. crediti/report singoli), non collegata a nulla.
 * Funziona solo nel percorso TWA: nel plugin nativo l'acquisto viene invece
 * confermato (acknowledgePurchase), mai consumato — la distinzione è
 * intenzionale, non un pezzo mancante.
 */
export async function consumePurchase(purchaseToken: string): Promise<void> {
  if (isNative()) return; // per Pro Lifetime non va mai consumato, vedi sopra
  const service = await getTwaService();
  if (!service) return;
  await service.consume(purchaseToken);
}
