import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FuelEntry, FuelSource, Vehicle } from "../types";
import { generateId } from "../utils/storage";
import { calculateConsumption, averageConsumption } from "../utils/calculations";
import { formatNumber, getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { formatCurrency, getCurrencySymbol } from "../utils/settings";
import QuickEntryHeader from "./QuickEntryHeader";
import ActionGridIcon from "./ActionGridIcon";
import VehicleSwitcher from "./VehicleSwitcher";
import { useCurrencySymbol } from "../utils/useCurrencySymbol";

interface Props {
  vehicle: Vehicle;
  /** Altri veicoli tra cui poter cambiare direttamente dal modulo (se più di uno). */
  vehicles?: Vehicle[];
  colors?: Record<string, string>;
  urgentCounts?: Record<string, number>;
  onChangeVehicle?: (vehicleId: string) => void;
  existingEntries?: FuelEntry[];
  /** "Come l'ultimo": prezzo e importo già compilati, si scrivono solo i km. */
  prefill?: { pricePerUnit: number; totalCost: number };
  onSave: (entry: FuelEntry) => void;
  onClose: () => void;
}

// Mappa il tipo di alimentazione del veicolo alla fonte rifornimento più
// probabile, per pre-compilare senza dover scegliere (velocità è l'obiettivo).
function defaultSource(vehicle: Vehicle): FuelSource {
  if (vehicle.fuelType === "benzina" || vehicle.fuelType === "diesel" || vehicle.fuelType === "gpl" || vehicle.fuelType === "metano") {
    return vehicle.fuelType;
  }
  return "benzina"; // ibrido: la maggioranza dei rifornimenti sarà comunque benzina
}

function formatPrice(value: number, locale: string, currency: string) {
  // Costo al km: con 3 decimali (es. € 0,052), come gli altri importi ma più preciso.
  return formatCurrency(value, currency, 3, locale);
}

export default function QuickFuelForm({ vehicle, vehicles, colors, urgentCounts, onChangeVehicle, existingEntries = [], prefill, onSave, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const cur = useCurrencySymbol();
  const locale = getNumberLocale(i18n.language);
  const { currency, formatMoney } = useAppSettings();
  const source = defaultSource(vehicle);
  const [pricePerUnit, setPricePerUnit] = useState(prefill ? String(Math.round(prefill.pricePerUnit * 1000) / 1000) : "");
  const [totalCost, setTotalCost] = useState(prefill ? String(Math.round(prefill.totalCost * 100) / 100) : "");
  const [fullTank, setFullTank] = useState(true);
  const [kmInput, setKmInput] = useState(String(Math.max(0, Math.round(vehicle.currentKm))));
  const [error, setError] = useState("");

  const priceValue = Number(pricePerUnit);
  const costValue = Number(totalCost);
  const computedLiters =
    pricePerUnit !== "" && !Number.isNaN(priceValue) && priceValue > 0 && totalCost !== "" && !Number.isNaN(costValue)
      ? costValue / priceValue
      : null;

  const kmParsed = Number(kmInput);
  const kmValue = kmInput !== "" && Number.isFinite(kmParsed) ? Math.max(0, Math.round(kmParsed)) : 0;
  const lastKnownKm = existingEntries.reduce((m, e) => Math.max(m, e.km), 0);
  const kmUnchanged = kmValue > 0 && kmValue === lastKnownKm;
  const previousEntry = [...existingEntries].filter((e) => e.km < kmValue).sort((a, b) => b.km - a.km)[0];
  const distanceSinceLast = previousEntry ? kmValue - previousEntry.km : null;
  const costPerKm = distanceSinceLast && distanceSinceLast > 0 && costValue > 0 ? costValue / distanceSinceLast : null;

  let newAvgConsumption: number | null = null;
  if (computedLiters !== null) {
    const previewEntry: FuelEntry = {
      id: "preview",
      vehicleId: vehicle.id,
      date: new Date().toISOString(),
      km: kmValue,
      liters: computedLiters,
      totalCost: costValue,
      source,
      fullTank,
    };
    newAvgConsumption = averageConsumption(calculateConsumption([...existingEntries, previewEntry]), source);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (kmValue <= 0 || kmValue < Math.round(vehicle.currentKm)) {
      setError(t("quickEntry.errorKmLower", { km: Math.round(vehicle.currentKm).toLocaleString(locale) }));
      return;
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setError(t("fuelForm.errorPrice", { unit: "l" }));
      return;
    }
    if (Number.isNaN(costValue) || costValue <= 0) {
      setError(t("fuelForm.errorTotalCost"));
      return;
    }

    const entry: FuelEntry = {
      id: generateId(),
      vehicleId: vehicle.id,
      date: new Date().toISOString(),
      km: kmValue,
      liters: costValue / priceValue,
      totalCost: costValue,
      source,
      fullTank,
    };

    onSave(entry);
  }

  return (
    <div className="quick-entry-page quick-entry-page--blue">
      <QuickEntryHeader title={t("quickEntry.fuelTitle")} onBack={onClose} tone="blue" />

      <form onSubmit={handleSubmit} className="quick-entry-page__body">
        {vehicles && vehicles.length > 1 && colors && onChangeVehicle && (
          <div>
            <p className="quick-entry-page__section-label">{t("quickEntry.vehicleLabel", "Veicolo")}</p>
            <VehicleSwitcher
              vehicles={vehicles}
              currentId={vehicle.id}
              colors={colors}
              urgentCounts={urgentCounts}
              onSelect={onChangeVehicle}
            />
          </div>
        )}
        <div className="quick-entry-card">
          <div className="quick-entry-card__title-row">
            <span className="quick-entry-card__icon quick-entry-card__icon--blue"><ActionGridIcon name="fuel" /></span>
            <div>
              <strong>{t("quickEntry.fuelTitleFull")}</strong>
              <p>{vehicle.name}</p>
            </div>
          </div>
          <label className="quick-entry-card__km quick-entry-card__km--edit">
            <span>{t("quickEntry.kmLabel")}</span>
            <div className="quick-entry-card__km-input">
              <input type="number" inputMode="numeric" value={kmInput} onChange={(e) => setKmInput(e.target.value)} aria-label={t("quickEntry.kmLabel")} />
              <small>km</small>
            </div>
          </label>
          {kmUnchanged && <p className="quick-entry-card__km-hint">{t("quickEntry.kmUnchangedHint")}</p>}
        </div>

        <p className="quick-entry-page__section-label">{t("quickEntry.enterOnlyFuelData")}</p>

        <div className="quick-entry-inputs">
          <label className="quick-entry-input">
            <span>{t("fuelForm.pricePerUnit", { unit: "l", cur })}</span>
            <div className="quick-entry-input__row">
              <input
                type="number"
                step="0.001"
                inputMode="decimal"
                autoFocus
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
              />
              <small>{getCurrencySymbol(currency)}/L</small>
            </div>
          </label>
          <label className="quick-entry-input">
            <span>{t("fuelForm.cost", { cur })}</span>
            <div className="quick-entry-input__row">
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
              />
              <small>{getCurrencySymbol(currency)}</small>
            </div>
          </label>
        </div>

        <div className="quick-entry-field field--checkbox">
          <label htmlFor="qf-full">
            <input id="qf-full" type="checkbox" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} />
            {t("fuelForm.fullTank")}
          </label>
        </div>

        <div className="quick-entry-calc">
          <p className="quick-entry-calc__title">{t("quickEntry.autoCalcTitle")}</p>
          <div className="quick-entry-calc__row">
            <span>{t("quickEntry.litersDispensed")}</span>
            <strong className="is-positive">{computedLiters !== null ? `${formatNumber(computedLiters, 2, locale)} L` : "—"}</strong>
          </div>
          <div className="quick-entry-calc__row">
            <span>{t("quickEntry.costPerKm")}</span>
            <strong>{costPerKm !== null ? formatPrice(costPerKm, locale, currency) : "—"}</strong>
          </div>
          <div className="quick-entry-calc__row">
            <span>{t("quickEntry.costPer100Km")}</span>
            <strong>{costPerKm !== null ? formatMoney(costPerKm * 100) : "—"}</strong>
          </div>
          <div className="quick-entry-calc__row">
            <span>{t("quickEntry.newAvgConsumption")}</span>
            <strong>{newAvgConsumption !== null && newAvgConsumption > 0 ? `${formatNumber(100 / newAvgConsumption, 1, locale)} l/100km` : "—"}</strong>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="quick-entry-page__save quick-entry-page__save--blue">
          ✓ {vehicles && vehicles.length > 1 ? t("quickEntry.saveFuelOn", { name: vehicle.name, defaultValue: "Salva su {{name}}" }) : t("quickEntry.saveFuel")}
        </button>

        <p className="quick-entry__full-form-hint">{t("quickEntry.fullFormHint")}</p>
      </form>
    </div>
  );
}
