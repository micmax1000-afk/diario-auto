import { useTranslation } from "react-i18next";
import type { Vehicle, FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry, Reminder } from "../types";
import { calculateConsumption, averageConsumption, calculateVehicleCosts, calculateElectricConsumption, averageElectricConsumption, mainFuelSource } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import CartoonCar from "./CartoonCar";
import { PRO_ENABLED } from "../services/billing/useProStatus";
import { reminderStatus } from "../utils/kmForecast";

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
  const { formatMoney } = useAppSettings();
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
    // Elettriche in kWh/100 km dalle ricariche, le altre in l/100 km (averageConsumption dà km/l).
    const electric = v.fuelType === "elettrico";
    const kmPerL = averageConsumption(calculateConsumption(fuel), mainFuelSource(v.fuelType));
    const consumption = electric ? averageElectricConsumption(calculateElectricConsumption(charging)) : kmPerL ? 100 / kmPerL : null;
    const urgent = reminders.filter(
      (r) => r.vehicleId === v.id && !r.completed && reminderStatus(r, v.currentKm) !== "ok",
    ).length;
    return { vehicle: v, total: costs.totalCost, costPerKm: costs.costPerKm, consumption, electric, urgent };
  });

  const grandTotal = rows.reduce((a, r) => a + r.total, 0);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const money = (n: number) => formatMoney(n, 0);

  return (
    <section className="fleet-stats">
      <div className="screen-head">
        <h1 className="screen-title">
          {t("fleet.allVehicles")} {PRO_ENABLED && <span className="vpick__pro">PRO</span>}
        </h1>
      </div>

      <section className="stotal">
        <span className="stotal__label">{t("fleet.last12", "Spesa ultimi 12 mesi")}</span>
        <div className="stotal__value">{money(grandTotal)}</div>
      </section>

      <div className="fleet-list">
        {rows.map((r) => (
          <button
            key={r.vehicle.id}
            type="button"
            className="fleet-card"
            onClick={() => onOpenVehicle(r.vehicle.id)}
          >
            <span className="fleet-card__top">
              <span className="fleet-card__thumb">
                {r.vehicle.photo ? (
                  <img src={r.vehicle.photo} alt="" />
                ) : (
                  <CartoonCar bodyType={r.vehicle.bodyType} color={colors[r.vehicle.id] ?? "#4f9dff"} />
                )}
              </span>
              <span className="fleet-card__name">{r.vehicle.name}</span>
              <b className="fleet-card__total">{money(r.total)}</b>
            </span>
            <span className="fleet-card__bar" aria-hidden="true">
              <i style={{ width: `${Math.round((r.total / maxTotal) * 100)}%`, background: colors[r.vehicle.id] ?? "var(--amber)" }} />
            </span>
            <span className="fleet-card__grid">
              <span>
                <b>{r.costPerKm !== null ? formatMoney(r.costPerKm, 2) : "–"}</b>
                {t("fleet.costPerKm", "costo/km")}
              </span>
              <span>
                <b>{r.consumption !== null ? r.consumption.toLocaleString(locale, { maximumFractionDigits: 1 }) : "–"}</b>
                {r.electric ? "kWh/100km" : t("dashboardGarage.avgConsumptionUnit", "l/100km")}
              </span>
              <span>
                <b className={r.urgent > 0 ? "is-urgent" : "is-ok"}>{r.urgent}</b>
                {t("fleet.urgent", "scadenze urgenti")}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="fleet-stats__hint">{t("fleet.hint", "Tocca un veicolo per vedere il suo dettaglio")}</p>
    </section>
  );
}
