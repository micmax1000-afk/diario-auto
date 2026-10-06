import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ExpenseEntry, ExpenseCategory, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import PhotoPicker from "./PhotoPicker";

const CATEGORIES: ExpenseCategory[] = ["assicurazione", "bollo", "multa", "documenti", "altro"];

interface Props {
  vehicle: Vehicle;
  onSave: (entry: ExpenseEntry) => void;
  onClose: () => void;
}

export default function ExpenseForm({ vehicle, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>("assicurazione");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
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
          <h2 id="expense-form-title">{t("expenseForm.title")}</h2>
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
            <label htmlFor="expense-amount">{t("expenseForm.amount")}</label>
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
