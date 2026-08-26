import { useTranslation } from "react-i18next";
import type { ChargingEntry } from "../types";
import { groupByMonth } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getCurrencySymbol, kmToDisplayDistance } from "../utils/settings";
import CategoryIcon from "./CategoryIcon";

interface Props {
  entries: ChargingEntry[];
  onEdit: (entry: ChargingEntry) => void;
  onDelete: (id: string) => void;
}

export default function ChargingList({ entries, onEdit, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, currency, distanceUnit } = useAppSettings();
  const currencySymbol = getCurrencySymbol(currency);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("charging.emptyTitle")}</p>
        <p className="empty-state__body">{t("charging.emptyBody")}</p>
      </div>
    );
  }

  const totalKWh = entries.reduce((sum, e) => sum + e.kWh, 0);
  const totalCost = entries.reduce((sum, e) => sum + e.totalCost, 0);
  const avgPrice = totalKWh > 0 ? totalCost / totalKWh : null;
  const monthGroups = groupByMonth(entries, (e) => e.date);

  return (
    <div>
      <div className="stat-row">
        <div className="stat-chip">
          <span className="stat-chip__label">{t("charging.totalKWh")}</span>
          <span className="stat-chip__value">{totalKWh.toFixed(1)}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip__label">{t("charging.totalSpent")}</span>
          <span className="stat-chip__value">{formatMoney(totalCost)}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip__label">{t("charging.avgPrice")}</span>
          <span className="stat-chip__value">{avgPrice !== null ? `${formatMoney(avgPrice, 3)}/kWh` : "—"}</span>
        </div>
      </div>

      {monthGroups.map((group, i) => {
        const monthKWh = group.entries.reduce((sum, e) => sum + e.kWh, 0);
        const monthCost = group.entries.reduce((sum, e) => sum + e.totalCost, 0);
        const sortedEntries = [...group.entries].sort((a, b) => b.km - a.km);

        return (
          <details key={group.key} className="month-group" open={i === 0}>
            <summary className="month-group__summary">
              <span className="month-group__label">
                <span className="month-group__chevron" />
                {group.label}
              </span>
              <span className="month-group__stats">
                <span>{t("charging.chargesCount", { count: group.entries.length })}</span>
                <span>{monthKWh.toFixed(1)} kWh</span>
                <span>
                  <strong>{formatMoney(monthCost)}</strong>
                </span>
              </span>
            </summary>

            <div className="month-group__body">
              {sortedEntries.map((entry) => (
                <div key={entry.id} className="record-card">
                  <div className="record-card__header">
                    <CategoryIcon kind="charging" category="ricarica" />
                    <div className="record-card__title-group">
                      <span className="record-card__title">
                        {entry.location ?? t("charging.defaultLocationLabel")}
                        {entry.atHome && <span style={{ opacity: 0.7 }}> · {t("charging.atHomeTag")}</span>}
                      </span>
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
                      <span className="record-card__row-label">kWh</span>
                      <span className="record-card__row-value mono">{entry.kWh}</span>
                    </div>
                    <div className="record-card__row">
                      <span className="record-card__row-label">{currencySymbol}/kWh</span>
                      <span className="record-card__row-value mono">{entry.pricePerKWh.toFixed(3)}</span>
                    </div>
                    <div className="record-card__row">
                      <span className="record-card__row-label">{t("fuel.columns.cost")}</span>
                      <span className="record-card__row-value mono">{formatMoney(entry.totalCost)}</span>
                    </div>
                    {entry.powerKW !== undefined && (
                      <div className="record-card__row">
                        <span className="record-card__row-label">{t("chargingForm.power")}</span>
                        <span className="record-card__row-value mono">{entry.powerKW} kW</span>
                      </div>
                    )}
                  </div>
                  {entry.notes && <p className="record-card__note">{entry.notes}</p>}
                  <div className="record-card__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onEdit(entry)}>
                      {t("fuel.edit")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger btn--small"
                      onClick={() => onDelete(entry.id)}
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
