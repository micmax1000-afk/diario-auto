import { useState } from "react";
import type { FormEvent } from "react";
import { isoToLocalDate, localDateString, localDateToIso } from "../utils/dates";
import { useTranslation } from "react-i18next";
import type { MaintenanceEntry, MaintenanceCategory, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import PhotoPicker from "./PhotoPicker";
import { useCurrencySymbol } from "../utils/useCurrencySymbol";

const CATEGORIES: MaintenanceCategory[] = [
  "tagliando", "gomme", "freni", "olio", "batteria", "raffreddamento", "software", "carrozzeria", "revisione", "altro",
];

interface Props {
  vehicle: Vehicle;
  /** Se presente, il modulo modifica questa manutenzione invece di crearne una nuova. */
  initialEntry?: MaintenanceEntry;
  onSave: (entry: MaintenanceEntry) => void;
  onClose: () => void;
  /** Se presente (in modifica), mostra "Elimina" nel modulo. */
  onDelete?: () => void;
  /** Valori iniziali per una nuova manutenzione (es. dopo "Fatto" su una scadenza). */
  defaults?: Partial<Pick<MaintenanceEntry, "category" | "description">>;
  /** Messaggio in cima al modulo. */
  notice?: string;
}

export default function MaintenanceForm({ vehicle, initialEntry, onSave, onClose, onDelete, defaults, notice }: Props) {
  const { t } = useTranslation();
  const cur = useCurrencySymbol();
  const [date, setDate] = useState(() => initialEntry ? isoToLocalDate(initialEntry.date) : localDateString());
  const [km, setKm] = useState(String(initialEntry?.km ?? vehicle.currentKm));
  const [category, setCategory] = useState<MaintenanceCategory>(initialEntry?.category ?? defaults?.category ?? "tagliando");
  const [description, setDescription] = useState(initialEntry?.description ?? defaults?.description ?? "");
  const [splitCost, setSplitCost] = useState(initialEntry?.partsCost !== undefined || initialEntry?.laborCost !== undefined);
  const [cost, setCost] = useState(initialEntry ? String(initialEntry.cost) : "");
  const [partsCost, setPartsCost] = useState(initialEntry?.partsCost !== undefined ? String(initialEntry.partsCost) : "");
  const [laborCost, setLaborCost] = useState(initialEntry?.laborCost !== undefined ? String(initialEntry.laborCost) : "");
  const [workshop, setWorkshop] = useState(initialEntry?.workshop ?? "");
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [photo, setPhoto] = useState<string | null>(initialEntry?.photo ?? null);
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const kmValue = Number(km);
    if (!description.trim()) {
      setError(t("maintenanceForm.errorDescription"));
      return;
    }
    if (Number.isNaN(kmValue) || kmValue < 0) {
      setError(t("maintenanceForm.errorKm"));
      return;
    }

    let totalCost: number;
    let parts: number | undefined;
    let labor: number | undefined;

    if (splitCost) {
      const partsValue = Number(partsCost || 0);
      const laborValue = Number(laborCost || 0);
      if (Number.isNaN(partsValue) || Number.isNaN(laborValue) || partsValue < 0 || laborValue < 0) {
        setError(t("maintenanceForm.errorSplitCost"));
        return;
      }
      parts = partsValue;
      labor = laborValue;
      totalCost = partsValue + laborValue;
    } else {
      const costValue = Number(cost);
      if (Number.isNaN(costValue) || costValue < 0) {
        setError(t("maintenanceForm.errorCost"));
        return;
      }
      totalCost = costValue;
    }

    const entry: MaintenanceEntry = {
      ...initialEntry,
      id: initialEntry?.id ?? generateId(),
      vehicleId: vehicle.id,
      date: localDateToIso(date, initialEntry?.date),
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
          <h2 id="maintenance-form-title">{t(initialEntry ? "maintenanceForm.editTitle" : "maintenanceForm.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          {notice && <p className="form-notice">{notice}</p>}
          <div className="field-row">
            <div className="field">
              <label htmlFor="maint-date">{t("maintenanceForm.date")}</label>
              <input id="maint-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="maint-km">{t("maintenanceForm.km")}</label>
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
            <label htmlFor="maintenance-category">{t("maintenanceForm.category")}</label>
            <select id="maintenance-category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>{t(`maintenanceCategory.${value}`)}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="maint-description">{t("maintenanceForm.description")}</label>
            <input
              id="maint-description"
              type="text"
              placeholder={t("maintenanceForm.descriptionPlaceholder")}
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
              {t("maintenanceForm.splitCost")}
            </label>
          </div>

          {splitCost ? (
            <div className="field-row">
              <div className="field">
                <label htmlFor="maint-parts">{t("maintenanceForm.parts", { cur })}</label>
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
                <label htmlFor="maint-labor">{t("maintenanceForm.labor", { cur })}</label>
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
              <label htmlFor="maint-cost">{t("maintenanceForm.totalCost", { cur })}</label>
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
            <label htmlFor="maint-workshop">{t("maintenanceForm.workshop")}</label>
            <input
              id="maint-workshop"
              type="text"
              placeholder={t("maintenanceForm.workshopPlaceholder")}
              value={workshop}
              onChange={(e) => setWorkshop(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="maint-notes">{t("maintenanceForm.notes")}</label>
            <textarea id="maint-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <PhotoPicker id="maint-photo" value={photo} onChange={setPhoto} keyPrefix="maintenanceForm" />

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            {onDelete && (
              <button type="button" className="btn btn--ghost btn--danger modal__delete" onClick={onDelete}>
                {t("common.delete")}
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("maintenanceForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary">
              {t("maintenanceForm.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
