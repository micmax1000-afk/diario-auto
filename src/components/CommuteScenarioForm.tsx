import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CommuteScenario, CommuteFuelType } from "../types";
import { generateId } from "../utils/storage";

interface Props {
  vehicleId: string;
  onSave: (scenario: CommuteScenario) => void;
  onClose: () => void;
}

const FUEL_TYPE_UNITS: Record<CommuteFuelType, "litro" | "kWh"> = {
  benzina: "litro",
  diesel: "litro",
  gpl: "litro",
  elettrico: "kWh",
  ibrido: "litro",
  ibrido_plugin: "litro",
};
const FUEL_TYPE_ORDER: CommuteFuelType[] = ["gpl", "benzina", "diesel", "elettrico", "ibrido", "ibrido_plugin"];

export default function CommuteScenarioForm({ vehicleId, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [fuelType, setFuelType] = useState<CommuteFuelType>("gpl");
  const [note, setNote] = useState("");
  const [kmPerUnit, setKmPerUnit] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [error, setError] = useState("");

  const unit = FUEL_TYPE_UNITS[fuelType];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const km = Number(kmPerUnit);
    const price = Number(pricePerUnit);

    if (Number.isNaN(km) || km <= 0) {
      setError(t("commuteScenarioForm.errorKm", { unit }));
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setError(t("commuteScenarioForm.errorPrice", { unit }));
      return;
    }

    const scenario: CommuteScenario = {
      id: generateId(),
      vehicleId,
      fuelType,
      note: note.trim() || undefined,
      kmPerUnit: km,
      pricePerUnit: price,
      unit,
    };

    onSave(scenario);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="commute-scenario-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="commute-scenario-title">{t("commuteScenarioForm.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field">
            <label htmlFor="scenario-fuel">{t("commuteScenarioForm.fuelType")}</label>
            <select
              id="scenario-fuel"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as CommuteFuelType)}
            >
              {FUEL_TYPE_ORDER.map((value) => (
                <option key={value} value={value}>
                  {t(`commuteFuelType.${value}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="scenario-km">{t("commuteScenarioForm.kmPerUnit", { unit })}</label>
              <input
                id="scenario-km"
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder={
                  unit === "litro"
                    ? t("commuteScenarioForm.kmPerUnitPlaceholderLiter")
                    : t("commuteScenarioForm.kmPerUnitPlaceholderKwh")
                }
                value={kmPerUnit}
                onChange={(e) => setKmPerUnit(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="scenario-price">{t("commuteScenarioForm.pricePerUnit", { unit })}</label>
              <input
                id="scenario-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                placeholder={
                  unit === "litro"
                    ? t("commuteScenarioForm.pricePerUnitPlaceholderLiter")
                    : t("commuteScenarioForm.pricePerUnitPlaceholderKwh")
                }
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="scenario-note">{t("commuteScenarioForm.note")}</label>
            <input
              id="scenario-note"
              type="text"
              placeholder={t("commuteScenarioForm.notePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("commuteScenarioForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary">
              {t("commuteScenarioForm.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
