import { useTranslation } from "react-i18next";
import type { Reminder } from "../types";
import { isReminderDue } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";

interface Props {
  reminders: Reminder[];
  currentKm: number;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ReminderList({ reminders, currentKm, onToggleComplete, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();
  const active = reminders.filter((r) => !r.completed);
  const completed = reminders.filter((r) => r.completed);

  const STATUS_LABELS: Record<string, string> = {
    overdue: t("reminders.statusOverdue"),
    soon: t("reminders.statusSoon"),
    ok: t("reminders.statusOk"),
  };

  const sorted = [...active].sort((a, b) => {
    const statusA = isReminderDue(a.dueDate, a.dueKm, currentKm);
    const statusB = isReminderDue(b.dueDate, b.dueKm, currentKm);
    const rank = { overdue: 0, soon: 1, ok: 2 };
    return rank[statusA] - rank[statusB];
  });

  if (reminders.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("reminders.emptyTitle")}</p>
        <p className="empty-state__body">{t("reminders.emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="reminder-list">
      {sorted.map((reminder) => {
        const status = isReminderDue(reminder.dueDate, reminder.dueKm, currentKm);
        return (
          <div key={reminder.id} className={`reminder-item reminder-item--${status}`}>
            <div className="reminder-item__badge">{STATUS_LABELS[status]}</div>
            <div className="reminder-item__body">
              <span className="reminder-item__label">{reminder.label}</span>
              <span className="reminder-item__due">
                {reminder.dueDate
                  ? new Date(reminder.dueDate).toLocaleDateString(getNumberLocale(i18n.language))
                  : `${kmToDisplayDistance(reminder.dueKm ?? 0, distanceUnit).toLocaleString(getNumberLocale(i18n.language), { maximumFractionDigits: 0 })} ${distanceUnit}`}
              </span>
              {reminder.notes && <span className="reminder-item__notes">{reminder.notes}</span>}
            </div>
            <div className="reminder-item__actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={() => onToggleComplete(reminder.id)}>
                {t("reminders.done")}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--danger btn--small"
                onClick={() => onDelete(reminder.id)}
              >
                {t("reminders.remove")}
              </button>
            </div>
          </div>
        );
      })}

      {completed.length > 0 && (
        <details className="reminder-completed">
          <summary>{t("reminders.completed", { count: completed.length })}</summary>
          {completed.map((reminder) => (
            <div key={reminder.id} className="reminder-item reminder-item--completed">
              <div className="reminder-item__body">
                <span className="reminder-item__label">{reminder.label}</span>
              </div>
              <div className="reminder-item__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => onToggleComplete(reminder.id)}
                >
                  {t("reminders.reactivate")}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--danger btn--small"
                  onClick={() => onDelete(reminder.id)}
                >
                  {t("reminders.remove")}
                </button>
              </div>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
