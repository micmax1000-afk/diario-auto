import { useState } from "react";
import type { FormEvent } from "react";
import type { Reminder, ReminderType, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import { REMINDER_CATALOG, computeDueFromCatalog } from "../utils/reminderCatalog";

interface Props {
  vehicle: Vehicle;
  onSave: (reminder: Reminder) => void;
  onClose: () => void;
}

export default function ReminderForm({ vehicle, onSave, onClose }: Props) {
  const [showCatalog, setShowCatalog] = useState(true);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ReminderType>("data");
  const [dueDate, setDueDate] = useState("");
  const [dueKm, setDueKm] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const [repeat, setRepeat] = useState(false);
  const [repeatMonths, setRepeatMonths] = useState("");
  const [repeatKm, setRepeatKm] = useState("");

  function applyCatalogEntry(entryLabel: string) {
    const entry = REMINDER_CATALOG.find((e) => e.label === entryLabel);
    if (!entry) return;
    const due = computeDueFromCatalog(entry, vehicle.currentKm);
    setLabel(entry.label);
    if (due.dueDate) {
      setType("data");
      setDueDate(due.dueDate);
    } else if (due.dueKm) {
      setType("km");
      setDueKm(String(due.dueKm));
    }
    if (entry.recurring) {
      setRepeat(true);
      if (entry.months) setRepeatMonths(String(entry.months));
      if (entry.km) setRepeatKm(String(entry.km));
    } else {
      setRepeat(false);
      setRepeatMonths("");
      setRepeatKm("");
    }
    setShowCatalog(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!label.trim()) {
      setError("Indica di cosa si tratta (es. Bollo).");
      return;
    }
    if (type === "data" && !dueDate) {
      setError("Inserisci la data di scadenza.");
      return;
    }
    if (type === "km") {
      const kmValue = Number(dueKm);
      if (dueKm.trim() === "" || Number.isNaN(kmValue) || kmValue <= 0) {
        setError("Inserisci un chilometraggio di scadenza valido.");
        return;
      }
    }

    const reminder: Reminder = {
      id: generateId(),
      vehicleId: vehicle.id,
      label: label.trim(),
      type,
      dueDate: type === "data" ? new Date(dueDate).toISOString() : undefined,
      dueKm: type === "km" ? Math.round(Number(dueKm)) : undefined,
      notes: notes.trim() || undefined,
      completed: false,
      repeatMonths: repeat && repeatMonths.trim() ? Number(repeatMonths) : undefined,
      repeatKm: repeat && repeatKm.trim() ? Number(repeatKm) : undefined,
    };

    onSave(reminder);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reminder-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="reminder-form-title">Nuova scadenza</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        {showCatalog ? (
          <div className="catalog-picker">
            <p className="obd-hint" style={{ padding: "0 1.5rem" }}>
              Scegli un promemoria comune (intervalli precompilati, modificabili) o crealo da zero.
            </p>
            <div className="catalog-list">
              {REMINDER_CATALOG.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  className="catalog-list__item"
                  onClick={() => applyCatalogEntry(entry.label)}
                >
                  <span>{entry.label}</span>
                  <span className="catalog-list__interval">
                    {entry.months ? `${entry.months} mesi` : ""}
                    {entry.months && entry.km ? " · " : ""}
                    {entry.km ? `${entry.km.toLocaleString("it-IT")} km` : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="modal__actions" style={{ padding: "0 1.5rem 1.5rem" }}>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Annulla
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setShowCatalog(false)}>
                Crea personalizzata
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="vehicle-form">
            <button type="button" className="back-link" style={{ margin: "0 0 0.5rem" }} onClick={() => setShowCatalog(true)}>
              ← Scegli dal catalogo
            </button>

            <div className="field">
              <label htmlFor="reminder-label">Cosa scade *</label>
              <input
                id="reminder-label"
                type="text"
                placeholder="es. Bollo"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="reminder-type">Tipo scadenza</label>
              <select id="reminder-type" value={type} onChange={(e) => setType(e.target.value as ReminderType)}>
                <option value="data">Per data</option>
                <option value="km">Per chilometraggio</option>
              </select>
            </div>

            {type === "data" ? (
              <div className="field">
                <label htmlFor="reminder-date">Data di scadenza *</label>
                <input
                  id="reminder-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="reminder-km">Km di scadenza *</label>
                <input
                  id="reminder-km"
                  type="number"
                  inputMode="numeric"
                  placeholder={`es. ${vehicle.currentKm + 15000}`}
                  value={dueKm}
                  onChange={(e) => setDueKm(e.target.value)}
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="reminder-notes">Note</label>
              <textarea id="reminder-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="field field--checkbox">
              <label htmlFor="reminder-repeat">
                <input
                  id="reminder-repeat"
                  type="checkbox"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                />
                Ripeti automaticamente al completamento
              </label>
            </div>

            {repeat && (
              <div className="field-row">
                <div className="field">
                  <label htmlFor="repeat-months">Ogni N mesi</label>
                  <input
                    id="repeat-months"
                    type="number"
                    placeholder="es. 12"
                    value={repeatMonths}
                    onChange={(e) => setRepeatMonths(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="repeat-km">Ogni N km</label>
                  <input
                    id="repeat-km"
                    type="number"
                    placeholder="es. 20000"
                    value={repeatKm}
                    onChange={(e) => setRepeatKm(e.target.value)}
                  />
                </div>
              </div>
            )}

            {error && <p className="form-error">{error}</p>}

            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Annulla
              </button>
              <button type="submit" className="btn btn--primary">
                Salva scadenza
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
