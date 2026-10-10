import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ChargingEntry, FuelEntry, FuelSource, Vehicle } from "../types";
import {
  convertRows,
  detectMapping,
  findTable,
  parseCsv,
  withoutDuplicates,
  type ColumnMapping,
  type CsvField,
  type CsvTable,
} from "../utils/csvImport";
import { isoToLocalDate, localDateToIso } from "../utils/dates";
import { generateId, putChargingEntry, putFuelEntry, putVehicle } from "../utils/storage";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getNumberLocale } from "../utils/locale";

interface Props {
  vehicles: Vehicle[];
  fuelEntries: FuelEntry[];
  chargingEntries: ChargingEntry[];
  /** Chiamata a importazione finita, per ricaricare i dati dell'app. */
  onImported: () => void;
}

const FIELDS: CsvField[] = ["date", "km", "liters", "totalCost", "unitPrice", "fullTank", "notes"];
const REQUIRED: CsvField[] = ["date", "km", "liters"];

function defaultSource(vehicle: Vehicle): FuelSource {
  if (vehicle.fuelType === "ibrido") return "benzina";
  return vehicle.fuelType;
}

/** Importazione dei rifornimenti da un CSV di un'altra app, con anteprima e scelta delle colonne. */
export default function CsvImportPanel({ vehicles, fuelEntries, chargingEntries, onImported }: Props) {
  const { t, i18n } = useTranslation();
  const locale = getNumberLocale(i18n.language);
  const { formatMoney } = useAppSettings();
  const activeVehicles = vehicles.filter((v) => !v.archived);
  const [table, setTable] = useState<CsvTable | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [vehicleId, setVehicleId] = useState(activeVehicles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setDone(null);
    try {
      const found = findTable(parseCsv(await file.text()));
      if (!found || found.rows.length === 0) {
        setError(t("csvImport.noTable"));
        setTable(null);
        return;
      }
      setTable(found);
      setFileName(file.name);
      setMapping(detectMapping(found.headers));
    } catch {
      setError(t("csvImport.readError"));
    }
  }

  const vehicle = activeVehicles.find((v) => v.id === vehicleId);
  const electric = vehicle?.fuelType === "elettrico";
  const missing = REQUIRED.filter((f) => mapping[f] === undefined);
  const result = table && missing.length === 0 ? convertRows(table, mapping) : null;
  const existing = electric
    ? chargingEntries.filter((e) => e.vehicleId === vehicleId)
    : fuelEntries.filter((e) => e.vehicleId === vehicleId);
  const toImport = result ? withoutDuplicates(result.rows, existing, isoToLocalDate) : [];
  const duplicates = result ? result.rows.length - toImport.length : 0;

  async function handleImport() {
    if (!vehicle || toImport.length === 0) return;
    setBusy(true);
    try {
      for (const row of toImport) {
        const date = localDateToIso(row.date);
        if (electric) {
          await putChargingEntry({
            id: generateId(),
            vehicleId: vehicle.id,
            date,
            km: row.km,
            kWh: row.liters,
            pricePerKWh: row.liters > 0 ? Math.round((row.totalCost / row.liters) * 1000) / 1000 : 0,
            totalCost: row.totalCost,
            notes: row.notes,
          });
        } else {
          await putFuelEntry({
            id: generateId(),
            vehicleId: vehicle.id,
            date,
            km: row.km,
            liters: row.liters,
            totalCost: row.totalCost,
            source: defaultSource(vehicle),
            fullTank: row.fullTank,
            notes: row.notes,
          });
        }
      }
      const maxKm = Math.max(...toImport.map((r) => r.km));
      if (maxKm > vehicle.currentKm) await putVehicle({ ...vehicle, currentKm: maxKm });
      setDone(t("csvImport.done", { count: toImport.length, name: vehicle.name }));
      setTable(null);
      onImported();
    } catch {
      setError(t("csvImport.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backup-panel__csv csv-import">
      <span className="backup-panel__csv-label">{t("csvImport.title")}</span>
      <p className="backup-panel__hint">{t("csvImport.hint")}</p>

      <label className="btn btn--ghost csv-import__pick">
        {t("csvImport.chooseFile")}
        <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} hidden />
      </label>

      {error && <p className="backup-panel__message backup-panel__message--error">{error}</p>}
      {done && <p className="backup-panel__message backup-panel__message--ok">{done}</p>}

      {table && (
        <div className="csv-import__preview">
          <p className="csv-import__file">
            {fileName} · {t("csvImport.rowsFound", { count: table.rows.length })}
          </p>

          <label className="field">
            <span>{t("csvImport.vehicle")}</span>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {activeVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>

          <p className="obd-hint">{t("csvImport.columnsHint")}</p>
          <div className="csv-import__mapping">
            {FIELDS.map((field) => (
              <label key={field} className="field">
                <span>
                  {t(`csvImport.fields.${field}`)}
                  {REQUIRED.includes(field) ? " *" : ""}
                </span>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                >
                  <option value="">—</option>
                  {table.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `#${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {missing.length > 0 ? (
            <p className="form-error">{t("csvImport.missingColumns")}</p>
          ) : (
            result && (
              <>
                <ul className="csv-import__sample">
                  {toImport.slice(0, 3).map((r, i) => (
                    <li key={i}>
                      <span>{new Date(localDateToIso(r.date)).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "2-digit" })}</span>
                      <span>{r.km.toLocaleString(locale)} km</span>
                      <span>
                        {r.liters} {electric ? "kWh" : "L"}
                      </span>
                      <span>{formatMoney(r.totalCost)}</span>
                    </li>
                  ))}
                </ul>
                <p className="obd-hint">
                  {t("csvImport.summary", { count: toImport.length, duplicates, skipped: result.skipped })}
                </p>
                <div className="backup-panel__actions">
                  <button type="button" className="btn btn--ghost" onClick={() => setTable(null)}>
                    {t("common.cancel")}
                  </button>
                  <button type="button" className="btn btn--primary" onClick={handleImport} disabled={busy || toImport.length === 0}>
                    {t("csvImport.import", { count: toImport.length })}
                  </button>
                </div>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
