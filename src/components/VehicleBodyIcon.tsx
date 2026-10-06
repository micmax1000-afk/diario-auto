import type { BodyType } from "../types";

interface Props {
  bodyType: BodyType;
  className?: string;
}

// Silhouette laterali stilizzate, disegnate a mano per essere chiaramente
// distinguibili tra loro pur restando semplici: non sono foto di nessun
// modello/produttore, solo forme geometriche generiche per categoria.
const PATHS: Record<BodyType, string> = {
  citycar:
    "M4 15.5c0-1 .6-1.8 1.5-2.1L7 12.8l1.4-2.3c.3-.5.9-.8 1.5-.8h4.2c.6 0 1.2.3 1.5.8l1.4 2.3 1.5.6c.9.3 1.5 1.1 1.5 2.1v1.5c0 .5-.4 1-1 1h-1a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H5c-.6 0-1-.5-1-1z",
  hatchback:
    "M3 15.5c0-.9.5-1.7 1.4-2l1.8-.6 1.6-2.6c.3-.5.9-.8 1.5-.8h5.4c.7 0 1.3.4 1.6 1l1.3 2.4 1.8.6c.9.3 1.6 1.1 1.6 2v1.5c0 .5-.4 1-1 1h-1a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H4c-.6 0-1-.5-1-1z",
  sedan:
    "M3 15.5c0-.9.4-1.6 1.2-1.9l2-.7.9-2.4c.3-.7 1-1.2 1.7-1.2h6.4c.7 0 1.4.5 1.7 1.2l.9 2.4 2 .7c.8.3 1.2 1 1.2 1.9v1.5c0 .5-.4 1-1 1h-1a2 2 0 1 1-4 0h-4a2 2 0 1 1-4 0H4c-.6 0-1-.5-1-1z",
  suv: "M3 16c0-1 .6-1.9 1.5-2.2l1.7-.5 1-2.7c.3-.8 1-1.3 1.9-1.3h6.8c.8 0 1.6.5 1.9 1.3l1 2.7 1.7.5c.9.3 1.5 1.2 1.5 2.2v1.3c0 .5-.4 1-1 1h-1.2a2.2 2.2 0 1 1-4.4 0H9.6a2.2 2.2 0 1 1-4.4 0H4c-.6 0-1-.5-1-1z",
  pickup:
    "M3 16c0-.9.5-1.6 1.3-1.9l1.5-.5.9-2.4c.3-.6.9-1 1.6-1h3.2c.7 0 1.3.4 1.6 1l.7 1.8h4.2c.6 0 1 .4 1 1v2c0 .5-.4 1-1 1h-1.2a2 2 0 1 1-4 0H9.2a2 2 0 1 1-4 0H4c-.6 0-1-.5-1-1z",
  van: "M3 16.3c0-.9.6-1.7 1.5-1.9l.5-.1V9.8c0-.7.6-1.3 1.3-1.3h8.4c.7 0 1.3.6 1.3 1.3v4.5h1c.6 0 1 .4 1 1v1.5c0 .5-.4 1-1 1h-1.2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H4c-.6 0-1-.4-1-1z",
  coupe:
    "M3 15.5c0-.8.4-1.5 1.1-1.8l1.6-.7 2-2.6c.3-.4.8-.6 1.3-.6h4.6c.6 0 1.1.3 1.4.8l1.5 2.5 1.6.6c.8.3 1.3 1 1.3 1.8v1.5c0 .5-.4 1-1 1h-1a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H4c-.6 0-1-.5-1-1z",
  wagon:
    "M3 15.5c0-.8.4-1.5 1.1-1.8l1-.3.9-2.5c.3-.7 1-1.2 1.7-1.2h7.3v-.4c0-.7.6-1.3 1.3-1.3h.7c.7 0 1.3.6 1.3 1.3v4.6h.7c.6 0 1 .4 1 1v1.6c0 .5-.4 1-1 1h-1a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H4c-.6 0-1-.5-1-1z",
};

export default function VehicleBodyIcon({ bodyType, className }: Props) {
  return (
    <svg viewBox="0 0 22 20" className={className} fill="currentColor" aria-hidden="true">
      <path d={PATHS[bodyType]} />
    </svg>
  );
}
