import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CommuteSettings } from "../types";
import CommuteRouteMap from "./CommuteRouteMap";
import { useCurrencySymbol } from "../utils/useCurrencySymbol";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { formatNumber, getNumberLocale } from "../utils/locale";
import { DEFAULT_WEEKS_PER_YEAR, type AutoPrice } from "../utils/commute";

interface Props {
  initial: CommuteSettings;
  /** Unità del carburante: litri, kWh (elettriche) o kg (metano). */
  unit: "l" | "kWh" | "kg";
  /** Prezzo preso dagli ultimi rifornimenti/ricariche, se ce ne sono. */
  autoPrice: AutoPrice | null;
  /** Consumo reale dai rifornimenti/ricariche, se ce ne sono abbastanza. */
  realConsumption: { kmPerUnit: number; count: number } | null;
  onSave: (patch: Partial<CommuteSettings>) => void;
  onClose: () => void;
}

function optionalNumber(value: string): number | undefined | null {
  if (!value.trim()) return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isNaN(n) || n < 0 ? null : n;
}

export default function CommuteSettingsForm({ initial, unit, autoPrice, realConsumption, onSave, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const cur = useCurrencySymbol();
  const electric = unit === "kWh";
  const [kmPerTrip, setKmPerTrip] = useState(String(initial.kmPerTrip || ""));
  const [tripsPerDay, setTripsPerDay] = useState(String(initial.tripsPerDay || 2));
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(String(initial.workDaysPerWeek || 5));
  const [weeks, setWeeks] = useState(String(initial.weeksPerYear || DEFAULT_WEEKS_PER_YEAR));
  const [toll, setToll] = useState(initial.tollPerDay ? String(initial.tollPerDay) : "");
  const [parking, setParking] = useState(initial.parkingPerDay ? String(initial.parkingPerDay) : "");
  const [other, setOther] = useState(initial.otherPerMonth ? String(initial.otherPerMonth) : "");
  // Prezzo a mano solo se l'utente l'ha scelto, o se non ci sono rifornimenti da cui prenderlo.
  const [manualPrice, setManualPrice] = useState(!autoPrice || !!initial.manualPrice);
  const [fuelPrice, setFuelPrice] = useState(
    String(initial.fuelPricePerLiter || (autoPrice ? Math.round(autoPrice.price * 1000) / 1000 : "")),
  );
  // Consumo stimato: salvato in km per unità, chiesto in unità ogni 100 km.
  const [estimate, setEstimate] = useState(
    initial.estimatedKmPerLiter ? String(Math.round((100 / initial.estimatedKmPerLiter) * 10) / 10) : "",
  );
  const [error, setError] = useState("");
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);

  const per100 = `${unit}/100 km`;
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const km = Number(kmPerTrip.replace(",", "."));
    const trips = Number(tripsPerDay);
    const days = Number(workDaysPerWeek);
    const weeksN = Number(weeks);

    if (Number.isNaN(km) || km <= 0) return setError(t("commuteSettingsForm.errorKm"));
    if (!Number.isInteger(trips) || trips <= 0) return setError(t("commuteSettingsForm.errorTrips"));
    if (Number.isNaN(days) || days <= 0 || days > 7) return setError(t("commuteSettingsForm.errorDays"));
    if (Number.isNaN(weeksN) || weeksN <= 0 || weeksN > 53) return setError(t("commuteSettingsForm.errorWeeks"));

    const tollN = optionalNumber(toll);
    const parkingN = optionalNumber(parking);
    const otherN = optionalNumber(other);
    if (tollN === null || parkingN === null || otherN === null) return setError(t("commuteSettingsForm.errorExtra"));

    let price = initial.fuelPricePerLiter;
    if (manualPrice) {
      price = Number(fuelPrice.replace(",", "."));
      if (Number.isNaN(price) || price <= 0) {
        return setError(t(electric ? "commuteSettingsForm.errorPriceElectric" : "commuteSettingsForm.errorPrice"));
      }
    }

    let estimatedKmPerLiter = initial.estimatedKmPerLiter;
    if (!realConsumption) {
      const est = optionalNumber(estimate);
      if (est === null || est === 0) return setError(t("commuteSettingsForm.errorEstimate"));
      estimatedKmPerLiter = est !== undefined ? 100 / est : undefined;
    }

    onSave({
      kmPerTrip: km,
      tripsPerDay: trips,
      workDaysPerWeek: days,
      weeksPerYear: weeksN,
      tollPerDay: tollN,
      parkingPerDay: parkingN,
      otherPerMonth: otherN,
      fuelPricePerLiter: price,
      manualPrice: manualPrice && !!autoPrice ? true : undefined,
      estimatedKmPerLiter,
    });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="commute-settings-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="commute-settings-title">{t("commuteSettingsForm.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <p className="commute-form__section">{t("commuteSettingsForm.routeSection")}</p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="commute-km">{t("commuteSettingsForm.kmPerTrip")}</label>
              <input
                id="commute-km"
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder={t("commuteSettingsForm.kmPerTripPlaceholder")}
                value={kmPerTrip}
                onChange={(e) => {
                  setKmPerTrip(e.target.value);
                  setRouteLabel(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="commute-trips">{t("commuteSettingsForm.tripsPerDay")}</label>
              <input
                id="commute-trips"
                type="number"
                step="1"
                inputMode="numeric"
                value={tripsPerDay}
                onChange={(e) => setTripsPerDay(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--small commute-form__map"
            onClick={() => setShowRouteMap(true)}
          >
            {t("commuteSettingsForm.calculateOnMap")}
          </button>
          {routeLabel && (
            <p className="commute-form__hint">{t("commuteSettingsForm.routeLabel", { label: routeLabel })}</p>
          )}

          <div className="field-row">
            <div className="field">
              <label htmlFor="commute-days">{t("commuteSettingsForm.workDays")}</label>
              <input
                id="commute-days"
                type="number"
                step="1"
                min="1"
                max="7"
                inputMode="numeric"
                value={workDaysPerWeek}
                onChange={(e) => setWorkDaysPerWeek(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="commute-weeks">{t("commuteSettingsForm.weeksPerYear")}</label>
              <input
                id="commute-weeks"
                type="number"
                step="1"
                min="1"
                max="53"
                inputMode="numeric"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
              />
            </div>
          </div>
          <p className="commute-form__hint">{t("commuteSettingsForm.weeksHint")}</p>

          <p className="commute-form__section">{t("commuteSettingsForm.extraSection")}</p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="commute-toll">{t("commuteSettingsForm.tollPerDay", { cur })}</label>
              <input
                id="commute-toll"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder={t("commuteSettingsForm.tollPlaceholder")}
                value={toll}
                onChange={(e) => setToll(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="commute-parking">{t("commuteSettingsForm.parkingPerDay", { cur })}</label>
              <input
                id="commute-parking"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0"
                value={parking}
                onChange={(e) => setParking(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="commute-other">{t("commuteSettingsForm.otherPerMonth", { cur })}</label>
            <input
              id="commute-other"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder={t("commuteSettingsForm.otherPlaceholder")}
              value={other}
              onChange={(e) => setOther(e.target.value)}
            />
          </div>
          <p className="commute-form__hint">{t("commuteSettingsForm.extraHint")}</p>

          <p className="commute-form__section">
            {t(electric ? "commuteSettingsForm.energySection" : "commuteSettingsForm.fuelSection")}
          </p>
          {autoPrice && !manualPrice ? (
            <div className="commute-auto">
              <span className="commute-auto__check" aria-hidden="true">✓</span>
              <span className="commute-auto__text">
                <strong>
                  {formatMoney(autoPrice.price, 3)}/{unit}
                </strong>{" "}
                {t(electric ? "commuteSettingsForm.autoPriceElectric" : "commuteSettingsForm.autoPrice", {
                  date: shortDate(autoPrice.date),
                })}
              </span>
              <button type="button" className="commute-auto__change" onClick={() => setManualPrice(true)}>
                {t("commuteSettingsForm.change")}
              </button>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="commute-price">
                {t(electric ? "commuteSettingsForm.energyPrice" : "commuteSettingsForm.fuelPrice", { cur, unit })}
              </label>
              <input
                id="commute-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                placeholder={electric ? t("commuteSettingsForm.energyPricePlaceholder") : t("commuteSettingsForm.fuelPricePlaceholder")}
                value={fuelPrice}
                onChange={(e) => setFuelPrice(e.target.value)}
              />
              {autoPrice && (
                <button type="button" className="commute-auto__change commute-auto__change--inline" onClick={() => setManualPrice(false)}>
                  {t("commuteSettingsForm.useAutoPrice", { price: `${formatMoney(autoPrice.price, 3)}/${unit}` })}
                </button>
              )}
            </div>
          )}
          {autoPrice && !manualPrice && <p className="commute-form__hint">{t("commuteSettingsForm.autoPriceHint")}</p>}

          {realConsumption ? (
            <div className="commute-auto">
              <span className="commute-auto__check" aria-hidden="true">✓</span>
              <span className="commute-auto__text">
                <strong>
                  {formatNumber(100 / realConsumption.kmPerUnit, 1, locale)} {per100}
                </strong>{" "}
                {t(electric ? "commuteSettingsForm.realConsumptionElectric" : "commuteSettingsForm.realConsumption", {
                  n: realConsumption.count,
                })}
              </span>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="commute-estimate">{t("commuteSettingsForm.estimatedConsumption", { unit: per100 })}</label>
              <input
                id="commute-estimate"
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder={t(electric ? "commuteSettingsForm.estimatePlaceholderElectric" : "commuteSettingsForm.estimatePlaceholder")}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
              />
              <p className="commute-form__hint">
                {t(electric ? "commuteSettingsForm.estimatedConsumptionElectricHint" : "commuteSettingsForm.estimatedConsumptionHint")}
              </p>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("commuteSettingsForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary">
              {t("commuteSettingsForm.save")}
            </button>
          </div>
        </form>
      </div>

      {showRouteMap && (
        <CommuteRouteMap
          onSelect={(kmOneWay, label) => {
            setKmPerTrip(kmOneWay.toFixed(1));
            setRouteLabel(label);
            setShowRouteMap(false);
          }}
          onClose={() => setShowRouteMap(false)}
        />
      )}
    </div>
  );
}
