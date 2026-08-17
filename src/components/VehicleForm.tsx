import { useState } from "react";
import type { FormEvent } from "react";
import type { Vehicle, FuelType } from "../types";
import { generateId } from "../utils/storage";

const FUEL_OPTIONS: { value: FuelType; label: string }[] = [
  { value: "benzina", label: "Benzina" },
  { value: "diesel", label: "Diesel" },
  { value: "gpl", label: "GPL" },
  { value: "metano", label: "Metano" },
  { value: "elettrico", label: "Elettrico" },
  { value: "ibrido", label: "Ibrido" },
];

interface Props {
  initialVehicle?: Vehicle;
  onSave: (vehicle: Vehicle) => void;
  onClose: () => void;
}

export default function VehicleForm({ initialVehicle, onSave, onClose }: Props) {
  const isEditing = Boolean(initialVehicle);
  const [name, setName] = useState(initialVehicle?.name ?? "");
  const [plate, setPlate] = useState(initialVehicle?.plate ?? "");
  const [fuelType, setFuelType] = useState<FuelType>(initialVehicle?.fuelType ?? "benzina");
  const [currentKm, setCurrentKm] = useState(initialVehicle ? String(initialVehicle.currentKm) : "");
  const [year, setYear] = useState(initialVehicle?.year ? String(initialVehicle.year) : "");
  const [notes, setNotes] = useState(initialVehicle?.notes ?? "");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Inserisci il nome del veicolo.");
      return;
    }
    const kmValue = Number(currentKm);
    if (currentKm.trim() === "" || Number.isNaN(kmValue) || kmValue < 0) {
      setError("Inserisci un chilometraggio valido.");
      return;
    }

    const vehicle: Vehicle = {
      id: initialVehicle?.id ?? generateId(),
      name: name.trim(),
      plate: plate.trim() || undefined,
      fuelType,
      currentKm: Math.round(kmValue),
      year: year.trim() ? Number(year) : undefined,
      notes: notes.trim() || undefined,
      createdAt: initialVehicle?.createdAt ?? new Date().toISOString(),
    };

    onSave(vehicle);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="vehicle-form-title">{isEditing ? "Modifica veicolo" : "Nuovo veicolo"}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field">
            <label htmlFor="name">Nome veicolo *</label>
            <input
              id="name"
              type="text"
              placeholder="es. La mia auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="fuelType">Alimentazione</label>
              <select id="fuelType" value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)}>
                {FUEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="year">Anno</label>
              <input
                id="year"
                type="number"
                placeholder="es. 2014"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="currentKm">Chilometraggio attuale *</label>
              <input
                id="currentKm"
                type="number"
                inputMode="numeric"
                placeholder="es. 204000"
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="plate">Targa</label>
              <input
                id="plate"
                type="text"
                placeholder="es. AB123CD"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="notes">Note</label>
            <textarea
              id="notes"
              placeholder="Annotazioni libere sul veicolo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn--primary">
              {isEditing ? "Salva modifiche" : "Salva veicolo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
