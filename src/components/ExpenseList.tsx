import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import CategoryIcon from "./CategoryIcon";

interface Props {
  entries: ExpenseEntry[];
  onDelete: (id: string) => void;
}

export default function ExpenseList({ entries, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("expenses.emptyTitle")}</p>
        <p className="empty-state__body">{t("expenses.emptyBody")}</p>
      </div>
    );
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  return (
    <div>
      <div className="stat-row">
        <div className="stat-chip">
          <span className="stat-chip__label">{t("expenses.total")}</span>
          <span className="stat-chip__value">{formatMoney(totalAmount)}</span>
        </div>
        {Object.entries(byCategory).map(([cat, amount]) => (
          <div className="stat-chip" key={cat}>
            <span className="stat-chip__label">{t(`expenseCategory.${cat}`)}</span>
            <span className="stat-chip__value">{formatMoney(amount)}</span>
          </div>
        ))}
      </div>

      <div className="record-list">
        {sorted.map((entry) => (
          <div key={entry.id} className="record-card">
            <div className="record-card__header">
              <CategoryIcon kind="expense" category={entry.category} />
              <div className="record-card__title-group">
                <span className="record-card__title">{t(`expenseCategory.${entry.category}`)}</span>
                <span className="record-card__meta">
                  {new Date(entry.date).toLocaleDateString(getNumberLocale(i18n.language))}
                </span>
              </div>
              <div className="record-card__check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l6 6L20 6" />
                </svg>
              </div>
            </div>
            <div className="record-card__rows">
              <div className="record-card__row">
                <span className="record-card__row-label">{t("expenses.columns.amount")}</span>
                <span className="record-card__row-value mono">{formatMoney(entry.amount)}</span>
              </div>
            </div>
            <p className="record-card__note">{entry.description}</p>
            <div className="record-card__actions">
              {entry.photo && (
                <button type="button" className="thumb-btn" onClick={() => setZoomPhoto(entry.photo!)}>
                  <img src={entry.photo} alt="" />
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--danger btn--small" onClick={() => onDelete(entry.id)}>
                {t("common.remove")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {zoomPhoto && (
        <div className="modal-overlay" onClick={() => setZoomPhoto(null)}>
          <img src={zoomPhoto} alt="" className="photo-zoom" />
        </div>
      )}
    </div>
  );
}
