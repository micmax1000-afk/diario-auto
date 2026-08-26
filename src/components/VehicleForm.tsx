import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle, FuelType, BodyType } from "../types";
import { generateId } from "../utils/storage";
import { CAR_CATALOG, OTHER_BRAND, OTHER_MODEL } from "../utils/carCatalog";
import VehicleBodyIcon from "./VehicleBodyIcon";

const FUEL_TYPES: FuelType[] = ["benzina", "diesel", "gpl", "metano", "elettrico", "ibrido"];
const BODY_TYPES: BodyType[] = ["citycar", "hatchback", "sedan", "suv", "pickup", "van", "coupe", "wagon"];

interface Props {
  initialVehicle?: Vehicle;
  onSave: (vehicle: Vehicle) => void;
  onClose: () => void;
  onArchive?: (id: string) => void;
}

export default function VehicleForm({ initialVehicle, onSave, onClose, onArchive }: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(initialVehicle);
  const [brand, setBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [name, setName] = useState(initialVehicle?.name ?? "");
  const [plate, setPlate] = useState(initialVehicle?.plate ?? "");
  const [fuelType, setFuelType] = useState<FuelType>(initialVehicle?.fuelType ?? "benzina");
  const [bodyType, setBodyType] = useState<BodyType | "">(initialVehicle?.bodyType ?? "");
  const [currentKm, setCurrentKm] = useState(initialVehicle ? String(initialVehicle.currentKm) : "");
  const [year, setYear] = useState(initialVehicle?.year ? String(initialVehicle.year) : "");
  const [notes, setNotes] = useState(initialVehicle?.notes ?? "");
  const [error, setError] = useState("");

  const selectedBrandEntry = CAR_CATALOG.find((b) => b.brand === brand);

  // Compila automaticamente "Nome veicolo" da Marca/Modello selezionati,
  // ma solo se l'utente ha effettivamente usato i menu: se non li tocca
  // (es. in modifica), il nome digitato a mano resta intatto.
  useEffect(() => {
    if (!brand) return;
    const brandLabel = brand === OTHER_BRAND ? customBrand.trim() : brand;
    const modelLabel = brand === OTHER_BRAND ? customModel.trim() : model === OTHER_MODEL ? customModel.trim() : model;
    const combined = [brandLabel, modelLabel].filter(Boolean).join(" ");
    if (combined) setName(combined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, customBrand, model, customModel]);

  function handleBrandChange(value: string) {
    setBrand(value);
    setModel("");
    setCustomModel("");
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
      bodyType: bodyType || undefined,
      currentKm: Math.round(kmValue),
      year: year.trim() ? Number(year) : undefined,
      notes: notes.trim() || undefined,
      createdAt: initialVehicle?.createdAt ?? new Date().toISOString(),
    };

    onSave(vehicle);
  }

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
          <div className="field-row">
            <div className="field">
              <label htmlFor="brand">{t("vehicleForm.brand")}</label>
              <select id="brand" value={brand} onChange={(e) => handleBrandChange(e.target.value)} autoFocus>
                <option value="">{t("vehicleForm.chooseBrandOptional")}</option>
                {CAR_CATALOG.map((b) => (
                  <option key={b.brand} value={b.brand}>
                    {b.brand}
                  </option>
                ))}
                <option value={OTHER_BRAND}>{t("vehicleForm.otherBrand")}</option>
              </select>
            </div>

            {brand && brand !== OTHER_BRAND && (
              <div className="field">
                <label htmlFor="model">{t("vehicleForm.model")}</label>
                <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="">{t("vehicleForm.chooseModel")}</option>
                  {selectedBrandEntry?.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={OTHER_MODEL}>{t("vehicleForm.otherModel")}</option>
                </select>
              </div>
            )}
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
                  onChange={(e) => setCustomBrand(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="custom-model-alt">{t("vehicleForm.model")}</label>
                <input
                  id="custom-model-alt"
                  type="text"
                  placeholder={t("vehicleForm.customModelPlaceholder")}
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
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
                onChange={(e) => setCustomModel(e.target.value)}
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
              onChange={(e) => setName(e.target.value)}
            />
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
                placeholder={t("vehicleForm.yearPlaceholder")}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>{t("vehicleForm.bodyType")}</label>
            <div className="body-type-picker">
              {BODY_TYPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`body-type-picker__item ${bodyType === value ? "is-active" : ""}`}
                  onClick={() => setBodyType(bodyType === value ? "" : value)}
                  title={t(`bodyType.${value}`)}
                >
                  <VehicleBodyIcon bodyType={value} className="body-type-picker__icon" />
                  <span>{t(`bodyType.${value}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="currentKm">{t("vehicleForm.currentKm")}</label>
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
            <label htmlFor="notes">{t("vehicleForm.notes")}</label>
            <textarea
              id="notes"
              placeholder={t("vehicleForm.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            {isEditing && onArchive && initialVehicle && (
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                style={{ marginRight: "auto" }}
                onClick={() => {
                  if (window.confirm(t("vehicles.archiveConfirm", { name: initialVehicle.name }))) {
                    onArchive(initialVehicle.id);
                  }
                }}
              >
                {t("vehicles.markSold")}
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("vehicleForm.cancel")}
            </button>
            <button type="submit" className="btn btn--primary">
              {isEditing ? t("vehicleForm.saveEdit") : t("vehicleForm.saveNew")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
