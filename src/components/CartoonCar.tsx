import { useId } from "react";
import type { BodyType } from "../types";
import { shade } from "../utils/bodyTypes";

// Auto disegnata in stile cartone animato, vista di lato e colorata con il colore
// del veicolo. Ogni carrozzeria ha una sagoma propria (altezza da terra, tetto,
// coda, cofano), così si riconoscono a colpo d'occhio anche da piccole.

interface Shape {
  x0: number; // paraurti posteriore
  x1: number; // paraurti anteriore
  bot: number; // fondo della carrozzeria
  cy: number; // centro delle ruote
  r: number; // raggio delle ruote
  wheels: [number, number];
  yr: number; // tetto
  xd: number; // fine della coda (inizio del lunotto)
  yd: number; // altezza della coda
  xr1: number; // inizio del tetto
  xr2: number; // fine del tetto
  xw: number; // base del parabrezza
  yh: number; // altezza del cofano
  rad: number; // arrotondamento degli spigoli
  van?: boolean; // furgone: un solo finestrino, davanti
  bed?: number; // pick-up: dove finisce il cassone e inizia la cabina
  open?: boolean; // cabrio: senza tetto
}

const SHAPES: Record<BodyType, Shape> = {
  citycar: { x0: 18, x1: 102, bot: 44, cy: 45, r: 11.5, wheels: [36, 84], yr: 9, xd: 20, yd: 20, xr1: 27, xr2: 63, xw: 82, yh: 28, rad: 9 },
  hatchback: { x0: 11, x1: 109, bot: 44, cy: 45, r: 12, wheels: [31, 88], yr: 12, xd: 14, yd: 22, xr1: 23, xr2: 64, xw: 86, yh: 29, rad: 7 },
  sedan: { x0: 6, x1: 114, bot: 44, cy: 45, r: 12, wheels: [28, 92], yr: 13, xd: 24, yd: 28, xr1: 40, xr2: 72, xw: 90, yh: 30, rad: 6 },
  wagon: { x0: 6, x1: 114, bot: 44, cy: 45, r: 12, wheels: [28, 92], yr: 12, xd: 7, yd: 18, xr1: 11, xr2: 72, xw: 91, yh: 30, rad: 6 },
  suv: { x0: 7, x1: 113, bot: 40, cy: 44, r: 14, wheels: [30, 91], yr: 5, xd: 8, yd: 13, xr1: 13, xr2: 73, xw: 92, yh: 22, rad: 7 },
  van: { x0: 6, x1: 114, bot: 43, cy: 45, r: 12.5, wheels: [27, 94], yr: 3, xd: 6, yd: 5, xr1: 8, xr2: 86, xw: 103, yh: 25, rad: 6, van: true },
  coupe: { x0: 8, x1: 112, bot: 45, cy: 46, r: 11.5, wheels: [29, 90], yr: 17, xd: 18, yd: 30, xr1: 44, xr2: 64, xw: 88, yh: 32, rad: 6 },
  convertible: { x0: 8, x1: 112, bot: 45, cy: 46, r: 11.5, wheels: [29, 90], yr: 14, xd: 14, yd: 28, xr1: 0, xr2: 0, xw: 80, yh: 28, rad: 6, open: true },
  pickup: { x0: 4, x1: 116, bot: 40, cy: 44, r: 14, wheels: [27, 94], yr: 7, xd: 5, yd: 25, xr1: 52, xr2: 75, xw: 93, yh: 25, rad: 5, bed: 49 },
};

type Pt = [number, number, number?];

/** Poligono con gli angoli arrotondati (raggio per vertice). */
function rounded(pts: Pt[]): string {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i - 1 + n) % n];
    const [x, y, rr = 0] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    const l1 = Math.hypot(x - px, y - py) || 1;
    const l2 = Math.hypot(nx - x, ny - y) || 1;
    const r = Math.min(rr, l1 / 2, l2 / 2);
    const ax = x + ((px - x) / l1) * r, ay = y + ((py - y) / l1) * r;
    const bx = x + ((nx - x) / l2) * r, by = y + ((ny - y) / l2) * r;
    d += `${i ? "L" : "M"}${ax.toFixed(1)} ${ay.toFixed(1)}Q${x} ${y} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  return d + "Z";
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Props {
  bodyType?: BodyType;
  color: string;
  className?: string;
  title?: string;
}

export default function CartoonCar({ bodyType = "hatchback", color, className, title }: Props) {
  const uid = useId().replace(/:/g, "");
  const s = SHAPES[bodyType] ?? SHAPES.hatchback;
  const { x0, x1, bot, cy, r, yr, xd, yd, xr1, xr2, xw, yh, rad } = s;
  const ink = shade(color, -0.55);
  const paint = `url(#b${uid})`;
  const glass = `url(#g${uid})`;

  // Sagoma della carrozzeria
  const pts: Pt[] = [[x0, bot, 6], [x0, yd + 2, rad]];
  if (s.open) pts.push([x0 + 6, yd - 0.5, 5], [xw - 2, yd - 0.5, 3]);
  else {
    if (s.bed) pts.push([s.bed, yd, 1], [s.bed, yr + 1, 2]);
    else pts.push([xd, yd, 4]);
    pts.push([xr1, yr, rad + 2], [xr2, yr, rad + 3], [xw, yh, 5]);
  }
  pts.push([x1 - 2, yh + 2, 8], [x1, bot, 6]);
  const body = rounded(pts);

  // Vetri tra il tetto e la linea di cintura
  const yT = yr + 3.6;
  const yB = s.open ? yd : Math.min(Math.max(yh, yd) - (s.bed ? 0 : 1), yh);
  const leftX = (y: number) => {
    if (s.bed) return s.bed + 3.5;
    if (y <= yd) return lerp(xr1, xd, (y - yr) / (yd - yr)) + 3.8;
    return lerp(xd, x0, (y - yd) / (bot - yd)) + 3.8;
  };
  const rightX = (y: number) => lerp(xr2, xw, (y - yr) / (yh - yr)) - 3.8;
  const lt = s.open ? 0 : leftX(yT), lb = s.open ? 0 : leftX(yB);
  const rt = s.open ? 0 : rightX(yT), rb = s.open ? 0 : rightX(yB);
  let pillar = s.van ? rt - 16 : s.bed ? lt + 7 : (lt + rt) / 2 + 2;
  if (bodyType === "coupe") pillar = lerp(lt, rt, 0.42);
  if (s.open) pillar = 58;

  const doorTop = yB + 1;
  const handleY = yB + 4.5;
  const tailY = (s.bed || s.open ? yd : Math.max(yd, yB)) + 3;

  return (
    <svg className={className} viewBox="0 0 120 62" role="img" aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 0.35)} />
          <stop offset=".55" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.22)} />
        </linearGradient>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e3f1ff" />
          <stop offset="1" stopColor="#8fb9e6" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy={cy + r - 0.4} rx="55" ry="3.2" fill="#000" opacity=".14" />
      {bodyType === "suv" && <path d={`M${xr1 + 6} ${yr - 2.2}L${xr2 - 6} ${yr - 2.2}`} stroke={ink} strokeWidth="2" strokeLinecap="round" />}
      {s.open && (
        <>
          {/* capote ripiegata, poggiatesta e parabrezza */}
          <rect x={x0 + 9} y={yd - 7} width="22" height="7.5" rx="3.6" fill="#3a3f47" stroke={ink} strokeWidth="1.4" />
          <rect x="49" y={yd - 10} width="6" height="10.5" rx="2.6" fill="#3a3f47" />
          <rect x="62" y={yd - 10} width="6" height="10.5" rx="2.6" fill="#3a3f47" />
          <path d={`M${xw - 1} ${yd}L${xw - 9} ${yr}L${xw - 13} ${yr}L${xw - 7} ${yd}Z`} fill={glass} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
        </>
      )}
      <path d={body} fill={paint} stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
      {!s.open && (
        <>
          {!s.van && <path d={rounded([[lt, yT, 2.5], [pillar - 1.8, yT, 1], [pillar - 1.8, yB, 1], [lb, yB, 1.5]])} fill={glass} stroke={ink} strokeWidth="1.7" />}
          <path
            d={rounded([[s.van ? pillar : pillar + 1.8, yT, 1], [rt, yT, 2.5], [rb, yB, 1.5], [s.van ? pillar : pillar + 1.8, yB, 1]])}
            fill={glass}
            stroke={ink}
            strokeWidth="1.7"
          />
          <path d={`M${lt + 5} ${yB - 1.5}L${lt + 9} ${yT + 1.5}`} stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      <path d={`M${x0 + 6} ${yB + 3.5}L${x1 - 10} ${yB + 3.5}`} stroke="#fff" strokeOpacity=".38" strokeWidth="2.4" strokeLinecap="round" />
      {s.van ? (
        <path d={`M${pillar - 2} ${yT}L${pillar - 2} ${bot - 3}M${(x0 + pillar) / 2} ${yd + 6}L${(x0 + pillar) / 2} ${bot - 3}`} stroke={ink} strokeWidth="1.2" strokeOpacity=".55" />
      ) : (
        <path d={`M${pillar} ${doorTop}L${pillar} ${bot - 3}`} stroke={ink} strokeWidth="1.2" strokeOpacity=".55" />
      )}
      {s.bed && <path d={`M${x0 + 2} ${yd + 3}L${s.bed - 2} ${yd + 3}`} stroke={ink} strokeWidth="1.2" strokeOpacity=".5" />}
      <rect x={pillar + 4} y={handleY} width="5" height="1.6" rx=".8" fill={ink} opacity=".6" />
      <ellipse cx={x1 - 4.5} cy={yh + 6} rx="3.2" ry="2.5" fill="#fff4b8" stroke={ink} strokeWidth="1.2" />
      <rect x={x0 - 1} y={tailY} width="3.6" height="5.5" rx="1.6" fill="#ff5a4a" stroke={ink} strokeWidth="1" />
      <rect x={x1 - 9} y={bot - 6} width="10" height="4.5" rx="2.2" fill="#d8dce2" stroke={ink} strokeWidth="1.2" />
      <rect x={x0 - 1} y={bot - 6} width="9" height="4.5" rx="2.2" fill="#d8dce2" stroke={ink} strokeWidth="1.2" />
      {s.wheels.map((x) => (
        <g key={x}>
          <path d={`M${x - r - 2.6} ${bot + 1}A${r + 2.6} ${r + 2.6} 0 0 1 ${x + r + 2.6} ${bot + 1}Z`} fill={ink} />
          <circle cx={x} cy={cy} r={r} fill="#2b2e35" stroke="#16181c" strokeWidth="1.6" />
          <circle cx={x} cy={cy} r={r * 0.56} fill="#eef1f5" stroke="#16181c" strokeWidth="1.2" />
          {[0, 72, 144, 216, 288].map((a) => {
            const t = ((a - 90) * Math.PI) / 180;
            return <circle key={a} cx={x + Math.cos(t) * r * 0.32} cy={cy + Math.sin(t) * r * 0.32} r={r * 0.075} fill="#9aa2ad" />;
          })}
          <circle cx={x} cy={cy} r={r * 0.13} fill="#6c737e" />
        </g>
      ))}
    </svg>
  );
}
