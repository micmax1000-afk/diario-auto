interface Props {
  /** Valore attuale; se assente il quadrante mostra "—" e nessun arco di progresso. */
  value?: number;
  /** Fondo scala del quadrante. */
  max: number;
  label: string;
  unit: string;
  /** Frazione (0-1) da cui inizia la zona rossa, es. 0.86 per i giri motore. */
  redFrom?: number;
}

const CX = 90;
const CY = 84;
const R = 62;

// Angoli in gradi: 180 = estrema sinistra, 0 = estrema destra, passando dall'alto.
function point(angle: number, radius: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY - radius * Math.sin(rad)];
}

function arcPath(fromAngle: number, toAngle: number): string {
  const [x0, y0] = point(fromAngle, R);
  const [x1, y1] = point(toAngle, R);
  const large = Math.abs(fromAngle - toAngle) > 180 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

/** Quadrante a mezzaluna, nello stile dell'icona dell'app: traccia, arco ambra, zona rossa e tacche. */
export default function ArcGauge({ value, max, label, unit, redFrom }: Props) {
  const fraction = value === undefined ? 0 : Math.min(Math.max(value / max, 0), 1);
  const ticks = Array.from({ length: 11 }, (_, i) => 180 - i * 18);

  return (
    <div className="arc-gauge" role="img" aria-label={`${label}: ${value !== undefined ? Math.round(value) : "—"} ${unit}`}>
      <svg viewBox="0 0 180 128" aria-hidden="true">
        <path d={arcPath(180, 0)} className="arc-gauge__track" />
        {redFrom !== undefined && <path d={arcPath(180 - 180 * redFrom, 0)} className="arc-gauge__red" />}
        {fraction > 0.004 && <path d={arcPath(180, 180 - 180 * fraction)} className="arc-gauge__progress" />}
        {ticks.map((angle) => {
          const [x0, y0] = point(angle, R + 12);
          const [x1, y1] = point(angle, R + 17);
          return <line key={angle} x1={x0} y1={y0} x2={x1} y2={y1} className="arc-gauge__tick" />;
        })}
        <text x={CX} y={CY - 4} textAnchor="middle" className="arc-gauge__value">
          {value !== undefined ? Math.round(value) : "—"}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" className="arc-gauge__unit">
          {unit}
        </text>
      </svg>
      <span className="arc-gauge__label">{label}</span>
    </div>
  );
}
