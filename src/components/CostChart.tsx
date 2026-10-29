import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getCurrencySymbol, kmToDisplayDistance } from "../utils/settings";

interface Props {
  fuelEntries: FuelEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries?: ExpenseEntry[];
  chargingEntries?: ChargingEntry[];
  /** Letture dei km di tutto lo storico (non solo del periodo), per i km percorsi nel mese. */
  kmReadings?: { date: string; km: number }[];
}

interface MonthBucket {
  month: string;
  carburante: number;
  ricarica: number;
  manutenzione: number;
  spese: number;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Km percorsi in un mese (AAAA-MM): lettura più alta del mese meno la più alta
 * dei mesi precedenti. null se mancano letture nel mese o prima.
 */
function kmDrivenInMonth(readings: { date: string; km: number }[], month: string): number | null {
  let inMonth = -Infinity;
  let before = -Infinity;
  for (const r of readings) {
    const key = monthKey(r.date);
    if (key === month) inMonth = Math.max(inMonth, r.km);
    else if (key < month) before = Math.max(before, r.km);
  }
  if (!Number.isFinite(inMonth) || !Number.isFinite(before) || inMonth <= before) return null;
  return inMonth - before;
}

function monthLabel(key: string, locale: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

export default function CostChart({ fuelEntries, maintenanceEntries, expenseEntries = [], chargingEntries = [], kmReadings = [] }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, currency, distanceUnit } = useAppSettings();
  const currencySymbol = getCurrencySymbol(currency);
  // Mese selezionato (toccando una barra); se nessuno, l'ultimo.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (fuelEntries.length === 0 && chargingEntries.length === 0 && maintenanceEntries.length === 0 && expenseEntries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("summary.chartEmptyTitle")}</p>
        <p className="empty-state__body">{t("summary.chartEmptyBody")}</p>
      </div>
    );
  }

  const locale = getNumberLocale(i18n.language);
  const buckets = new Map<string, MonthBucket>();

  function getBucket(key: string): MonthBucket {
    if (!buckets.has(key)) {
      buckets.set(key, { month: key, carburante: 0, ricarica: 0, manutenzione: 0, spese: 0 });
    }
    return buckets.get(key)!;
  }

  for (const entry of fuelEntries) {
    getBucket(monthKey(entry.date)).carburante += entry.totalCost;
  }
  for (const entry of chargingEntries) {
    getBucket(monthKey(entry.date)).ricarica += entry.totalCost;
  }
  for (const entry of maintenanceEntries) {
    getBucket(monthKey(entry.date)).manutenzione += entry.cost;
  }
  for (const entry of expenseEntries) {
    getBucket(monthKey(entry.date)).spese += entry.amount;
  }

  // Anche i mesi senza spese, così l'asse del tempo è continuo e i buchi si vedono.
  const keys = [...buckets.keys()].sort();
  const lastKey = keys[keys.length - 1];
  let [year, month] = keys[0].split("-").map(Number);
  while (`${year}-${String(month).padStart(2, "0")}` < lastKey) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    getBucket(`${year}-${String(month).padStart(2, "0")}`);
  }

  const data = Array.from(buckets.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((b) => ({
      ...b,
      monthLabel: monthLabel(b.month, locale),
      carburante: Math.round(b.carburante * 100) / 100,
      ricarica: Math.round(b.ricarica * 100) / 100,
      manutenzione: Math.round(b.manutenzione * 100) / 100,
      spese: Math.round(b.spese * 100) / 100,
    }));

  // Solo le serie con almeno un importo: niente barre e voci di legenda vuote.
  const hasFuel = data.some((d) => d.carburante > 0);
  const hasCharging = data.some((d) => d.ricarica > 0);
  const hasMaintenance = data.some((d) => d.manutenzione > 0);
  const hasExpenses = data.some((d) => d.spese > 0);
  const series = [
    { key: "carburante", name: t("summary.chartFuel"), color: "#f5901f", show: hasFuel },
    { key: "ricarica", name: t("summary.charging"), color: "#22b8cf", show: hasCharging },
    { key: "manutenzione", name: t("summary.chartMaintenance"), color: "#3fbb72", show: hasMaintenance },
    { key: "spese", name: t("summary.chartExpenses"), color: "#a58fd1", show: hasExpenses },
  ].filter((serie) => serie.show) as { key: "carburante" | "ricarica" | "manutenzione" | "spese"; name: string; color: string; show: boolean }[];

  const selected = selectedIndex !== null && selectedIndex < data.length ? selectedIndex : data.length - 1;
  const row = data[selected];
  const rowTotal = row.carburante + row.ricarica + row.manutenzione + row.spese;
  const kmInMonth = kmDrivenInMonth(kmReadings, row.month);

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onMouseMove={(state) => {
            const index = Number(state?.activeTooltipIndex);
            if (Number.isInteger(index) && index >= 0) setSelectedIndex(index);
          }}
          onClick={(state) => {
            const index = Number(state?.activeTooltipIndex);
            if (Number.isInteger(index) && index >= 0) setSelectedIndex(index);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="monthLabel" interval="preserveStartEnd" minTickGap={12} tick={{ fontFamily: "Inter", fontSize: 11, fill: "var(--text-muted)" }} stroke="var(--border)" />
          <YAxis
            tick={{ fontFamily: "Inter", fontSize: 11, fill: "var(--text-muted)" }}
            stroke="var(--border)"
            width={56}
            allowDecimals={false}
            tickFormatter={(v: number) => `${currencySymbol} ${v.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
          />
          <Tooltip cursor={{ fill: "color-mix(in srgb, var(--text-muted) 12%, transparent)" }} content={() => null} />
          {series.map((serie) => (
            <Bar key={serie.key} dataKey={serie.key} name={serie.name} stackId="costs" fill={serie.color} maxBarSize={28}>
              {data.map((_, i) => (
                <Cell key={i} fillOpacity={i === selected ? 1 : 0.55} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      {/* Legenda fuori dal grafico: dentro rubava altezza e le barre restavano schiacciate. */}
      <div className="chart-legend">
        {series.map((serie) => (
          <span key={serie.key} className="chart-legend__item">
            <i className="chart-legend__swatch" style={{ background: serie.color }} aria-hidden="true" />
            {serie.name}
          </span>
        ))}
      </div>

      <div className="cost-detail" aria-live="polite">
        <strong>{row.monthLabel}</strong>
        {series
          .filter((serie) => row[serie.key] > 0)
          .map((serie) => (
            <span key={serie.key}>
              <i style={{ background: serie.color }} />
              {serie.name}
              <b>{formatMoney(row[serie.key])}</b>
            </span>
          ))}
        <span className="cost-detail__total">
          {t("summary.total")}
          <b>{formatMoney(rowTotal)}</b>
        </span>
        {kmInMonth !== null && (
          <span className="cost-detail__km">
            {t("summary.monthKm", { km: `${kmToDisplayDistance(kmInMonth, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} ${distanceUnit}` })}
            <b>{t("summary.monthCostPerKm", { cost: formatMoney(rowTotal / kmToDisplayDistance(kmInMonth, distanceUnit), 3), unit: distanceUnit })}</b>
          </span>
        )}
      </div>
    </div>
  );
}
