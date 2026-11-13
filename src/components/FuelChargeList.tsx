import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FuelEntry, ChargingEntry, FuelType, FuelSource } from "../types";
import { calculateConsumption, averageConsumption, calculateElectricConsumption, averageElectricConsumption, groupByMonth, mainFuelSource, needsFullTankHint } from "../utils/calculations";
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
  /** Alimentazione del veicolo: per GPL e metano il consumo medio conta solo quella. */
  vehicleFuelType?: FuelType;
  /** Doppia alimentazione: i due carburanti. Niente consumo in litri, ma costo al km e riepilogo per carburante. */
  bifuel?: [FuelSource, FuelSource] | null;
  /** Mostra i filtri Tutti / Carburante / Elettrico (inutili per un veicolo che non si ricarica). */
  showSourceFilters?: boolean;
  onEditFuel: (entry: FuelEntry) => void;
  onEditCharging: (entry: ChargingEntry) => void;
  /** Pulsanti per aggiungere, mostrati tra il riepilogo e l'elenco. */
  actions?: ReactNode;
}

export default function FuelChargeList({
  fuelEntries,
  chargingEntries,
  vehicleFuelType,
  bifuel = null,
  showSourceFilters = true,
  onEditFuel,
  onEditCharging,
  actions,
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
      <>
        {actions}
        <div className="empty-state">
          <p className="empty-state__title">{t("fuel.emptyTitle")}</p>
          <p className="empty-state__body">{t("fuel.emptyBody")}</p>
        </div>
      </>
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
  const consumptionPoints = bifuel ? [] : calculateConsumption(periodFuel);
  const avgConsumption = averageConsumption(consumptionPoints, mainFuelSource(vehicleFuelType));
  // Solo ricariche nel periodo (auto elettrica): consumo in kWh/100 km.
  const periodCharging = periodFilteredRows.filter((r) => r.kind === "charge").map((r) => r.entry as ChargingEntry);
  const avgElectric = periodFuel.length === 0 ? averageElectricConsumption(calculateElectricConsumption(periodCharging)) : null;
  // Prezzo medio al litro (o al kWh se ci sono solo ricariche).
  // Per GPL e metano conta solo quel carburante (la benzina di riserva ha un altro prezzo).
  const mainSource = mainFuelSource(vehicleFuelType);
  const priceFuel = mainSource && periodFuel.some((e) => e.source === mainSource) ? periodFuel.filter((e) => e.source === mainSource) : periodFuel;
  const fuelQty = priceFuel.reduce((sum, e) => sum + e.liters, 0);
  const chargeQty = periodCharging.reduce((sum, e) => sum + e.kWh, 0);
  const avgPrice =
    periodFuel.length > 0
      ? fuelQty > 0 ? `${formatMoney(priceFuel.reduce((sum, e) => sum + e.totalCost, 0) / fuelQty, 3)}/l` : null
      : chargeQty > 0 ? `${formatMoney(periodCharging.reduce((sum, e) => sum + e.totalCost, 0) / chargeQty, 2)}/kWh` : null;
  const allKm = periodFilteredRows.map((r) => r.entry.km);
  const totalDistance = allKm.length > 1 ? Math.max(...allKm) - Math.min(...allKm) : 0;
  // Doppia alimentazione: spesa, litri e rifornimenti di ciascun carburante.
  const bifuelRows = (bifuel ?? []).map((src, i) => {
    const list = periodFuel.filter((e) => e.source === src);
    const liters = list.reduce((s, e) => s + e.liters, 0);
    const spend = list.reduce((s, e) => s + e.totalCost, 0);
    return { src, spend, count: list.length, price: liters > 0 ? spend / liters : null, color: i === 0 ? "var(--amber)" : "#13a086" };
  });
  const bifuelSpend = bifuelRows.reduce((s, r) => s + r.spend, 0);
  const bifuelCostPerKm = totalDistance > 0 && totalCost > 0 ? totalCost / totalDistance : null;

  // Nessun "Pieno" da un po': il consumo non si può calcolare, lo ricordiamo.
  const hintSource = mainFuelSource(vehicleFuelType);
  const showFullHint = !bifuel && needsFullTankHint(fuelEntries.filter((e) => !hintSource || e.source === hintSource));

  // per calcolare il delta "+XXX km" rispetto alla voce precedente nello storico completo (non filtrato)
  const sortedByKm = [...rows].sort((a, b) => a.entry.km - b.entry.km);
  const deltaByEntryId = new Map<string, number | null>();
  sortedByKm.forEach((r, idx) => {
    const prev = idx > 0 ? sortedByKm[idx - 1] : null;
    deltaByEntryId.set(r.entry.id, prev ? r.entry.km - prev.entry.km : null);
  });

  return (
    <div className="fc-list">
      <section className="fc-sum">
        <div className="fc-sum__top">
          <span className="fc-sum__label">{t("fuel.summaryTotalCost", "Spesa totale")}</span>
          <select className="fc-sum__period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label={t("fuel.period")}>
            <option value="3m">{t("fuel.periodLast3", "Ultimi 3 mesi")}</option>
            <option value="6m">{t("fuel.periodLast6", "Ultimi 6 mesi")}</option>
            <option value="12m">{t("fuel.periodLast12", "Ultimi 12 mesi")}</option>
            <option value="all">{t("fuel.periodAll", "Sempre")}</option>
          </select>
        </div>
        <div className="fc-sum__total">{formatMoney(totalCost)}</div>
        <div className="fc-sum__kpis">
          <div className="fc-sum__kpi">
            <span>{bifuel ? t("summary.costPerKm") : t("fuel.summaryAvgConsumption", "Consumo medio")}</span>
            <b>
              {bifuel ? (
                bifuelCostPerKm !== null ? formatMoney(bifuelCostPerKm, 3) : "—"
              ) : avgConsumption !== null && avgConsumption > 0 ? (
                <>
                  {(100 / avgConsumption).toLocaleString(locale, { maximumFractionDigits: 1 })} <small>l/100 km</small>
                </>
              ) : avgElectric !== null ? (
                <>
                  {avgElectric.toLocaleString(locale, { maximumFractionDigits: 1 })} <small>kWh/100</small>
                </>
              ) : (
                "—"
              )}
            </b>
          </div>
          <div className="fc-sum__kpi">
            <span>{t("fuel.summaryTotalDistance", "Distanza totale")}</span>
            <b>
              {kmToDisplayDistance(totalDistance, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} <small>{distanceUnit}</small>
            </b>
          </div>
          <div className="fc-sum__kpi">
            <span>{bifuel ? t("fuel.refuelsShort") : t("fuel.summaryAvgPrice")}</span>
            <b>{bifuel ? periodFuel.length : (avgPrice ?? "—")}</b>
          </div>
        </div>
        {bifuel && bifuelSpend > 0 && (
          <div className="fc-bifuel">
            <div className="fc-bifuel__bar" aria-hidden="true">
              {bifuelRows.map((r) => (
                <i key={r.src} style={{ width: `${(r.spend / bifuelSpend) * 100}%`, background: r.color }} />
              ))}
            </div>
            {bifuelRows.map((r) => (
              <div key={r.src} className="fc-bifuel__row">
                <span>
                  <span className="fc-bifuel__dot" style={{ background: r.color }} />
                  {t(`fuelType.${r.src}`)} · {formatMoney(r.spend)} · {r.count}×
                </span>
                <b>{r.price !== null ? `${formatMoney(r.price, 3)}/l` : "—"}</b>
              </div>
            ))}
            <p className="fc-bifuel__note">{t("fuel.bifuelNote")}</p>
          </div>
        )}
      </section>

      {showFullHint && <p className="fc-full-hint">{t("fuel.fullTankHint")}</p>}

      {actions}

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

      <div className="fc-list__items">
        {groupByMonth(periodFilteredRows, (r) => r.entry.date, locale).map((group) => (
          <section key={group.key} className="fc-month">
            <div className="fc-month__head">
              <span className="fc-month__label">{group.label}</span>
              <span className="fc-month__total">
                {group.entries.length}× · <b>{formatMoney(group.entries.reduce((sum, r) => sum + r.entry.totalCost, 0))}</b>
              </span>
            </div>
            <div className="fc-month__list">
              {group.entries.map((row) => {
                const { entry } = row;
                const isFuel = row.kind === "fuel";
                const unit = isFuel ? "l" : "kWh";
                const quantity = isFuel ? (entry as FuelEntry).liters : (entry as ChargingEntry).kWh;
                const pricePerUnit = quantity > 0 ? entry.totalCost / quantity : null;
                const delta = deltaByEntryId.get(entry.id);
                const date = new Date(entry.date);
                const title = isFuel ? t((entry as FuelEntry).fullTank ? "home.fullTank" : "fuel.partialShort") : t("home.charge");
                const sub = [
                  date.toLocaleDateString(locale, {
                    day: "numeric",
                    month: "short",
                    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
                  }),
                  pricePerUnit !== null ? `${getCurrencySymbol(currency)} ${formatNumber(pricePerUnit, 3, locale)}/${unit}` : null,
                  `${kmToDisplayDistance(entry.km, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} ${distanceUnit}`,
                ].filter(Boolean).join(" · ");
                const edit = () => (isFuel ? onEditFuel(entry as FuelEntry) : onEditCharging(entry as ChargingEntry));

                return (
                  <button key={entry.id} type="button" className="fc-row" aria-label={`${t("fuel.edit")} · ${title}`} onClick={edit}>
                    <span className={`fc-row__icon fc-row__icon--${isFuel ? "fuel" : "charge"}`}>
                      <ActionGridIcon name={isFuel ? "fuel" : "bolt"} />
                    </span>
                    <span className="fc-row__mid">
                      <span className="fc-row__title">
                        {title} · {formatNumber(quantity, quantity % 1 === 0 ? 0 : 1, locale)} {unit}
                      </span>
                      <span className="fc-row__sub">{sub}</span>
                    </span>
                    <span className="fc-row__end">
                      <span className="fc-row__amt">{formatMoney(entry.totalCost)}</span>
                      {delta != null && delta > 0 && (
                        <span className="fc-row__delta">+{Math.round(kmToDisplayDistance(delta, distanceUnit)).toLocaleString(locale)} {distanceUnit}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
