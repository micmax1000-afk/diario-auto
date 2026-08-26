import type { ReactElement } from "react";

type IconTint = "amber" | "cyan" | "purple";

interface Props {
  category: string;
  kind: "maintenance" | "fuel" | "charging" | "expense";
  size?: "default" | "small";
}

const MAINTENANCE_ICONS: Record<string, ReactElement> = {
  tagliando: (
    <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z" />
  ),
  gomme: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.1 7.1l1.4 1.4M15.5 15.5l1.4 1.4M16.9 7.1l-1.4 1.4M8.5 15.5l-1.4 1.4" />
    </>
  ),
  freni: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  olio: <path d="M12 3c2.5 3 5 6.2 5 9.5a5 5 0 0 1-10 0C7 9.2 9.5 6 12 3z" />,
  batteria: (
    <>
      <rect x="4" y="8" width="14" height="9" rx="1.5" />
      <path d="M18 11h2v3h-2" />
      <path d="M9 11v3M12 11v3" />
    </>
  ),
  raffreddamento: (
    <>
      <path d="M12 3v18M6 7l12 10M18 7L6 17" />
    </>
  ),
  software: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </>
  ),
  carrozzeria: (
    <>
      <path d="M4 15l1.5-5A2 2 0 0 1 7.4 8.5h9.2A2 2 0 0 1 18.5 10l1.5 5" />
      <rect x="3" y="15" width="18" height="4" rx="1.5" />
      <circle cx="7.5" cy="19" r="1.3" />
      <circle cx="16.5" cy="19" r="1.3" />
    </>
  ),
  revisione: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 3.5h6M8 10l2 2 4-4M8 16h6" />
    </>
  ),
  altro: (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
};

const FUEL_ICONS: Record<string, ReactElement> = {
  benzina: (
    <>
      <path d="M5 20V6a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 13 6v14" />
      <path d="M4 20h10M13 10h1.8L17 12.2V17a1.5 1.5 0 0 1-1.5 1.5" />
      <path d="M13 7h1.5L17 9.5" />
    </>
  ),
  diesel: (
    <>
      <path d="M5 20V6a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 13 6v14" />
      <path d="M4 20h10M13 10h1.8L17 12.2V17a1.5 1.5 0 0 1-1.5 1.5" />
      <path d="M13 7h1.5L17 9.5" />
    </>
  ),
  gpl: (
    <>
      <path d="M12 3c2.5 3 5 6.2 5 9.5a5 5 0 0 1-10 0C7 9.2 9.5 6 12 3z" />
    </>
  ),
  metano: (
    <>
      <rect x="7" y="4" width="10" height="16" rx="5" />
      <path d="M9 9h6" />
    </>
  ),
  elettrico: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />,
  ibrido: (
    <>
      <path d="M12 3c4 3 7 6.5 7 10.5A7 7 0 0 1 5 13.5C5 9.5 8 6 12 3z" />
      <path d="M9.5 14.5c1 .8 2 .8 3-1 .8-1.4 1.5-.5 2-.2" />
    </>
  ),
};

const CHARGING_ICON = <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />;

const EXPENSE_ICONS: Record<string, ReactElement> = {
  assicurazione: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
  bollo: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  multa: (
    <>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4M12 17v.01" />
    </>
  ),
  documenti: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
    </>
  ),
  altro: (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
};

function tintFor(kind: Props["kind"]): IconTint {
  if (kind === "charging") return "cyan";
  if (kind === "expense") return "purple";
  return "amber";
}

function iconFor(kind: Props["kind"], category: string): ReactElement {
  if (kind === "charging") return CHARGING_ICON;
  const table = kind === "maintenance" ? MAINTENANCE_ICONS : kind === "fuel" ? FUEL_ICONS : EXPENSE_ICONS;
  return table[category] ?? table.altro ?? <circle cx="12" cy="12" r="6" />;
}

export default function CategoryIcon({ category, kind, size = "default" }: Props) {
  const tint = tintFor(kind);
  const sizeClass = size === "small" ? " record-card__icon--sm" : "";
  return (
    <div className={`record-card__icon record-card__icon--${tint}${sizeClass}`}>
      <svg viewBox="0 0 24 24">{iconFor(kind, category)}</svg>
    </div>
  );
}
