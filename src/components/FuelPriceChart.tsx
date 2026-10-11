import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import type { FuelEntry, FuelSource } from "../types";
import { getNumberLocale } from "../utils/locale";
import { useCurrencySymbol } from "../utils/useCurrencySymbol";

const SOURCE_COLORS: Record<FuelSource, string> = {
  benzina: "#f5901f",
  diesel: "#4c9aff",
  gpl: "#a58fd1",
  metano: "#22b8cf",
  elettrico: "#3fbb72",
};

interface Props {
  fuelEntries: FuelEntry[];
}

/** Prezzo pagato al litro nel tempo, una linea per alimentazione, con la media del periodo. */
export default function FuelPriceChart({ fuelEntries }: Props) {
  const { t, i18n } = useTranslation();
  const locale = getNumberLocale(i18n.language);
  const cur = useCurrencySymbol();

  const points = fuelEntries
    .filter((e) => e.liters > 0 && e.totalCost > 0)
    .map((e) => ({ t: new Date(e.date).getTime(), source: e.source, price: e.totalCost / e.liters }))
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return null;

  const sources = [...new Set(points.map((p) => p.source))];
  // Una riga per rifornimento, con il prezzo nella colonna della sua alimentazione.
  const data = points.map((p) => ({ t: p.t, [p.source]: Math.round(p.price * 1000) / 1000 }));
  const main = sources.length === 1 ? sources[0] : null;
  const average = main ? points.reduce((sum, p) => sum + p.price, 0) / points.length : null;
  const last = points[points.length - 1];
  const fmt = (v: number) => `${cur} ${v.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

  return (
    <div className="chart-wrap price-chart">
      <div className="price-chart__head">
        <strong>{t("summary.fuelPriceTitle")}</strong>
        <span>
          {t("summary.fuelPriceLast", { price: fmt(last.price) })}
          {average !== null && ` · ${t("summary.fuelPriceAverage", { price: fmt(average) })}`}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 22, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            minTickGap={16}
            tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--text-muted)" }}
            stroke="var(--border)"
            tickFormatter={(v: number) => new Date(v).toLocaleDateString(locale, { month: "short", year: "2-digit" })}
          />
          <YAxis
            width={56}
            // Scala stretta intorno ai prezzi pagati: le differenze di pochi centesimi devono vedersi.
            domain={[(min: number) => Math.max(0, Math.floor(min * 10) / 10 - 0.1), (max: number) => Math.ceil(max * 10) / 10 + 0.1]}
            tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--text-muted)" }}
            stroke="var(--border)"
            tickFormatter={(v: number) => v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }}
            separator=": "
            labelFormatter={(v) => new Date(Number(v)).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}
            formatter={(value, name) => [`${fmt(Number(value))}/L`, t(`fuelType.${String(name)}`)]}
          />
          {average !== null && <ReferenceLine y={average} stroke="var(--text-muted)" strokeDasharray="4 4" />}
          {sources.map((source) => (
            <Line
              key={source}
              type="linear"
              dataKey={source}
              connectNulls
              stroke={SOURCE_COLORS[source]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {sources.length > 1 && (
        <div className="chart-legend">
          {sources.map((source) => (
            <span key={source} className="chart-legend__item">
              <i className="price-chart__dot" style={{ background: SOURCE_COLORS[source] }} />
              {t(`fuelType.${source}`)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
