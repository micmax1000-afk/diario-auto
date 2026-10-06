import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CommuteSettings } from "../types";
import CommuteRouteMap from "./CommuteRouteMap";

interface Props {
  initial: CommuteSettings;
  onSave: (patch: Partial<CommuteSettings>) => void;
  onClose: () => void;
}

export default function CommuteSettingsForm({ initial, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [kmPerTrip, setKmPerTrip] = useState(String(initial.kmPerTrip || ""));
  const [tripsPerDay, setTripsPerDay] = useState(String(initial.tripsPerDay || 2));
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(String(initial.workDaysPerWeek || 6));
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(String(initial.fuelPricePerLiter || ""));
  const [estimatedKmPerLiter, setEstimatedKmPerLiter] = useState(
    initial.estimatedKmPerLiter ? String(initial.estimatedKmPerLiter) : "",
  );
  const [error, setError] = useState("");
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const km = Number(kmPerTrip);
    const trips = Number(tripsPerDay);
    const days = Number(workDaysPerWeek);
    const price = Number(fuelPricePerLiter);

    if (Number.isNaN(km) || km <= 0) {
      setError(t("commuteSettingsForm.errorKm"));
      return;
    }
    if (Number.isNaN(trips) || trips <= 0) {
      setError(t("commuteSettingsForm.errorTrips"));
      return;
    }
    if (Number.isNaN(days) || days <= 0 || days > 7) {
      setError(t("commuteSettingsForm.errorDays"));
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setError(t("commuteSettingsForm.errorPrice"));
      return;
    }

    const estimate = estimatedKmPerLiter.trim() ? Number(estimatedKmPerLiter) : undefined;
    if (estimate !== undefined && (Number.isNaN(estimate) || estimate <= 0)) {
      setError(t("commuteSettingsForm.errorEstimate"));
      return;
    }

    onSave({
      kmPerTrip: km,
      tripsPerDay: trips,
      workDaysPerWeek: days,
      fuelPricePerLiter: price,
      estimatedKmPerLiter: estimate,
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
              <button
                type="button"
                className="btn btn--ghost btn--small"
                style={{ alignSelf: "flex-start", marginTop: "0.25rem" }}
                onClick={() => setShowRouteMap(true)}
              >
                {t("commuteSettingsForm.calculateOnMap")}
              </button>
              {routeLabel && (
                <p className="empty-state__body" style={{ margin: 0 }}>
                  {t("commuteSettingsForm.routeLabel", { label: routeLabel })}
                </p>
              )}
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
              <label htmlFor="commute-price">{t("commuteSettingsForm.fuelPrice")}</label>
              <input
                id="commute-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                placeholder={t("commuteSettingsForm.fuelPricePlaceholder")}
                value={fuelPricePerLiter}
                onChange={(e) => setFuelPricePerLiter(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="commute-estimate">{t("commuteSettingsForm.estimatedConsumption")}</label>
            <input
              id="commute-estimate"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder={t("commuteSettingsForm.estimatedConsumptionPlaceholder")}
              value={estimatedKmPerLiter}
              onChange={(e) => setEstimatedKmPerLiter(e.target.value)}
            />
            <p className="empty-state__body" style={{ margin: "0.25rem 0 0" }}>
              {t("commuteSettingsForm.estimatedConsumptionHint")}
            </p>
          </div>

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
