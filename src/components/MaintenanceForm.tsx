import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { MaintenanceEntry, MaintenanceCategory, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import { compressImage, estimateDataUrlKb } from "../utils/imageCompression";

const CATEGORY_OPTIONS: { value: MaintenanceCategory; label: string }[] = [
  { value: "tagliando", label: "Tagliando" },
  { value: "gomme", label: "Gomme" },
  { value: "freni", label: "Freni" },
  { value: "olio", label: "Cambio olio" },
  { value: "batteria", label: "Batteria (12V/trazione)" },
  { value: "raffreddamento", label: "Liquido raffreddamento" },
  { value: "software", label: "Aggiornamento software" },
  { value: "carrozzeria", label: "Carrozzeria" },
  { value: "revisione", label: "Revisione" },
  { value: "altro", label: "Altro" },
];

interface Props {
  vehicle: Vehicle;
  onSave: (entry: MaintenanceEntry) => void;
  onClose: () => void;
}

export default function MaintenanceForm({ vehicle, onSave, onClose }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState(String(vehicle.currentKm));
  const [category, setCategory] = useState<MaintenanceCategory>("tagliando");
  const [description, setDescription] = useState("");
  const [splitCost, setSplitCost] = useState(false);
  const [cost, setCost] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoKb, setPhotoKb] = useState<number | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPhotoKb(estimateDataUrlKb(compressed));
    } catch {
      setError("Non sono riuscito a caricare la foto.");
    }
    setPhotoBusy(false);
    e.target.value = "";
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const kmValue = Number(km);
    if (!description.trim()) {
      setError("Descrivi l'intervento eseguito.");
      return;
    }
    if (Number.isNaN(kmValue) || kmValue < 0) {
      setError("Inserisci un chilometraggio valido.");
      return;
    }

    let totalCost: number;
    let parts: number | undefined;
    let labor: number | undefined;

    if (splitCost) {
      const partsValue = Number(partsCost || 0);
      const laborValue = Number(laborCost || 0);
      if (Number.isNaN(partsValue) || Number.isNaN(laborValue) || partsValue < 0 || laborValue < 0) {
        setError("Inserisci importi validi per ricambi e manodopera.");
        return;
      }
      parts = partsValue;
      labor = laborValue;
      totalCost = partsValue + laborValue;
    } else {
      const costValue = Number(cost);
      if (Number.isNaN(costValue) || costValue < 0) {
        setError("Inserisci un costo valido.");
        return;
      }
      totalCost = costValue;
    }

    const entry: MaintenanceEntry = {
      id: generateId(),
      vehicleId: vehicle.id,
      date: new Date(date).toISOString(),
      km: Math.round(kmValue),
      category,
      description: description.trim(),
      cost: totalCost,
      partsCost: parts,
      laborCost: labor,
      workshop: workshop.trim() || undefined,
      notes: notes.trim() || undefined,
      photo: photo ?? undefined,
    };

    onSave(entry);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="maintenance-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="maintenance-form-title">Nuova manutenzione</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="maint-date">Data</label>
              <input id="maint-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="maint-km">Km *</label>
              <input
                id="maint-km"
                type="number"
                inputMode="numeric"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="maint-category">Categoria</label>
            <select
              id="maint-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="maint-description">Descrizione *</label>
            <input
              id="maint-description"
              type="text"
              placeholder="es. Sostituzione pastiglie freni anteriori"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field field--checkbox">
            <label htmlFor="maint-split">
              <input
                id="maint-split"
                type="checkbox"
                checked={splitCost}
                onChange={(e) => setSplitCost(e.target.checked)}
              />
              Separa ricambi e manodopera
            </label>
          </div>

          {splitCost ? (
            <div className="field-row">
              <div className="field">
                <label htmlFor="maint-parts">Ricambi (€)</label>
                <input
                  id="maint-parts"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={partsCost}
                  onChange={(e) => setPartsCost(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="maint-labor">Manodopera (€)</label>
                <input
                  id="maint-labor"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="maint-cost">Costo totale (€) *</label>
              <input
                id="maint-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="maint-workshop">Officina</label>
            <input
              id="maint-workshop"
              type="text"
              placeholder="es. Officina Rossi"
              value={workshop}
              onChange={(e) => setWorkshop(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="maint-notes">Note</label>
            <textarea id="maint-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="field">
            <label htmlFor="maint-photo">Foto (fattura, ricambio, ecc.)</label>
            <input id="maint-photo" type="file" accept="image/*" onChange={handlePhotoChange} disabled={photoBusy} />
            {photoBusy && <p className="obd-hint">Comprimo l'immagine…</p>}
            {photo && (
              <div className="photo-preview">
                <img src={photo} alt="Anteprima allegato" />
                <span className="photo-preview__meta">
                  ~{photoKb} KB
                  <button type="button" className="photo-preview__remove" onClick={() => setPhoto(null)}>
                    Rimuovi
                  </button>
                </span>
              </div>
            )}
            <p className="obd-hint">
              Le foto sono salvate solo su questo dispositivo (compresse per occupare poco spazio) e incluse nel
              backup JSON — non nell'export CSV.
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn--primary">
              Salva manutenzione
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
