import { useTranslation } from "react-i18next";
import type { Reminder } from "../types";
import { isReminderDue } from "../utils/calculations";

type LightId = "oil" | "battery" | "coolant" | "brake" | "tires" | "wrench";
type LightStatus = "off" | "amber" | "red";

// Collega le voci del catalogo scadenze (REMINDER_CATALOG) alle spie del
// cruscotto: solo le scadenze create dal catalogo (o con lo stesso
// catalogKey) accendono una spia specifica — quelle personalizzate scritte
// a mano restano "non categorizzate" e non accendono nulla, per evitare di
// far finta di sapere una categoria che l'utente non ha indicato.
const CATALOG_KEY_TO_LIGHT: Record<string, LightId> = {
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

const LIGHT_ORDER: LightId[] = ["oil", "battery", "coolant", "brake", "tires", "wrench"];

const LIGHT_ICONS: Record<LightId, string> = {
  oil: "M12 3c2.5 3 5 6.2 5 9.5a5 5 0 0 1-10 0C7 9.2 9.5 6 12 3z",
  battery: "M4 9h13v7H4zM17 11h2.5v3H17zM8 9V7h2v2zM12 9V7h2v2z",
  coolant: "M11 3h2v10.3a3.5 3.5 0 1 1-2 0V3zm1 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  brake: "M12 2 2 20h20L12 2zm0 6 1 7h-2l1-7zm0 9.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z",
  tires: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5.5 5.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-8-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm2.5 4.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  wrench: "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z",
};

interface Props {
  reminders: Reminder[]; // già filtrate per il veicolo
  currentKm: number;
}

function computeLightStatuses(reminders: Reminder[], currentKm: number): Record<LightId, LightStatus> {
  const statuses: Record<LightId, LightStatus> = {
    oil: "off", battery: "off", coolant: "off", brake: "off", tires: "off", wrench: "off",
  };

  for (const r of reminders) {
    if (r.completed || !r.catalogKey) continue;
    const light = CATALOG_KEY_TO_LIGHT[r.catalogKey];
    if (!light) continue;
    const due = isReminderDue(r.dueDate, r.dueKm, currentKm);
    if (due === "overdue") {
      statuses[light] = "red";
    } else if (due === "soon" && statuses[light] !== "red") {
      statuses[light] = "amber";
    }
  }

  return statuses;
}

export default function VehicleDashboardCluster({ reminders, currentKm }: Props) {
  const { t } = useTranslation();
  const statuses = computeLightStatuses(reminders, currentKm);
  const anyActive = LIGHT_ORDER.some((id) => statuses[id] !== "off");

  return (
    <div className={`dash-cluster ${anyActive ? "" : "dash-cluster--all-clear"}`} title={t("dashCluster.title")}>
      {LIGHT_ORDER.map((id) => (
        <div
          key={id}
          className={`dash-cluster__light dash-cluster__light--${statuses[id]}`}
          title={t(`dashCluster.${id}`)}
        >
          <svg viewBox="0 0 24 24">
            <path d={LIGHT_ICONS[id]} />
          </svg>
        </div>
      ))}
    </div>
  );
}
