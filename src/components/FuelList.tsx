import type { FuelEntry } from "../types";
import { calculateConsumption, averageConsumption } from "../utils/calculations";

interface Props {
  entries: FuelEntry[];
  onDelete: (id: string) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  benzina: "Benzina",
  diesel: "Diesel",
  gpl: "GPL",
  metano: "Metano",
  elettrico: "Elettrico",
};

export default function FuelList({ entries, onDelete }: Props) {
  const sorted = [...entries].sort((a, b) => b.km - a.km);
  const points = calculateConsumption(entries);

  const sources = Array.from(new Set(entries.map((e) => e.source)));

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Nessun rifornimento registrato</p>
        <p className="empty-state__body">
          Aggiungi il primo rifornimento per iniziare a calcolare il consumo medio.
        </p>
      </div>
    );
  }

  return (
    <div>
      {sources.length > 0 && (
        <div className="stat-row">
          {sources.map((source) => {
            const avg = averageConsumption(points, source);
            return (
              <div className="stat-chip" key={source}>
                <span className="stat-chip__label">{SOURCE_LABELS[source] ?? source}</span>
                <span className="stat-chip__value">
                  {avg !== null ? `${avg.toFixed(1)} km/l` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Km</th>
            <th>Alimentazione</th>
            <th>Quantità</th>
            <th>Costo</th>
            <th>Consumo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => {
            const point = points.find((p) => p.toKm === entry.km);
            return (
              <tr key={entry.id}>
                <td>{new Date(entry.date).toLocaleDateString("it-IT")}</td>
                <td className="mono">{entry.km.toLocaleString("it-IT")}</td>
                <td>{SOURCE_LABELS[entry.source] ?? entry.source}</td>
                <td className="mono">
                  {entry.liters} {entry.source === "elettrico" ? "kWh" : "L"}
                </td>
                <td className="mono">€ {entry.totalCost.toFixed(2)}</td>
                <td className="mono">
                  {point ? `${point.kmPerLiter.toFixed(1)} km/l` : entry.fullTank ? "—" : "parziale"}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger btn--small"
                    onClick={() => onDelete(entry.id)}
                  >
                    Rimuovi
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
