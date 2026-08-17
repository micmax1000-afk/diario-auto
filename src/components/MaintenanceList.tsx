import { useState } from "react";
import type { MaintenanceEntry } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  tagliando: "Tagliando",
  gomme: "Gomme",
  freni: "Freni",
  olio: "Cambio olio",
  batteria: "Batteria",
  carrozzeria: "Carrozzeria",
  revisione: "Revisione",
  altro: "Altro",
};

interface Props {
  entries: MaintenanceEntry[];
  onDelete: (id: string) => void;
}

export default function MaintenanceList({ entries, onDelete }: Props) {
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const sorted = [...entries].sort((a, b) => b.km - a.km);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Nessuna manutenzione registrata</p>
        <p className="empty-state__body">Aggiungi un intervento per iniziare a tenerne traccia.</p>
      </div>
    );
  }

  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);

  return (
    <div>
      <div className="stat-row">
        <div className="stat-chip">
          <span className="stat-chip__label">Totale speso</span>
          <span className="stat-chip__value">€ {totalCost.toFixed(2)}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip__label">Interventi</span>
          <span className="stat-chip__value">{entries.length}</span>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Km</th>
            <th>Categoria</th>
            <th>Descrizione</th>
            <th>Officina</th>
            <th>Costo</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.date).toLocaleDateString("it-IT")}</td>
              <td className="mono">{entry.km.toLocaleString("it-IT")}</td>
              <td>{CATEGORY_LABELS[entry.category] ?? entry.category}</td>
              <td>{entry.description}</td>
              <td>{entry.workshop ?? "—"}</td>
              <td className="mono">
                € {entry.cost.toFixed(2)}
                {entry.partsCost !== undefined && entry.laborCost !== undefined && (
                  <span className="cost-breakdown">
                    ricambi € {entry.partsCost.toFixed(2)} · manodopera € {entry.laborCost.toFixed(2)}
                  </span>
                )}
              </td>
              <td>
                {entry.photo && (
                  <button type="button" className="thumb-btn" onClick={() => setZoomPhoto(entry.photo!)}>
                    <img src={entry.photo} alt="Allegato" />
                  </button>
                )}
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
          ))}
        </tbody>
      </table>

      {zoomPhoto && (
        <div className="modal-overlay" onClick={() => setZoomPhoto(null)}>
          <img src={zoomPhoto} alt="Allegato ingrandito" className="photo-zoom" />
        </div>
      )}
    </div>
  );
}
