import type { Vehicle } from "../types";

const FUEL_LABELS: Record<Vehicle["fuelType"], string> = {
  benzina: "Benzina",
  diesel: "Diesel",
  gpl: "GPL",
  metano: "Metano",
  elettrico: "Elettrico",
  ibrido: "Ibrido",
};

interface Props {
  vehicle: Vehicle;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onQuickKm: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function VehicleCard({ vehicle, onOpen, onEdit, onQuickKm, onDelete }: Props) {
  return (
    <article className="vehicle-card">
      <button
        type="button"
        className="vehicle-card__stamp"
        onClick={() => onQuickKm(vehicle.id)}
        title="Aggiorna chilometraggio"
      >
        <span className="vehicle-card__stamp-km">{vehicle.currentKm.toLocaleString("it-IT")}</span>
        <span className="vehicle-card__stamp-unit">km</span>
      </button>

      <header className="vehicle-card__header" onClick={() => onOpen(vehicle.id)} role="button" tabIndex={0}>
        <h3 className="vehicle-card__name">{vehicle.name}</h3>
        {vehicle.year && <span className="vehicle-card__year">{vehicle.year}</span>}
      </header>

      <dl className="vehicle-card__facts">
        <div className="vehicle-card__fact">
          <dt>Alimentazione</dt>
          <dd>{FUEL_LABELS[vehicle.fuelType]}</dd>
        </div>
        {vehicle.plate && (
          <div className="vehicle-card__fact">
            <dt>Targa</dt>
            <dd>{vehicle.plate}</dd>
          </div>
        )}
      </dl>

      {vehicle.notes && <p className="vehicle-card__notes">{vehicle.notes}</p>}

      <footer className="vehicle-card__footer">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => onOpen(vehicle.id)}>
          Apri
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => onEdit(vehicle.id)}>
          Modifica
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--danger btn--small"
          onClick={() => onDelete(vehicle.id)}
        >
          Segna come venduto
        </button>
      </footer>
    </article>
  );
}
