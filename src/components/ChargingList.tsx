import type { ChargingEntry } from "../types";

interface Props {
  entries: ChargingEntry[];
  onEdit: (entry: ChargingEntry) => void;
  onDelete: (id: string) => void;
}

export default function ChargingList({ entries, onEdit, onDelete }: Props) {
  const sorted = [...entries].sort((a, b) => b.km - a.km);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Nessuna ricarica registrata</p>
        <p className="empty-state__body">Aggiungi la prima ricarica per iniziare a tenerne traccia.</p>
      </div>
    );
  }

  const totalKWh = entries.reduce((sum, e) => sum + e.kWh, 0);
  const totalCost = entries.reduce((sum, e) => sum + e.totalCost, 0);
  const avgPrice = totalKWh > 0 ? totalCost / totalKWh : null;

  return (
    <div>
      <div className="stat-row">
        <div className="stat-chip">
          <span className="stat-chip__label">Totale kWh</span>
          <span className="stat-chip__value">{totalKWh.toFixed(1)}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip__label">Totale speso</span>
          <span className="stat-chip__value">€ {totalCost.toFixed(2)}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip__label">Prezzo medio</span>
          <span className="stat-chip__value">{avgPrice !== null ? `€ ${avgPrice.toFixed(3)}/kWh` : "—"}</span>
        </div>
      </div>

      <div className="record-list">
        {sorted.map((entry) => (
          <div key={entry.id} className="record-card">
            <div className="record-card__header">
              <span className="record-card__title">
                {entry.location ?? "Ricarica"}
                {entry.atHome && <span style={{ opacity: 0.7 }}> · Casa</span>}
              </span>
              <span className="record-card__meta">{new Date(entry.date).toLocaleDateString("it-IT")}</span>
            </div>
            <div className="record-card__rows">
              <div className="record-card__row">
                <span className="record-card__row-label">Km</span>
                <span className="record-card__row-value mono">{entry.km.toLocaleString("it-IT")}</span>
              </div>
              <div className="record-card__row">
                <span className="record-card__row-label">kWh</span>
                <span className="record-card__row-value mono">{entry.kWh}</span>
              </div>
              <div className="record-card__row">
                <span className="record-card__row-label">€/kWh</span>
                <span className="record-card__row-value mono">{entry.pricePerKWh.toFixed(3)}</span>
              </div>
              <div className="record-card__row">
                <span className="record-card__row-label">Costo</span>
                <span className="record-card__row-value mono">€ {entry.totalCost.toFixed(2)}</span>
              </div>
              {entry.powerKW !== undefined && (
                <div className="record-card__row">
                  <span className="record-card__row-label">Potenza</span>
                  <span className="record-card__row-value mono">{entry.powerKW} kW</span>
                </div>
              )}
            </div>
            {entry.notes && <p className="record-card__note">{entry.notes}</p>}
            <div className="record-card__actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={() => onEdit(entry)}>
                Modifica
              </button>
              <button type="button" className="btn btn--ghost btn--danger btn--small" onClick={() => onDelete(entry.id)}>
                Rimuovi
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
