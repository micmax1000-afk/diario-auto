import { useTranslation } from "react-i18next";
import type { Reminder } from "../types";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { estimateDateForKm, getKmPerDay, reminderStatus } from "../utils/kmForecast";
import { formatForecastDate } from "../utils/dates";

interface Props {
  reminders: Reminder[];
  currentKm: number;
  onToggleComplete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
}

export default function ReminderList({ reminders, currentKm, onToggleComplete, onEdit, onDelete }: Props) {
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
    const statusA = reminderStatus(a, currentKm);
    const statusB = reminderStatus(b, currentKm);
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
        const status = reminderStatus(reminder, currentKm);
        return (
          <div
            key={reminder.id}
            className={`reminder-item reminder-item--${status} reminder-item--tappable`}
            role="button"
            tabIndex={0}
            aria-label={t("common.edit")}
            onClick={() => onEdit(reminder)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit(reminder);
              }
            }}
          >
            <span className={`reminder-item__dot reminder-item__dot--${status}`} aria-hidden="true">
              {status === "ok" ? "✓" : "!"}
            </span>
            <div className="reminder-item__body">
              <span className="reminder-item__label">
                {reminder.label}
                <span className={`reminder-item__badge reminder-item__badge--${status}`}>{STATUS_LABELS[status]}</span>
              </span>
              <span className="reminder-item__due">
                {reminder.dueDate
                  ? new Date(reminder.dueDate).toLocaleDateString(getNumberLocale(i18n.language))
                  : `${kmToDisplayDistance(reminder.dueKm ?? 0, distanceUnit).toLocaleString(getNumberLocale(i18n.language), { maximumFractionDigits: 0 })} ${distanceUnit}`}
              </span>
              {reminder.dueKm !== undefined && !reminder.dueDate && reminder.dueKm > currentKm && (
                <span className="reminder-item__forecast">
                  {(() => {
                    const locale = getNumberLocale(i18n.language);
                    const km = `${kmToDisplayDistance(reminder.dueKm - currentKm, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} ${distanceUnit}`;
                    const date = estimateDateForKm(reminder.dueKm, currentKm, getKmPerDay(reminder.vehicleId));
                    return date
                      ? t("reminders.kmForecast", { km, date: formatForecastDate(date, locale) })
                      : t("reminders.kmRemaining", { km });
                  })()}
                </span>
              )}
              {reminder.notes && <span className="reminder-item__notes">{reminder.notes}</span>}
            </div>
            <div className="reminder-item__actions">
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete(reminder.id);
                }}
              >
                {t("reminders.done")}
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
