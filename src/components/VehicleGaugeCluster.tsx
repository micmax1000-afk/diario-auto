import { useTranslation } from "react-i18next";
import { getNumberLocale } from "../utils/locale";

interface Props {
  totalKmLabel: string; // già formattato con unità (es. "123.456 km")
  totalKmSubtitle: string; // "km totali" / "mi totali"
  avgConsumption: number | null; // valore numerico, unità dipende dal chiamante
  avgConsumptionUnit: string; // es. "l/100km", "km/l", "mi/kWh"
  maxScale?: number; // valore massimo mostrato sull'arco (default 240)
}

const TICKS = [0, 40, 80, 120, 160, 200, 240];

// Arco da -130° a +130° (in alto), stile cruscotto analogico.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export default function VehicleGaugeCluster({
  totalKmLabel,
  totalKmSubtitle,
  avgConsumption,
  avgConsumptionUnit,
  maxScale = 240,
}: Props) {
  const { i18n } = useTranslation();
  const locale = getNumberLocale(i18n.language);
  const startAngle = -130;
  const endAngle = 130;
  const cx = 130;
  const cy = 140;
  const r = 105;

  return (
    <div className="gauge-cluster">
      <svg viewBox="0 0 260 260" className="gauge-cluster__svg" role="img" aria-hidden="true">
        <path
          d={describeArc(cx, cy, r, startAngle, endAngle)}
          className="gauge-cluster__track"
          fill="none"
        />
        <path
          d={describeArc(cx, cy, r, startAngle, endAngle)}
          className="gauge-cluster__glow"
          fill="none"
        />
        {TICKS.map((tick) => {
          const angle = startAngle + ((endAngle - startAngle) * tick) / maxScale;
          const outer = polarToCartesian(cx, cy, r + 14, angle);
          const inner = polarToCartesian(cx, cy, r + 2, angle);
          const labelPos = polarToCartesian(cx, cy, r - 20, angle);
          return (
            <g key={tick}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="gauge-cluster__tick" />
              <text x={labelPos.x} y={labelPos.y} className="gauge-cluster__tick-label" textAnchor="middle" dominantBaseline="middle">
                {tick}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="gauge-cluster__center">
        <span className="gauge-cluster__unit">km/h</span>
        <strong className="gauge-cluster__value">{totalKmLabel}</strong>
        <span className="gauge-cluster__caption">{totalKmSubtitle}</span>
        {avgConsumption != null && (
          <div className="gauge-cluster__consumption">
            <strong>{avgConsumption.toLocaleString(locale, { maximumFractionDigits: 2 })}</strong>
            <small>{avgConsumptionUnit}</small>
          </div>
        )}
      </div>
    </div>
  );
}
