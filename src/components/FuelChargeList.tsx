import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FuelEntry, ChargingEntry } from "../types";
import { calculateConsumption, averageConsumption, groupByMonth } from "../utils/calculations";
import { formatNumber, getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getCurrencySymbol, kmToDisplayDistance } from "../utils/settings";
import ActionGridIcon from "./ActionGridIcon";

type Filter = "all" | "fuel" | "electric";
type Period = "all" | "12m" | "6m" | "3m";

type Row =
  | { kind: "fuel"; entry: FuelEntry }
  | { kind: "charge"; entry: ChargingEntry };

interface Props {
  fuelEntries: FuelEntry[];
  chargingEntries: ChargingEntry[];
  /** Mostra i filtri Tutti / Carburante / Elettrico (inutili per un veicolo che non si ricarica). */
  showSourceFilters?: boolean;
  onEditFuel: (entry: FuelEntry) => void;
  onEditCharging: (entry: ChargingEntry) => void;
}

export default function FuelChargeList({
  fuelEntries,
  chargingEntries,
  showSourceFilters = true,
  onEditFuel,
  onEditCharging,
}: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, currency, distanceUnit } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const [filter, setFilter] = useState<Filter>("all");
  const [period, setPeriod] = useState<Period>("12m");

  const rows: Row[] = [
    ...fuelEntries.map((entry): Row => ({ kind: "fuel", entry })),
    ...chargingEntries.map((entry): Row => ({ kind: "charge", entry })),
  ].sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime() || b.entry.km - a.entry.km);

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("fuel.emptyTitle")}</p>
        <p className="empty-state__body">{t("fuel.emptyBody")}</p>
      </div>
    );
  }

  const filteredRows = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "fuel") return r.kind === "fuel";
    return r.kind === "charge";
  });

  const periodMonths = period === "12m" ? 12 : period === "6m" ? 6 : period === "3m" ? 3 : null;
  const periodCutoff = periodMonths ? new Date(new Date().setMonth(new Date().getMonth() - periodMonths)) : null;
  const periodFilteredRows = periodCutoff
    ? filteredRows.filter((r) => new Date(r.entry.date) >= periodCutoff)
    : filteredRows;

  // Totali del periodo scelto (prima erano sempre quelli di tutto lo storico).
  const totalCost = periodFilteredRows.reduce((sum, r) => sum + r.entry.totalCost, 0);
  const periodFuel = periodFilteredRows.filter((r) => r.kind === "fuel").map((r) => r.entry as FuelEntry);
  const consumptionPoints = calculateConsumption(periodFuel);
  const avgConsumption = averageConsumption(consumptionPoints);
  const allKm = periodFilteredRows.map((r) => r.entry.km);
  const totalDistance = allKm.length > 1 ? Math.max(...allKm) - Math.min(...allKm) : 0;

  // per calcolare il delta "+XXX km" rispetto alla voce precedente nello storico completo (non filtrato)
  const sortedByKm = [...rows].sort((a, b) => a.entry.km - b.entry.km);
  const deltaByEntryId = new Map<string, number | null>();
  sortedByKm.forEach((r, idx) => {
    const prev = idx > 0 ? sortedByKm[idx - 1] : null;
    deltaByEntryId.set(r.entry.id, prev ? r.entry.km - prev.entry.km : null);
  });

  return (
    <div className="fc-list">
      {showSourceFilters && (
        <div className="fc-list__filters">
          {(["all", "fuel", "electric"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`fc-list__filter ${filter === f ? "is-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? t("fuel.filterAll", "Tutti") : f === "fuel" ? t("fuel.filterFuel", "Carburante") : t("fuel.filterElectric", "Elettrico")}
            </button>
          ))}
        </div>
      )}

      <div className="fc-list__period">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="3m">{t("fuel.periodLast3", "Ultimi 3 mesi")}</option>
          <option value="6m">{t("fuel.periodLast6", "Ultimi 6 mesi")}</option>
          <option value="12m">{t("fuel.periodLast12", "Ultimi 12 mesi")}</option>
          <option value="all">{t("fuel.periodAll", "Sempre")}</option>
        </select>
      </div>

      <div className="fc-list__summary">
        <div className="fc-list__summary-item">
          <span>{t("fuel.summaryTotalCost", "Spesa totale")}</span>
          <strong>{formatMoney(totalCost)}</strong>
        </div>
        <div className="fc-list__summary-item">
          <span>{t("fuel.summaryAvgConsumption", "Consumo medio")}</span>
          <strong>{avgConsumption !== null && avgConsumption > 0 ? `${(100 / avgConsumption).toLocaleString(locale, { maximumFractionDigits: 1 })} l/100km` : "—"}</strong>
        </div>
        <div className="fc-list__summary-item">
          <span>{t("fuel.summaryTotalDistance", "Distanza totale")}</span>
          <strong>{kmToDisplayDistance(totalDistance, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} {distanceUnit}</strong>
        </div>
      </div>

      <div className="fc-list__items">
        {groupByMonth(periodFilteredRows, (r) => r.entry.date, locale).map((group) => (
          <section key={group.key} className="fc-month">
            <div className="fc-month__head">
              <span className="fc-month__label">{group.label}</span>
              <span className="fc-month__total">
                {group.entries.length}× · {formatMoney(group.entries.reduce((sum, r) => sum + r.entry.totalCost, 0))}
              </span>
            </div>
            {group.entries.map((row) => {
              const { entry } = row;
              const isFuel = row.kind === "fuel";
              const unit = isFuel ? "L" : "kWh";
              const quantity = isFuel ? (entry as FuelEntry).liters : (entry as ChargingEntry).kWh;
              const pricePerUnit = quantity > 0 ? entry.totalCost / quantity : null;
              const delta = deltaByEntryId.get(entry.id);
              const date = new Date(entry.date);

              return (
                <div
                  key={entry.id}
                  className="fc-item fc-item--tappable"
                  role="button"
                  tabIndex={0}
                  aria-label={t("fuel.edit")}
                  onClick={() => (isFuel ? onEditFuel(entry as FuelEntry) : onEditCharging(entry as ChargingEntry))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isFuel) onEditFuel(entry as FuelEntry);
                      else onEditCharging(entry as ChargingEntry);
                    }
                  }}
                >
                  <div className={`fc-item__icon fc-item__icon--${isFuel ? "fuel" : "charge"}`}>
                    <ActionGridIcon name={isFuel ? "fuel" : "bolt"} />
                  </div>
                  <div className="fc-item__body">
                    <div className="fc-item__top">
                      <span className="fc-item__date">
                        {date.toLocaleDateString(locale, {
                          day: "2-digit",
                          month: "short",
                          ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
                        })}
                      </span>
                      <span className={`fc-item__badge fc-item__badge--${isFuel ? "fuel" : "charge"}`}>
                        {isFuel ? t("fuel.filterFuel", "Carburante") : t("fuel.filterElectric", "Elettrico")}
                      </span>
                    </div>
                    <div className="fc-item__mid">
                      <span>{formatMoney(entry.totalCost)}</span>
                      {pricePerUnit !== null && <span>{getCurrencySymbol(currency)} {formatNumber(pricePerUnit, 3, locale)}/{unit}</span>}
                      <span>{formatNumber(quantity, 2, locale)} {unit}</span>
                    </div>
                  </div>
                  <div className="fc-item__right">
                    {delta != null && delta > 0 && <span className="fc-item__delta">+{delta} km</span>}
                    <span className="fc-item__km">{kmToDisplayDistance(entry.km, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} km</span>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
