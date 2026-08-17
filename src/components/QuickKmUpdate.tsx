import { useState } from "react";
import type { FormEvent } from "react";
import type { Vehicle } from "../types";

interface Props {
  vehicle: Vehicle;
  onSave: (km: number) => void;
  onClose: () => void;
}

export default function QuickKmUpdate({ vehicle, onSave, onClose }: Props) {
  const [km, setKm] = useState(String(vehicle.currentKm));
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(km);
    if (Number.isNaN(value) || value < vehicle.currentKm) {
      setError(`Inserisci un valore maggiore o uguale a ${vehicle.currentKm.toLocaleString("it-IT")}.`);
      return;
    }
    onSave(Math.round(value));
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-km-title">
      <div className="modal modal--small">
        <div className="modal__header">
          <h2 id="quick-km-title">Aggiorna km — {vehicle.name}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field">
            <label htmlFor="quick-km">Chilometraggio attuale</label>
            <input
              id="quick-km"
              type="number"
              inputMode="numeric"
              autoFocus
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn--primary">
              Aggiorna
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
