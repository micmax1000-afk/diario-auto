import { useId } from "react";
import type { BodyType } from "../types";
import { shade } from "../utils/bodyTypes";

// Auto disegnata in stile cartone animato, vista di lato e colorata con il colore
// del veicolo: carrozzeria paffuta con contorno spesso, ruote grandi e riflessi.
// Le forme sono generate dagli stessi pochi parametri per ogni carrozzeria.

interface Shape {
  x0: number; // paraurti posteriore
  x1: number; // paraurti anteriore
  yb: number; // linea di cintura (sopra le portiere)
  yr: number; // tetto
  xr1: number; // inizio del tetto
  xr2: number; // fine del tetto
  xw: number; // base del parabrezza
  wheels: [number, number];
  r: number; // raggio delle ruote
}

const SHAPES: Record<BodyType, Shape> = {
  citycar: { x0: 17, x1: 103, yb: 30, yr: 9, xr1: 26, xr2: 60, xw: 80, wheels: [38, 83], r: 12.5 },
  hatchback: { x0: 12, x1: 108, yb: 31, yr: 11, xr1: 19, xr2: 64, xw: 84, wheels: [33, 87], r: 12.5 },
  sedan: { x0: 7, x1: 113, yb: 31, yr: 13, xr1: 34, xr2: 67, xw: 87, wheels: [30, 91], r: 12.5 },
  wagon: { x0: 7, x1: 113, yb: 31, yr: 12, xr1: 14, xr2: 68, xw: 88, wheels: [30, 91], r: 12.5 },
  suv: { x0: 7, x1: 113, yb: 27, yr: 6, xr1: 14, xr2: 70, xw: 91, wheels: [30, 91], r: 14 },
  pickup: { x0: 5, x1: 115, yb: 28, yr: 8, xr1: 50, xr2: 72, xw: 91, wheels: [28, 93], r: 14 },
  van: { x0: 9, x1: 111, yb: 30, yr: 6, xr1: 15, xr2: 56, xw: 92, wheels: [31, 89], r: 12.5 },
  coupe: { x0: 9, x1: 111, yb: 32, yr: 15, xr1: 38, xr2: 62, xw: 86, wheels: [31, 89], r: 12.5 },
};

interface Props {
  bodyType?: BodyType;
  color: string;
  className?: string;
  title?: string;
}

export default function CartoonCar({ bodyType = "hatchback", color, className, title }: Props) {
  const uid = useId().replace(/:/g, "");
  const s = SHAPES[bodyType] ?? SHAPES.hatchback;
  const { x0, x1, yb, yr, xr1, xr2, xw, r } = s;
  const B = 45;
  const ink = shade(color, -0.55);
  const deck = Math.max(x0 + 8, xr1 - 6);
  const body = `M${x0 + 10} ${B} Q${x0} ${B} ${x0} ${B - 10} L${x0} ${yb + 7} Q${x0} ${yb - 1} ${x0 + 9} ${yb - 1.5} L${deck} ${yb - 2} C${deck} ${yr + 2} ${xr1 - 2} ${yr} ${xr1 + 7} ${yr} L${xr2 - 7} ${yr} C${xr2 + 5} ${yr} ${xw - 3} ${yb - 7} ${xw + 4} ${yb - 2} L${x1 - 11} ${yb} Q${x1} ${yb + 1} ${x1} ${yb + 11} L${x1} ${B - 9} Q${x1} ${B} ${x1 - 10} ${B} Z`;
  const xp = (xr1 + xr2) / 2;
  const top = yr + 3.6;
  const bot = yb - 4;
  const rearWin = `M${deck + 3.5} ${bot} C${deck + 3.5} ${top + 2} ${xr1 + 1} ${top} ${xr1 + 8} ${top} L${xp - 2} ${top} L${xp - 2} ${bot} Z`;
  const frontWin = `M${xp + 2} ${top} L${xr2 - 7} ${top} C${xr2 + 2} ${top} ${xw - 5} ${bot - 4} ${xw - 1} ${bot} L${xp + 2} ${bot} Z`;
  const body_ = `url(#b${uid})`;
  const glass = `url(#g${uid})`;

  return (
    <svg className={className} viewBox="0 0 120 62" role="img" aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 0.35)} />
          <stop offset=".55" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.25)} />
        </linearGradient>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e3f1ff" />
          <stop offset="1" stopColor="#8fb9e6" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy={B + r - 0.5} rx="54" ry="3.4" fill="#000" opacity=".15" />
      <path d={body} fill={body_} stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={rearWin} fill={glass} stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d={frontWin} fill={glass} stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d={`M${xp + 6} ${bot - 1.5} L${xp + 11} ${top + 1.5} M${xp + 10} ${bot - 1.5} L${xp + 13} ${top + 4}`} stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M${x0 + 9} ${yb + 2.5} Q${(x0 + x1) / 2} ${yb + 1} ${x1 - 13} ${yb + 3.5}`} stroke="#fff" strokeOpacity=".45" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d={`M${xp} ${bot + 2} L${xp} ${B - 5}`} stroke={ink} strokeWidth="1.3" strokeOpacity=".6" />
      <rect x={xp - 7} y={yb + 3.5} width="4.5" height="1.6" rx=".8" fill={ink} opacity=".6" />
      <ellipse cx={x1 - 5} cy={yb + 6} rx="3.2" ry="2.6" fill="#fff4b8" stroke={ink} strokeWidth="1.2" />
      <rect x={x0 - 1} y={yb + 3} width="3.6" height="5.5" rx="1.6" fill="#ff5a4a" stroke={ink} strokeWidth="1" />
      <rect x={x1 - 9} y={B - 6.5} width="10" height="4.5" rx="2.2" fill="#d8dce2" stroke={ink} strokeWidth="1.2" />
      <rect x={x0 - 1} y={B - 6.5} width="9" height="4.5" rx="2.2" fill="#d8dce2" stroke={ink} strokeWidth="1.2" />
      {s.wheels.map((x) => (
        <g key={x}>
          <path d={`M${x - r - 2.5} ${B} A${r + 2.5} ${r + 2.5} 0 0 1 ${x + r + 2.5} ${B} Z`} fill={ink} />
          <circle cx={x} cy={B} r={r} fill="#2b2e35" stroke="#16181c" strokeWidth="1.6" />
          <circle cx={x} cy={B} r={r * 0.58} fill="#f2f4f7" stroke="#16181c" strokeWidth="1.2" />
          {[0, 72, 144, 216, 288].map((a) => {
            const rad = ((a - 90) * Math.PI) / 180;
            return <circle key={a} cx={x + Math.cos(rad) * r * 0.33} cy={B + Math.sin(rad) * r * 0.33} r={r * 0.08} fill="#9aa2ad" />;
          })}
          <circle cx={x} cy={B} r={r * 0.13} fill="#6c737e" />
          <path d={`M${x - r * 0.72} ${B - r * 0.35} A${r * 0.8} ${r * 0.8} 0 0 1 ${x - r * 0.2} ${B - r * 0.78}`} stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
