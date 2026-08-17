import { useState } from "react";
import type { Vehicle, FuelEntry, MaintenanceEntry, ExpenseEntry, Reminder } from "../types";
import { calculateVehicleCosts } from "../utils/calculations";
import FuelForm from "./FuelForm";
import FuelList from "./FuelList";
import MaintenanceForm from "./MaintenanceForm";
import MaintenanceList from "./MaintenanceList";
import ExpenseForm from "./ExpenseForm";
import ExpenseList from "./ExpenseList";
import ReminderForm from "./ReminderForm";
import ReminderList from "./ReminderList";
import CostChart from "./CostChart";
import LiveDataPanel from "./LiveDataPanel";
import CommutePanel from "./CommutePanel";

type DetailTab = "live" | "rifornimenti" | "manutenzioni" | "spese" | "scadenze" | "tragitto" | "riepilogo";
type Period = "sempre" | "anno-scorso" | "anno-corrente" | number;

interface Props {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries: ExpenseEntry[];
  reminders: Reminder[];
  onBack: () => void;
  onAddFuel: (entry: FuelEntry) => void;
  onDeleteFuel: (id: string) => void;
  onAddMaintenance: (entry: MaintenanceEntry) => void;
  onDeleteMaintenance: (id: string) => void;
  onAddExpense: (entry: ExpenseEntry) => void;
  onDeleteExpense: (id: string) => void;
  onAddReminder: (reminder: Reminder) => void;
  onToggleReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
}

const TABS: { id: DetailTab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "rifornimenti", label: "Rifornimenti" },
  { id: "manutenzioni", label: "Manutenzioni" },
  { id: "spese", label: "Spese" },
  { id: "scadenze", label: "Scadenze" },
  { id: "tragitto", label: "Tragitto" },
  { id: "riepilogo", label: "Riepilogo" },
];

export default function VehicleDetail({
  vehicle,
  fuelEntries,
  maintenanceEntries,
  expenseEntries,
  reminders,
  onBack,
  onAddFuel,
  onDeleteFuel,
  onAddMaintenance,
  onDeleteMaintenance,
  onAddExpense,
  onDeleteExpense,
  onAddReminder,
  onToggleReminder,
  onDeleteReminder,
}: Props) {
  const [tab, setTab] = useState<DetailTab>("live");
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [period, setPeriod] = useState<Period>("sempre");

  const activeRemindersCount = reminders.filter((r) => !r.completed).length;

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    new Set(
      [...fuelEntries, ...maintenanceEntries, ...expenseEntries].map((e) => new Date(e.date).getFullYear()),
    ),
  )
    .sort((a, b) => b - a)
    .slice(0, 4);

  function inPeriod(dateIso: string): boolean {
    const year = new Date(dateIso).getFullYear();
    if (period === "sempre") return true;
    if (period === "anno-corrente") return year === currentYear;
    if (period === "anno-scorso") return year === currentYear - 1;
    return year === period;
  }

  const filteredFuel = fuelEntries.filter((e) => inPeriod(e.date));
  const filteredMaintenance = maintenanceEntries.filter((e) => inPeriod(e.date));
  const filteredExpenses = expenseEntries.filter((e) => inPeriod(e.date));
  const costs = calculateVehicleCosts(filteredFuel, filteredMaintenance, vehicle.currentKm, filteredExpenses);

  return (
    <section>
      <button type="button" className="back-link" onClick={onBack}>
        ← Tutti i veicoli
      </button>

      <div className="section-head">
        <h1>{vehicle.name}</h1>
        <span className="detail-km">{vehicle.currentKm.toLocaleString("it-IT")} km</span>
      </div>

      <nav className="subtabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`subtabbar__item ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "scadenze" && activeRemindersCount > 0 && (
              <span className="subtabbar__badge">{activeRemindersCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="detail-content">
        {tab === "live" && (
          <>
            <div className="section-head section-head--tight">
              <h2>Dati in tempo reale</h2>
            </div>
            <LiveDataPanel vehicle={vehicle} />
          </>
        )}

        {tab === "rifornimenti" && (
          <>
            <div className="section-head section-head--tight">
              <h2>Rifornimenti</h2>
              <button type="button" className="btn btn--primary" onClick={() => setShowFuelForm(true)}>
                + Aggiungi rifornimento
              </button>
            </div>
            <FuelList entries={fuelEntries} onDelete={onDeleteFuel} />
          </>
        )}

        {tab === "manutenzioni" && (
          <>
            <div className="section-head section-head--tight">
              <h2>Manutenzioni</h2>
              <button type="button" className="btn btn--primary" onClick={() => setShowMaintenanceForm(true)}>
                + Aggiungi manutenzione
              </button>
            </div>
            <MaintenanceList entries={maintenanceEntries} onDelete={onDeleteMaintenance} />
          </>
        )}

        {tab === "spese" && (
          <>
            <div className="section-head section-head--tight">
              <h2>Spese (bollo, assicurazione, multe)</h2>
              <button type="button" className="btn btn--primary" onClick={() => setShowExpenseForm(true)}>
                + Aggiungi spesa
              </button>
            </div>
            <ExpenseList entries={expenseEntries} onDelete={onDeleteExpense} />
          </>
        )}

        {tab === "scadenze" && (
          <>
            <div className="section-head section-head--tight">
              <h2>Scadenze</h2>
              <button type="button" className="btn btn--primary" onClick={() => setShowReminderForm(true)}>
                + Aggiungi scadenza
              </button>
            </div>
            <ReminderList
              reminders={reminders}
              currentKm={vehicle.currentKm}
              onToggleComplete={onToggleReminder}
              onDelete={onDeleteReminder}
            />
          </>
        )}

        {tab === "tragitto" && <CommutePanel vehicle={vehicle} fuelEntries={fuelEntries} />}

        {tab === "riepilogo" && (
          <>
            <div className="section-head section-head--tight">
              <h2>Riepilogo costi</h2>
            </div>

            <div className="period-filter">
              <button
                type="button"
                className={`period-filter__btn ${period === "sempre" ? "is-active" : ""}`}
                onClick={() => setPeriod("sempre")}
              >
                Sempre
              </button>
              <button
                type="button"
                className={`period-filter__btn ${period === "anno-corrente" ? "is-active" : ""}`}
                onClick={() => setPeriod("anno-corrente")}
              >
                {currentYear}
              </button>
              <button
                type="button"
                className={`period-filter__btn ${period === "anno-scorso" ? "is-active" : ""}`}
                onClick={() => setPeriod("anno-scorso")}
              >
                L'anno scorso
              </button>
              {availableYears
                .filter((y) => y !== currentYear && y !== currentYear - 1)
                .map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`period-filter__btn ${period === y ? "is-active" : ""}`}
                    onClick={() => setPeriod(y)}
                  >
                    {y}
                  </button>
                ))}
            </div>

            <div className="stat-row">
              <div className="stat-chip">
                <span className="stat-chip__label">Carburante</span>
                <span className="stat-chip__value">€ {costs.fuelCost.toFixed(2)}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip__label">Manutenzione</span>
                <span className="stat-chip__value">€ {costs.maintenanceCost.toFixed(2)}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip__label">Spese</span>
                <span className="stat-chip__value">€ {costs.expensesCost.toFixed(2)}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip__label">Totale</span>
                <span className="stat-chip__value">€ {costs.totalCost.toFixed(2)}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip__label">Costo/km</span>
                <span className="stat-chip__value">
                  {costs.costPerKm !== null ? `€ ${costs.costPerKm.toFixed(3)}` : "—"}
                </span>
              </div>
            </div>
            <CostChart fuelEntries={filteredFuel} maintenanceEntries={filteredMaintenance} expenseEntries={filteredExpenses} />
          </>
        )}
      </div>

      {showFuelForm && (
        <FuelForm
          vehicle={vehicle}
          onSave={(entry) => {
            onAddFuel(entry);
            setShowFuelForm(false);
          }}
          onClose={() => setShowFuelForm(false)}
        />
      )}

      {showMaintenanceForm && (
        <MaintenanceForm
          vehicle={vehicle}
          onSave={(entry) => {
            onAddMaintenance(entry);
            setShowMaintenanceForm(false);
          }}
          onClose={() => setShowMaintenanceForm(false)}
        />
      )}

      {showExpenseForm && (
        <ExpenseForm
          vehicle={vehicle}
          onSave={(entry) => {
            onAddExpense(entry);
            setShowExpenseForm(false);
          }}
          onClose={() => setShowExpenseForm(false)}
        />
      )}

      {showReminderForm && (
        <ReminderForm
          vehicle={vehicle}
          onSave={(reminder) => {
            onAddReminder(reminder);
            setShowReminderForm(false);
          }}
          onClose={() => setShowReminderForm(false)}
        />
      )}
    </section>
  );
}
