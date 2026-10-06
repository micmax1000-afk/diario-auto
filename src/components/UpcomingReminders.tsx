import { useTranslation } from "react-i18next";
import type { Reminder, Vehicle } from "../types";
import { isReminderDue } from "../utils/calculations";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance, type DistanceUnit } from "../utils/settings";

type LightId = "oil" | "battery" | "coolant" | "brake" | "tires" | "wrench";

const CATALOG_KEY_TO_ICON: Record<string, LightId> = {
  oilFilter: "oil",
  periodicService: "wrench",
  seasonalTires: "tires",
  cabinFilter: "wrench",
  airFilter: "wrench",
  brakeFluid: "brake",
  sparkPlugs: "wrench",
  timingBelt: "wrench",
  fuelFilter: "wrench",
  inspection: "wrench",
  coolant: "coolant",
  battery: "battery",
};

const ICON_PATHS: Record<LightId, string> = {
  oil: "M12 3c2.5 3 5 6.2 5 9.5a5 5 0 0 1-10 0C7 9.2 9.5 6 12 3z",
  battery: "M4 9h13v7H4zM17 11h2.5v3H17zM8 9V7h2v2zM12 9V7h2v2z",
  coolant: "M11 3h2v10.3a3.5 3.5 0 1 1-2 0V3zm1 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  brake: "M12 2 2 20h20L12 2zm0 6 1 7h-2l1-7zm0 9.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z",
  tires: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5.5 5.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-8-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm2.5 4.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  wrench: "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z",
};
const CLIPBOARD_PATH = "M9 3h6a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1V4a1 1 0 0 1 1-1zm0 2v1h6V5H9zm-1 4h8v2H8V9zm0 4h8v2H8v-2z";

interface RowData {
  key: string;
  icon: LightId | "clipboard";
  label: string;
  status: "overdue" | "soon" | "ok";
  progress: number; // 0-100, quanta "strada" resta prima della scadenza (100 = appena fatta, 0 = scaduta)
  remainingText: string;
}

function buildRow(r: Reminder, vehicle: Vehicle | undefined, locale: string, t: (k: string, o?: Record<string, unknown>) => string, distanceUnit: DistanceUnit): RowData | null {
  if (!vehicle || r.completed) return null;
  const status = isReminderDue(r.dueDate, r.dueKm, vehicle.currentKm);
  if (status === "ok") return null;

  const icon: LightId | "clipboard" = (r.catalogKey && CATALOG_KEY_TO_ICON[r.catalogKey]) || "clipboard";

  let progress = 40;
  let remainingText = r.label;

  if (r.type === "km" && r.dueKm != null) {
    const remaining = r.dueKm - vehicle.currentKm;
    const remainingDisplay = kmToDisplayDistance(remaining, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 });
    remainingText = remaining > 0
      ? t("dashboardGarage.reminderInKm", { label: "", km: `${remainingDisplay} ${distanceUnit}` }).trim()
      : t("dashboardGarage.reminderOverdue", { label: "" }).trim();
    const warningKm = 1000;
    progress = Math.max(0, Math.min(100, (remaining / warningKm) * 100));
  } else if (r.type === "data" && r.dueDate) {
    const diffDays = (new Date(r.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    remainingText = diffDays > 0
      ? t("dashboardGarage.reminderInDays", { days: Math.ceil(diffDays) })
      : t("dashboardGarage.reminderOverdue", { label: "" }).trim();
    const warningDays = 30;
    progress = Math.max(0, Math.min(100, (diffDays / warningDays) * 100));
  }

  return { key: r.id, icon, label: r.label, status, progress, remainingText };
}

interface Props {
  vehicles: Vehicle[];
  reminders: Reminder[];
  distanceUnit: DistanceUnit;
  onOpenReminder: (id: string) => void;
  onViewAll: () => void;
  limit?: number;
}

export default function UpcomingReminders({ vehicles, reminders, distanceUnit, onOpenReminder, onViewAll, limit = 5 }: Props) {
  const { t, i18n } = useTranslation();
  const locale = getNumberLocale(i18n.language);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  const rows = reminders
    .map((r) => buildRow(r, vehicleById.get(r.vehicleId), locale, t, distanceUnit))
    .filter((r): r is RowData => r !== null)
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return 1;
      return a.progress - b.progress;
    })
    .slice(0, limit);

  if (rows.length === 0) return null;

  return (
    <section className="upcoming-reminders">
      <div className="upcoming-reminders__head">
        <h2>{t("dashboardGarage.upcomingDeadlines", "Scadenze in arrivo")}</h2>
        <button type="button" className="dash-link" onClick={onViewAll}>
          {t("dashboardGarage.viewAll", "Vedi tutte")}
        </button>
      </div>
      <ul className="upcoming-reminders__list">
        {rows.map((row) => (
          <li key={row.key} className="upcoming-reminders__item" onClick={() => onOpenReminder(row.key)}>
            <span className={`upcoming-reminders__icon upcoming-reminders__icon--${row.status}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d={row.icon === "clipboard" ? CLIPBOARD_PATH : ICON_PATHS[row.icon]} />
              </svg>
            </span>
            <div className="upcoming-reminders__body">
              <span className="upcoming-reminders__label">{row.label}</span>
              <div className={`upcoming-reminders__bar upcoming-reminders__bar--${row.status}`}>
                <div className="upcoming-reminders__bar-fill" style={{ width: `${Math.max(6, 100 - row.progress)}%` }} />
              </div>
            </div>
            <span className="upcoming-reminders__remaining">{row.remainingText}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="upcoming-reminders__chevron">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </li>
        ))}
      </ul>
    </section>
  );
}
