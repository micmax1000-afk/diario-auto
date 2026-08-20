import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Vehicle, FuelType } from "../types";
import { generateId } from "../utils/storage";
import { CAR_CATALOG, OTHER_BRAND, OTHER_MODEL } from "../utils/carCatalog";

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
  const [brand, setBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [name, setName] = useState(initialVehicle?.name ?? "");
  const [plate, setPlate] = useState(initialVehicle?.plate ?? "");
  const [fuelType, setFuelType] = useState<FuelType>(initialVehicle?.fuelType ?? "benzina");
  const [currentKm, setCurrentKm] = useState(initialVehicle ? String(initialVehicle.currentKm) : "");
  const [year, setYear] = useState(initialVehicle?.year ? String(initialVehicle.year) : "");
  const [notes, setNotes] = useState(initialVehicle?.notes ?? "");
  const [error, setError] = useState("");

  const selectedBrandEntry = CAR_CATALOG.find((b) => b.brand === brand);

  // Compila automaticamente "Nome veicolo" da Marca/Modello selezionati,
  // ma solo se l'utente ha effettivamente usato i menu: se non li tocca
  // (es. in modifica), il nome digitato a mano resta intatto.
  useEffect(() => {
    if (!brand) return;
    const brandLabel = brand === OTHER_BRAND ? customBrand.trim() : brand;
    const modelLabel = brand === OTHER_BRAND ? customModel.trim() : model === OTHER_MODEL ? customModel.trim() : model;
    const combined = [brandLabel, modelLabel].filter(Boolean).join(" ");
    if (combined) setName(combined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, customBrand, model, customModel]);

  function handleBrandChange(value: string) {
    setBrand(value);
    setModel("");
    setCustomModel("");
  }

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
          <div className="field-row">
            <div className="field">
              <label htmlFor="brand">Marca</label>
              <select id="brand" value={brand} onChange={(e) => handleBrandChange(e.target.value)} autoFocus>
                <option value="">Scegli marca (opzionale)</option>
                {CAR_CATALOG.map((b) => (
                  <option key={b.brand} value={b.brand}>
                    {b.brand}
                  </option>
                ))}
                <option value={OTHER_BRAND}>Altra marca...</option>
              </select>
            </div>

            {brand && brand !== OTHER_BRAND && (
              <div className="field">
                <label htmlFor="model">Modello</label>
                <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="">Scegli modello</option>
                  {selectedBrandEntry?.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={OTHER_MODEL}>Altro modello...</option>
                </select>
              </div>
            )}
          </div>

          {brand === OTHER_BRAND && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="custom-brand">Marca</label>
                <input
                  id="custom-brand"
                  type="text"
                  placeholder="es. Lada"
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="custom-model-alt">Modello</label>
                <input
                  id="custom-model-alt"
                  type="text"
                  placeholder="es. Niva"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                />
              </div>
            </div>
          )}

          {brand && brand !== OTHER_BRAND && model === OTHER_MODEL && (
            <div className="field">
              <label htmlFor="custom-model">Modello personalizzato</label>
              <input
                id="custom-model"
                type="text"
                placeholder="es. A3 Sportback"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="name">Nome veicolo *</label>
            <input
              id="name"
              type="text"
              placeholder="es. La mia auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
