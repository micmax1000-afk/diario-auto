import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MaintenanceEntry, Reminder } from "../types";
import { isReminderDue } from "../utils/calculations";
import { useAppSettings } from "../contexts/AppSettingsContext";

interface Props {
  entries: MaintenanceEntry[];
  reminders: Reminder[];
  currentKm: number;
  onOpenReminders?: () => void;
}

export default function MaintenanceOverview({ entries, reminders, currentKm, onOpenReminders }: Props) {
  const { t } = useTranslation();
  const { formatMoney, distanceUnit } = useAppSettings();

  const stats = useMemo(() => {
    const active = reminders.filter((r) => !r.completed);
    let overdue = 0;
    let soon = 0;
    for (const reminder of active) {
      const status = isReminderDue(reminder.dueDate, reminder.dueKm, currentKm);
      if (status === "overdue") overdue++;
      else if (status === "soon") soon++;
    }
    const last = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const year = new Date().getFullYear();
    const yearCost = entries
      .filter((entry) => new Date(entry.date).getFullYear() === year)
      .reduce((sum, entry) => sum + entry.cost, 0);
    return { overdue, soon, active: active.length, last, yearCost };
  }, [entries, reminders, currentKm]);

  return (
    <div className="maintenance-overview" aria-label={t("maintenance.overviewTitle", "Stato manutenzione")}>
      <div className="maintenance-overview__header">
        <div>
          <span className="eyebrow">{t("maintenance.overviewEyebrow", "CONTROLLO VEICOLO")}</span>
          <h3>{t("maintenance.overviewTitle", "Stato manutenzione")}</h3>
        </div>
        {onOpenReminders && (
          <button type="button" className="btn btn--ghost btn--small" onClick={onOpenReminders}>
            {t("maintenance.overviewReminders", "Vedi scadenze")}
          </button>
        )}
      </div>

      <div className="maintenance-overview__grid">
        <div className={`maintenance-overview__status ${stats.overdue ? "is-danger" : stats.soon ? "is-warning" : "is-ok"}`}>
          <span className="maintenance-overview__icon">{stats.overdue ? "!" : stats.soon ? "•" : "✓"}</span>
          <div>
            <strong>{stats.overdue ? t("maintenance.overdue", "Scadute") : stats.soon ? t("maintenance.soon", "In arrivo") : t("maintenance.ok", "Tutto OK")}</strong>
            <span>{stats.overdue ? `${stats.overdue} ${t("maintenance.overdueItems", "da controllare")}` : stats.soon ? `${stats.soon} ${t("maintenance.soonItems", "prossime")}` : t("maintenance.noUrgent", "Nessuna scadenza urgente")}</span>
          </div>
        </div>

        <div className="maintenance-overview__metric">
          <span>{t("maintenance.yearCost", "Speso quest'anno")}</span>
          <strong>{formatMoney(stats.yearCost)}</strong>
        </div>

        <div className="maintenance-overview__metric">
          <span>{t("maintenance.interventions", "Interventi")}</span>
          <strong>{entries.length}</strong>
        </div>

        <div className="maintenance-overview__metric">
          <span>{t("maintenance.activeReminders", "Scadenze attive")}</span>
          <strong>{stats.active}</strong>
        </div>
      </div>

      {stats.last ? (
        <div className="maintenance-overview__last">
          <div>
            <span>{t("maintenance.last", "Ultimo intervento")}</span>
            <strong>{t(`maintenanceCategory.${stats.last.category}`)}</strong>
          </div>
          <div>
            <span>{new Date(stats.last.date).toLocaleDateString()}</span>
            <strong>{stats.last.km.toLocaleString()} {distanceUnit}</strong>
          </div>
          <strong>{formatMoney(stats.last.cost)}</strong>
        </div>
      ) : (
        <div className="maintenance-overview__empty">{t("maintenance.noHistory", "Registra il primo intervento per iniziare a monitorare la manutenzione.")}</div>
      )}
    </div>
  );
}
