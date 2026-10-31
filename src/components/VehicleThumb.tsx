import type { Vehicle } from "../types";
import { vehicleVisual } from "../utils/carImages";

/**
 * Miniatura del veicolo: la sua foto, altrimenti l'immagine del tipo di
 * carrozzeria. Se non c'è nessuna delle due non mostra nulla.
 */
export default function VehicleThumb({ vehicle, className }: { vehicle: Pick<Vehicle, "photo" | "bodyType">; className: string }) {
  const visual = vehicleVisual(vehicle);
  if (!visual) return null;
  return (
    <span className={`${className}${visual.isPhoto ? "" : " is-cut"}`}>
      <img src={visual.src} alt="" />
    </span>
  );
}
