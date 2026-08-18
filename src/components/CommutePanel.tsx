import { useEffect, useState } from "react";
import type { Vehicle, FuelEntry, CommuteSettings, CommuteScenario, CommuteFuelType } from "../types";
import { calculateConsumption, averageConsumption, calculateCommuteCost } from "../utils/calculations";
import {
  getCommuteSettings,
  upsertCommuteSettings,
  getCommuteScenarios,
  addCommuteScenario,
  deleteCommuteScenario,
} from "../utils/storage";
import CommuteSettingsForm from "./CommuteSettingsForm";
import CommuteScenarioForm from "./CommuteScenarioForm";

const FUEL_TYPE_LABELS: Record<CommuteFuelType, string> = {
  benzina: "Benzina",
  diesel: "Diesel",
  gpl: "GPL",
  elettrico: "Elettrico",
  ibrido: "Ibrido",
  ibrido_plugin: "Ibrido plug-in",
};

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

function formatEuro(value: number): string {
  return `€ ${value.toFixed(2)}`;
}

export default function CommutePanel({ vehicle, fuelEntries }: Props) {
  const [settings, setSettings] = useState<CommuteSettings>(() =>
    getCommuteSettings(vehicle.id) ?? DEFAULT_SETTINGS(vehicle.id),
  );
  const [scenarios, setScenarios] = useState<CommuteScenario[]>(() => getCommuteScenarios(vehicle.id));
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [showScenarioForm, setShowScenarioForm] = useState(false);

  useEffect(() => {
    setSettings(getCommuteSettings(vehicle.id) ?? DEFAULT_SETTINGS(vehicle.id));
    setScenarios(getCommuteScenarios(vehicle.id));
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

  function handleSaveSettings(patch: Partial<CommuteSettings>) {
    const updated = upsertCommuteSettings(vehicle.id, patch);
    setSettings(updated);
    setShowSettingsForm(false);
  }

  function handleAddScenario(scenario: CommuteScenario) {
    addCommuteScenario(scenario);
    setScenarios(getCommuteScenarios(vehicle.id));
    setShowScenarioForm(false);
  }

  function handleDeleteScenario(id: string) {
    deleteCommuteScenario(id);
    setScenarios(getCommuteScenarios(vehicle.id));
  }

  return (
    <div>
      <div className="section-head section-head--tight">
        <h2>Costo reale del tragitto</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowSettingsForm(true)}>
          {isConfigured ? "Modifica impostazioni" : "Imposta tragitto"}
        </button>
      </div>

      {!isConfigured && (
        <div className="empty-state">
          <p className="empty-state__title">Tragitto non ancora configurato</p>
          <p className="empty-state__body">
            Imposta i km della tratta casa-lavoro e il prezzo del carburante per calcolare il costo reale del
            tuo pendolarismo, basato sul consumo medio calcolato dai rifornimenti registrati.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setShowSettingsForm(true)}>
            Imposta tragitto
          </button>
        </div>
      )}

      {isConfigured && effectiveKmPerLiter === null && (
        <div className="empty-state">
          <p className="empty-state__title">Consumo non ancora disponibile</p>
          <p className="empty-state__body">
            Aggiungi un consumo stimato nelle impostazioni (anche approssimativo) per vedere subito il costo
            del tragitto, oppure registra almeno due rifornimenti "pieno" per farlo calcolare a Diario Auto in
            automatico.
          </p>
        </div>
      )}

      {isConfigured && realCost && effectiveKmPerLiter !== null && (
        <>
          <p className="empty-state__body" style={{ marginBottom: "0.75rem" }}>
            {settings.kmPerTrip.toLocaleString("it-IT")} km a tratta × {settings.tripsPerDay}/giorno ×{" "}
            {settings.workDaysPerWeek} giorni/settimana, consumo {usingEstimate ? "stimato" : "medio reale"}{" "}
            {effectiveKmPerLiter.toFixed(1)} km/l a {formatEuro(settings.fuelPricePerLiter)}/litro.
            {usingEstimate && (
              <> Dato provvisorio — verrà sostituito in automatico appena avrai abbastanza rifornimenti registrati.</>
            )}
          </p>
          <div className="stat-row">
            <div className="stat-chip">
              <span className="stat-chip__label">A tratta</span>
              <span className="stat-chip__value">{formatEuro(realCost.costPerTrip)}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Al giorno</span>
              <span className="stat-chip__value">{formatEuro(realCost.costPerDay)}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">A settimana</span>
              <span className="stat-chip__value">{formatEuro(realCost.costPerWeek)}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Al mese</span>
              <span className="stat-chip__value">{formatEuro(realCost.costPerMonth)}</span>
            </div>
          </div>
        </>
      )}

      <div className="section-head section-head--tight" style={{ marginTop: "1.5rem" }}>
        <h2>Confronto con altre opzioni</h2>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setShowScenarioForm(true)}
          disabled={!isConfigured}
        >
          + Aggiungi scenario
        </button>
      </div>

      {!isConfigured && (
        <p className="empty-state__body">Imposta prima il tragitto per poter confrontare altri veicoli.</p>
      )}

      {isConfigured && scenarios.length === 0 && (
        <p className="empty-state__body">
          Aggiungi uno scenario ipotetico (es. un veicolo GPL o elettrico che stai valutando) per confrontarne il
          costo del tragitto con quello reale del tuo {vehicle.name}.
        </p>
      )}

      {isConfigured && scenarios.length > 0 && (
        <div className="record-list">
          {realCost && (
            <div className="record-card">
              <div className="record-card__header">
                <span className="record-card__title">
                  {vehicle.name} (attuale){usingEstimate && <span style={{ opacity: 0.7 }}> · stimato</span>}
                </span>
                <span className="record-card__meta">al mese: {formatEuro(realCost.costPerMonth)}</span>
              </div>
              <div className="record-card__rows">
                <div className="record-card__row">
                  <span className="record-card__row-label">Consumo</span>
                  <span className="record-card__row-value mono">{effectiveKmPerLiter?.toFixed(1)} km/l</span>
                </div>
                <div className="record-card__row">
                  <span className="record-card__row-label">Prezzo</span>
                  <span className="record-card__row-value mono">{formatEuro(settings.fuelPricePerLiter)}/l</span>
                </div>
                <div className="record-card__row">
                  <span className="record-card__row-label">A tratta</span>
                  <span className="record-card__row-value mono">{formatEuro(realCost.costPerTrip)}</span>
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
                  <span className="record-card__title">{FUEL_TYPE_LABELS[s.fuelType]}</span>
                  <span className="record-card__meta">
                    al mese: {cost ? formatEuro(cost.costPerMonth) : "—"}
                    {delta !== null && (
                      <> ({delta <= 0 ? "-" : "+"}{formatEuro(Math.abs(delta))})</>
                    )}
                  </span>
                </div>
                <div className="record-card__rows">
                  <div className="record-card__row">
                    <span className="record-card__row-label">Consumo</span>
                    <span className="record-card__row-value mono">
                      {s.kmPerUnit.toFixed(1)} km/{s.unit}
                    </span>
                  </div>
                  <div className="record-card__row">
                    <span className="record-card__row-label">Prezzo</span>
                    <span className="record-card__row-value mono">
                      {formatEuro(s.pricePerUnit)}/{s.unit}
                    </span>
                  </div>
                  <div className="record-card__row">
                    <span className="record-card__row-label">A tratta</span>
                    <span className="record-card__row-value mono">{cost ? formatEuro(cost.costPerTrip) : "—"}</span>
                  </div>
                </div>
                {s.note && <p className="record-card__note">{s.note}</p>}
                <div className="record-card__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger btn--small"
                    onClick={() => handleDeleteScenario(s.id)}
                  >
                    Rimuovi
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
