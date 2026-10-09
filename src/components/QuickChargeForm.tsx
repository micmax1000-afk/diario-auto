import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ChargingEntry, Vehicle } from "../types";
import { generateId, getHomeChargingDefaults, setHomeChargingDefaults } from "../utils/storage";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getCurrencySymbol } from "../utils/settings";
import QuickEntryHeader from "./QuickEntryHeader";
import ActionGridIcon from "./ActionGridIcon";
import VehicleSwitcher from "./VehicleSwitcher";

interface Props {
  vehicle: Vehicle;
  vehicles?: Vehicle[];
  colors?: Record<string, string>;
  urgentCounts?: Record<string, number>;
  onChangeVehicle?: (vehicleId: string) => void;
  existingEntries?: ChargingEntry[];
  onSave: (entry: ChargingEntry) => void;
  onClose: () => void;
}

function formatEuro(value: number, locale: string) {
  return value.toLocaleString(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 4 });
}

export default function QuickChargeForm({ vehicle, vehicles, colors, urgentCounts, onChangeVehicle, existingEntries = [], onSave, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const locale = getNumberLocale(i18n.language);
  const { currency } = useAppSettings();
  const [pricePerKWh, setPricePerKWh] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [atHome, setAtHome] = useState(false);
  const [kmInput, setKmInput] = useState(String(Math.max(0, Math.round(vehicle.currentKm))));
  const [error, setError] = useState("");

  const priceValue = Number(pricePerKWh);
  const costValue = Number(totalCost);
  const computedKWh =
    pricePerKWh !== "" && !Number.isNaN(priceValue) && priceValue > 0 && totalCost !== "" && !Number.isNaN(costValue)
      ? costValue / priceValue
      : null;

  const kmParsed = Number(kmInput);
  const kmValue = kmInput !== "" && Number.isFinite(kmParsed) ? Math.max(0, Math.round(kmParsed)) : 0;
  const lastKnownKm = existingEntries.reduce((m, e) => Math.max(m, e.km), 0);
  const kmUnchanged = kmValue > 0 && kmValue === lastKnownKm;
  const previousEntry = [...existingEntries].filter((e) => e.km < kmValue).sort((a, b) => b.km - a.km)[0];
  const distanceSinceLast = previousEntry ? kmValue - previousEntry.km : null;
  const costPerKm = distanceSinceLast && distanceSinceLast > 0 && costValue > 0 ? costValue / distanceSinceLast : null;

  async function handleToggleAtHome(checked: boolean) {
    setAtHome(checked);
    if (checked && !pricePerKWh) {
      const defaults = await getHomeChargingDefaults(vehicle.id);
      if (defaults) setPricePerKWh(String(defaults.pricePerKWh));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (kmValue <= 0 || kmValue < Math.round(vehicle.currentKm)) {
      setError(t("quickEntry.errorKmLower", { km: Math.round(vehicle.currentKm).toLocaleString(locale) }));
      return;
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setError(t("chargingForm.errorPrice"));
      return;
    }
    if (Number.isNaN(costValue) || costValue <= 0) {
      setError(t("chargingForm.errorCost"));
      return;
    }

    const entry: ChargingEntry = {
      id: generateId(),
      vehicleId: vehicle.id,
      date: new Date().toISOString(),
      km: kmValue,
      kWh: costValue / priceValue,
      pricePerKWh: priceValue,
      totalCost: costValue,
      atHome,
    };

    if (atHome) {
      await setHomeChargingDefaults(vehicle.id, entry.pricePerKWh, entry.powerKW);
    }

    onSave(entry);
  }

  return (
    <div className="quick-entry-page quick-entry-page--green">
      <QuickEntryHeader title={t("quickEntry.chargeTitle")} onBack={onClose} tone="green" />

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
            <span className="quick-entry-card__icon quick-entry-card__icon--green"><ActionGridIcon name="bolt" /></span>
            <div>
              <strong>{t("quickEntry.chargeTitleFull")}</strong>
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

        <p className="quick-entry-page__section-label">{t("quickEntry.enterOnlyChargeData")}</p>

        <div className="quick-entry-field field--checkbox">
          <label htmlFor="qc-home">
            <input
              id="qc-home"
              type="checkbox"
              checked={atHome}
              onChange={(e) => handleToggleAtHome(e.target.checked)}
            />
            {t("chargingForm.atHome")}
          </label>
        </div>

        <div className="quick-entry-inputs">
          <label className="quick-entry-input">
            <span>{t("chargingForm.price")}</span>
            <div className="quick-entry-input__row">
              <input
                type="number"
                step="0.001"
                inputMode="decimal"
                autoFocus
                value={pricePerKWh}
                onChange={(e) => setPricePerKWh(e.target.value)}
              />
              <small>{getCurrencySymbol(currency)}/kWh</small>
            </div>
          </label>
          <label className="quick-entry-input">
            <span>{t("chargingForm.cost")}</span>
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

        <div className="quick-entry-calc quick-entry-calc--green">
          <p className="quick-entry-calc__title">{t("quickEntry.autoCalcTitle")}</p>
          <div className="quick-entry-calc__row">
            <span>{t("quickEntry.kwhDispensed")}</span>
            <strong className="is-positive">{computedKWh !== null ? `${computedKWh.toFixed(2)} kWh` : "—"}</strong>
          </div>
          <div className="quick-entry-calc__row">
            <span>{t("quickEntry.costPerKm")}</span>
            <strong>{costPerKm !== null ? formatEuro(costPerKm, locale) : "—"}</strong>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="quick-entry-page__save quick-entry-page__save--green">
          ✓ {vehicles && vehicles.length > 1 ? t("quickEntry.saveFuelOn", { name: vehicle.name, defaultValue: "Salva su {{name}}" }) : t("quickEntry.saveCharge")}
        </button>

        <p className="quick-entry__full-form-hint">{t("quickEntry.fullFormHint")}</p>
      </form>
    </div>
  );
}
