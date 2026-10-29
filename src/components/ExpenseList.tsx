import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import CategoryIcon from "./CategoryIcon";

interface Props {
  entries: ExpenseEntry[];
  onEdit: (entry: ExpenseEntry) => void;
}

export default function ExpenseList({ entries, onEdit }: Props) {
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
  const byCategory = Object.entries(
    entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const locale = getNumberLocale(i18n.language);

  return (
    <div>
      <section className="stotal">
        <span className="stotal__label">{t("expenses.total")}</span>
        <div className="stotal__value">{formatMoney(totalAmount)}</div>
        <div className="sbreak sbreak--flat">
          {byCategory.map(([cat, amount]) => {
            const pct = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
            return (
              <div key={cat} className="sbreak__row">
                <span className="sbreak__name">{t(`expenseCategory.${cat}`)}</span>
                <span className="sbreak__value">
                  {formatMoney(amount, 0)}
                  <small>{Math.round(pct)}%</small>
                </span>
                <span className="sbreak__bar" aria-hidden="true">
                  <i style={{ width: `${pct}%`, background: "var(--purple)" }} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mlist mlist--spaced">
        {sorted.map((entry) => {
          const title = t(`expenseCategory.${entry.category}`);
          return (
            <div
              key={entry.id}
              className="mrow"
              aria-label={`${t("common.edit")} · ${title}`}
              role="button"
              tabIndex={0}
              onClick={() => onEdit(entry)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEdit(entry);
                }
              }}
            >
              <CategoryIcon kind="expense" category={entry.category} />
              <span className="mrow__mid">
                <span className="mrow__title">{title}</span>
                {entry.description && <span className="mrow__sub">{entry.description}</span>}
              </span>
              {entry.photo && (
                <button
                  type="button"
                  className="mrow__photo"
                  aria-label={t("vehicleForm.photo")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomPhoto(entry.photo!);
                  }}
                >
                  <img src={entry.photo} alt="" />
                </button>
              )}
              <span className="mrow__end">
                <span className="mrow__amt">{formatMoney(entry.amount)}</span>
                <span className="mrow__date">
                  {new Date(entry.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "2-digit" })}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {zoomPhoto && (
        <div className="modal-overlay" onClick={() => setZoomPhoto(null)}>
          <img src={zoomPhoto} alt="" className="photo-zoom" />
        </div>
      )}
    </div>
  );
}
