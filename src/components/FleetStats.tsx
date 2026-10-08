import { useTranslation } from "react-i18next";
import type { Vehicle, FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry, Reminder } from "../types";
import { calculateConsumption, averageConsumption, calculateVehicleCosts, isReminderDue } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import VehicleSwitcher from "./VehicleSwitcher";

interface Props {
  vehicles: Vehicle[];
  colors: Record<string, string>;
  fuelEntries: FuelEntry[];
  chargingEntries: ChargingEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries: ExpenseEntry[];
  reminders: Reminder[];
  onOpenVehicle: (vehicleId: string) => void;
}

const MONTHS = 12;

/** Confronto tra tutti i veicoli (ultimi 12 mesi). Funzione Premium. */
export default function FleetStats({ vehicles, colors, fuelEntries, chargingEntries, maintenanceEntries, expenseEntries, reminders, onOpenVehicle }: Props) {
  const { t, i18n } = useTranslation();
  const locale = getNumberLocale(i18n.language);
  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS);
  const sinceIso = since.toISOString();
  const inRange = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date >= sinceIso);

  const rows = vehicles.map((v) => {
    const fuel = fuelEntries.filter((e) => e.vehicleId === v.id);
    const charging = chargingEntries.filter((e) => e.vehicleId === v.id);
    const costs = calculateVehicleCosts(
      inRange(fuel),
      inRange(maintenanceEntries.filter((e) => e.vehicleId === v.id)),
      v.currentKm,
      inRange(expenseEntries.filter((e) => e.vehicleId === v.id)),
      inRange(charging),
    );
    const consumption = averageConsumption(calculateConsumption(fuel));
    const urgent = reminders.filter(
      (r) => r.vehicleId === v.id && !r.completed && isReminderDue(r.dueDate, r.dueKm, v.currentKm) !== "ok",
    ).length;
    return { vehicle: v, total: costs.totalCost, costPerKm: costs.costPerKm, consumption, urgent };
  });

  const grandTotal = rows.reduce((a, r) => a + r.total, 0);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const money = (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 0 })} €`;
  const urgentCounts = Object.fromEntries(rows.map((r) => [r.vehicle.id, r.urgent]));

  return (
    <section className="fleet-stats">
      <div className="section-head">
        <h1>
          {t("bottomNav.stats")} <span className="vswitch__pro">PRO</span>
        </h1>
      </div>

      <VehicleSwitcher
        vehicles={vehicles}
        currentId={null}
        colors={colors}
        urgentCounts={urgentCounts}
        onSelect={onOpenVehicle}
        leading={{ label: t("fleet.all", "Tutti"), active: true, onClick: () => undefined }}
      />

      <div className="fleet-stats__head">
        <span>{t("fleet.last12", "Spesa ultimi 12 mesi")}</span>
        <strong>{money(grandTotal)}</strong>
      </div>

      {rows.map((r) => (
        <button
          key={r.vehicle.id}
          type="button"
          className="fleet-stats__card"
          style={{ ["--c" as string]: colors[r.vehicle.id] }}
          onClick={() => onOpenVehicle(r.vehicle.id)}
        >
          <span className="fleet-stats__title">
            <span className="vdot" />
            {r.vehicle.name}
            <b>{money(r.total)}</b>
          </span>
          <span className="fleet-stats__grid">
            <span>
              <b>{r.costPerKm !== null ? `${r.costPerKm.toLocaleString(locale, { maximumFractionDigits: 2 })} €` : "–"}</b>
              {t("fleet.costPerKm", "costo/km")}
            </span>
            <span>
              <b>{r.consumption !== null ? r.consumption.toLocaleString(locale, { maximumFractionDigits: 1 }) : "–"}</b>
              {t("dashboardGarage.avgConsumptionUnit", "l/100km")}
            </span>
            <span>
              <b className={r.urgent > 0 ? "is-urgent" : "is-ok"}>{r.urgent}</b>
              {t("fleet.urgent", "scadenze urgenti")}
            </span>
          </span>
          <span className="fleet-stats__bar">
            <i style={{ width: `${Math.round((r.total / maxTotal) * 100)}%` }} />
          </span>
        </button>
      ))}
      <p className="fleet-stats__hint">{t("fleet.hint", "Tocca un veicolo per vedere il suo dettaglio")}</p>
    </section>
  );
}
