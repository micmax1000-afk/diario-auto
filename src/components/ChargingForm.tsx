import { useState } from "react";
import type { FormEvent } from "react";
import type { ChargingEntry, Vehicle } from "../types";
import { generateId, getHomeChargingDefaults, setHomeChargingDefaults } from "../utils/storage";
import EVChargerMap from "./EVChargerMap";
import type { ChargerStation } from "../utils/evChargerApi";

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
  const [kWh, setKWh] = useState(initialEntry ? String(initialEntry.kWh) : "");
  const [pricePerKWh, setPricePerKWh] = useState(initialEntry ? String(initialEntry.pricePerKWh) : "");
  const [totalCost, setTotalCost] = useState(initialEntry ? String(initialEntry.totalCost) : "");
  const [powerKW, setPowerKW] = useState(initialEntry?.powerKW !== undefined ? String(initialEntry.powerKW) : "");
  const [atHome, setAtHome] = useState(initialEntry?.atHome ?? false);
  const [location, setLocation] = useState(initialEntry?.location ?? "");
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);

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

  // Calcolo triangolare: kWh × prezzo/kWh = costo totale. Basta compilare due
  // qualsiasi dei tre campi: il terzo si calcola da solo.
  function recalcFrom(changed: "kwh" | "price" | "cost", value: string) {
    const kwhValue = changed === "kwh" ? Number(value) : Number(kWh);
    const priceValue = changed === "price" ? Number(value) : Number(pricePerKWh);
    const costValue = changed === "cost" ? Number(value) : Number(totalCost);

    const hasKwh = changed === "kwh" ? value !== "" && !Number.isNaN(kwhValue) : kWh !== "" && !Number.isNaN(kwhValue);
    const hasPrice =
      changed === "price" ? value !== "" && !Number.isNaN(priceValue) : pricePerKWh !== "" && !Number.isNaN(priceValue);
    const hasCost =
      changed === "cost" ? value !== "" && !Number.isNaN(costValue) : totalCost !== "" && !Number.isNaN(costValue);

    if (changed === "kwh") {
      setKWh(value);
      if (hasPrice && kwhValue > 0) setTotalCost((kwhValue * priceValue).toFixed(2));
      else if (hasCost && kwhValue > 0) setPricePerKWh((costValue / kwhValue).toFixed(3));
    } else if (changed === "price") {
      setPricePerKWh(value);
      if (hasKwh && priceValue >= 0) setTotalCost((kwhValue * priceValue).toFixed(2));
      else if (hasCost && priceValue > 0) setKWh((costValue / priceValue).toFixed(2));
    } else {
      setTotalCost(value);
      if (hasKwh && kwhValue > 0) setPricePerKWh((costValue / kwhValue).toFixed(3));
      else if (hasPrice && priceValue > 0) setKWh((costValue / priceValue).toFixed(2));
    }
  }

  function handleSelectStation(station: ChargerStation) {
    setShowMap(false);
    setLocation(station.title);
    if (station.maxPowerKW) {
      // usiamo la potenza massima come indicazione; non è un prezzo, quindi non ricalcola nulla
      setNotes((prev) => (prev ? prev : `Potenza colonnina: fino a ${station.maxPowerKW} kW`));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const kmValue = Number(km);
    const kWhValue = Number(kWh);
    const costValue = Number(totalCost);
    const priceValue = Number(pricePerKWh);

    if (!date) {
      setError("Inserisci la data.");
      return;
    }
    if (Number.isNaN(kmValue) || kmValue < 0) {
      setError("Inserisci un chilometraggio valido.");
      return;
    }
    if (Number.isNaN(kWhValue) || kWhValue <= 0) {
      setError("Inserisci una quantità di kWh valida.");
      return;
    }
    if (Number.isNaN(costValue) || costValue < 0) {
      setError("Inserisci un costo valido.");
      return;
    }

    const entry: ChargingEntry = {
      id: initialEntry?.id ?? generateId(),
      vehicleId: vehicle.id,
      date: new Date(date).toISOString(),
      km: Math.round(kmValue),
      kWh: kWhValue,
      pricePerKWh: Number.isNaN(priceValue) ? costValue / kWhValue : priceValue,
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

          <p className="empty-state__body" style={{ margin: "0 0 0.25rem" }}>
            Compila due qualsiasi tra kWh, prezzo e costo totale: calcolo il terzo in automatico.
          </p>

          <div className="field-row">
            <div className="field">
              <label htmlFor="charge-kwh">kWh</label>
              <input
                id="charge-kwh"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={kWh}
                onChange={(e) => recalcFrom("kwh", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="charge-price">€/kWh</label>
              <input
                id="charge-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                value={pricePerKWh}
                onChange={(e) => recalcFrom("price", e.target.value)}
              />
              {!atHome && (
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  style={{ alignSelf: "flex-start", marginTop: "0.25rem" }}
                  onClick={() => setShowMap(true)}
                >
                  Trova colonnina sulla mappa
                </button>
              )}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="charge-cost">Costo totale (€) *</label>
              <input
                id="charge-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalCost}
                onChange={(e) => recalcFrom("cost", e.target.value)}
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

      {showMap && <EVChargerMap onSelect={handleSelectStation} onClose={() => setShowMap(false)} />}
    </div>
  );
}
