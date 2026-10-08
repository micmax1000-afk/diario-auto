import type { Vehicle } from "../types";
import VehicleBodyIcon from "./VehicleBodyIcon";

interface Props {
  vehicles: Vehicle[];
  currentId: string | null;
  colors: Record<string, string>;
  urgentCounts?: Record<string, number>;
  onSelect: (vehicleId: string) => void;
  /** Voce iniziale facoltativa (es. "Tutti" nelle statistiche). */
  leading?: { label: string; active: boolean; onClick: () => void; badge?: string };
}

/** Fascia orizzontale per passare da un veicolo all'altro senza tornare al garage. */
export default function VehicleSwitcher({ vehicles, currentId, colors, urgentCounts, onSelect, leading }: Props) {
  if (vehicles.length < 2) return null;
  return (
    <div className="vswitch" role="tablist">
      {leading && (
        <button
          type="button"
          role="tab"
          aria-selected={leading.active}
          className={`vswitch__chip${leading.active ? " is-on" : ""}`}
          style={{ ["--c" as string]: "var(--amber)" }}
          onClick={leading.onClick}
        >
          <span className="vswitch__thumb">☰</span>
          {leading.label}
          {leading.badge && <span className="vswitch__pro">{leading.badge}</span>}
        </button>
      )}
      {vehicles.map((v) => {
        const urgent = urgentCounts?.[v.id] ?? 0;
        const active = !leading?.active && v.id === currentId;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`vswitch__chip${active ? " is-on" : ""}`}
            style={{ ["--c" as string]: colors[v.id] }}
            onClick={() => onSelect(v.id)}
          >
            <span className="vswitch__thumb" style={v.photo ? { backgroundImage: `url(${v.photo})` } : undefined}>
              {!v.photo && <VehicleBodyIcon bodyType={v.bodyType ?? "hatchback"} className="vswitch__icon" />}
            </span>
            <span className="vswitch__name">{v.name}</span>
            {urgent > 0 && <span className="vswitch__badge">{urgent}</span>}
          </button>
        );
      })}
    </div>
  );
}
