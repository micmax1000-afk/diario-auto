// Digital Goods API — disponibile SOLO dentro una Trusted Web Activity (TWA)
// pubblicata su Google Play, non nel browser normale. Non fa parte dei tipi
// standard del DOM, quindi va dichiarata a mano.
// Spec: https://github.com/WICG/digital-goods

export interface ItemDetails {
  itemId: string;
  title: string;
  description: string;
  price: {
    currency: string;
    value: string; // es. "4.99"
  };
  subscriptionPeriod?: string; // es. "P1M" (ISO 8601 duration) per gli abbonamenti
  freeTrialPeriod?: string;
  introductoryPrice?: {
    currency: string;
    value: string;
  };
  introductoryPricePeriod?: string;
}

export interface PurchaseDetails {
  itemId: string;
  purchaseToken: string;
}

export interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<ItemDetails[]>;
  listPurchases(): Promise<PurchaseDetails[]>;
  listPurchaseHistory(): Promise<PurchaseDetails[]>;
  consume(purchaseToken: string): Promise<void>;
}

declare global {
  interface Window {
    getDigitalGoodsService?: (paymentMethod: string) => Promise<DigitalGoodsService>;
  }
}
