import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Reminder, ReminderType, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { isRtlLanguage } from "../i18n";
import { REMINDER_CATALOG, computeDueFromCatalog } from "../utils/reminderCatalog";

interface Props {
  vehicle: Vehicle;
  onSave: (reminder: Reminder) => void;
  onClose: () => void;
}

export default function ReminderForm({ vehicle, onSave, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();
  const [showCatalog, setShowCatalog] = useState(true);
  const [catalogKey, setCatalogKey] = useState<string | undefined>(undefined);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ReminderType>("data");
  const [dueDate, setDueDate] = useState("");
  const [dueKm, setDueKm] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const [repeat, setRepeat] = useState(false);
  const [repeatMonths, setRepeatMonths] = useState("");
  const [repeatKm, setRepeatKm] = useState("");

  function applyCatalogEntry(key: string) {
    const entry = REMINDER_CATALOG.find((e) => e.key === key);
    if (!entry) return;
    const due = computeDueFromCatalog(entry, vehicle.currentKm);
    setCatalogKey(entry.key);
    setLabel(t(`reminderCatalog.${entry.key}`));
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
      setError(t("reminderForm.errorLabel"));
      return;
    }
    if (type === "data" && !dueDate) {
      setError(t("reminderForm.errorDate"));
      return;
    }
    if (type === "km") {
      const kmValue = Number(dueKm);
      if (dueKm.trim() === "" || Number.isNaN(kmValue) || kmValue <= 0) {
        setError(t("reminderForm.errorKm"));
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
      catalogKey,
    };

    onSave(reminder);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reminder-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="reminder-form-title">{t("reminderForm.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        {showCatalog ? (
          <div className="catalog-picker">
            <p className="obd-hint" style={{ padding: "0 1.5rem" }}>
              {t("reminderForm.catalogHint")}
            </p>
            <div className="catalog-list">
              {REMINDER_CATALOG.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className="catalog-list__item"
                  onClick={() => applyCatalogEntry(entry.key)}
                >
                  <span>{t(`reminderCatalog.${entry.key}`)}</span>
                  <span className="catalog-list__interval">
                    {entry.months ? `${entry.months} ${t("reminderForm.months")}` : ""}
                    {entry.months && entry.km ? " · " : ""}
                    {entry.km
                      ? `${kmToDisplayDistance(entry.km, distanceUnit).toLocaleString(getNumberLocale(i18n.language), { maximumFractionDigits: 0 })} ${distanceUnit}`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="modal__actions" style={{ padding: "0 1.5rem 1.5rem" }}>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {t("reminderForm.cancel")}
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setShowCatalog(false)}>
                {t("reminderForm.createCustom")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="vehicle-form">
            <button
              type="button"
              className="back-link"
              style={{ margin: "0 0 0.5rem" }}
              onClick={() => setShowCatalog(true)}
            >
              {isRtlLanguage(i18n.language) ? "→ " : "← "}
              {t("reminderForm.backToCatalog")}
            </button>

            <div className="field">
              <label htmlFor="reminder-label">{t("reminderForm.label")}</label>
              <input
                id="reminder-label"
                type="text"
                placeholder={t("reminderForm.labelPlaceholder")}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="reminder-type">{t("reminderForm.type")}</label>
              <select id="reminder-type" value={type} onChange={(e) => setType(e.target.value as ReminderType)}>
                <option value="data">{t("reminderForm.typeDate")}</option>
                <option value="km">{t("reminderForm.typeKm")}</option>
              </select>
            </div>

            {type === "data" ? (
              <div className="field">
                <label htmlFor="reminder-date">{t("reminderForm.dueDate")}</label>
                <input
                  id="reminder-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="reminder-km">{t("reminderForm.dueKm")}</label>
                <input
                  id="reminder-km"
                  type="number"
                  inputMode="numeric"
                  placeholder={t("reminderForm.dueKmPlaceholder", { km: vehicle.currentKm + 15000 })}
                  value={dueKm}
                  onChange={(e) => setDueKm(e.target.value)}
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="reminder-notes">{t("reminderForm.notes")}</label>
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
                {t("reminderForm.repeat")}
              </label>
            </div>

            {repeat && (
              <div className="field-row">
                <div className="field">
                  <label htmlFor="repeat-months">{t("reminderForm.repeatMonths")}</label>
                  <input
                    id="repeat-months"
                    type="number"
                    placeholder="12"
                    value={repeatMonths}
                    onChange={(e) => setRepeatMonths(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="repeat-km">{t("reminderForm.repeatKm")}</label>
                  <input
                    id="repeat-km"
                    type="number"
                    placeholder="20000"
                    value={repeatKm}
                    onChange={(e) => setRepeatKm(e.target.value)}
                  />
                </div>
              </div>
            )}

            {error && <p className="form-error">{error}</p>}

            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {t("reminderForm.cancel")}
              </button>
              <button type="submit" className="btn btn--primary">
                {t("reminderForm.save")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
