import type { DigitalGoodsService, ItemDetails, PurchaseDetails } from "./digitalGoodsTypes";

// Identificatore del metodo di pagamento richiesto sia da PaymentRequest che
// da getDigitalGoodsService: è una costante fissa definita dalla spec, non
// un URL da modificare.
const PLAY_BILLING_METHOD = "https://play.google.com/billing";

// L'ID prodotto va definito IDENTICO nella Play Console (Prodotti in app →
// tipo "Prodotto gestito", NON abbonamento — è un acquisto singolo, non
// ricorrente) prima che le query/acquisti funzionino.
export const PRODUCT_IDS = {
  proLifetime: "diario_auto_pro_lifetime",
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

let cachedService: DigitalGoodsService | null | undefined;

/**
 * true SOLO se l'app gira dentro una Trusted Web Activity (TWA) Android con
 * Google Play Billing disponibile. Nel browser normale (anche su Android,
 * anche installata come PWA "Aggiungi a schermata Home") è sempre false:
 * Play Billing esiste solo dentro un'app pubblicata su Play Store.
 */
export function isDigitalGoodsAvailable(): boolean {
  return typeof window !== "undefined" && "getDigitalGoodsService" in window;
}

/**
 * Ottiene (e mette in cache) l'istanza del servizio Digital Goods.
 * Ritorna null se non disponibile — il chiamante deve sempre gestire questo
 * caso mostrando un fallback, mai assumere che la chiamata funzioni.
 */
async function getService(): Promise<DigitalGoodsService | null> {
  if (cachedService !== undefined) return cachedService;
  if (!isDigitalGoodsAvailable() || !window.getDigitalGoodsService) {
    cachedService = null;
    return null;
  }
  try {
    cachedService = await window.getDigitalGoodsService(PLAY_BILLING_METHOD);
  } catch {
    // può fallire anche dentro una TWA se Play Billing non è configurato
    // correttamente (assetlinks.json mancante, app non pubblicata, ecc.)
    cachedService = null;
  }
  return cachedService;
}

export type BillingStatus =
  | "unavailable" // browser normale o TWA senza Play Billing configurato
  | "ready"; // pronto per interrogare/acquistare prodotti

export async function getBillingStatus(): Promise<BillingStatus> {
  const service = await getService();
  return service ? "ready" : "unavailable";
}

/** Recupera prezzo/periodo dei prodotti abbonamento definiti in Play Console. Vuoto se non disponibile. */
export async function listAvailableProducts(): Promise<ItemDetails[]> {
  const service = await getService();
  if (!service) return [];
  try {
    return await service.getDetails(Object.values(PRODUCT_IDS));
  } catch {
    return [];
  }
}

/** Acquisti attivi dell'utente secondo Google Play. Usato per verificare l'entitlement all'avvio e per "Ripristina acquisto". */
export async function listActivePurchases(): Promise<PurchaseDetails[]> {
  const service = await getService();
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
 * Avvia l'acquisto singolo (non ricorrente) tramite l'API PaymentRequest
 * standard con il metodo di pagamento Google Play. Per la Fase 1 (nessun
 * backend) l'app considera l'acquisto valido non appena Google Play lo
 * conferma — vedi isProUnlocked(). Se in futuro si aggiungono funzioni con
 * costi ricorrenti per te (cloud/AI), quelle sì richiederanno una verifica
 * server-side del purchaseToken prima di sbloccarle: non riusare questa
 * stessa logica "client-trust" per quelle.
 */
export async function purchaseProLifetime(): Promise<PurchaseResult> {
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
 */
export async function consumePurchase(purchaseToken: string): Promise<void> {
  const service = await getService();
  if (!service) return;
  await service.consume(purchaseToken);
}
