import type { ReactElement } from "react";
import type { CommuteFuelType } from "../types";

/** Voci del costo del tragitto e tipi di scenario: icone a linea come nel resto dell'app. */
export type CommuteIconName = CommuteFuelType | "fuel" | "energy" | "toll" | "parking" | "other" | "fixed" | "car";

const pump = (
  <>
    <path d="M5 20V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15M3.5 20h12M5 10h9" />
    <path d="M14 8h1.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-3-3" />
  </>
);
const bolt = <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3z" />;

const ICONS: Record<CommuteIconName, ReactElement> = {
  fuel: pump,
  benzina: pump,
  diesel: pump,
  energy: bolt,
  elettrico: bolt,
  toll: (
    <>
      <path d="M7 21 10 3M17 21 14 3" />
      <path d="M12 6v2M12 11v2M12 16v2" />
    </>
  ),
  parking: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M10 16.5v-9h3a2.75 2.75 0 0 1 0 5.5h-3" />
    </>
  ),
  other: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  fixed: <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z" />,
  car: (
    <>
      <path d="M4 15l1.5-5A2 2 0 0 1 7.4 8.5h9.2A2 2 0 0 1 18.5 10l1.5 5" />
      <rect x="3" y="15" width="18" height="4" rx="1.5" />
      <circle cx="7.5" cy="19" r="1.3" />
      <circle cx="16.5" cy="19" r="1.3" />
    </>
  ),
  gpl: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2-4.6.3 1.6 1 2.6 2 3.1C11 8.5 11 6 12 3z" />,
  metano: (
    <>
      <path d="M4 9h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M4 13h15a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M4 17h7" />
    </>
  ),
  ibrido: (
    <>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
      <path d="M5 19 13 11" />
    </>
  ),
  ibrido_plugin: (
    <>
      <path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7z" />
      <path d="M12 16v5" />
    </>
  ),
  mezzi: (
    <>
      <rect x="5" y="3.5" width="14" height="13" rx="3" />
      <path d="M5 10.5h14M9 20l-2 1.5M15 20l2 1.5M8.5 16.5 7 20h10l-1.5-3.5" />
      <circle cx="9" cy="13.5" r=".6" />
      <circle cx="15" cy="13.5" r=".6" />
    </>
  ),
  carpooling: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.3A5.5 5.5 0 0 1 20.5 20" />
    </>
  ),
  bici: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16 9.5 9h6L18 16M9.5 9 12 16h-6M14 6.5h2.5" />
    </>
  ),
};

export default function CommuteIcon({ name, className = "commute-icon" }: { name: CommuteIconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
