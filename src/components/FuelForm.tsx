import { useState } from "react";
import type { FormEvent } from "react";
import type { FuelEntry, FuelSource, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import FuelPriceMap from "./FuelPriceMap";
import type { FuelApiType } from "../utils/fuelPriceApi";

const SOURCE_OPTIONS: { value: FuelSource; label: string }[] = [
  { value: "benzina", label: "Benzina" },
  { value: "diesel", label: "Diesel" },
  { value: "gpl", label: "GPL" },
  { value: "metano", label: "Metano" },
  { value: "elettrico", label: "Elettrico (kWh)" },
];

interface Props {
  vehicle: Vehicle;
  onSave: (entry: FuelEntry) => void;
  onClose: () => void;
}

export default function FuelForm({ vehicle, onSave, onClose }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState(String(vehicle.currentKm));
  const [liters, setLiters] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [source, setSource] = useState<FuelSource>(
    vehicle.fuelType === "ibrido" ? "benzina" : (vehicle.fuelType as FuelSource),
  );
  const [fullTank, setFullTank] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [priceHint, setPriceHint] = useState<{ price: number; label: string } | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const kmValue = Number(km);
    const litersValue = Number(liters);
    const costValue = Number(totalCost);

    if (!date) {
      setError("Inserisci la data.");
      return;
    }
    if (Number.isNaN(kmValue) || kmValue < 0) {
      setError("Inserisci un chilometraggio valido.");
      return;
    }
    if (Number.isNaN(litersValue) || litersValue <= 0) {
      setError("Inserisci una quantità valida (litri o kWh).");
      return;
    }
    if (Number.isNaN(costValue) || costValue < 0) {
      setError("Inserisci un costo valido.");
      return;
    }

    const entry: FuelEntry = {
      id: generateId(),
      vehicleId: vehicle.id,
      date: new Date(date).toISOString(),
      km: Math.round(kmValue),
      liters: litersValue,
      totalCost: costValue,
      source,
      fullTank,
      notes: notes.trim() || undefined,
    };

    onSave(entry);
  }

  const unitLabel = source === "elettrico" ? "kWh" : "Litri";

  const apiFuelForSource: FuelApiType | null =
    source === "benzina" ? "benzina" : source === "diesel" ? "gasolio" : null;

  function handleSelectPrice(price: number, label: string) {
    setPriceHint({ price, label });
    setShowMap(false);
    const litersValue = Number(liters);
    const costValue = Number(totalCost);
    if (!Number.isNaN(litersValue) && litersValue > 0) {
      setTotalCost((litersValue * price).toFixed(2));
    } else if (!Number.isNaN(costValue) && costValue > 0) {
      setLiters((costValue / price).toFixed(2));
    }
  }

  function handleLitersChange(value: string) {
    setLiters(value);
    if (priceHint) {
      const litersValue = Number(value);
      if (!Number.isNaN(litersValue) && litersValue > 0) {
        setTotalCost((litersValue * priceHint.price).toFixed(2));
      }
    }
  }

  function handleCostChange(value: string) {
    setTotalCost(value);
    if (priceHint) {
      const costValue = Number(value);
      if (!Number.isNaN(costValue) && costValue > 0) {
        setLiters((costValue / priceHint.price).toFixed(2));
      }
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fuel-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="fuel-form-title">Nuovo rifornimento</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="fuel-date">Data</label>
              <input id="fuel-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fuel-km">Km attuali *</label>
              <input
                id="fuel-km"
                type="number"
                inputMode="numeric"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="fuel-source">Alimentazione usata</label>
              <select id="fuel-source" value={source} onChange={(e) => setSource(e.target.value as FuelSource)}>
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fuel-liters">{unitLabel} *</label>
              <input
                id="fuel-liters"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={liters}
                onChange={(e) => handleLitersChange(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="fuel-cost">Costo totale (€) *</label>
              <input
                id="fuel-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalCost}
                onChange={(e) => handleCostChange(e.target.value)}
              />
              {apiFuelForSource && (
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  style={{ alignSelf: "flex-start", marginTop: "0.25rem" }}
                  onClick={() => setShowMap(true)}
                >
                  Trova sulla mappa
                </button>
              )}
              {priceHint && (
                <p className="empty-state__body" style={{ margin: 0 }}>
                  € {priceHint.price.toFixed(3)}/l — {priceHint.label}. Inserisci litri o costo: calcolo l'altro
                  automaticamente.
                </p>
              )}
            </div>
            <div className="field field--checkbox">
              <label htmlFor="fuel-full">
                <input
                  id="fuel-full"
                  type="checkbox"
                  checked={fullTank}
                  onChange={(e) => setFullTank(e.target.checked)}
                />
                Pieno (serve per calcolo consumo)
              </label>
            </div>
          </div>

          <div className="field">
            <label htmlFor="fuel-notes">Note</label>
            <textarea
              id="fuel-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="es. autostrada, distributore..."
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn--primary">
              Salva rifornimento
            </button>
          </div>
        </form>
      </div>

      {showMap && apiFuelForSource && (
        <FuelPriceMap initialFuel={apiFuelForSource} onSelect={handleSelectPrice} onClose={() => setShowMap(false)} />
      )}
    </div>
  );
}
