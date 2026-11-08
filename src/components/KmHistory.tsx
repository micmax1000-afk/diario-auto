import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { accentCssColor } from "../utils/theme";
import { useTranslation } from "react-i18next";
import type { FuelEntry, ChargingEntry, Vehicle } from "../types";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import QuickEntryHeader from "./QuickEntryHeader";

interface Props {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  chargingEntries: ChargingEntry[];
  onBack: () => void;
  onUpdateKm: () => void;
}

export default function KmHistory({ vehicle, fuelEntries, chargingEntries, onBack, onUpdateKm }: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();
  const locale = getNumberLocale(i18n.language);

  const readings = [...fuelEntries, ...chargingEntries]
    .map((e) => ({ date: e.date, km: e.km }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Asse X sul tempo reale (non una lettura = un passo), così la pendenza è la percorrenza vera.
  const chartData = readings.map((r) => ({
    t: new Date(r.date).getTime(),
    km: kmToDisplayDistance(r.km, distanceUnit),
  }));
  const formatKm = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 0 });

  const sortedDesc = [...readings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="quick-entry-page">
      <QuickEntryHeader title={t("kmHistory.title", "Cronologia km")} onBack={onBack} tone="blue" />

      <div className="quick-entry-page__body">
        <div className="quick-entry-card">
          <div className="quick-entry-card__km" style={{ borderTop: "none", paddingTop: 0 }}>
            <span>{t("quickEntry.currentKmLabel")}</span>
            <strong>{kmToDisplayDistance(vehicle.currentKm, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} {distanceUnit}</strong>
          </div>
        </div>

        {chartData.length >= 2 ? (
          <div className="km-history-chart">
            <p className="quick-entry-page__section-label">{t("kmHistory.trend", "Andamento percorrenza")}</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  stroke="var(--text-muted)"
                  fontSize={11}
                  minTickGap={16}
                  tickFormatter={(v: number) => new Date(v).toLocaleDateString(locale, { month: "short", year: "2-digit" })}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={11}
                  width={58}
                  domain={["auto", "auto"]}
                  allowDecimals={false}
                  tickFormatter={(v: number) => formatKm(v)}
                />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }}
                  separator=""
                  labelFormatter={(v) => new Date(Number(v)).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}
                  formatter={(value) => [`${formatKm(Number(value))} ${distanceUnit}`, ""]}
                />
                <Line type="linear" dataKey="km" stroke={accentCssColor()} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="quick-entry-page__section-label">{t("kmHistory.notEnoughData", "Servono almeno due letture per mostrare il grafico.")}</p>
        )}

        <div className="km-history-list">
          {sortedDesc.map((r, idx) => (
            <div key={`${r.date}-${idx}`} className="km-history-row">
              <span>{new Date(r.date).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}</span>
              <strong>{kmToDisplayDistance(r.km, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} {distanceUnit}</strong>
            </div>
          ))}
        </div>

        <button type="button" className="km-history-add" onClick={onUpdateKm}>
          + {t("kmHistory.addReading", "Aggiungi lettura contachilometri")}
        </button>
        <p className="quick-entry__full-form-hint">
          {t("kmHistory.hint", "Le letture qui sopra provengono dai rifornimenti e dalle ricariche registrate. Una lettura manuale aggiorna il chilometraggio attuale del veicolo.")}
        </p>
      </div>
    </div>
  );
}
