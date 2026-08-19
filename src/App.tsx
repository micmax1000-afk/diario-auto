import { useEffect, useState } from "react";
import type { Vehicle, FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry, Reminder } from "./types";
import {
  loadVehicles,
  saveVehicles,
  loadFuelEntries,
  saveFuelEntries,
  loadChargingEntries,
  saveChargingEntries,
  loadMaintenanceEntries,
  saveMaintenanceEntries,
  loadExpenseEntries,
  saveExpenseEntries,
  loadReminders,
  saveReminders,
  generateId,
} from "./utils/storage";
import { isReminderDue } from "./utils/calculations";
import { areNotificationsEnabled, notifyDueReminders, type NotifiableReminder } from "./utils/notifications";
import VehicleCard from "./components/VehicleCard";
import VehicleForm from "./components/VehicleForm";
import VehicleDetail from "./components/VehicleDetail";
import QuickKmUpdate from "./components/QuickKmUpdate";
import BackupPanel from "./components/BackupPanel";

type Tab = "veicoli" | "backup";

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [chargingEntries, setChargingEntries] = useState<ChargingEntry[]>([]);
  const [maintenanceEntries, setMaintenanceEntries] = useState<MaintenanceEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>("veicoli");
  const [openVehicleId, setOpenVehicleId] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  const [quickKmVehicle, setQuickKmVehicle] = useState<Vehicle | null>(null);

  function reloadAll() {
    setVehicles(loadVehicles());
    setFuelEntries(loadFuelEntries());
    setChargingEntries(loadChargingEntries());
    setMaintenanceEntries(loadMaintenanceEntries());
    setExpenseEntries(loadExpenseEntries());
    setReminders(loadReminders());
  }

  useEffect(() => {
    reloadAll();
  }, []);

  // Controlla le scadenze imminenti/scadute e invia notifiche del browser,
  // se l'utente le ha attivate. Al massimo una per promemoria al giorno.
  useEffect(() => {
    if (!areNotificationsEnabled() || vehicles.length === 0 || reminders.length === 0) return;

    const items: NotifiableReminder[] = [];
    for (const reminder of reminders) {
      if (reminder.completed) continue;
      const vehicle = vehicles.find((v) => v.id === reminder.vehicleId);
      if (!vehicle) continue;
      const status = isReminderDue(reminder.dueDate, reminder.dueKm, vehicle.currentKm);
      if (status === "ok") continue;
      items.push({
        id: reminder.id,
        label: reminder.label,
        vehicleName: vehicle.name,
        status,
        dueDate: reminder.dueDate,
      });
    }
    notifyDueReminders(items);
  }, [vehicles, reminders]);

  // ---------- Veicoli ----------

  function handleSaveVehicle(vehicle: Vehicle) {
    const exists = vehicles.some((v) => v.id === vehicle.id);
    const next = exists ? vehicles.map((v) => (v.id === vehicle.id ? vehicle : v)) : [...vehicles, vehicle];
    setVehicles(next);
    saveVehicles(next);
    setShowNewVehicleForm(false);
    setEditingVehicle(null);
  }

  function handleArchiveVehicle(id: string) {
    const next = vehicles.map((v) =>
      v.id === id ? { ...v, archived: true, archivedAt: new Date().toISOString() } : v,
    );
    setVehicles(next);
    saveVehicles(next);
    if (openVehicleId === id) setOpenVehicleId(null);
  }

  function handleRestoreVehicle(id: string) {
    const next = vehicles.map((v) => (v.id === id ? { ...v, archived: false, archivedAt: undefined } : v));
    setVehicles(next);
    saveVehicles(next);
  }

  function handleDeleteVehicle(id: string) {
    const next = vehicles.filter((v) => v.id !== id);
    setVehicles(next);
    saveVehicles(next);

    const nextFuel = fuelEntries.filter((e) => e.vehicleId !== id);
    setFuelEntries(nextFuel);
    saveFuelEntries(nextFuel);

    const nextCharging = chargingEntries.filter((e) => e.vehicleId !== id);
    setChargingEntries(nextCharging);
    saveChargingEntries(nextCharging);

    const nextMaint = maintenanceEntries.filter((e) => e.vehicleId !== id);
    setMaintenanceEntries(nextMaint);
    saveMaintenanceEntries(nextMaint);

    const nextExpenses = expenseEntries.filter((e) => e.vehicleId !== id);
    setExpenseEntries(nextExpenses);
    saveExpenseEntries(nextExpenses);

    const nextReminders = reminders.filter((r) => r.vehicleId !== id);
    setReminders(nextReminders);
    saveReminders(nextReminders);

    if (openVehicleId === id) setOpenVehicleId(null);
  }

  function handleQuickKmSave(km: number) {
    if (!quickKmVehicle) return;
    const updated: Vehicle = { ...quickKmVehicle, currentKm: km };
    handleSaveVehicle(updated);
    setQuickKmVehicle(null);
  }

  // ---------- Rifornimenti ----------

  function handleSaveFuel(entry: FuelEntry) {
    const exists = fuelEntries.some((e) => e.id === entry.id);
    const next = exists ? fuelEntries.map((e) => (e.id === entry.id ? entry : e)) : [...fuelEntries, entry];
    setFuelEntries(next);
    saveFuelEntries(next);

    // aggiorna automaticamente il km del veicolo se il rifornimento è più recente
    const vehicle = vehicles.find((v) => v.id === entry.vehicleId);
    if (vehicle && entry.km > vehicle.currentKm) {
      const updated = { ...vehicle, currentKm: entry.km };
      const nextVehicles = vehicles.map((v) => (v.id === vehicle.id ? updated : v));
      setVehicles(nextVehicles);
      saveVehicles(nextVehicles);
    }
  }

  function handleDeleteFuel(id: string) {
    const next = fuelEntries.filter((e) => e.id !== id);
    setFuelEntries(next);
    saveFuelEntries(next);
  }

  // ---------- Ricariche elettriche ----------

  function handleSaveCharging(entry: ChargingEntry) {
    const exists = chargingEntries.some((e) => e.id === entry.id);
    const next = exists ? chargingEntries.map((e) => (e.id === entry.id ? entry : e)) : [...chargingEntries, entry];
    setChargingEntries(next);
    saveChargingEntries(next);

    const vehicle = vehicles.find((v) => v.id === entry.vehicleId);
    if (vehicle && entry.km > vehicle.currentKm) {
      const updated = { ...vehicle, currentKm: entry.km };
      const nextVehicles = vehicles.map((v) => (v.id === vehicle.id ? updated : v));
      setVehicles(nextVehicles);
      saveVehicles(nextVehicles);
    }
  }

  function handleDeleteCharging(id: string) {
    const next = chargingEntries.filter((e) => e.id !== id);
    setChargingEntries(next);
    saveChargingEntries(next);
  }

  // ---------- Manutenzioni ----------

  function handleAddMaintenance(entry: MaintenanceEntry) {
    const next = [...maintenanceEntries, entry];
    setMaintenanceEntries(next);
    saveMaintenanceEntries(next);

    const vehicle = vehicles.find((v) => v.id === entry.vehicleId);
    if (vehicle && entry.km > vehicle.currentKm) {
      const updated = { ...vehicle, currentKm: entry.km };
      const nextVehicles = vehicles.map((v) => (v.id === vehicle.id ? updated : v));
      setVehicles(nextVehicles);
      saveVehicles(nextVehicles);
    }
  }

  function handleDeleteMaintenance(id: string) {
    const next = maintenanceEntries.filter((e) => e.id !== id);
    setMaintenanceEntries(next);
    saveMaintenanceEntries(next);
  }

  // ---------- Spese ----------

  function handleAddExpense(entry: ExpenseEntry) {
    const next = [...expenseEntries, entry];
    setExpenseEntries(next);
    saveExpenseEntries(next);
  }

  function handleDeleteExpense(id: string) {
    const next = expenseEntries.filter((e) => e.id !== id);
    setExpenseEntries(next);
    saveExpenseEntries(next);
  }

  // ---------- Scadenze ----------

  function handleAddReminder(reminder: Reminder) {
    const next = [...reminders, reminder];
    setReminders(next);
    saveReminders(next);
  }

  function handleToggleReminder(id: string) {
    const target = reminders.find((r) => r.id === id);
    let next = reminders.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r));

    // se viene completata (non riattivata) e ha un intervallo di ripetizione, crea la prossima occorrenza
    if (target && !target.completed && (target.repeatMonths || target.repeatKm)) {
      const vehicle = vehicles.find((v) => v.id === target.vehicleId);
      const nextReminder: Reminder = {
        ...target,
        id: generateId(),
        completed: false,
      };
      if (target.type === "data" && target.repeatMonths) {
        const due = new Date();
        due.setMonth(due.getMonth() + target.repeatMonths);
        nextReminder.dueDate = due.toISOString();
      }
      if (target.type === "km" && target.repeatKm && vehicle) {
        nextReminder.dueKm = vehicle.currentKm + target.repeatKm;
      }
      next = [...next, nextReminder];
    }

    setReminders(next);
    saveReminders(next);
  }

  function handleDeleteReminder(id: string) {
    const next = reminders.filter((r) => r.id !== id);
    setReminders(next);
    saveReminders(next);
  }

  const openVehicle = vehicles.find((v) => v.id === openVehicleId) ?? null;

  function urgentRemindersCount(vehicleId: string, currentKm: number): number {
    return reminders.filter(
      (r) => r.vehicleId === vehicleId && !r.completed && isReminderDue(r.dueDate, r.dueKm, currentKm) !== "ok",
    ).length;
  }

  function hasUrgentReminder(vehicleId: string, currentKm: number): boolean {
    return reminders.some(
      (r) =>
        r.vehicleId === vehicleId &&
        !r.completed &&
        isReminderDue(r.dueDate, r.dueKm, currentKm) !== "ok",
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__title">Diario Auto</span>
          <span className="topbar__subtitle">manutenzione &amp; consumi</span>
        </div>
      </header>

      <nav className="tabbar">
        <button
          type="button"
          className={`tabbar__item ${activeTab === "veicoli" ? "is-active" : ""}`}
          onClick={() => {
            setActiveTab("veicoli");
            setOpenVehicleId(null);
          }}
        >
          Veicoli
        </button>
        <button
          type="button"
          className={`tabbar__item ${activeTab === "backup" ? "is-active" : ""}`}
          onClick={() => setActiveTab("backup")}
        >
          Backup
        </button>
      </nav>

      {activeTab === "veicoli" && vehicles.filter((v) => !v.archived).length > 1 && (
        <div className="vehicle-switcher">
          {vehicles
            .filter((v) => !v.archived)
            .map((v) => (
              <button
                key={v.id}
                type="button"
                className={`vehicle-switcher__chip ${openVehicleId === v.id ? "is-active" : ""}`}
                onClick={() => setOpenVehicleId(v.id)}
              >
                {v.name}
                {hasUrgentReminder(v.id, v.currentKm) && <span className="vehicle-switcher__dot" />}
              </button>
            ))}
        </div>
      )}

      <main className="content">
        {activeTab === "veicoli" && !openVehicle && (
          <section>
            <div className="section-head">
              <h1>I tuoi veicoli</h1>
              <button type="button" className="btn btn--primary" onClick={() => setShowNewVehicleForm(true)}>
                + Aggiungi veicolo
              </button>
            </div>

            {vehicles.filter((v) => !v.archived).length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">Nessun veicolo attivo</p>
                <p className="empty-state__body">
                  {vehicles.length === 0
                    ? "Aggiungi il tuo primo veicolo per iniziare a tracciare consumi, manutenzioni e scadenze."
                    : "Tutti i tuoi veicoli sono archiviati come venduti. Aggiungine uno nuovo o ripristina uno dall'elenco qui sotto."}
                </p>
                <button type="button" className="btn btn--primary" onClick={() => setShowNewVehicleForm(true)}>
                  + Aggiungi veicolo
                </button>
              </div>
            ) : (
              <div className="vehicle-grid">
                {vehicles
                  .filter((v) => !v.archived)
                  .map((v) => (
                    <div key={v.id} className="vehicle-grid__item">
                      {hasUrgentReminder(v.id, v.currentKm) && (
                        <span className="vehicle-grid__alert" title="Scadenza in arrivo o scaduta">
                          ⚠ {urgentRemindersCount(v.id, v.currentKm)}
                        </span>
                      )}
                      <VehicleCard
                        vehicle={v}
                        onOpen={setOpenVehicleId}
                        onEdit={(id) => setEditingVehicle(vehicles.find((veh) => veh.id === id) ?? null)}
                        onQuickKm={(id) => setQuickKmVehicle(vehicles.find((veh) => veh.id === id) ?? null)}
                        onDelete={handleArchiveVehicle}
                      />
                    </div>
                  ))}
              </div>
            )}

            {vehicles.some((v) => v.archived) && (
              <div className="archived-section">
                <h2 className="archived-section__title">Veicoli venduti</h2>
                <div className="archived-list">
                  {vehicles
                    .filter((v) => v.archived)
                    .map((v) => (
                      <div key={v.id} className="archived-item">
                        <div className="archived-item__info">
                          <span className="archived-item__name">{v.name}</span>
                          <span className="archived-item__meta">
                            {v.currentKm.toLocaleString("it-IT")} km
                            {v.archivedAt ? ` · venduto il ${new Date(v.archivedAt).toLocaleDateString("it-IT")}` : ""}
                          </span>
                        </div>
                        <div className="archived-item__actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--small"
                            onClick={() => handleRestoreVehicle(v.id)}
                          >
                            Ripristina
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--danger btn--small"
                            onClick={() => {
                              if (window.confirm(`Eliminare definitivamente ${v.name} e tutti i suoi dati?`)) {
                                handleDeleteVehicle(v.id);
                              }
                            }}
                          >
                            Elimina definitivamente
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "veicoli" && openVehicle && (
          <VehicleDetail
            vehicle={openVehicle}
            fuelEntries={fuelEntries.filter((e) => e.vehicleId === openVehicle.id)}
            chargingEntries={chargingEntries.filter((e) => e.vehicleId === openVehicle.id)}
            maintenanceEntries={maintenanceEntries.filter((e) => e.vehicleId === openVehicle.id)}
            expenseEntries={expenseEntries.filter((e) => e.vehicleId === openVehicle.id)}
            reminders={reminders.filter((r) => r.vehicleId === openVehicle.id)}
            onBack={() => setOpenVehicleId(null)}
            onSaveFuel={handleSaveFuel}
            onDeleteFuel={handleDeleteFuel}
            onSaveCharging={handleSaveCharging}
            onDeleteCharging={handleDeleteCharging}
            onAddMaintenance={handleAddMaintenance}
            onDeleteMaintenance={handleDeleteMaintenance}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onAddReminder={handleAddReminder}
            onToggleReminder={handleToggleReminder}
            onDeleteReminder={handleDeleteReminder}
          />
        )}

        {activeTab === "backup" && (
          <section>
            <div className="section-head">
              <h1>Backup e esportazione</h1>
            </div>
            <BackupPanel
              vehicles={vehicles}
              fuelEntries={fuelEntries}
              maintenanceEntries={maintenanceEntries}
              expenseEntries={expenseEntries}
              onRestored={reloadAll}
            />
          </section>
        )}
      </main>

      {showNewVehicleForm && (
        <VehicleForm onSave={handleSaveVehicle} onClose={() => setShowNewVehicleForm(false)} />
      )}

      {editingVehicle && (
        <VehicleForm
          initialVehicle={editingVehicle}
          onSave={handleSaveVehicle}
          onClose={() => setEditingVehicle(null)}
        />
      )}

      {quickKmVehicle && (
        <QuickKmUpdate
          vehicle={quickKmVehicle}
          onSave={handleQuickKmSave}
          onClose={() => setQuickKmVehicle(null)}
        />
      )}
    </div>
  );
}
