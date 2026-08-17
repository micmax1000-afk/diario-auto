import { useState } from "react";
import type { FormEvent } from "react";
import type { CommuteScenario, CommuteFuelType } from "../types";
import { generateId } from "../utils/storage";

interface Props {
  vehicleId: string;
  onSave: (scenario: CommuteScenario) => void;
  onClose: () => void;
}

const FUEL_TYPE_OPTIONS: { value: CommuteFuelType; label: string; unit: "litro" | "kWh" }[] = [
  { value: "benzina", label: "Benzina", unit: "litro" },
  { value: "diesel", label: "Diesel", unit: "litro" },
  { value: "gpl", label: "GPL", unit: "litro" },
  { value: "elettrico", label: "Elettrico", unit: "kWh" },
  { value: "ibrido", label: "Ibrido", unit: "litro" },
  { value: "ibrido_plugin", label: "Ibrido plug-in", unit: "litro" },
];

export default function CommuteScenarioForm({ vehicleId, onSave, onClose }: Props) {
  const [fuelType, setFuelType] = useState<CommuteFuelType>("gpl");
  const [note, setNote] = useState("");
  const [kmPerUnit, setKmPerUnit] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [error, setError] = useState("");

  const unit = FUEL_TYPE_OPTIONS.find((o) => o.value === fuelType)?.unit ?? "litro";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const km = Number(kmPerUnit);
    const price = Number(pricePerUnit);

    if (Number.isNaN(km) || km <= 0) {
      setError(`Inserisci i km percorribili con 1 ${unit} valido.`);
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setError(`Inserisci un prezzo per ${unit} valido.`);
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
          <h2 id="commute-scenario-title">Nuovo scenario di confronto</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field">
            <label htmlFor="scenario-fuel">Alimentazione *</label>
            <select
              id="scenario-fuel"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as CommuteFuelType)}
            >
              {FUEL_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="scenario-km">Km per 1 {unit} *</label>
              <input
                id="scenario-km"
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder={unit === "litro" ? "es. 18" : "es. 6"}
                value={kmPerUnit}
                onChange={(e) => setKmPerUnit(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="scenario-price">Prezzo per 1 {unit} (€) *</label>
              <input
                id="scenario-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                placeholder={unit === "litro" ? "es. 0.700" : "es. 0.250"}
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="scenario-note">Nota (opzionale)</label>
            <input
              id="scenario-note"
              type="text"
              placeholder="es. usata, km 40.000"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn--primary">
              Aggiungi scenario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
