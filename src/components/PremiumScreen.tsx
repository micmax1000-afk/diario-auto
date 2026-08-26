import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePremiumPurchase } from "../services/billing/usePremiumPurchase";
import type { ProductId } from "../services/billing/digitalGoods";

interface Props {
  onClose: () => void;
  /**
   * purchaseToken passato solo a scopo informativo/di log: per la Fase 1
   * (nessun backend) l'entitlement è già gestito da isProUnlocked() dentro
   * l'hook, che verifica direttamente con Google Play. Se in futuro si
   * aggiungono funzioni con costi ricorrenti per te, quelle avranno bisogno
   * di una verifica server-side separata di questo stesso meccanismo.
   */
  onPurchaseToken?: (productId: ProductId, purchaseToken: string) => void;
}

export default function PremiumScreen({ onClose, onPurchaseToken }: Props) {
  const { t } = useTranslation();
  const { status, products, unlocked, purchasing, restoring, purchase, restore } = usePremiumPurchase();
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  async function handlePurchase() {
    const result = await purchase();
    if (result.success && result.purchaseToken) {
      onPurchaseToken?.(products[0]?.itemId as ProductId, result.purchaseToken);
    }
  }

  async function handleRestore() {
    const found = await restore();
    setRestoreMessage(found ? t("premium.restoreFound") : t("premium.restoreNotFound"));
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="premium-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="premium-title">{t("premium.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          {status === "checking" && <p className="empty-state__body">{t("premium.checking")}</p>}

          {status === "unavailable" && (
            <div className="empty-state">
              <p className="empty-state__title">{t("premium.unavailableTitle")}</p>
              <p className="empty-state__body">{t("premium.unavailableBody")}</p>
            </div>
          )}

          {status === "ready" && unlocked && (
            <div className="empty-state">
              <p className="empty-state__title">✓ {t("premium.alreadyUnlockedTitle")}</p>
              <p className="empty-state__body">{t("premium.alreadyUnlockedBody")}</p>
            </div>
          )}

          {status === "ready" && !unlocked && products.length === 0 && (
            <p className="empty-state__body">{t("premium.noProducts")}</p>
          )}

          {status === "ready" && !unlocked && products.length > 0 && (
            <div className="record-list">
              {products.map((item) => (
                <div key={item.itemId} className="record-card">
                  <div className="record-card__header">
                    <div className="record-card__title-group">
                      <span className="record-card__title">{item.title}</span>
                      <span className="record-card__meta">{item.description}</span>
                    </div>
                    <span className="record-card__title">
                      {item.price.value} {item.price.currency}
                    </span>
                  </div>
                  <div className="record-card__actions">
                    <button type="button" className="btn btn--primary" disabled={purchasing} onClick={handlePurchase}>
                      {purchasing ? t("premium.processing") : t("premium.unlock")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {status === "ready" && !unlocked && (
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button type="button" className="btn btn--ghost btn--small" disabled={restoring} onClick={handleRestore}>
                {restoring ? t("premium.processing") : t("premium.restorePurchase")}
              </button>
              {restoreMessage && <p className="empty-state__body" style={{ marginTop: "0.5rem" }}>{restoreMessage}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
