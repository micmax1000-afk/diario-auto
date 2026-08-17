import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import type { FuelEntry, MaintenanceEntry, ExpenseEntry } from "../types";

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

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
}

export default function CostChart({ fuelEntries, maintenanceEntries, expenseEntries = [] }: Props) {
  if (fuelEntries.length === 0 && maintenanceEntries.length === 0 && expenseEntries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Nessun dato ancora disponibile</p>
        <p className="empty-state__body">
          Aggiungi rifornimenti, manutenzioni e spese per vedere l'andamento dei costi nel tempo.
        </p>
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
      monthLabel: monthLabel(b.month),
      carburante: Math.round(b.carburante * 100) / 100,
      manutenzione: Math.round(b.manutenzione * 100) / 100,
      spese: Math.round(b.spese * 100) / 100,
    }));

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6dcc4" />
          <XAxis dataKey="monthLabel" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} stroke="#8a8172" />
          <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} stroke="#8a8172" unit="€" />
          <Tooltip
            contentStyle={{
              fontFamily: "JetBrains Mono",
              fontSize: 12,
              background: "#f2ecdd",
              border: "1px solid #e6dcc4",
              borderRadius: 4,
            }}
            formatter={(value) => [`€ ${Number(value).toFixed(2)}`, undefined]}
          />
          <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
          <Bar dataKey="carburante" name="Carburante" fill="#e8a33d" radius={[3, 3, 0, 0]} />
          <Bar dataKey="manutenzione" name="Manutenzione" fill="#5c7a52" radius={[3, 3, 0, 0]} />
          <Bar dataKey="spese" name="Spese (bollo/assic./multe)" fill="#8a6fb0" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
