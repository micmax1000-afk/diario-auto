import { useState } from "react";
import type { FormEvent } from "react";
import { isoToLocalDate, localDateString, localDateToIso } from "../utils/dates";
import { useTranslation } from "react-i18next";
import type { ExpenseEntry, ExpenseCategory, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import PhotoPicker from "./PhotoPicker";
import { useCurrencySymbol } from "../utils/useCurrencySymbol";

const CATEGORIES: ExpenseCategory[] = ["assicurazione", "bollo", "multa", "documenti", "altro"];

interface Props {
  vehicle: Vehicle;
  /** Se presente, il modulo modifica questa spesa invece di crearne una nuova. */
  initialEntry?: ExpenseEntry;
  onSave: (entry: ExpenseEntry) => void;
  onClose: () => void;
  /** Se presente (in modifica), mostra "Elimina" nel modulo. */
  onDelete?: () => void;
}

export default function ExpenseForm({ vehicle, initialEntry, onSave, onClose, onDelete }: Props) {
  const { t } = useTranslation();
  const cur = useCurrencySymbol();
  const [date, setDate] = useState(() => initialEntry ? isoToLocalDate(initialEntry.date) : localDateString());
  const [category, setCategory] = useState<ExpenseCategory>(initialEntry?.category ?? "assicurazione");
  const [description, setDescription] = useState(initialEntry?.description ?? "");
  const [amount, setAmount] = useState(initialEntry ? String(initialEntry.amount) : "");
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [photo, setPhoto] = useState<string | null>(initialEntry?.photo ?? null);
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!description.trim()) {
      setError(t("expenseForm.errorDescription"));
      return;
    }
    const amountValue = Number(amount);
    if (Number.isNaN(amountValue) || amountValue < 0) {
      setError(t("expenseForm.errorAmount"));
      return;
    }

    const entry: ExpenseEntry = {
      ...initialEntry,
      id: initialEntry?.id ?? generateId(),
      vehicleId: vehicle.id,
      date: localDateToIso(date, initialEntry?.date),
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
          <h2 id="expense-form-title">{t(initialEntry ? "expenseForm.editTitle" : "expenseForm.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field">
            <label htmlFor="expense-date">{t("expenseForm.date")}</label>
            <input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="expense-category">{t("expenseForm.category")}</label>
            <select id="expense-category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>{t(`expenseCategory.${value}`)}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="expense-description">{t("expenseForm.description")}</label>
            <input
              id="expense-description"
              type="text"
              placeholder={t("expenseForm.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="expense-amount">{t("expenseForm.amount", { cur })}</label>
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
            <label htmlFor="expense-notes">{t("expenseForm.notes")}</label>
            <textarea id="expense-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <PhotoPicker id="expense-photo" value={photo} onChange={setPhoto} keyPrefix="expenseForm" />

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            {onDelete && (
              <button type="button" className="btn btn--ghost btn--danger modal__delete" onClick={onDelete}>
                {t("common.delete")}
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("expenseForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary">
              {t("expenseForm.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
