import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Vehicle,
  FuelEntry,
  ChargingEntry,
  MaintenanceEntry,
  ExpenseEntry,
  FuelSource,
  CommuteSettings,
  CommuteScenario,
} from "../types";
import {
  calculateConsumption,
  averageConsumption,
  calculateElectricConsumption,
  averageElectricConsumption,
  mainFuelSource,
} from "../utils/calculations";
import {
  commuteYearCost,
  commutePeriods,
  commuteKmPerYear,
  scenarioYearCost,
  paybackYears,
  extraHoursPerYear,
  latestFuelPrice,
  latestChargingPrice,
  fixedCostsPerYear,
  isCarScenario,
  weeksPerYear,
} from "../utils/commute";
import { formatNumber, getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import {
  getCommuteSettings,
  upsertCommuteSettings,
  getCommuteScenarios,
  addCommuteScenario,
  deleteCommuteScenario,
  deleteCommute,
} from "../utils/storage";
import CommuteSettingsForm from "./CommuteSettingsForm";
import CommuteScenarioForm from "./CommuteScenarioForm";
import { SCENARIO_ICONS } from "./commuteIcons";

interface Props {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  chargingEntries: ChargingEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries: ExpenseEntry[];
}

const DEFAULT_SETTINGS = (vehicleId: string): CommuteSettings => ({
  vehicleId,
  kmPerTrip: 0,
  tripsPerDay: 2,
  workDaysPerWeek: 5,
  fuelPricePerLiter: 0,
});

type ScenarioForm = { mode: "new" } | { mode: "edit"; scenario: CommuteScenario };

export default function CommutePanel({ vehicle, fuelEntries, chargingEntries, maintenanceEntries, expenseEntries }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const [settings, setSettings] = useState<CommuteSettings>(() => DEFAULT_SETTINGS(vehicle.id));
  const [scenarios, setScenarios] = useState<CommuteScenario[]>([]);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [scenarioForm, setScenarioForm] = useState<ScenarioForm | null>(null);
  const [allIncludedChoice, setAllIncluded] = useState(false);

  async function reload() {
    const [loadedSettings, loadedScenarios] = await Promise.all([
      getCommuteSettings(vehicle.id),
      getCommuteScenarios(vehicle.id),
    ]);
    setSettings(loadedSettings ?? DEFAULT_SETTINGS(vehicle.id));
    setScenarios(loadedScenarios);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  // Le elettriche ragionano in kWh (consumo e prezzo dalle ricariche), il metano in kg, le altre in litri.
  const electric = vehicle.fuelType === "elettrico";
  const unit = electric ? "kWh" : vehicle.fuelType === "metano" ? "kg" : "l";

  // Consumo reale dai rifornimenti/ricariche, in km per unità.
  let realConsumption: { kmPerUnit: number; count: number } | null = null;
  if (electric) {
    const points = calculateElectricConsumption(chargingEntries);
    const kWhPer100 = averageElectricConsumption(points);
    if (kWhPer100 && kWhPer100 > 0) realConsumption = { kmPerUnit: 100 / kWhPer100, count: points.length };
  } else {
    const source = mainFuelSource(vehicle.fuelType);
    const points = calculateConsumption(fuelEntries).filter((p) => !source || p.source === source);
    const kmPerLiter = averageConsumption(points);
    if (kmPerLiter && kmPerLiter > 0) realConsumption = { kmPerUnit: kmPerLiter, count: points.length };
  }
  const usingEstimate = !realConsumption && !!settings.estimatedKmPerLiter;
  const kmPerUnit = realConsumption?.kmPerUnit ?? settings.estimatedKmPerLiter ?? null;

  // Prezzo: dagli ultimi rifornimenti/ricariche, a meno che l'utente non l'abbia scritto a mano.
  const autoPrice = electric
    ? latestChargingPrice(chargingEntries)
    : latestFuelPrice(fuelEntries, vehicle.fuelType === "ibrido" ? "benzina" : (vehicle.fuelType as FuelSource));
  const priceIsAuto = !!autoPrice && !settings.manualPrice;
  const price = priceIsAuto ? autoPrice.price : settings.fuelPricePerLiter;

  const isConfigured = settings.kmPerTrip > 0 && price > 0;
  const year = isConfigured && kmPerUnit ? commuteYearCost(settings, kmPerUnit, price) : null;
  const fixed = fixedCostsPerYear(maintenanceEntries, expenseEntries);
  const fixedCosts = fixed.perYear;
  // Senza spese registrate "Tutto incluso" non aggiungerebbe nulla: resta disattivato.
  const allIncluded = allIncludedChoice && fixedCosts > 0;
  const shownYear = year ? year.total + (allIncluded ? fixedCosts : 0) : 0;
  const periods = year ? commutePeriods(shownYear, settings) : null;
  const kmYear = commuteKmPerYear(settings);

  const per100 = (k: number) => `${formatNumber(100 / k, 1, locale)} ${unit}/100 km`;
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const money0 = (v: number) => formatMoney(v, 0);

  async function handleSaveSettings(patch: Partial<CommuteSettings>) {
    const updated = await upsertCommuteSettings(vehicle.id, patch);
    setSettings(updated);
    setShowSettingsForm(false);
  }

  async function handleDeleteCommute() {
    await deleteCommute(vehicle.id);
    setSettings(DEFAULT_SETTINGS(vehicle.id));
    setScenarios([]);
    setAllIncluded(false);
    setShowSettingsForm(false);
  }

  async function handleSaveScenario(scenario: CommuteScenario) {
    await addCommuteScenario(scenario);
    setScenarios(await getCommuteScenarios(vehicle.id));
    setScenarioForm(null);
  }

  async function handleDeleteScenario(id: string) {
    await deleteCommuteScenario(id);
    setScenarios(await getCommuteScenarios(vehicle.id));
    setScenarioForm(null);
  }

  const yearCostOf = (s: CommuteScenario) => scenarioYearCost(s, settings, year);
  const scenarioName = (s: CommuteScenario) =>
    s.fuelType === "carpooling"
      ? t("commute.carpoolingName", { people: s.people ?? 2 })
      : t(`commuteFuelType.${s.fuelType}`);

  const segments = year
    ? [
        { key: "fuel", label: t(electric ? "commute.energy" : "commute.fuel"), icon: electric ? "⚡" : "⛽", value: year.fuel },
        { key: "toll", label: t("commute.toll"), icon: "🛣️", value: year.toll },
        { key: "parking", label: t("commute.parking"), icon: "🅿️", value: year.parking },
        { key: "other", label: t("commute.other"), icon: "➕", value: year.other },
        ...(allIncluded ? [{ key: "fixed", label: t("commute.fixedCosts"), icon: "🔧", value: fixedCosts }] : []),
      ].filter((s) => s.value > 0)
    : [];
  const barTotal = segments.reduce((sum, s) => sum + s.value, 0);

  // Barre del confronto: veicolo attuale + scenari, costo annuo solo viaggio.
  const rows = year
    ? [
        { id: "current", label: `${vehicle.name}`, tag: t("commute.currentVehicleTag"), icon: "", value: year.total as number | null },
        ...scenarios.map((s) => ({ id: s.id, label: scenarioName(s), tag: s.note ?? "", icon: SCENARIO_ICONS[s.fuelType], value: yearCostOf(s) })),
      ]
    : [];
  const maxRow = Math.max(1, ...rows.map((r) => r.value ?? 0));

  return (
    <div className="commute">
      <div className="section-head section-head--tight">
        <h2>{t("commute.title")}</h2>
        {isConfigured && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowSettingsForm(true)}>
            {t("commute.editSettings")}
          </button>
        )}
      </div>

      {!isConfigured && (
        <div className="empty-state">
          <p className="empty-state__title">{t("commute.notConfiguredTitle")}</p>
          <p className="empty-state__body">{t(electric ? "commute.notConfiguredBodyElectric" : "commute.notConfiguredBody")}</p>
          <button type="button" className="btn btn--primary" onClick={() => setShowSettingsForm(true)}>
            {t("commute.setup")}
          </button>
        </div>
      )}

      {isConfigured && !kmPerUnit && (
        <div className="empty-state">
          <p className="empty-state__title">{t("commute.noConsumptionTitle")}</p>
          <p className="empty-state__body">{t(electric ? "commute.noConsumptionBodyElectric" : "commute.noConsumptionBody")}</p>
        </div>
      )}

      {year && periods && kmPerUnit && (
        <>
          <p className="commute__summary">
            {t("commute.summary", {
              km: settings.kmPerTrip.toLocaleString(locale, { maximumFractionDigits: 1 }),
              trips: settings.tripsPerDay,
              days: settings.workDaysPerWeek,
              weeks: weeksPerYear(settings),
            })}
          </p>

          <div className="commute-toggle" role="tablist">
            <button type="button" role="tab" aria-selected={!allIncluded} className={!allIncluded ? "is-active" : ""} onClick={() => setAllIncluded(false)}>
              {t("commute.tripOnly")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={allIncluded}
              className={allIncluded ? "is-active" : ""}
              disabled={fixedCosts <= 0}
              onClick={() => setAllIncluded(true)}
            >
              {t("commute.allIncluded")}
            </button>
          </div>

          <div className="commute-totals">
            <div className="commute-total">
              <span className="commute-total__label">{t("commute.perMonth")}</span>
              <span className="commute-total__value">{money0(periods.perMonth)}</span>
            </div>
            <div className="commute-total commute-total--dark">
              <span className="commute-total__label">{t("commute.perYear")}</span>
              <span className="commute-total__value">{money0(periods.perYear)}</span>
            </div>
          </div>

          <div className="commute-card">
            {barTotal > 0 && (
              <div className="commute-bar" aria-hidden="true">
                {segments.map((s) => (
                  <span key={s.key} className={`commute-bar__seg commute-bar__seg--${s.key}`} style={{ flexGrow: s.value }} />
                ))}
              </div>
            )}
            <ul className="commute-legend">
              {segments.map((s) => (
                <li key={s.key}>
                  <span className={`commute-legend__dot commute-bar__seg--${s.key}`} aria-hidden="true" />
                  <span className="commute-legend__label">
                    <span aria-hidden="true">{s.icon}</span> {s.label}
                  </span>
                  <span className="commute-legend__value">{money0(s.value)}</span>
                </li>
              ))}
              {!allIncluded && fixedCosts > 0 && (
                <li className="commute-legend__muted">
                  <span className="commute-legend__dot" aria-hidden="true" />
                  <span className="commute-legend__label">
                    <span aria-hidden="true">🔧</span> {t("commute.fixedCosts")}
                  </span>
                  <span className="commute-legend__value">+{money0(fixedCosts)}</span>
                </li>
              )}
            </ul>
            <p className="commute-card__note">
              {fixedCosts > 0
                ? allIncluded
                  ? t(fixed.basis === "average" ? "commute.allIncludedNoteAverage" : "commute.allIncludedNote", { perKm: formatMoney(shownYear / kmYear, 2) })
                  : t(fixed.basis === "average" ? "commute.tripOnlyNoteAverage" : "commute.tripOnlyNote", { total: money0(year.total + fixedCosts), perKm: formatMoney((year.total + fixedCosts) / kmYear, 2) })
                : t("commute.noFixedCosts")}
            </p>
          </div>

          <div className="stat-row commute-periods">
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commute.perTrip")}</span>
              <span className="stat-chip__value">{formatMoney(periods.perTrip)}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commute.perDay")}</span>
              <span className="stat-chip__value">{formatMoney(periods.perDay)}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commute.perWeek")}</span>
              <span className="stat-chip__value">{formatMoney(periods.perWeek)}</span>
            </div>
          </div>

          <p className="commute__source">
            {realConsumption
              ? t(electric ? "commute.consumptionRealElectric" : "commute.consumptionReal", {
                  value: per100(kmPerUnit),
                  n: realConsumption.count,
                })
              : t("commute.consumptionEstimated", { value: per100(kmPerUnit) })}
            {" · "}
            {priceIsAuto
              ? t(electric ? "commute.priceAutoElectric" : "commute.priceAuto", {
                  value: `${formatMoney(price, 3)}/${unit}`,
                  date: shortDate(autoPrice.date),
                })
              : t("commute.priceManual", { value: `${formatMoney(price, 3)}/${unit}` })}
            {usingEstimate && t(electric ? "commute.estimateProvisionalElectric" : "commute.estimateProvisional")}
          </p>
        </>
      )}

      <div className="section-head section-head--tight" style={{ marginTop: "1.5rem" }}>
        <h2>{t("commute.compareTitle")}</h2>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setScenarioForm({ mode: "new" })}
          disabled={!year}
        >
          {t("commute.addScenario")}
        </button>
      </div>

      {!year && <p className="empty-state__body">{t("commute.setupFirst")}</p>}

      {year && scenarios.length === 0 && (
        <p className="empty-state__body">{t("commute.noScenarios", { name: vehicle.name })}</p>
      )}

      {year && scenarios.length > 0 && (
        <>
          <div className="commute-card">
            <ul className="commute-compare">
              {rows.map((r, i) => {
                const delta = i > 0 && r.value !== null ? r.value - year.total : null;
                return (
                  <li key={r.id}>
                    <div className="commute-compare__head">
                      <span className="commute-compare__name">
                        {r.icon && <span aria-hidden="true">{r.icon} </span>}
                        {r.label}
                        {r.tag && <span className="commute-compare__tag"> {i === 0 ? r.tag : `· ${r.tag}`}</span>}
                      </span>
                      <span className="commute-compare__value">
                        {r.value !== null ? money0(r.value) : "—"}
                        {delta !== null && Math.round(delta) !== 0 && (
                          <span className={delta < 0 ? "commute-compare__delta is-saving" : "commute-compare__delta is-extra"}>
                            {delta < 0 ? "−" : "+"}
                            {money0(Math.abs(delta))}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="commute-compare__track">
                      <span
                        className={`commute-compare__fill${i === 0 ? " is-current" : delta !== null && delta < 0 ? " is-saving" : " is-extra"}`}
                        style={{ width: `${((r.value ?? 0) / maxRow) * 100}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="commute-card__note">{t("commute.compareNote")}</p>
          </div>

          <div className="record-list">
            {scenarios.map((s) => {
              const cost = yearCostOf(s);
              const saving = cost !== null ? year.total - cost : null;
              const payback = saving !== null ? paybackYears(s.priceDifference, saving) : null;
              const hours = extraHoursPerYear(s.extraMinutesPerTrip, settings);
              const sUnit = s.unit === "litro" ? "l" : s.unit;
              return (
                <div key={s.id} className="record-card">
                  <button
                    type="button"
                    className="commute-scenario"
                    onClick={() => setScenarioForm({ mode: "edit", scenario: s })}
                  >
                    <span className="record-card__header">
                      <span className="record-card__title">
                        <span aria-hidden="true">{SCENARIO_ICONS[s.fuelType]}</span> {scenarioName(s)}
                      </span>
                      {s.note && <span className="commute-scenario__note">{s.note}</span>}
                    </span>
                    {saving !== null && (
                      <span className={`commute-scenario__result${saving < 0 ? " is-extra" : ""}`}>
                        <span>
                          {Math.round(saving) === 0
                            ? t("commute.sameCost")
                            : t(saving > 0 ? "commute.wouldSave" : "commute.wouldSpend", { value: money0(Math.abs(saving)) })}
                          {payback !== null && ` ${payback > 30 ? t("commute.paybackNever") : t("commute.payback", { years: formatNumber(payback, 1, locale) })}`}
                        </span>
                        {s.fuelType === "mezzi" && <span className="commute-scenario__sub">{t("commute.transitCarStays")}</span>}
                        {s.fuelType === "carpooling" && <span className="commute-scenario__sub">{t("commute.carpoolingNote")}</span>}
                      </span>
                    )}
                    <span className="commute-scenario__facts">
                      {isCarScenario(s.fuelType) && (
                        <>
                          <span>{`${formatNumber(100 / s.kmPerUnit, 1, locale)} ${sUnit}/100 km`}</span>
                          <span>{`${formatMoney(s.pricePerUnit, 3)}/${sUnit}`}</span>
                        </>
                      )}
                      {(s.fuelType === "mezzi" || s.fuelType === "bici") && (
                        <span>{t("commute.perMonthValue", { value: formatMoney(s.monthlyCost ?? 0, 0) })}</span>
                      )}
                      {hours > 0 && (
                        <span>
                          {t("commute.extraTime", {
                            minutes: s.extraMinutesPerTrip,
                            hours: formatNumber(hours, 0, locale),
                          })}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="record-card__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setScenarioForm({ mode: "edit", scenario: s })}>
                      {t("commute.editSettings")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger btn--small"
                      onClick={() => {
                        if (window.confirm(t("commute.removeConfirm", { name: scenarioName(s) }))) handleDeleteScenario(s.id);
                      }}
                    >
                      {t("commute.remove")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showSettingsForm && (
        <CommuteSettingsForm
          initial={settings}
          unit={unit}
          autoPrice={autoPrice}
          realConsumption={realConsumption}
          onSave={handleSaveSettings}
          onClose={() => setShowSettingsForm(false)}
          onDelete={settings.kmPerTrip > 0 ? handleDeleteCommute : undefined}
        />
      )}

      {scenarioForm && (
        <CommuteScenarioForm
          vehicleId={vehicle.id}
          vehicleName={vehicle.name}
          initial={scenarioForm.mode === "edit" ? scenarioForm.scenario : undefined}
          currentYear={year?.total ?? null}
          yearCostOf={yearCostOf}
          onSave={handleSaveScenario}
          onDelete={handleDeleteScenario}
          onClose={() => setScenarioForm(null)}
        />
      )}
    </div>
  );
}
