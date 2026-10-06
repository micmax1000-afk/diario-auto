import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MaintenanceEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import CategoryIcon from "./CategoryIcon";

interface Props {
  entries: MaintenanceEntry[];
  onDelete: (id: string) => void;
}

export default function MaintenanceList({ entries, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, distanceUnit } = useAppSettings();
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const sorted = [...entries].sort((a, b) => b.km - a.km);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("maintenance.emptyTitle")}</p>
        <p className="empty-state__body">{t("maintenance.emptyBody")}</p>
      </div>
    );
  }

  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);

  return (
    <div>
      <div className="stat-row">
        <div className="stat-chip">
          <span className="stat-chip__label">{t("maintenance.totalSpent")}</span>
          <span className="stat-chip__value">{formatMoney(totalCost)}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip__label">{t("maintenance.interventions")}</span>
          <span className="stat-chip__value">{entries.length}</span>
        </div>
      </div>

      <div className="record-list">
        {sorted.map((entry) => (
          <div key={entry.id} className="record-card">
            <div className="record-card__header">
              <CategoryIcon kind="maintenance" category={entry.category} />
              <div className="record-card__title-group">
                <span className="record-card__title">{t(`maintenanceCategory.${entry.category}`)}</span>
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
                <span className="record-card__row-label">{distanceUnit.toUpperCase()}</span>
                <span className="record-card__row-value mono">
                  {kmToDisplayDistance(entry.km, distanceUnit).toLocaleString(getNumberLocale(i18n.language), { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="record-card__row">
                <span className="record-card__row-label">{t("maintenance.columns.cost")}</span>
                <span className="record-card__row-value mono">
                  {formatMoney(entry.cost)}
                  {entry.partsCost !== undefined && entry.laborCost !== undefined && (
                    <span className="cost-breakdown">
                      {" "}
                      ({t("maintenance.partsLabor", { parts: formatMoney(entry.partsCost), labor: formatMoney(entry.laborCost) })})
                    </span>
                  )}
                </span>
              </div>
              {entry.workshop && (
                <div className="record-card__row">
                  <span className="record-card__row-label">{t("maintenanceForm.workshop")}</span>
                  <span className="record-card__row-value">{entry.workshop}</span>
                </div>
              )}
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
