// Bridge verso il plugin nativo Android (Kotlin) che parla direttamente con
// Google Play Billing. Il plugin vero e proprio vive in
// android/app/src/main/java/com/micmax/diarioauto/PlayBillingPlugin.kt
//
// Sostituisce la Digital Goods API (vedi digitalGoods.ts), che esiste solo
// dentro una Trusted Web Activity — non in un'app Capacitor come questa.
// Fuori da un'app Capacitor nativa (cioè nel normale browser) questo modulo
// non viene mai chiamato: digitalGoods.ts sceglie il percorso giusto in
// base a Capacitor.isNativePlatform().

import { registerPlugin } from "@capacitor/core";

export interface NativeProduct {
  itemId: string;
  title: string;
  description: string;
  priceValue: string; // già formattato da Google, es. "4,99 €"
  priceCurrency: string;
}

export interface NativePurchase {
  itemId: string;
  purchaseToken: string;
}

export interface NativePurchaseResult {
  success: boolean;
  purchaseToken?: string;
  errorReason?: "unavailable" | "cancelled" | "failed";
}

export interface PlayBillingPlugin {
  getStatus(): Promise<{ status: "ready" | "unavailable" }>;
  queryProducts(): Promise<{ products: NativeProduct[] }>;
  queryPurchases(): Promise<{ purchases: NativePurchase[] }>;
  purchase(): Promise<NativePurchaseResult>;
}

const NativePlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");

export default NativePlayBilling;
