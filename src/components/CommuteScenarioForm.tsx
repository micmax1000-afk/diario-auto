import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CommuteScenario, CommuteFuelType } from "../types";
import { generateId } from "../utils/storage";
import { useCurrencySymbol } from "../utils/useCurrencySymbol";
import { useAppSettings } from "../contexts/AppSettingsContext";
import {
  SCENARIO_PRESETS,
  SCENARIO_UNITS,
  TRANSIT_PRESET_EUR,
  isCarScenario,
} from "../utils/commute";
import { SCENARIO_ICONS } from "./commuteIcons";

interface Props {
  vehicleId: string;
  vehicleName: string;
  /** Scenario da modificare; se manca se ne crea uno nuovo. */
  initial?: CommuteScenario;
  /** Costo annuo (solo viaggio) del veicolo attuale, per l'anteprima del risparmio. */
  currentYear: number | null;
  /** Costo annuo di uno scenario con le impostazioni del tragitto. */
  yearCostOf: (scenario: CommuteScenario) => number | null;
  onSave: (scenario: CommuteScenario) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const TYPE_ORDER: CommuteFuelType[] = [
  "elettrico",
  "gpl",
  "ibrido",
  "ibrido_plugin",
  "benzina",
  "diesel",
  "metano",
  "mezzi",
  "carpooling",
  "bici",
];

const round = (n: number, digits: number) => String(Math.round(n * 10 ** digits) / 10 ** digits);
const parse = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : NaN);

export default function CommuteScenarioForm({
  vehicleId,
  vehicleName,
  initial,
  currentYear,
  yearCostOf,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const cur = useCurrencySymbol();
  const { currency, formatMoney } = useAppSettings();
  const euro = currency === "EUR";

  const [fuelType, setFuelType] = useState<CommuteFuelType>(initial?.fuelType ?? "elettrico");
  const [note, setNote] = useState(initial?.note ?? "");
  // Consumo chiesto in unità ogni 100 km (l, kWh, kg), salvato in km per unità.
  const [per100, setPer100] = useState(
    initial && initial.kmPerUnit > 0 ? round(100 / initial.kmPerUnit, 1) : round(100 / SCENARIO_PRESETS.elettrico.kmPerUnit, 1),
  );
  const [price, setPrice] = useState(
    initial && isCarScenario(initial.fuelType) ? String(initial.pricePerUnit) : euro ? String(SCENARIO_PRESETS.elettrico.priceEur) : "",
  );
  const [priceDifference, setPriceDifference] = useState(initial?.priceDifference ? String(initial.priceDifference) : "");
  const [people, setPeople] = useState(String(initial?.people ?? 2));
  const [monthlyCost, setMonthlyCost] = useState(initial?.monthlyCost !== undefined ? String(initial.monthlyCost) : "");
  const [extraMinutes, setExtraMinutes] = useState(initial?.extraMinutesPerTrip ? String(initial.extraMinutesPerTrip) : "");
  const [error, setError] = useState("");

  const car = isCarScenario(fuelType);
  const unit = car ? SCENARIO_UNITS[fuelType] : "litro";
  const unitShort = unit === "litro" ? "l" : unit;

  function pickType(type: CommuteFuelType) {
    if (type === fuelType) return; // ritoccare il tipo già scelto non cancella i valori inseriti
    setFuelType(type);
    setError("");
    // Valori tipici già inseriti: si possono modificare.
    if (isCarScenario(type)) {
      const preset = SCENARIO_PRESETS[type];
      setPer100(round(100 / preset.kmPerUnit, 1));
      setPrice(euro ? String(preset.priceEur) : "");
    } else if (type === "mezzi") {
      setMonthlyCost(euro ? String(TRANSIT_PRESET_EUR.monthlyCost) : "");
      setExtraMinutes(String(TRANSIT_PRESET_EUR.extraMinutesPerTrip));
    } else if (type === "bici") {
      setMonthlyCost("0");
      setExtraMinutes("");
    } else if (type === "carpooling") {
      setPeople("2");
    }
  }

  /** Scenario dai valori del modulo, oppure il messaggio d'errore. */
  function build(): CommuteScenario | string {
    const base = { id: initial?.id ?? generateId(), vehicleId, fuelType, note: note.trim() || undefined };
    if (car) {
      const consumption = parse(per100);
      const p = parse(price);
      if (Number.isNaN(consumption) || consumption <= 0) return t("commuteScenarioForm.errorConsumption");
      if (Number.isNaN(p) || p < 0) return t("commuteScenarioForm.errorPrice", { unit: unitShort });
      const diff = priceDifference.trim() ? parse(priceDifference) : undefined;
      if (diff !== undefined && (Number.isNaN(diff) || diff < 0)) return t("commuteScenarioForm.errorPriceDifference");
      return { ...base, kmPerUnit: 100 / consumption, pricePerUnit: p, unit, priceDifference: diff || undefined };
    }
    const common = { ...base, kmPerUnit: 0, pricePerUnit: 0, unit: "litro" as const };
    if (fuelType === "carpooling") {
      const n = Number(people);
      if (!Number.isInteger(n) || n < 2 || n > 9) return t("commuteScenarioForm.errorPeople");
      return { ...common, people: n };
    }
    const monthly = monthlyCost.trim() ? parse(monthlyCost) : 0;
    if (Number.isNaN(monthly) || monthly < 0) return t("commuteScenarioForm.errorMonthly");
    const minutes = extraMinutes.trim() ? parse(extraMinutes) : undefined;
    if (minutes !== undefined && (Number.isNaN(minutes) || minutes < 0)) return t("commuteScenarioForm.errorMinutes");
    return { ...common, monthlyCost: monthly, extraMinutesPerTrip: minutes || undefined };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = build();
    if (typeof result === "string") {
      setError(result);
      return;
    }
    onSave(result);
  }

  const draft = build();
  const previewYear = typeof draft === "string" ? null : yearCostOf(draft);
  const saving = previewYear !== null && currentYear !== null ? currentYear - previewYear : null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="commute-scenario-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="commute-scenario-title">{t(initial ? "commuteScenarioForm.editTitle" : "commuteScenarioForm.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form">
          <p className="commute-form__section">{t("commuteScenarioForm.whatToCompare")}</p>
          <div className="commute-presets" role="radiogroup">
            {TYPE_ORDER.map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={fuelType === type}
                className={`commute-preset${fuelType === type ? " is-active" : ""}`}
                onClick={() => pickType(type)}
              >
                <span aria-hidden="true">{SCENARIO_ICONS[type]}</span> {t(`commuteFuelType.${type}`)}
              </button>
            ))}
          </div>

          {car && (
            <>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="scenario-consumption">{t("commuteScenarioForm.consumption", { unit: `${unitShort}/100 km` })}</label>
                  <input
                    id="scenario-consumption"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={per100}
                    onChange={(e) => setPer100(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="scenario-price">{t("commuteScenarioForm.pricePerUnit", { unit: unitShort, cur })}</label>
                  <input
                    id="scenario-price"
                    type="number"
                    step="0.001"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
              <p className="commute-form__hint">{t("commuteScenarioForm.typicalHint")}</p>
              <div className="field">
                <label htmlFor="scenario-diff">{t("commuteScenarioForm.priceDifference", { cur })}</label>
                <input
                  id="scenario-diff"
                  type="number"
                  step="100"
                  min="0"
                  inputMode="decimal"
                  placeholder={t("commuteScenarioForm.optional")}
                  value={priceDifference}
                  onChange={(e) => setPriceDifference(e.target.value)}
                />
                <p className="commute-form__hint">{t("commuteScenarioForm.priceDifferenceHint")}</p>
              </div>
            </>
          )}

          {fuelType === "carpooling" && (
            <div className="field">
              <label htmlFor="scenario-people">{t("commuteScenarioForm.people")}</label>
              <input
                id="scenario-people"
                type="number"
                step="1"
                min="2"
                max="9"
                inputMode="numeric"
                value={people}
                onChange={(e) => setPeople(e.target.value)}
              />
              <p className="commute-form__hint">{t("commuteScenarioForm.peopleHint", { name: vehicleName })}</p>
            </div>
          )}

          {(fuelType === "mezzi" || fuelType === "bici") && (
            <>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="scenario-monthly">
                    {t(fuelType === "mezzi" ? "commuteScenarioForm.monthlyPass" : "commuteScenarioForm.monthlyBike", { cur })}
                  </label>
                  <input
                    id="scenario-monthly"
                    type="number"
                    step="0.5"
                    min="0"
                    inputMode="decimal"
                    value={monthlyCost}
                    onChange={(e) => setMonthlyCost(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="scenario-minutes">{t("commuteScenarioForm.extraMinutes")}</label>
                  <input
                    id="scenario-minutes"
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    placeholder={t("commuteScenarioForm.optional")}
                    value={extraMinutes}
                    onChange={(e) => setExtraMinutes(e.target.value)}
                  />
                </div>
              </div>
              <p className="commute-form__hint">
                {t(fuelType === "mezzi" ? "commuteScenarioForm.transitHint" : "commuteScenarioForm.bikeHint")}
              </p>
            </>
          )}

          <div className="field">
            <label htmlFor="scenario-note">{t("commuteScenarioForm.note")}</label>
            <input
              id="scenario-note"
              type="text"
              placeholder={t(car ? "commuteScenarioForm.notePlaceholder" : "commuteScenarioForm.notePlaceholderOther")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {previewYear !== null && (
            <div className="commute-preview">
              <span className="commute-preview__label">{t("commuteScenarioForm.preview")}</span>
              <strong>{t("commute.perMonthValue", { value: formatMoney(previewYear / 12, 0) })}</strong>
              {saving !== null && Math.round(saving) !== 0 && (
                <span>
                  {" · "}
                  {t(saving > 0 ? "commuteScenarioForm.previewSaving" : "commuteScenarioForm.previewExtra", {
                    value: formatMoney(Math.abs(saving), 0),
                    name: vehicleName,
                  })}
                </span>
              )}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            {initial && onDelete ? (
              <button type="button" className="btn btn--ghost btn--danger" onClick={() => {
                  if (window.confirm(t("commute.removeConfirm", {
                      name:
                        initial.fuelType === "carpooling"
                          ? t("commute.carpoolingName", { people: initial.people ?? 2 })
                          : t(`commuteFuelType.${initial.fuelType}`),
                    }))) onDelete(initial.id);
                }}>
                {t("commute.remove")}
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {t("commuteScenarioForm.cancel")}
              </button>
            )}
            <button type="submit" className="btn btn--primary">
              {t(initial ? "commuteSettingsForm.save" : "commuteScenarioForm.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
