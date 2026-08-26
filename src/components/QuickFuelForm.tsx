import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FuelEntry, FuelSource, Vehicle } from "../types";
import { generateId } from "../utils/storage";

interface Props {
  vehicle: Vehicle;
  onSave: (entry: FuelEntry) => void;
  onClose: () => void;
}

// Mappa il tipo di alimentazione del veicolo alla fonte rifornimento più
// probabile, per pre-compilare senza dover scegliere (velocità è l'obiettivo).
function defaultSource(vehicle: Vehicle): FuelSource {
  if (vehicle.fuelType === "benzina" || vehicle.fuelType === "diesel" || vehicle.fuelType === "gpl" || vehicle.fuelType === "metano") {
    return vehicle.fuelType;
  }
  return "benzina"; // ibrido: la maggioranza dei rifornimenti sarà comunque benzina
}

export default function QuickFuelForm({ vehicle, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const source = defaultSource(vehicle);
  const [km, setKm] = useState(String(vehicle.currentKm));
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [fullTank, setFullTank] = useState(true);
  const [error, setError] = useState("");

  const priceValue = Number(pricePerUnit);
  const costValue = Number(totalCost);
  const computedLiters =
    pricePerUnit !== "" && !Number.isNaN(priceValue) && priceValue > 0 && totalCost !== "" && !Number.isNaN(costValue)
      ? costValue / priceValue
      : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const kmValue = Number(km);

    if (Number.isNaN(kmValue) || kmValue < 0) {
      setError(t("fuelForm.errorKm"));
      return;
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setError(t("fuelForm.errorPrice", { unit: "l" }));
      return;
    }
    if (Number.isNaN(costValue) || costValue <= 0) {
      setError(t("fuelForm.errorTotalCost"));
      return;
    }

    const entry: FuelEntry = {
      id: generateId(),
      vehicleId: vehicle.id,
      date: new Date().toISOString(),
      km: Math.round(kmValue),
      liters: costValue / priceValue,
      totalCost: costValue,
      source,
      fullTank,
    };

    onSave(entry);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-fuel-title">
      <div className="modal modal--small">
        <div className="modal__header">
          <h2 id="quick-fuel-title">
            ⛽ {t("quickEntry.fuelTitle")}
            <span className="quick-entry__vehicle"> · {vehicle.name}</span>
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form quick-entry">
          <div className="field-row">
            <div className="field">
              <label htmlFor="qf-price">{t("fuelForm.pricePerUnit", { unit: "l" })}</label>
              <input
                id="qf-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                autoFocus
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                className="quick-entry__big-input"
              />
            </div>
            <div className="field">
              <label htmlFor="qf-cost">{t("fuelForm.cost")}</label>
              <input
                id="qf-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                className="quick-entry__big-input"
              />
            </div>
          </div>

          {computedLiters !== null && (
            <p className="quick-entry__computed">
              {computedLiters.toFixed(2)} {t("fuelForm.liters").replace(" *", "")}
            </p>
          )}

          <div className="field">
            <label htmlFor="qf-km">{t("fuelForm.km")}</label>
            <input
              id="qf-km"
              type="number"
              inputMode="numeric"
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          </div>

          <div className="field field--checkbox">
            <label htmlFor="qf-full">
              <input id="qf-full" type="checkbox" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} />
              {t("fuelForm.fullTank")}
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("fuelForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary quick-entry__save">
              {t("fuelForm.save")}
            </button>
          </div>

          <p className="quick-entry__full-form-hint">{t("quickEntry.fullFormHint")}</p>
        </form>
      </div>
    </div>
  );
}
