import { useState } from "react";
import { VEHICLE_COLORS } from "../utils/vehicleColor";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle, FuelType, BodyType } from "../types";
import { generateId } from "../utils/storage";
import { CAR_CATALOG, OTHER_BRAND, OTHER_MODEL } from "../utils/carCatalog";
import { getNumberLocale } from "../utils/locale";
import { useBackButtonClose } from "../utils/backButtonStack";
import PhotoPicker from "./PhotoPicker";
import CartoonCar from "./CartoonCar";
import { BODY_TYPES, shade } from "../utils/bodyTypes";

const FUEL_TYPES: FuelType[] = ["benzina", "diesel", "gpl", "metano", "elettrico", "ibrido"];

interface Props {
  initialVehicle?: Vehicle;
  /** Colore che l'app gli assegna in automatico se l'utente non ne sceglie uno. */
  autoColor?: string;
  onSave: (vehicle: Vehicle) => void;
  onClose: () => void;
  onArchive?: (id: string) => void;
}

/** Riconosce marca e modello dal nome già salvato (es. "Fiat 500L"), se sono nell'elenco. */
function guessBrandModel(name: string): { brand: string; model: string } {
  const lower = name.trim().toLowerCase();
  const brand = [...CAR_CATALOG]
    .sort((a, b) => b.brand.length - a.brand.length)
    .find((b) => lower === b.brand.toLowerCase() || lower.startsWith(b.brand.toLowerCase() + " "));
  if (!brand) return { brand: "", model: "" };
  const rest = lower.slice(brand.brand.length).trim();
  const model = brand.models.find((m) => m.toLowerCase() === rest);
  return { brand: brand.brand, model: model ?? "" };
}

export default function VehicleForm({ initialVehicle, autoColor, onSave, onClose, onArchive }: Props) {
  const { t, i18n } = useTranslation();
  const isEditing = Boolean(initialVehicle);
  const [initialGuess] = useState(() => guessBrandModel(initialVehicle?.name ?? ""));
  const [brand, setBrand] = useState(initialGuess.brand);
  const [customBrand, setCustomBrand] = useState("");
  const [model, setModel] = useState(initialGuess.model);
  const [customModel, setCustomModel] = useState("");
  const [name, setName] = useState(initialVehicle?.name ?? "");
  const [nameAuto, setNameAuto] = useState(false);
  const [plate, setPlate] = useState(initialVehicle?.plate ?? "");
  const [fuelType, setFuelType] = useState<FuelType>(initialVehicle?.fuelType ?? "benzina");
  const [currentKm, setCurrentKm] = useState(initialVehicle ? String(initialVehicle.currentKm) : "");
  const [year, setYear] = useState(initialVehicle?.year ? String(initialVehicle.year) : "");
  const [notes, setNotes] = useState(initialVehicle?.notes ?? "");
  const [photo, setPhoto] = useState<string | null>(initialVehicle?.photo ?? null);
  const [color, setColor] = useState<string | undefined>(initialVehicle?.color);
  const [bodyType, setBodyType] = useState<BodyType>(initialVehicle?.bodyType ?? "hatchback");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<"brand" | "model" | null>(null);
  const [query, setQuery] = useState("");
  const [confirmSold, setConfirmSold] = useState(false);
  useBackButtonClose(picker !== null, () => setPicker(null));
  useBackButtonClose(confirmSold, () => setConfirmSold(false));

  const locale = getNumberLocale(i18n.language);
  const shownColor = color ?? autoColor ?? VEHICLE_COLORS[0];
  const brandEntry = CAR_CATALOG.find((b) => b.brand === brand);

  const brandLabel = (b: string, cb: string) => (b === OTHER_BRAND ? cb.trim() : b);
  const modelLabel = (b: string, m: string, cm: string) => (b === OTHER_BRAND || m === OTHER_MODEL ? cm.trim() : m);
  const combo = (b: string, m: string, cb: string, cm: string) => [brandLabel(b, cb), modelLabel(b, m, cm)].filter(Boolean).join(" ");

  /** Il nome segue marca e modello finché è vuoto o è proprio "marca modello". */
  function updateSelection(next: { brand?: string; model?: string; customBrand?: string; customModel?: string }) {
    const prev = combo(brand, model, customBrand, customModel);
    const b = next.brand ?? brand, m = next.model ?? model;
    const cb = next.customBrand ?? customBrand, cm = next.customModel ?? customModel;
    setBrand(b);
    setModel(m);
    setCustomBrand(cb);
    setCustomModel(cm);
    const nextCombo = combo(b, m, cb, cm);
    if ((!name.trim() || name.trim() === prev) && nextCombo) {
      setName(nextCombo);
      setNameAuto(true);
    }
  }

  function pickBrand(value: string) {
    setQuery("");
    if (value === brand) {
      setPicker(value === OTHER_BRAND ? null : "model");
      return;
    }
    updateSelection({ brand: value, model: "", customModel: "" });
    setPicker(value === OTHER_BRAND ? null : "model");
  }

  function pickModel(value: string) {
    setQuery("");
    setPicker(null);
    updateSelection({ model: value });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError(t("vehicleForm.errorNameGeneric"));
      return;
    }
    const kmValue = Number(currentKm);
    if (currentKm.trim() === "" || Number.isNaN(kmValue) || kmValue < 0) {
      setError(t("vehicleForm.errorKm"));
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
      photo: photo ?? undefined,
      color,
      bodyType,
      createdAt: initialVehicle?.createdAt ?? new Date().toISOString(),
    };

    onSave(vehicle);
  }

  const q = query.trim().toLowerCase();
  const brandOptions = CAR_CATALOG.filter((b) => !q || b.brand.toLowerCase().includes(q));
  const modelOptions = (brandEntry?.models ?? []).filter((m) => !q || m.toLowerCase().includes(q));
  const chevron = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
  const kmNumber = Number(currentKm);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="vehicle-form-title">{isEditing ? t("vehicleForm.titleEdit") : t("vehicleForm.titleNew")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <div
            className="vform-hero"
            style={photo ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.6)), url(${photo})` } : { backgroundImage: `linear-gradient(135deg, ${shade(shownColor, -0.12)}, ${shade(shownColor, -0.45)})` }}
          >
            {!photo && (
              <span className="vform-hero__car">
                <CartoonCar bodyType={bodyType} color={shownColor} />
              </span>
            )}
            <span className="vform-hero__text">
              <span className="vform-hero__name">{name.trim() || t("vehicleForm.newVehicle")}</span>
              {plate.trim() && <span className="vform-hero__plate">{plate.trim()}</span>}
              <span className="vform-hero__km">
                {currentKm.trim() && !Number.isNaN(kmNumber) ? `${kmNumber.toLocaleString(locale)} km` : "— km"} · {t(`fuelType.${fuelType}`)}
              </span>
            </span>
          </div>

          <div className="field-row">
            <div className="field">
              <span className="field__label">{t("vehicleForm.brandOptional")}</span>
              <button type="button" className="vform-pick" onClick={() => { setQuery(""); setPicker("brand"); }}>
                {brand ? <span>{brand === OTHER_BRAND ? t("vehicleForm.otherBrand") : brand}</span> : <span className="vform-pick__ph">{t("vehicleForm.choose")}</span>}
                {chevron}
              </button>
            </div>
            <div className="field">
              <span className="field__label">{t("vehicleForm.model")}</span>
              <button
                type="button"
                className="vform-pick"
                disabled={!brand || brand === OTHER_BRAND}
                onClick={() => { setQuery(""); setPicker("model"); }}
              >
                {model ? <span>{model === OTHER_MODEL ? t("vehicleForm.otherModel") : model}</span> : <span className="vform-pick__ph">{t("vehicleForm.choose")}</span>}
                {chevron}
              </button>
            </div>
          </div>

          {brand === OTHER_BRAND && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="custom-brand">{t("vehicleForm.brand")}</label>
                <input
                  id="custom-brand"
                  type="text"
                  placeholder={t("vehicleForm.customBrandPlaceholder")}
                  value={customBrand}
                  onChange={(e) => updateSelection({ customBrand: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="custom-model-alt">{t("vehicleForm.model")}</label>
                <input
                  id="custom-model-alt"
                  type="text"
                  placeholder={t("vehicleForm.customModelPlaceholder")}
                  value={customModel}
                  onChange={(e) => updateSelection({ customModel: e.target.value })}
                />
              </div>
            </div>
          )}

          {brand && brand !== OTHER_BRAND && model === OTHER_MODEL && (
            <div className="field">
              <label htmlFor="custom-model">{t("vehicleForm.customModelLabel")}</label>
              <input
                id="custom-model"
                type="text"
                placeholder={t("vehicleForm.customModelCustomPlaceholder")}
                value={customModel}
                onChange={(e) => updateSelection({ customModel: e.target.value })}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="name">{t("vehicleForm.name")}</label>
            <input
              id="name"
              type="text"
              placeholder={t("vehicleForm.namePlaceholderGeneric")}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameAuto(false);
              }}
            />
            {nameAuto && <small className="vform-auto">✓ {t("vehicleForm.nameAuto")}</small>}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="fuelType">{t("vehicleForm.fuelType")}</label>
              <select id="fuelType" value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)}>
                {FUEL_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`fuelType.${value}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="year">{t("vehicleForm.year")}</label>
              <input
                id="year"
                type="number"
                inputMode="numeric"
                placeholder={t("vehicleForm.yearPlaceholder")}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="currentKm">{t("vehicleForm.kmShort")}</label>
              <input
                id="currentKm"
                type="number"
                inputMode="numeric"
                placeholder={t("vehicleForm.currentKmPlaceholder")}
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="plate">{t("vehicleForm.plate")}</label>
              <input
                id="plate"
                type="text"
                placeholder={t("vehicleForm.platePlaceholder")}
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="field">
            <span className="vform-title">{t("vehicleForm.colorTitle")}</span>
            <div className="vcolor">
              {VEHICLE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={color === c}
                  className={color === c ? "is-on" : ""}
                  style={{ ["--c" as string]: c }}
                  onClick={() => setColor(color === c ? undefined : c)}
                />
              ))}
            </div>
            {!color && <small>{t("vehicleForm.colorHint", "Se non scegli, viene assegnato in automatico.")}</small>}
          </div>

          <div className="field">
            <span className="vform-title">{t("vehicleForm.bodyTypeTitle")}</span>
            <div className="body-picker" role="radiogroup" aria-label={t("vehicleForm.bodyTypeTitle")}>
              {BODY_TYPES.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={bodyType === b}
                  className={`body-picker__item${bodyType === b ? " is-on" : ""}`}
                  onClick={() => setBodyType(b)}
                >
                  <CartoonCar bodyType={b} color={shownColor} />
                  <span>{t(`bodyType.${b}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <PhotoPicker id="vehicle-photo" value={photo} onChange={setPhoto} keyPrefix="vehicleForm" aspect={16 / 9} />

          <div className="field">
            <label htmlFor="notes">{t("vehicleForm.notes")}</label>
            <textarea
              id="notes"
              placeholder={t("vehicleForm.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {isEditing && onArchive && initialVehicle && (
            <button type="button" className="vform-sold" onClick={() => setConfirmSold(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
                <circle cx="7.5" cy="7.5" r="1.5" />
              </svg>
              <span>
                <b>{t("vehicles.markSold")}</b>
                <small>{t("vehicles.soldSub")}</small>
              </span>
            </button>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("vehicleForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary">
              {isEditing ? t("vehicleForm.saveEdit") : t("vehicleForm.saveNew")}
            </button>
          </div>
        </form>
      </div>

      {picker && (
        <div className="vform-over" onClick={(e) => e.target === e.currentTarget && setPicker(null)}>
          <div className="vform-panel" role="dialog" aria-modal="true" aria-labelledby="vform-picker-title">
            <span className="sheet__grab" aria-hidden="true" />
            <h3 id="vform-picker-title">{picker === "brand" ? t("vehicleForm.chooseBrandTitle") : t("vehicleForm.chooseModelTitle", { brand })}</h3>
            <div className="vform-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={picker === "brand" ? t("vehicleForm.searchBrand") : t("vehicleForm.searchModel")}
                aria-label={picker === "brand" ? t("vehicleForm.searchBrand") : t("vehicleForm.searchModel")}
              />
            </div>
            <div className="vform-list">
              {picker === "brand"
                ? brandOptions.map((b, i) => (
                    <div key={b.brand}>
                      {!q && (i === 0 || brandOptions[i - 1].brand[0].toUpperCase() !== b.brand[0].toUpperCase()) && (
                        <div className="vform-letter">{b.brand[0].toUpperCase()}</div>
                      )}
                      <button type="button" className={`vform-opt${b.brand === brand ? " is-on" : ""}`} onClick={() => pickBrand(b.brand)}>
                        <span>{b.brand}</span>
                        <small>{t("vehicleForm.modelsCount", { count: b.models.length })}</small>
                      </button>
                    </div>
                  ))
                : modelOptions.map((m) => (
                    <button key={m} type="button" className={`vform-opt${m === model ? " is-on" : ""}`} onClick={() => pickModel(m)}>
                      <span>{m}</span>
                    </button>
                  ))}
              <button
                type="button"
                className="vform-opt vform-opt--other"
                onClick={() => (picker === "brand" ? pickBrand(OTHER_BRAND) : pickModel(OTHER_MODEL))}
              >
                {picker === "brand" ? t("vehicleForm.otherBrand") : t("vehicleForm.otherModel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSold && initialVehicle && onArchive && (
        <div className="vform-over" onClick={(e) => e.target === e.currentTarget && setConfirmSold(false)}>
          <div className="vform-panel" role="alertdialog" aria-modal="true" aria-labelledby="vform-sold-title">
            <span className="sheet__grab" aria-hidden="true" />
            <h3 id="vform-sold-title">{t("vehicles.soldTitle", { name: initialVehicle.name })}</h3>
            <p className="vform-confirm">{t("vehicles.soldBody")}</p>
            <div className="vform-confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmSold(false)}>
                {t("vehicleForm.cancel")}
              </button>
              <button type="button" className="btn btn--danger-solid" onClick={() => onArchive(initialVehicle.id)}>
                {t("vehicles.soldYes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
