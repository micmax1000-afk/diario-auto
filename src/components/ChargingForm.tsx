import { useState } from "react";
import type { FormEvent } from "react";
import type { ChargingEntry, Vehicle } from "../types";
import { generateId, getHomeChargingDefaults, setHomeChargingDefaults } from "../utils/storage";

interface Props {
  vehicle: Vehicle;
  initialEntry?: ChargingEntry;
  onSave: (entry: ChargingEntry) => void;
  onClose: () => void;
}

export default function ChargingForm({ vehicle, initialEntry, onSave, onClose }: Props) {
  const isEditing = Boolean(initialEntry);
  const [date, setDate] = useState(() => initialEntry?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState(String(initialEntry?.km ?? vehicle.currentKm));
  const [pricePerKWh, setPricePerKWh] = useState(initialEntry ? String(initialEntry.pricePerKWh) : "");
  const [totalCost, setTotalCost] = useState(initialEntry ? String(initialEntry.totalCost) : "");
  const [powerKW, setPowerKW] = useState(initialEntry?.powerKW !== undefined ? String(initialEntry.powerKW) : "");
  const [atHome, setAtHome] = useState(initialEntry?.atHome ?? false);
  const [location, setLocation] = useState(initialEntry?.location ?? "");
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [error, setError] = useState("");

  // kWh calcolati SEMPRE da costo totale / prezzo unitario: non editabili
  // direttamente, per evitare valori tra loro incoerenti.
  const priceValue = Number(pricePerKWh);
  const costValue = Number(totalCost);
  const computedKWh =
    pricePerKWh !== "" && !Number.isNaN(priceValue) && priceValue > 0 && totalCost !== "" && !Number.isNaN(costValue)
      ? costValue / priceValue
      : null;

  function handleToggleAtHome(checked: boolean) {
    setAtHome(checked);
    if (checked) {
      if (!location.trim()) setLocation("Casa");
      // precompila da ultima ricarica a casa registrata, solo se i campi sono ancora vuoti
      const defaults = getHomeChargingDefaults(vehicle.id);
      if (defaults) {
        if (!pricePerKWh) setPricePerKWh(String(defaults.pricePerKWh));
        if (!powerKW && defaults.powerKW !== undefined) setPowerKW(String(defaults.powerKW));
      }
    } else if (location === "Casa") {
      setLocation("");
    }
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
      setError("Inserisci un prezzo per kWh valido.");
      return;
    }
    if (Number.isNaN(costValue) || costValue <= 0) {
      setError("Inserisci un costo totale valido.");
      return;
    }

    const entry: ChargingEntry = {
      id: initialEntry?.id ?? generateId(),
      vehicleId: vehicle.id,
      date: new Date(date).toISOString(),
      km: Math.round(kmValue),
      kWh: costValue / priceValue,
      pricePerKWh: priceValue,
      totalCost: costValue,
      powerKW: powerKW.trim() ? Number(powerKW) : undefined,
      atHome,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (atHome) {
      setHomeChargingDefaults(vehicle.id, entry.pricePerKWh, entry.powerKW);
    }

    onSave(entry);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="charging-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="charging-form-title">{isEditing ? "Modifica ricarica" : "Nuova ricarica"}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="charge-date">Data</label>
              <input id="charge-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="charge-km">Km attuali *</label>
              <input
                id="charge-km"
                type="number"
                inputMode="numeric"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            </div>
          </div>

          <div className="field field--checkbox">
            <label htmlFor="charge-home">
              <input
                id="charge-home"
                type="checkbox"
                checked={atHome}
                onChange={(e) => handleToggleAtHome(e.target.checked)}
              />
              Ricarica a casa (wallbox/presa)
            </label>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="charge-price">€/kWh *</label>
              <input
                id="charge-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                value={pricePerKWh}
                onChange={(e) => setPricePerKWh(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="charge-cost">Costo totale (€) *</label>
              <input
                id="charge-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="charge-kwh">kWh (calcolati)</label>
              <input
                id="charge-kwh"
                type="text"
                readOnly
                disabled
                value={computedKWh !== null ? computedKWh.toFixed(2) : "—"}
              />
            </div>
            <div className="field">
              <label htmlFor="charge-power">Potenza (kW)</label>
              <input
                id="charge-power"
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder={atHome ? "es. 7.4 (wallbox)" : "es. 50, 150..."}
                value={powerKW}
                onChange={(e) => setPowerKW(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="charge-location">Colonnina / luogo</label>
            <input
              id="charge-location"
              type="text"
              placeholder="es. Ionity A1 - Fidenza"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="charge-notes">Note</label>
            <textarea
              id="charge-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="es. ricarica rapida in autostrada..."
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn--primary">
              {isEditing ? "Salva modifiche" : "Salva ricarica"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
