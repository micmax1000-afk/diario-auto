import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MaintenanceEntry, Reminder, Vehicle } from "../types";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { reminderStatus } from "../utils/kmForecast";
import UpcomingReminders from "./UpcomingReminders";

interface Props {
  vehicle: Vehicle;
  entries: MaintenanceEntry[];
  reminders: Reminder[];
  onOpenReminders?: () => void;
}

/** Stato delle scadenze in una scheda sola, poi tre numeri sugli interventi. */
export default function MaintenanceOverview({ vehicle, entries, reminders, onOpenReminders }: Props) {
  const { t } = useTranslation();
  const { formatMoney, distanceUnit } = useAppSettings();

  const stats = useMemo(() => {
    let overdue = 0;
    let soon = 0;
    for (const reminder of reminders) {
      if (reminder.completed || reminder.vehicleId !== vehicle.id) continue;
      const status = reminderStatus(reminder, vehicle.currentKm);
      if (status === "overdue") overdue++;
      else if (status === "soon") soon++;
    }
    const last = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const year = new Date().getFullYear();
    const yearCost = entries
      .filter((entry) => new Date(entry.date).getFullYear() === year)
      .reduce((sum, entry) => sum + entry.cost, 0);
    return { overdue, soon, last, yearCost };
  }, [entries, reminders, vehicle.id, vehicle.currentKm]);

  const tone = stats.overdue ? "danger" : stats.soon ? "warning" : "ok";
  const title = stats.overdue
    ? stats.soon
      ? t("maintenance.statusOverdueSoon", { overdue: stats.overdue, soon: stats.soon })
      : t("maintenance.statusOverdue", { count: stats.overdue })
    : stats.soon
      ? t("maintenance.statusSoon", { count: stats.soon })
      : t("maintenance.statusOk");

  return (
    <>
      <section className={`mstatus mstatus--${tone}`} aria-label={t("maintenance.overviewTitle", "Stato manutenzione")}>
        <div className="mstatus__head">
          <span className="mstatus__icon" aria-hidden="true">{tone === "ok" ? "✓" : "!"}</span>
          <div>
            <strong>{title}</strong>
            <span>{tone === "ok" ? t("maintenance.noUrgent", "Nessuna scadenza urgente") : t("maintenance.statusHint")}</span>
          </div>
        </div>
        <UpcomingReminders
          vehicles={[vehicle]}
          reminders={reminders}
          distanceUnit={distanceUnit}
          onOpenReminder={() => onOpenReminders?.()}
          variant="attached"
        />
      </section>

      <div className="mtiles">
        <div className="mtile">
          <span>{t("maintenance.thisYear")}</span>
          <b>{formatMoney(stats.yearCost, 0)}</b>
        </div>
        <div className="mtile">
          <span>{t("maintenance.interventions", "Interventi")}</span>
          <b>{entries.length}</b>
        </div>
        <div className="mtile">
          <span>{t("maintenance.lastShort")}</span>
          <b>{stats.last ? t(`maintenanceCategory.${stats.last.category}`) : "—"}</b>
        </div>
      </div>
    </>
  );
}
