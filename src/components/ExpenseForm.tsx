import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { ExpenseEntry, ExpenseCategory, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import { compressImage, estimateDataUrlKb } from "../utils/imageCompression";

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "assicurazione", label: "Assicurazione" },
  { value: "bollo", label: "Bollo" },
  { value: "multa", label: "Multa" },
  { value: "documenti", label: "Documenti" },
  { value: "altro", label: "Altro" },
];

interface Props {
  vehicle: Vehicle;
  onSave: (entry: ExpenseEntry) => void;
  onClose: () => void;
}

export default function ExpenseForm({ vehicle, onSave, onClose }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>("assicurazione");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
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

    if (!description.trim()) {
      setError("Indica di cosa si tratta (es. Assicurazione RCA 2026).");
      return;
    }
    const amountValue = Number(amount);
    if (Number.isNaN(amountValue) || amountValue < 0) {
      setError("Inserisci un importo valido.");
      return;
    }

    const entry: ExpenseEntry = {
      id: generateId(),
      vehicleId: vehicle.id,
      date: new Date(date).toISOString(),
      category,
      description: description.trim(),
      amount: amountValue,
      notes: notes.trim() || undefined,
      photo: photo ?? undefined,
    };

    onSave(entry);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="expense-form-title">Nuova spesa</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="expense-date">Data</label>
              <input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="expense-category">Categoria</label>
              <select
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="expense-description">Descrizione *</label>
            <input
              id="expense-description"
              type="text"
              placeholder="es. Assicurazione RCA 2026"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="expense-amount">Importo (€) *</label>
            <input
              id="expense-amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="expense-notes">Note</label>
            <textarea id="expense-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="field">
            <label htmlFor="expense-photo">Foto (bolletta, verbale, ecc.)</label>
            <input
              id="expense-photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              disabled={photoBusy}
            />
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
              Le foto sono salvate solo su questo dispositivo (compresse) e incluse nel backup JSON.
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn--primary">
              Salva spesa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
