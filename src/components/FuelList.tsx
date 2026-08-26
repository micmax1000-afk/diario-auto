import { useTranslation } from "react-i18next";
import type { FuelEntry } from "../types";
import { calculateConsumption, averageConsumption, groupByMonth } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import CategoryIcon from "./CategoryIcon";

interface Props {
  entries: FuelEntry[];
  onEdit: (entry: FuelEntry) => void;
  onDelete: (id: string) => void;
}

export default function FuelList({ entries, onEdit, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, distanceUnit } = useAppSettings();
  const points = calculateConsumption(entries);
  const sources = Array.from(new Set(entries.map((e) => e.source)));
  const monthGroups = groupByMonth(entries, (e) => e.date);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("fuel.emptyTitle")}</p>
        <p className="empty-state__body">{t("fuel.emptyBody")}</p>
      </div>
    );
  }

  return (
    <div>
      {sources.length > 0 && (
        <div className="stat-row">
          {sources.map((source) => {
            const avg = averageConsumption(points, source);
            return (
              <div className="stat-chip" key={source}>
                <span className="stat-chip__label">{t(`fuelType.${source}`)}</span>
                <span className="stat-chip__value">{avg !== null ? `${avg.toFixed(1)} km/l` : "—"}</span>
              </div>
            );
          })}
        </div>
      )}

      {monthGroups.map((group, i) => {
        const monthTotal = group.entries.reduce((sum, e) => sum + e.totalCost, 0);
        const monthLiters = group.entries.reduce((sum, e) => sum + e.liters, 0);
        const sortedEntries = [...group.entries].sort((a, b) => b.km - a.km);

        return (
          <details key={group.key} className="month-group" open={i === 0}>
            <summary className="month-group__summary">
              <span className="month-group__label">
                <span className="month-group__chevron" />
                {group.label}
              </span>
              <span className="month-group__stats">
                <span>{t("fuel.fillupsCount", { count: group.entries.length })}</span>
                <span>{monthLiters.toFixed(1)} L</span>
                <span>
                  <strong>{formatMoney(monthTotal)}</strong>
                </span>
              </span>
            </summary>

            <div className="month-group__body">
              {sortedEntries.map((entry) => {
                const point = points.find((p) => p.toKm === entry.km);
                const unit = entry.source === "elettrico" ? "kWh" : "L";
                const pricePerUnit = entry.liters > 0 ? entry.totalCost / entry.liters : null;
                return (
                  <div key={entry.id} className="record-card">
                    <div className="record-card__header">
                      <CategoryIcon kind="fuel" category={entry.source} />
                      <div className="record-card__title-group">
                        <span className="record-card__title">{t(`fuelType.${entry.source}`)}</span>
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
                        <span className="record-card__row-label">{t("fuel.columns.quantity")}</span>
                        <span className="record-card__row-value mono">
                          {entry.liters} {unit}
                        </span>
                      </div>
                      <div className="record-card__row">
                        <span className="record-card__row-label">{t("fuel.columns.cost")}</span>
                        <span className="record-card__row-value mono">{formatMoney(entry.totalCost)}</span>
                      </div>
                      {pricePerUnit !== null && (
                        <div className="record-card__row">
                          <span className="record-card__row-label">{t("fuel.pricePerUnitLabel", { unit })}</span>
                          <span className="record-card__row-value mono">{pricePerUnit.toFixed(3)}</span>
                        </div>
                      )}
                      <div className="record-card__row">
                        <span className="record-card__row-label">{t("fuel.columns.consumption")}</span>
                        <span className="record-card__row-value mono">
                          {point ? `${point.kmPerLiter.toFixed(1)} km/l` : entry.fullTank ? "—" : t("fuel.partial")}
                        </span>
                      </div>
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
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
