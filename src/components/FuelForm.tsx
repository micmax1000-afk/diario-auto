import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FuelEntry, FuelSource, Vehicle } from "../types";
import { generateId } from "../utils/storage";

const SOURCE_TYPES: FuelSource[] = ["benzina", "diesel", "gpl", "metano", "elettrico"];

interface Props {
  vehicle: Vehicle;
  initialEntry?: FuelEntry;
  onSave: (entry: FuelEntry) => void;
  onClose: () => void;
}

export default function FuelForm({ vehicle, initialEntry, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(initialEntry);
  const [date, setDate] = useState(() => initialEntry?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState(String(initialEntry?.km ?? vehicle.currentKm));
  const [pricePerUnit, setPricePerUnit] = useState(
    initialEntry && initialEntry.liters > 0 ? (initialEntry.totalCost / initialEntry.liters).toFixed(3) : "",
  );
  const [totalCost, setTotalCost] = useState(initialEntry ? String(initialEntry.totalCost) : "");
  const [source, setSource] = useState<FuelSource>(
    initialEntry?.source ?? (vehicle.fuelType === "ibrido" ? "benzina" : (vehicle.fuelType as FuelSource)),
  );
  const [fullTank, setFullTank] = useState(initialEntry?.fullTank ?? true);
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [error, setError] = useState("");

  const unitLabel = source === "elettrico" ? "kWh" : t("fuelForm.liters").replace(" *", "");
  const unitShort = source === "elettrico" ? "kWh" : "l";

  // Litri (o kWh) calcolati SEMPRE da costo totale / prezzo unitario: non
  // sono editabili direttamente, per evitare valori tra loro incoerenti.
  const priceValue = Number(pricePerUnit);
  const costValue = Number(totalCost);
  const computedLiters =
    pricePerUnit !== "" && !Number.isNaN(priceValue) && priceValue > 0 && totalCost !== "" && !Number.isNaN(costValue)
      ? costValue / priceValue
      : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const kmValue = Number(km);

    if (!date) {
      setError(t("fuelForm.errorDate"));
      return;
    }
    if (Number.isNaN(kmValue) || kmValue < 0) {
      setError(t("fuelForm.errorKm"));
      return;
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setError(t("fuelForm.errorPrice", { unit: unitShort }));
      return;
    }
    if (Number.isNaN(costValue) || costValue <= 0) {
      setError(t("fuelForm.errorTotalCost"));
      return;
    }

    const entry: FuelEntry = {
      id: initialEntry?.id ?? generateId(),
      vehicleId: vehicle.id,
      date: new Date(date).toISOString(),
      km: Math.round(kmValue),
      liters: costValue / priceValue,
      totalCost: costValue,
      source,
      fullTank,
      notes: notes.trim() || undefined,
    };

    onSave(entry);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fuel-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="fuel-form-title">{isEditing ? t("fuel.titleEdit") : t("fuelForm.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="fuel-date">{t("fuelForm.date")}</label>
              <input id="fuel-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fuel-km">{t("fuelForm.km")}</label>
              <input
                id="fuel-km"
                type="number"
                inputMode="numeric"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="fuel-source">{t("fuelForm.source")}</label>
            <select id="fuel-source" value={source} onChange={(e) => setSource(e.target.value as FuelSource)}>
              {SOURCE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`fuelType.${value}`)}
                  {value === "elettrico" ? " (kWh)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="fuel-price">{t("fuelForm.pricePerUnit", { unit: unitShort })}</label>
              <input
                id="fuel-price"
                type="number"
                step="0.001"
                inputMode="decimal"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="fuel-cost">{t("fuelForm.cost")}</label>
              <input
                id="fuel-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="fuel-liters">{t("fuelForm.litersComputed", { unit: unitLabel })}</label>
            <input
              id="fuel-liters"
              type="text"
              readOnly
              disabled
              value={computedLiters !== null ? computedLiters.toFixed(2) : "—"}
            />
          </div>

          <div className="field field--checkbox">
            <label htmlFor="fuel-full">
              <input
                id="fuel-full"
                type="checkbox"
                checked={fullTank}
                onChange={(e) => setFullTank(e.target.checked)}
              />
              {t("fuelForm.fullTank")}
            </label>
          </div>

          <div className="field">
            <label htmlFor="fuel-notes">{t("fuelForm.notes")}</label>
            <textarea
              id="fuel-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("fuelForm.notesPlaceholder")}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("fuelForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary">
              {isEditing ? t("vehicleForm.saveEdit") : t("fuelForm.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
