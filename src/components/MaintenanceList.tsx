import { useState } from "react";
import type { MaintenanceEntry } from "../types";
import CategoryIcon from "./CategoryIcon";

const CATEGORY_LABELS: Record<string, string> = {
  tagliando: "Tagliando",
  gomme: "Gomme",
  freni: "Freni",
  olio: "Cambio olio",
  batteria: "Batteria (12V/trazione)",
  raffreddamento: "Liquido raffreddamento",
  software: "Aggiornamento software",
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

      <div className="record-list">
        {sorted.map((entry) => (
          <div key={entry.id} className="record-card">
            <div className="record-card__header">
              <CategoryIcon kind="maintenance" category={entry.category} />
              <div className="record-card__title-group">
                <span className="record-card__title">{CATEGORY_LABELS[entry.category] ?? entry.category}</span>
                <span className="record-card__meta">{new Date(entry.date).toLocaleDateString("it-IT")}</span>
              </div>
              <div className="record-card__check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l6 6L20 6" />
                </svg>
              </div>
            </div>
            <div className="record-card__rows">
              <div className="record-card__row">
                <span className="record-card__row-label">Km</span>
                <span className="record-card__row-value mono">{entry.km.toLocaleString("it-IT")}</span>
              </div>
              <div className="record-card__row">
                <span className="record-card__row-label">Costo</span>
                <span className="record-card__row-value mono">
                  € {entry.cost.toFixed(2)}
                  {entry.partsCost !== undefined && entry.laborCost !== undefined && (
                    <span className="cost-breakdown">
                      {" "}
                      (ricambi € {entry.partsCost.toFixed(2)} · manodopera € {entry.laborCost.toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
              {entry.workshop && (
                <div className="record-card__row">
                  <span className="record-card__row-label">Officina</span>
                  <span className="record-card__row-value">{entry.workshop}</span>
                </div>
              )}
            </div>
            <p className="record-card__note">{entry.description}</p>
            <div className="record-card__actions">
              {entry.photo && (
                <button type="button" className="thumb-btn" onClick={() => setZoomPhoto(entry.photo!)}>
                  <img src={entry.photo} alt="Allegato" />
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--danger btn--small" onClick={() => onDelete(entry.id)}>
                Rimuovi
              </button>
            </div>
          </div>
        ))}
      </div>

      {zoomPhoto && (
        <div className="modal-overlay" onClick={() => setZoomPhoto(null)}>
          <img src={zoomPhoto} alt="Allegato ingrandito" className="photo-zoom" />
        </div>
      )}
    </div>
  );
}
