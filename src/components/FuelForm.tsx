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
  initialEntry?: FuelEntry;
  onSave: (entry: FuelEntry) => void;
  onClose: () => void;
}

export default function FuelForm({ vehicle, initialEntry, onSave, onClose }: Props) {
  const isEditing = Boolean(initialEntry);
  const [date, setDate] = useState(() => initialEntry?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState(String(initialEntry?.km ?? vehicle.currentKm));
  const [pricePerUnit, setPricePerUnit] = useState(
    initialEntry && initialEntry.liters > 0 ? (initialEntry.totalCost / initialEntry.liters).toFixed(3) : "",
  );
  const [totalCost, setTotalCost] = useState(initialEntry ? String(initialEntry.totalCost) : "");
  const [source, setSource] = useState<FuelSource>(
    initialEntry?.source ?? (vehicle.fuelType === "ibrido" ? "benzina" : (vehicle.fuelType as FuelSource)),
  );
  const [fullTank, setFullTank] = useState(initialEntry?.fullTank ?? true);
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [priceSource, setPriceSource] = useState<string | null>(null);

  const unitLabel = source === "elettrico" ? "kWh" : "Litri";
  const unitShort = source === "elettrico" ? "kWh" : "l";

  const apiFuelForSource: FuelApiType | null =
    source === "benzina"
      ? "benzina"
      : source === "diesel"
        ? "gasolio"
        : source === "gpl"
          ? "gpl"
          : source === "metano"
            ? "metano"
            : null;

  // Litri (o kWh) calcolati SEMPRE da costo totale / prezzo unitario: non
  // sono editabili direttamente, per evitare valori tra loro incoerenti.
  const priceValue = Number(pricePerUnit);
  const costValue = Number(totalCost);
  const computedLiters =
    pricePerUnit !== "" && !Number.isNaN(priceValue) && priceValue > 0 && totalCost !== "" && !Number.isNaN(costValue)
      ? costValue / priceValue
      : null;

  function handleSelectPrice(price: number, label: string) {
    setPriceSource(label);
    setShowMap(false);
    setPricePerUnit(price.toFixed(3));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const kmValue = Number(km);

    if (!date) {
      setError("Inserisci la data.");
      return;
    }
    if (Number.isNaN(kmValue) || kmValue < 0) {
      setError("Inserisci un chilometraggio valido.");
      return;
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setError(`Inserisci un prezzo per ${unitShort} valido.`);
      return;
    }
    if (Number.isNaN(costValue) || costValue <= 0) {
      setError("Inserisci un costo totale valido.");
      return;
    }

    const entry: FuelEntry = {
      id: initialEntry?.id ?? generateId(),
      vehicleId: vehicle.id,
      date: new Date(date).toISOString(),
      km: Math.round(kmValue),
      liters: costValue / priceValue,
      totalCost: costValue,
      source,
      fullTank,
      notes: notes.trim() || undefined,
    };

    onSave(entry);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fuel-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="fuel-form-title">{isEditing ? "Modifica rifornimento" : "Nuovo rifornimento"}</h2>
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

          <div className="field-row">
            <div className="field">
              <label htmlFor="fuel-price">€/{unitShort} *</label>
              <input
                id="fuel-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
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
            </div>
            <div className="field">
              <label htmlFor="fuel-cost">Costo totale (€) *</label>
              <input
                id="fuel-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
              />
            </div>
          </div>

          {priceSource && (
            <p className="empty-state__body" style={{ margin: "-0.25rem 0 0.5rem" }}>
              Prezzo da: {priceSource}
            </p>
          )}

          <div className="field">
            <label htmlFor="fuel-liters">{unitLabel} (calcolati)</label>
            <input
              id="fuel-liters"
              type="text"
              readOnly
              disabled
              value={computedLiters !== null ? computedLiters.toFixed(2) : "—"}
            />
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
              {isEditing ? "Salva modifiche" : "Salva rifornimento"}
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
