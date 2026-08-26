import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ChargingEntry, Vehicle } from "../types";
import { generateId, getHomeChargingDefaults, setHomeChargingDefaults } from "../utils/storage";

interface Props {
  vehicle: Vehicle;
  onSave: (entry: ChargingEntry) => void;
  onClose: () => void;
}

export default function QuickChargeForm({ vehicle, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [km, setKm] = useState(String(vehicle.currentKm));
  const [pricePerKWh, setPricePerKWh] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [atHome, setAtHome] = useState(false);
  const [error, setError] = useState("");

  const priceValue = Number(pricePerKWh);
  const costValue = Number(totalCost);
  const computedKWh =
    pricePerKWh !== "" && !Number.isNaN(priceValue) && priceValue > 0 && totalCost !== "" && !Number.isNaN(costValue)
      ? costValue / priceValue
      : null;

  async function handleToggleAtHome(checked: boolean) {
    setAtHome(checked);
    if (checked && !pricePerKWh) {
      const defaults = await getHomeChargingDefaults(vehicle.id);
      if (defaults) setPricePerKWh(String(defaults.pricePerKWh));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const kmValue = Number(km);

    if (Number.isNaN(kmValue) || kmValue < 0) {
      setError(t("chargingForm.errorKm"));
      return;
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setError(t("chargingForm.errorPrice"));
      return;
    }
    if (Number.isNaN(costValue) || costValue <= 0) {
      setError(t("chargingForm.errorCost"));
      return;
    }

    const entry: ChargingEntry = {
      id: generateId(),
      vehicleId: vehicle.id,
      date: new Date().toISOString(),
      km: Math.round(kmValue),
      kWh: costValue / priceValue,
      pricePerKWh: priceValue,
      totalCost: costValue,
      atHome,
    };

    if (atHome) {
      await setHomeChargingDefaults(vehicle.id, entry.pricePerKWh, entry.powerKW);
    }

    onSave(entry);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-charge-title">
      <div className="modal modal--small">
        <div className="modal__header">
          <h2 id="quick-charge-title">
            ⚡ {t("quickEntry.chargeTitle")}
            <span className="quick-entry__vehicle"> · {vehicle.name}</span>
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form quick-entry">
          <div className="field field--checkbox">
            <label htmlFor="qc-home">
              <input
                id="qc-home"
                type="checkbox"
                checked={atHome}
                onChange={(e) => handleToggleAtHome(e.target.checked)}
              />
              {t("chargingForm.atHome")}
            </label>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="qc-price">{t("chargingForm.price")}</label>
              <input
                id="qc-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                autoFocus
                value={pricePerKWh}
                onChange={(e) => setPricePerKWh(e.target.value)}
                className="quick-entry__big-input"
              />
            </div>
            <div className="field">
              <label htmlFor="qc-cost">{t("chargingForm.cost")}</label>
              <input
                id="qc-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                className="quick-entry__big-input"
              />
            </div>
          </div>

          {computedKWh !== null && <p className="quick-entry__computed">{computedKWh.toFixed(2)} kWh</p>}

          <div className="field">
            <label htmlFor="qc-km">{t("chargingForm.km")}</label>
            <input
              id="qc-km"
              type="number"
              inputMode="numeric"
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("chargingForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary quick-entry__save">
              {t("chargingForm.save")}
            </button>
          </div>

          <p className="quick-entry__full-form-hint">{t("quickEntry.fullFormHint")}</p>
        </form>
      </div>
    </div>
  );
}
