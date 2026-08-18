import { useState } from "react";
import type { FormEvent } from "react";
import type { CommuteSettings } from "../types";
import FuelPriceMap from "./FuelPriceMap";
import CommuteRouteMap from "./CommuteRouteMap";

interface Props {
  initial: CommuteSettings;
  onSave: (patch: Partial<CommuteSettings>) => void;
  onClose: () => void;
}

export default function CommuteSettingsForm({ initial, onSave, onClose }: Props) {
  const [kmPerTrip, setKmPerTrip] = useState(String(initial.kmPerTrip || ""));
  const [tripsPerDay, setTripsPerDay] = useState(String(initial.tripsPerDay || 2));
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(String(initial.workDaysPerWeek || 6));
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(String(initial.fuelPricePerLiter || ""));
  const [estimatedKmPerLiter, setEstimatedKmPerLiter] = useState(
    initial.estimatedKmPerLiter ? String(initial.estimatedKmPerLiter) : "",
  );
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [priceSource, setPriceSource] = useState<string | null>(null);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const km = Number(kmPerTrip);
    const trips = Number(tripsPerDay);
    const days = Number(workDaysPerWeek);
    const price = Number(fuelPricePerLiter);

    if (Number.isNaN(km) || km <= 0) {
      setError("Inserisci i km della tratta (es. andata casa-lavoro).");
      return;
    }
    if (Number.isNaN(trips) || trips <= 0) {
      setError("Inserisci un numero di tratte al giorno valido.");
      return;
    }
    if (Number.isNaN(days) || days <= 0 || days > 7) {
      setError("Inserisci un numero di giorni lavorativi a settimana valido (1-7).");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setError("Inserisci un prezzo carburante valido.");
      return;
    }

    const estimate = estimatedKmPerLiter.trim() ? Number(estimatedKmPerLiter) : undefined;
    if (estimate !== undefined && (Number.isNaN(estimate) || estimate <= 0)) {
      setError("Il consumo stimato deve essere un numero maggiore di zero.");
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
          <h2 id="commute-settings-title">Impostazioni tragitto</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="commute-km">Km a tratta *</label>
              <input
                id="commute-km"
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="es. 35"
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
                Calcola con la mappa
              </button>
              {routeLabel && <p className="empty-state__body" style={{ margin: 0 }}>Percorso: {routeLabel}</p>}
            </div>
            <div className="field">
              <label htmlFor="commute-trips">Tratte al giorno *</label>
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
              <label htmlFor="commute-days">Giorni lavorativi/settimana *</label>
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
              <label htmlFor="commute-price">Prezzo carburante (€/litro) *</label>
              <input
                id="commute-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                placeholder="es. 1.750"
                value={fuelPricePerLiter}
                onChange={(e) => {
                  setFuelPricePerLiter(e.target.value);
                  setPriceSource(null);
                }}
              />
              <button
                type="button"
                className="btn btn--ghost btn--small"
                style={{ alignSelf: "flex-start", marginTop: "0.25rem" }}
                onClick={() => setShowMap(true)}
              >
                Trova sulla mappa
              </button>
              {priceSource && <p className="empty-state__body" style={{ margin: 0 }}>Da: {priceSource}</p>}
            </div>
          </div>

          <div className="field">
            <label htmlFor="commute-estimate">Consumo stimato (km/l, opzionale)</label>
            <input
              id="commute-estimate"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="es. 15 (una stima approssimativa va bene)"
              value={estimatedKmPerLiter}
              onChange={(e) => setEstimatedKmPerLiter(e.target.value)}
            />
            <p className="empty-state__body" style={{ margin: "0.25rem 0 0" }}>
              Usato solo finché non hai registrato abbastanza rifornimenti "pieno" per calcolare il consumo
              reale — da quel momento lo sostituisco automaticamente, senza bisogno di modificare nulla qui.
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn--primary">
              Salva
            </button>
          </div>
        </form>
      </div>

      {showMap && (
        <FuelPriceMap
          onSelect={(price, label) => {
            setFuelPricePerLiter(price.toFixed(3));
            setPriceSource(label);
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}

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
