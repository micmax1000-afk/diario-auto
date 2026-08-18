import { useState } from "react";
import type { ExpenseEntry } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  assicurazione: "Assicurazione",
  bollo: "Bollo",
  multa: "Multa",
  documenti: "Documenti",
  altro: "Altro",
};

interface Props {
  entries: ExpenseEntry[];
  onDelete: (id: string) => void;
}

export default function ExpenseList({ entries, onDelete }: Props) {
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Nessuna spesa registrata</p>
        <p className="empty-state__body">
          Registra assicurazione, bollo, multe e altri documenti separatamente dalla manutenzione.
        </p>
      </div>
    );
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  return (
    <div>
      <div className="stat-row">
        <div className="stat-chip">
          <span className="stat-chip__label">Totale</span>
          <span className="stat-chip__value">€ {totalAmount.toFixed(2)}</span>
        </div>
        {Object.entries(byCategory).map(([cat, amount]) => (
          <div className="stat-chip" key={cat}>
            <span className="stat-chip__label">{CATEGORY_LABELS[cat] ?? cat}</span>
            <span className="stat-chip__value">€ {amount.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="record-list">
        {sorted.map((entry) => (
          <div key={entry.id} className="record-card">
            <div className="record-card__header">
              <span className="record-card__title">{CATEGORY_LABELS[entry.category] ?? entry.category}</span>
              <span className="record-card__meta">{new Date(entry.date).toLocaleDateString("it-IT")}</span>
            </div>
            <div className="record-card__rows">
              <div className="record-card__row">
                <span className="record-card__row-label">Importo</span>
                <span className="record-card__row-value mono">€ {entry.amount.toFixed(2)}</span>
              </div>
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
