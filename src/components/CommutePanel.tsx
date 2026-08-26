import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle, FuelEntry, CommuteSettings, CommuteScenario } from "../types";
import { calculateConsumption, averageConsumption, calculateCommuteCost } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import {
  getCommuteSettings,
  upsertCommuteSettings,
  getCommuteScenarios,
  addCommuteScenario,
  deleteCommuteScenario,
} from "../utils/storage";
import CommuteSettingsForm from "./CommuteSettingsForm";
import CommuteScenarioForm from "./CommuteScenarioForm";

interface Props {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
}

const DEFAULT_SETTINGS = (vehicleId: string): CommuteSettings => ({
  vehicleId,
  kmPerTrip: 0,
  tripsPerDay: 2,
  workDaysPerWeek: 6,
  fuelPricePerLiter: 0,
});

export default function CommutePanel({ vehicle, fuelEntries }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const [settings, setSettings] = useState<CommuteSettings>(() => DEFAULT_SETTINGS(vehicle.id));
  const [scenarios, setScenarios] = useState<CommuteScenario[]>([]);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [showScenarioForm, setShowScenarioForm] = useState(false);

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

  const isConfigured = settings.kmPerTrip > 0 && settings.fuelPricePerLiter > 0;

  const consumptionPoints = calculateConsumption(fuelEntries);
  const avgKmPerLiter = averageConsumption(consumptionPoints);
  const usingEstimate = avgKmPerLiter === null && !!settings.estimatedKmPerLiter;
  const effectiveKmPerLiter = avgKmPerLiter ?? settings.estimatedKmPerLiter ?? null;

  const realCost =
    isConfigured && effectiveKmPerLiter !== null
      ? calculateCommuteCost(
          settings.kmPerTrip,
          settings.tripsPerDay,
          settings.workDaysPerWeek,
          effectiveKmPerLiter,
          settings.fuelPricePerLiter,
        )
      : null;

  async function handleSaveSettings(patch: Partial<CommuteSettings>) {
    const updated = await upsertCommuteSettings(vehicle.id, patch);
    setSettings(updated);
    setShowSettingsForm(false);
  }

  async function handleAddScenario(scenario: CommuteScenario) {
    await addCommuteScenario(scenario);
    setScenarios(await getCommuteScenarios(vehicle.id));
    setShowScenarioForm(false);
  }

  async function handleDeleteScenario(id: string) {
    await deleteCommuteScenario(id);
    setScenarios(await getCommuteScenarios(vehicle.id));
  }

  return (
    <div>
      <div className="section-head section-head--tight">
        <h2>{t("commute.title")}</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowSettingsForm(true)}>
          {isConfigured ? t("commute.editSettings") : t("commute.setup")}
        </button>
      </div>

      {!isConfigured && (
        <div className="empty-state">
          <p className="empty-state__title">{t("commute.notConfiguredTitle")}</p>
          <p className="empty-state__body">{t("commute.notConfiguredBody")}</p>
          <button type="button" className="btn btn--primary" onClick={() => setShowSettingsForm(true)}>
            {t("commute.setup")}
          </button>
        </div>
      )}

      {isConfigured && effectiveKmPerLiter === null && (
        <div className="empty-state">
          <p className="empty-state__title">{t("commute.noConsumptionTitle")}</p>
          <p className="empty-state__body">{t("commute.noConsumptionBody")}</p>
        </div>
      )}

      {isConfigured && realCost && effectiveKmPerLiter !== null && (
        <>
          <p className="empty-state__body" style={{ marginBottom: "0.75rem" }}>
            {t("commute.summaryLine", {
              km: settings.kmPerTrip.toLocaleString(getNumberLocale(i18n.language)),
              trips: settings.tripsPerDay,
              days: settings.workDaysPerWeek,
              estimateLabel: usingEstimate ? t("commute.estimateLabelEstimated") : t("commute.estimateLabelReal"),
              consumption: effectiveKmPerLiter.toFixed(1),
              price: formatMoney(settings.fuelPricePerLiter),
            })}
            {usingEstimate && t("commute.estimateProvisional")}
          </p>
          <div className="stat-row">
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commute.perTrip")}</span>
              <span className="stat-chip__value">{formatMoney(realCost.costPerTrip)}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commute.perDay")}</span>
              <span className="stat-chip__value">{formatMoney(realCost.costPerDay)}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commute.perWeek")}</span>
              <span className="stat-chip__value">{formatMoney(realCost.costPerWeek)}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commute.perMonth")}</span>
              <span className="stat-chip__value">{formatMoney(realCost.costPerMonth)}</span>
            </div>
          </div>
        </>
      )}

      <div className="section-head section-head--tight" style={{ marginTop: "1.5rem" }}>
        <h2>{t("commute.compareTitle")}</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowScenarioForm(true)}>
          {t("commute.addScenario")}
        </button>
      </div>

      {scenarios.length === 0 && (
        <p className="empty-state__body">{t("commute.noScenarios", { name: vehicle.name })}</p>
      )}

      {scenarios.length > 0 && (
        <div className="record-list">
          {realCost && (
            <div className="record-card">
              <div className="record-card__header">
                <span className="record-card__title">
                  {vehicle.name} {t("commute.currentVehicleTag")}
                  {usingEstimate && <span style={{ opacity: 0.7 }}> {t("commute.estimatedTag")}</span>}
                </span>
                <span className="record-card__meta">{t("commute.perMonthLabel", { value: formatMoney(realCost.costPerMonth) })}</span>
              </div>
              <div className="record-card__rows">
                <div className="record-card__row">
                  <span className="record-card__row-label">{t("commute.consumption")}</span>
                  <span className="record-card__row-value mono">{effectiveKmPerLiter?.toFixed(1)} km/l</span>
                </div>
                <div className="record-card__row">
                  <span className="record-card__row-label">{t("commute.price")}</span>
                  <span className="record-card__row-value mono">{formatMoney(settings.fuelPricePerLiter)}/l</span>
                </div>
                <div className="record-card__row">
                  <span className="record-card__row-label">{t("commute.perTrip")}</span>
                  <span className="record-card__row-value mono">{formatMoney(realCost.costPerTrip)}</span>
                </div>
              </div>
            </div>
          )}
          {scenarios.map((s) => {
            const cost = calculateCommuteCost(
              settings.kmPerTrip,
              settings.tripsPerDay,
              settings.workDaysPerWeek,
              s.kmPerUnit,
              s.pricePerUnit,
            );
            const delta = realCost && cost ? cost.costPerMonth - realCost.costPerMonth : null;
            return (
              <div key={s.id} className="record-card">
                <div className="record-card__header">
                  <span className="record-card__title">{t(`commuteFuelType.${s.fuelType}`)}</span>
                  <span className="record-card__meta">
                    {t("commute.perMonthLabel", { value: cost ? formatMoney(cost.costPerMonth) : "—" })}
                    {delta !== null && (
                      <>
                        {" "}
                        ({delta <= 0 ? "-" : "+"}
                        {formatMoney(Math.abs(delta))})
                      </>
                    )}
                  </span>
                </div>
                <div className="record-card__rows">
                  <div className="record-card__row">
                    <span className="record-card__row-label">{t("commute.consumption")}</span>
                    <span className="record-card__row-value mono">
                      {s.kmPerUnit.toFixed(1)} km/{s.unit}
                    </span>
                  </div>
                  <div className="record-card__row">
                    <span className="record-card__row-label">{t("commute.price")}</span>
                    <span className="record-card__row-value mono">
                      {formatMoney(s.pricePerUnit)}/{s.unit}
                    </span>
                  </div>
                  <div className="record-card__row">
                    <span className="record-card__row-label">{t("commute.perTrip")}</span>
                    <span className="record-card__row-value mono">{cost ? formatMoney(cost.costPerTrip) : "—"}</span>
                  </div>
                </div>
                {s.note && <p className="record-card__note">{s.note}</p>}
                <div className="record-card__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger btn--small"
                    onClick={() => handleDeleteScenario(s.id)}
                  >
                    {t("commute.remove")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showSettingsForm && (
        <CommuteSettingsForm initial={settings} onSave={handleSaveSettings} onClose={() => setShowSettingsForm(false)} />
      )}

      {showScenarioForm && (
        <CommuteScenarioForm
          vehicleId={vehicle.id}
          onSave={handleAddScenario}
          onClose={() => setShowScenarioForm(false)}
        />
      )}
    </div>
  );
}
