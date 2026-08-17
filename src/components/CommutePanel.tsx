import { useEffect, useState } from "react";
import type { Vehicle, FuelEntry, CommuteSettings, CommuteScenario } from "../types";
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

  const realCost =
    isConfigured && avgKmPerLiter !== null
      ? calculateCommuteCost(
          settings.kmPerTrip,
          settings.tripsPerDay,
          settings.workDaysPerWeek,
          avgKmPerLiter,
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

      {isConfigured && avgKmPerLiter === null && (
        <div className="empty-state">
          <p className="empty-state__title">Consumo non ancora calcolabile</p>
          <p className="empty-state__body">
            Registra almeno due rifornimenti "pieno" per la stessa alimentazione: da lì Diario Auto calcola il
            consumo medio reale e il costo del tragitto.
          </p>
        </div>
      )}

      {isConfigured && realCost && avgKmPerLiter !== null && (
        <>
          <p className="empty-state__body" style={{ marginBottom: "0.75rem" }}>
            {settings.kmPerTrip.toLocaleString("it-IT")} km a tratta × {settings.tripsPerDay}/giorno ×{" "}
            {settings.workDaysPerWeek} giorni/settimana, consumo medio reale{" "}
            {avgKmPerLiter.toFixed(1)} km/l a {formatEuro(settings.fuelPricePerLiter)}/litro.
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Consumo</th>
              <th>Prezzo</th>
              <th>A tratta</th>
              <th>Al mese</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {realCost && (
              <tr>
                <td>
                  <strong>{vehicle.name} (attuale)</strong>
                </td>
                <td className="mono">{avgKmPerLiter?.toFixed(1)} km/l</td>
                <td className="mono">{formatEuro(settings.fuelPricePerLiter)}/l</td>
                <td className="mono">{formatEuro(realCost.costPerTrip)}</td>
                <td className="mono">{formatEuro(realCost.costPerMonth)}</td>
                <td></td>
              </tr>
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
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td className="mono">
                    {s.kmPerUnit.toFixed(1)} km/{s.unit}
                  </td>
                  <td className="mono">
                    {formatEuro(s.pricePerUnit)}/{s.unit}
                  </td>
                  <td className="mono">{cost ? formatEuro(cost.costPerTrip) : "—"}</td>
                  <td className="mono">
                    {cost ? formatEuro(cost.costPerMonth) : "—"}
                    {delta !== null && (
                      <span style={{ opacity: 0.7 }}>
                        {" "}
                        ({delta <= 0 ? "-" : "+"}
                        {formatEuro(Math.abs(delta))})
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger btn--small"
                      onClick={() => handleDeleteScenario(s.id)}
                    >
                      Rimuovi
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
