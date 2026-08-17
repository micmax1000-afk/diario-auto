import { useState } from "react";
import type { FormEvent } from "react";
import type { CommuteScenario } from "../types";
import { generateId } from "../utils/storage";

interface Props {
  vehicleId: string;
  onSave: (scenario: CommuteScenario) => void;
  onClose: () => void;
}

export default function CommuteScenarioForm({ vehicleId, onSave, onClose }: Props) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState<"litro" | "kWh">("litro");
  const [kmPerUnit, setKmPerUnit] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const km = Number(kmPerUnit);
    const price = Number(pricePerUnit);

    if (!label.trim()) {
      setError("Dai un nome allo scenario (es. \"Dacia Sandero GPL\").");
      return;
    }
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
      label: label.trim(),
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
            <label htmlFor="scenario-label">Nome scenario *</label>
            <input
              id="scenario-label"
              type="text"
              placeholder='es. "Dacia Sandero GPL" o "Renault Zoe"'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="scenario-unit">Tipo</label>
              <select id="scenario-unit" value={unit} onChange={(e) => setUnit(e.target.value as "litro" | "kWh")}>
                <option value="litro">Carburante (litro)</option>
                <option value="kWh">Elettrico (kWh)</option>
              </select>
            </div>
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
          </div>

          <div className="field">
            <label htmlFor="scenario-price">Prezzo per 1 {unit} (€) *</label>
            <input
              id="scenario-price"
              type="number"
              step="0.001"
              inputMode="decimal"
              placeholder={unit === "litro" ? "es. 0.700 (GPL)" : "es. 0.250"}
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
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
