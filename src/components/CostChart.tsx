import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import type { FuelEntry, ChargingEntry, MaintenanceEntry, ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getCurrencySymbol } from "../utils/settings";
import CategoryIcon from "./CategoryIcon";

interface Props {
  fuelEntries: FuelEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries?: ExpenseEntry[];
  chargingEntries?: ChargingEntry[];
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

function monthLabel(key: string, locale: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

export default function CostChart({ fuelEntries, maintenanceEntries, expenseEntries = [], chargingEntries = [] }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, currency } = useAppSettings();
  const currencySymbol = getCurrencySymbol(currency);

  if (fuelEntries.length === 0 && chargingEntries.length === 0 && maintenanceEntries.length === 0 && expenseEntries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("summary.chartEmptyTitle")}</p>
        <p className="empty-state__body">{t("summary.chartEmptyBody")}</p>
      </div>
    );
  }

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

  const data = Array.from(buckets.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((b) => ({
      ...b,
      monthLabel: monthLabel(b.month, getNumberLocale(i18n.language)),
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

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="monthLabel" interval="preserveStartEnd" minTickGap={12} tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--text-muted)" }} stroke="var(--border)" />
          <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--text-muted)" }} stroke="var(--border)" unit={currencySymbol} />
          <Tooltip
            contentStyle={{
              fontFamily: "JetBrains Mono",
              fontSize: 12,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text)",
            }}
            labelStyle={{ color: "var(--text)" }}
            formatter={(value) => [formatMoney(Number(value)), undefined]}
          />
          <Legend
            content={() => (
              <div className="chart-legend">
                {hasFuel && (
                  <span className="chart-legend__item">
                    <CategoryIcon kind="fuel" category="benzina" size="small" />
                    {t("summary.chartFuel")}
                  </span>
                )}
                {hasCharging && (
                  <span className="chart-legend__item">
                    <CategoryIcon kind="charging" category="" size="small" />
                    {t("summary.charging")}
                  </span>
                )}
                {hasMaintenance && (
                  <span className="chart-legend__item">
                    <CategoryIcon kind="maintenance" category="tagliando" size="small" />
                    {t("summary.chartMaintenance")}
                  </span>
                )}
                {hasExpenses && (
                  <span className="chart-legend__item">
                    <CategoryIcon kind="expense" category="altro" size="small" />
                    {t("summary.chartExpenses")}
                  </span>
                )}
              </div>
            )}
          />
          {hasFuel && <Bar dataKey="carburante" name={t("summary.chartFuel")} fill="#f5901f" radius={[8, 8, 0, 0]} />}
          {hasCharging && <Bar dataKey="ricarica" name={t("summary.charging")} fill="#22b8cf" radius={[8, 8, 0, 0]} />}
          {hasMaintenance && <Bar dataKey="manutenzione" name={t("summary.chartMaintenance")} fill="#3fbb72" radius={[8, 8, 0, 0]} />}
          {hasExpenses && <Bar dataKey="spese" name={t("summary.chartExpenses")} fill="#a58fd1" radius={[8, 8, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
