import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MaintenanceEntry, MaintenanceCategory, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import { compressImage, estimateDataUrlKb } from "../utils/imageCompression";
import CategoryIcon from "./CategoryIcon";

const CATEGORIES: MaintenanceCategory[] = [
  "tagliando", "gomme", "freni", "olio", "batteria", "raffreddamento", "software", "carrozzeria", "revisione", "altro",
];

interface Props {
  vehicle: Vehicle;
  onSave: (entry: MaintenanceEntry) => void;
  onClose: () => void;
}

export default function MaintenanceForm({ vehicle, onSave, onClose }: Props) {
  const { t } = useTranslation();
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
      setError(t("maintenanceForm.photoError"));
    }
    setPhotoBusy(false);
    e.target.value = "";
  }

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
          <h2 id="maintenance-form-title">{t("maintenanceForm.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
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
            <label>{t("maintenanceForm.category")}</label>
            <div className="category-picker">
              {CATEGORIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`category-picker__item ${category === value ? "is-active" : ""}`}
                  onClick={() => setCategory(value)}
                  title={t(`maintenanceCategory.${value}`)}
                >
                  <CategoryIcon kind="maintenance" category={value} size="small" />
                  <span>{t(`maintenanceCategory.${value}`)}</span>
                </button>
              ))}
            </div>
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
                <label htmlFor="maint-parts">{t("maintenanceForm.parts")}</label>
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
                <label htmlFor="maint-labor">{t("maintenanceForm.labor")}</label>
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
              <label htmlFor="maint-cost">{t("maintenanceForm.totalCost")}</label>
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

          <div className="field">
            <label htmlFor="maint-photo">{t("maintenanceForm.photo")}</label>
            <input id="maint-photo" type="file" accept="image/*" onChange={handlePhotoChange} disabled={photoBusy} />
            {photoBusy && <p className="obd-hint">{t("maintenanceForm.photoCompressing")}</p>}
            {photo && (
              <div className="photo-preview">
                <img src={photo} alt={t("maintenanceForm.photoPreviewAlt")} />
                <span className="photo-preview__meta">
                  ~{photoKb} KB
                  <button type="button" className="photo-preview__remove" onClick={() => setPhoto(null)}>
                    {t("common.remove")}
                  </button>
                </span>
              </div>
            )}
            <p className="obd-hint">{t("maintenanceForm.photoHint")}</p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
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
