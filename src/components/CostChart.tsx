import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import type { FuelEntry, MaintenanceEntry, ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getCurrencySymbol } from "../utils/settings";
import CategoryIcon from "./CategoryIcon";

interface Props {
  fuelEntries: FuelEntry[];
  maintenanceEntries: MaintenanceEntry[];
  expenseEntries?: ExpenseEntry[];
}

interface MonthBucket {
  month: string;
  carburante: number;
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

export default function CostChart({ fuelEntries, maintenanceEntries, expenseEntries = [] }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, currency } = useAppSettings();
  const currencySymbol = getCurrencySymbol(currency);

  if (fuelEntries.length === 0 && maintenanceEntries.length === 0 && expenseEntries.length === 0) {
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
      buckets.set(key, { month: key, carburante: 0, manutenzione: 0, spese: 0 });
    }
    return buckets.get(key)!;
  }

  for (const entry of fuelEntries) {
    getBucket(monthKey(entry.date)).carburante += entry.totalCost;
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
      manutenzione: Math.round(b.manutenzione * 100) / 100,
      spese: Math.round(b.spese * 100) / 100,
    }));

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262d36" />
          <XAxis dataKey="monthLabel" tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "#8a93a1" }} stroke="#262d36" />
          <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "#8a93a1" }} stroke="#262d36" unit={currencySymbol} />
          <Tooltip
            contentStyle={{
              fontFamily: "JetBrains Mono",
              fontSize: 12,
              background: "#171c22",
              border: "1px solid #262d36",
              borderRadius: 4,
              color: "#f3f1ea",
            }}
            labelStyle={{ color: "#f3f1ea" }}
            formatter={(value) => [formatMoney(Number(value)), undefined]}
          />
          <Legend
            content={() => (
              <div className="chart-legend">
                <span className="chart-legend__item">
                  <CategoryIcon kind="fuel" category="benzina" size="small" />
                  {t("summary.chartFuel")}
                </span>
                <span className="chart-legend__item">
                  <CategoryIcon kind="maintenance" category="tagliando" size="small" />
                  {t("summary.chartMaintenance")}
                </span>
                <span className="chart-legend__item">
                  <CategoryIcon kind="expense" category="altro" size="small" />
                  {t("summary.chartExpenses")}
                </span>
              </div>
            )}
          />
          <Bar dataKey="carburante" name={t("summary.chartFuel")} fill="#f5901f" radius={[8, 8, 0, 0]} />
          <Bar dataKey="manutenzione" name={t("summary.chartMaintenance")} fill="#3fbb72" radius={[8, 8, 0, 0]} />
          <Bar dataKey="spese" name={t("summary.chartExpenses")} fill="#a58fd1" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
