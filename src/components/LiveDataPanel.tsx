import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getNumberLocale } from "../utils/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { Vehicle, LogSession, LogSample, AlarmThresholds, DtcReading } from "../types";
import { ObdConnection, type LiveReading, type LivePidKey, type ObdStatus, type DtcMode, type ReadinessResult, type PairedDevice, PROTOCOL_DESCRIPTIONS, localizeObdText } from "../utils/obd";
import { DemoObdConnection } from "../utils/obdDemo";
import { describeDtc } from "../utils/dtcCodes";
import { addDtcReading, previousOccurrences, sameCodes } from "../utils/dtcHistory";
import { isManufacturerSpecificDtc } from "../utils/obdDtc";
import { getMeta, setMeta } from "../utils/db";
import { useBackButtonClose } from "../utils/backButtonStack";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { celsiusToDisplayTemp, displayTempToCelsius, kmToDisplayDistance, formatDistance } from "../utils/settings";
import ObdRequirementNotice from "./ObdRequirementNotice";
import ArcGauge from "./ArcGauge";
import {
  generateId,
  getObdProfile,
  upsertObdProfile,
  loadLogSessionsForVehicle,
  putLogSession,
  deleteLogSession,
  logSessionToCsv,
} from "../utils/storage";
import { exportTextFile } from "../utils/nativeFileExport";

interface Props {
  vehicle: Vehicle;
  /** Chiamata quando l'utente conferma di aggiornare i km del diario con quelli letti dall'auto. */
  onOdometerKm?: (km: number) => void;
}

const GAUGE_KEYS: (keyof LiveReading)[] = [
  "rpm", "speedKmh", "coolantTempC", "intakeTempC", "throttlePercent", "fuelLevelPercent",
  "engineLoadPercent", "batteryVoltage", "mafGs", "mapKpa", "fuelTrimShortB1", "fuelTrimLongB1",
  "fuelPressureKpa", "o2Bank1Sensor1V", "timingAdvanceDeg",
];

const GAUGE_UNITS: Record<string, string> = {
  rpm: "rpm", speedKmh: "km/h", coolantTempC: "°C", intakeTempC: "°C", throttlePercent: "%",
  fuelLevelPercent: "%", engineLoadPercent: "%", batteryVoltage: "V", mafGs: "g/s", mapKpa: "kPa",
  fuelTrimShortB1: "%", fuelTrimLongB1: "%", fuelPressureKpa: "kPa", o2Bank1Sensor1V: "V", timingAdvanceDeg: "°",
};

// Dati aggiuntivi: letti solo se l'auto li dichiara supportati, mostrati solo se arriva un valore.
const EXTRA_KEYS: (keyof LiveReading)[] = [
  "ambientTempC", "oilTempC", "catalystTempC", "baroKpa", "pedalPercent",
  "runTimeMin", "distSinceClearedKm", "distMilOnKm",
];
const EXTRA_UNITS: Record<string, string> = { baroKpa: "kPa", pedalPercent: "%", runTimeMin: "min" };
const TEMP_KEYS = new Set<string>(["coolantTempC", "intakeTempC", "ambientTempC", "oilTempC", "catalystTempC"]);
const DISTANCE_KEYS = new Set<string>(["distSinceClearedKm", "distMilOnKm"]);

// Schermata Live: i dati sono raggruppati per argomento. I giri e la velocità hanno i quadranti grandi in alto.
const LIVE_GROUPS: { id: "engine" | "fuel" | "temps" | "electric" | "other"; keys: (keyof LiveReading)[] }[] = [
  { id: "engine", keys: ["engineLoadPercent", "throttlePercent", "pedalPercent", "mapKpa", "mafGs", "timingAdvanceDeg"] },
  { id: "fuel", keys: ["fuelLevelPercent", "fuelTrimShortB1", "fuelTrimLongB1", "fuelPressureKpa", "o2Bank1Sensor1V"] },
  { id: "temps", keys: ["coolantTempC", "intakeTempC", "ambientTempC", "oilTempC", "catalystTempC"] },
  { id: "electric", keys: ["batteryVoltage"] },
  { id: "other", keys: ["baroKpa", "runTimeMin", "distSinceClearedKm", "distMilOnKm"] },
];
// Valori in percentuale: si mostra anche una barra di riempimento.
const BAR_KEYS = new Set<string>(["engineLoadPercent", "throttlePercent", "pedalPercent", "fuelLevelPercent"]);

type Tone = { color: "cold" | "hot" | "warn"; tag?: "cold" | "high" | "low" };

// Colori che avvisano. Sono indicazioni di massima, non diagnosi: le soglie sono volutamente prudenti.
function toneFor(key: string, value: number, rpm: number | undefined): Tone | null {
  switch (key) {
    case "coolantTempC":
      if (value < 60) return { color: "cold", tag: "cold" };
      if (value >= 105) return { color: "hot", tag: "high" };
      return null;
    case "oilTempC":
      return value >= 130 ? { color: "hot", tag: "high" } : null;
    case "batteryVoltage": {
      const engineRunning = (rpm ?? 0) > 400;
      if (engineRunning) {
        if (value < 13.0) return { color: "warn", tag: "low" };
        if (value > 15.0) return { color: "hot", tag: "high" };
      } else if (value < 11.8) {
        return { color: "hot", tag: "low" };
      }
      return null;
    }
    case "fuelTrimShortB1":
    case "fuelTrimLongB1":
      return Math.abs(value) > 10 ? { color: "warn" } : null;
    default:
      return null;
  }
}

type LiveTab = "live" | "diagnosis" | "tools";
const LIVE_TABS: LiveTab[] = ["live", "diagnosis", "tools"];

const DTC_MODES: DtcMode[] = ["03", "07", "0A"];
const DTC_MODE_I18N_KEYS: Record<DtcMode, string> = { "03": "live.dtcModes.stored", "07": "live.dtcModes.pending", "0A": "live.dtcModes.permanent" };

export default function LiveDataPanel({ vehicle, onOdometerKm }: Props) {
  const { t, i18n } = useTranslation();
  const { temperatureUnit, formatTemperature, distanceUnit } = useAppSettings();
  const connRef = useRef<ObdConnection | null>(null);
  const [status, setStatus] = useState<ObdStatus>("disconnected");
  const [showRequirementNotice, setShowRequirementNotice] = useState(false);
  const [reading, setReading] = useState<LiveReading>({});
  const [error, setError] = useState<string | null>(null);
  // Adattatore collegato ma auto che non risponde: avviso separato dagli errori, sparisce da solo quando arrivano dati.
  const [vehicleNote, setVehicleNote] = useState<string | null>(null);

  const [dtcMode, setDtcMode] = useState<DtcMode>("03");
  const [dtcCodes, setDtcCodes] = useState<string[] | null>(null);
  const [loadingDtc, setLoadingDtc] = useState(false);
  const [dtcHistory, setDtcHistory] = useState<DtcReading[]>([]);
  // Lettura dello storico che corrisponde ai codici mostrati ora (esclusa dal conteggio "già visto").
  const [currentReadingId, setCurrentReadingId] = useState<string | undefined>(undefined);
  const [showDtcHistory, setShowDtcHistory] = useState(false);

  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);

  const [freezeFrame, setFreezeFrame] = useState<Record<string, number | undefined> | null>(null);
  const [loadingFreeze, setLoadingFreeze] = useState(false);

  const [vin, setVin] = useState<string | null>(null);
  const [loadingVin, setLoadingVin] = useState(false);

  const [ecuName, setEcuName] = useState<string | null>(null);
  const [calibrationId, setCalibrationId] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [loadingEcuInfo, setLoadingEcuInfo] = useState(false);

  const [liveTab, setLiveTab] = useState<LiveTab>("live");
  // Elenco dei PID che l'auto dichiara di supportare (null = non noto): serve per nascondere i dati che non fornisce.
  const [pidList, setPidList] = useState<Set<string> | null>(null);
  // Chilometri letti dal contachilometri dell'auto (solo alcune auto lo forniscono) e relativa proposta di aggiornamento.
  const [odometerKm, setOdometerKm] = useState<number | null>(null);
  const [odometerDone, setOdometerDone] = useState(false);



  const [alarms, setAlarms] = useState<AlarmThresholds>({});
  const [alarmTriggered, setAlarmTriggered] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [chartData, setChartData] = useState<LogSample[]>([]);
  const recordStartRef = useRef<number>(0);
  const samplesRef = useRef<LogSample[]>([]);

  const [sessions, setSessions] = useState<LogSession[]>([]);

  const supported = ObdConnection.isSupported();
  const nativeSupported = ObdConnection.isNativePlatform();
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [devicePickerError, setDevicePickerError] = useState<string | null>(null);

  useBackButtonClose(showRequirementNotice, () => setShowRequirementNotice(false));
  useBackButtonClose(showDevicePicker, () => setShowDevicePicker(false));

  // carica profilo OBD (soglie allarme) e sessioni salvate per questo veicolo
  useEffect(() => {
    getObdProfile(vehicle.id).then((profile) => setAlarms(profile?.alarms ?? {}));
    loadLogSessionsForVehicle(vehicle.id).then(setSessions);
    getObdProfile(vehicle.id).then((profile) => setDtcHistory(profile?.dtcHistory ?? []));
  }, [vehicle.id]);

  useEffect(() => {
    return () => {
      connRef.current?.disconnect();
    };
  }, []);

  // tentativo di riconnessione automatica all'apertura, se il browser lo consente
  useEffect(() => {
    if (!ObdConnection.supportsAutoReconnect()) return;

    let cancelled = false;

    getObdProfile(vehicle.id).then((profile) => {
      if (cancelled || !profile?.lastDeviceId) return;

      const conn = new ObdConnection();
      conn.onStatusChange = setStatus;
      conn.onDisconnected = () => {
        setStatus("disconnected");
        setReading({});
      };
      connRef.current = conn;
      conn.tryAutoReconnect(profile.lastDeviceId, profile.protocol).catch(() => {});
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  // polling dati live
  useEffect(() => {
    if (status !== "connected" || !connRef.current) return;

    let cancelled = false;
    // Solo i dati extra che l'auto supporta (o, se l'elenco non è noto, si prova comunque).
    setPidList(connRef.current.supportedPids);
    setOdometerDone(false);
    connRef.current.readOdometerKm().then((km) => {
      if (!cancelled && km !== null) setOdometerKm(km);
    });
    const extraKeys = EXTRA_KEYS.filter((k) => connRef.current?.isPidSupported(k) !== false);
    let cycle = 0;

    async function loop() {
      while (!cancelled && connRef.current?.status === "connected") {
        // I dati aggiuntivi cambiano lentamente: si rileggono solo ogni 5 giri.
        const keys = cycle % 5 === 0 ? [...GAUGE_KEYS, ...extraKeys] : GAUGE_KEYS;
        cycle++;
        const data = await connRef.current.readLiveData(keys, (key, value) => {
          if (cancelled) return;
          setReading((prev) => ({ ...prev, [key]: value }));
          setVehicleNote(null);
        });
        if (cancelled) break;

        setReading((prev) => ({ ...prev, ...data }));

        if (alarms.maxRpm && data.rpm && data.rpm > alarms.maxRpm) {
          setAlarmTriggered(t("live.alarms.triggeredRpm", { rpm: Math.round(data.rpm) }));
        } else if (alarms.maxCoolantTempC && data.coolantTempC && data.coolantTempC > alarms.maxCoolantTempC) {
          setAlarmTriggered(t("live.alarms.triggeredTemp", { temp: formatTemperature(data.coolantTempC) }));
        }

        if (recording) {
          const t = Date.now() - recordStartRef.current;
          const sample: LogSample = { t, rpm: data.rpm, speedKmh: data.speedKmh, coolantTempC: data.coolantTempC };
          samplesRef.current = [...samplesRef.current, sample];
          setChartData((prev) => {
            const next = [...prev, sample];
            return next.length > 120 ? next.slice(next.length - 120) : next;
          });
        }

        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    loop();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, recording, alarms.maxRpm, alarms.maxCoolantTempC]);

  function connectionErrorMessage(e: unknown): string {
    if (e instanceof Error && e.message === "ADAPTER_SILENT") return t("live.adapterNotResponding");
    return e instanceof Error ? localizeObdText(e.message, t) : t("obdText.gattFailed");
  }

  async function performConnect() {
    setError(null);
    setVehicleNote(null);
    setDtcCodes(null);
    setReadiness(null);
    setFreezeFrame(null);
    setVin(null);

    const conn = new ObdConnection();
    conn.onStatusChange = setStatus;
    conn.onDisconnected = () => {
      setStatus("disconnected");
      setReading({});
    };
    connRef.current = conn;

    try {
      const savedProfile = await getObdProfile(vehicle.id);
      await conn.connect(savedProfile?.protocol);
      if (conn.vehicleResponds === false) {
        setVehicleNote(
          conn.warmUpReply
            ? `${t("live.vehicleNotResponding")} ${t("live.adapterReply")} ${conn.warmUpReply}`
            : t("live.vehicleNotResponding"),
        );
      }
      const detectedProtocol = await conn.detectProtocol();
      await upsertObdProfile(vehicle.id, {
        lastDeviceId: conn.lastDeviceId ?? undefined,
        protocol: detectedProtocol ?? savedProfile?.protocol,
      });
    } catch (e) {
      setStatus("error");
      setError(connectionErrorMessage(e));
    }
  }

  /** Apre l'elenco degli adattatori Bluetooth già accoppiati (solo app Android nativa). */
  async function handleOpenDevicePicker() {
    setDevicePickerError(null);
    try {
      const devices = await ObdConnection.listPairedDevices();
      setPairedDevices(devices);
      setShowDevicePicker(true);
    } catch (e) {
      setDevicePickerError(localizeObdText(e instanceof Error ? e.message : "Impossibile leggere i dispositivi accoppiati.", t));
    }
  }

  async function performConnectNative(device: PairedDevice) {
    setShowDevicePicker(false);
    setError(null);
    setVehicleNote(null);
    setDtcCodes(null);
    setReadiness(null);
    setFreezeFrame(null);
    setVin(null);

    const conn = new ObdConnection();
    conn.onStatusChange = setStatus;
    conn.onDisconnected = () => {
      setStatus("disconnected");
      setReading({});
    };
    connRef.current = conn;

    try {
      const savedProfile = await getObdProfile(vehicle.id);
      await conn.connectNative(device.address, device.name, savedProfile?.protocol);
      if (conn.vehicleResponds === false) {
        setVehicleNote(
          conn.warmUpReply
            ? `${t("live.vehicleNotResponding")} ${t("live.adapterReply")} ${conn.warmUpReply}`
            : t("live.vehicleNotResponding"),
        );
      }
      const detectedProtocol = await conn.detectProtocol();
      await upsertObdProfile(vehicle.id, {
        lastDeviceId: conn.lastDeviceId ?? undefined,
        protocol: detectedProtocol ?? savedProfile?.protocol,
      });
    } catch (e) {
      setStatus("error");
      setError(connectionErrorMessage(e));
    }
  }

  async function handleConnect() {
    const seen = await getMeta("obd:requirementNoticeSeen");
    if (seen === "true") {
      if (nativeSupported) {
        await handleOpenDevicePicker();
      } else {
        await performConnect();
      }
    } else {
      setShowRequirementNotice(true);
    }
  }

  async function handleNoticeContinue(dontShowAgain: boolean) {
    setShowRequirementNotice(false);
    if (dontShowAgain) {
      await setMeta("obd:requirementNoticeSeen", "true");
    }
    if (nativeSupported) {
      await handleOpenDevicePicker();
    } else {
      await performConnect();
    }
  }

  async function handleStartDemo() {
    setError(null);
    setVehicleNote(null);
    setDtcCodes(null);
    setReadiness(null);
    setFreezeFrame(null);
    setVin(null);
    setOdometerKm(null);
    setOdometerDone(false);

    const conn = new DemoObdConnection();
    conn.onStatusChange = setStatus;
    conn.onDisconnected = () => {
      setStatus("disconnected");
      setReading({});
    };
    connRef.current = conn;
    await conn.connectDemo();
  }

  async function handleDisconnect() {
    await connRef.current?.disconnect();
    setReading({});
  }

  async function handleReadDtc(mode: DtcMode) {
    if (!connRef.current) return;
    setDtcMode(mode);
    setLoadingDtc(true);
    const codes = await connRef.current.readDtcCodes(mode);
    setDtcCodes(codes);
    setLoadingDtc(false);
    setCurrentReadingId(undefined);
    // Le letture della modalità demo non finiscono nello storico.
    if (connRef.current.isDemo) return;

    const profile = await getObdProfile(vehicle.id);
    const history = profile?.dtcHistory ?? [];
    const km = odometerKm !== null && odometerKm > 0 ? odometerKm : vehicle.currentKm;
    const updated = addDtcReading(history, { id: generateId(), date: new Date().toISOString(), km, mode, codes });
    const finalHistory = updated ?? history;
    if (updated) await upsertObdProfile(vehicle.id, { dtcHistory: updated });
    setDtcHistory(finalHistory);
    const last = [...finalHistory].reverse().find((r) => r.mode === mode);
    setCurrentReadingId(last && sameCodes(last.codes, codes) ? last.id : undefined);
  }

  async function handleDeleteDtcReading(id: string) {
    const next = dtcHistory.filter((r) => r.id !== id);
    setDtcHistory(next);
    if (id === currentReadingId) setCurrentReadingId(undefined);
    await upsertObdProfile(vehicle.id, { dtcHistory: next });
  }

  function formatReadingDate(iso: string) {
    return new Date(iso).toLocaleDateString(getNumberLocale(i18n.language));
  }

  function renderDtcHistory() {
    if (dtcHistory.length === 0) return null;
    const locale = getNumberLocale(i18n.language);
    return (
      <div className="obd-block">
        <div className="section-head section-head--tight">
          <h2>{t("live.dtcHistory.title")}</h2>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowDtcHistory((v) => !v)}>
            {showDtcHistory ? t("live.dtcHistory.hide") : t("live.dtcHistory.show", { n: dtcHistory.length })}
          </button>
        </div>
        {showDtcHistory && (
          <>
            <p className="obd-hint">{t("live.dtcHistory.hint")}</p>
            <ul className="dtc-history">
              {[...dtcHistory].reverse().map((r) => (
                <li key={r.id} className="dtc-history__item">
                  <div className="dtc-history__meta">
                    <span>{formatReadingDate(r.date)}</span>
                    <span className="mono">{formatDistance(r.km, distanceUnit, locale)}</span>
                    <span>{t(DTC_MODE_I18N_KEYS[r.mode])}</span>
                    <button type="button" className="photo-preview__remove" onClick={() => handleDeleteDtcReading(r.id)}>
                      {t("live.dtcHistory.delete")}
                    </button>
                  </div>
                  {r.codes.length === 0 ? (
                    <p className="dtc-history__none">{t("live.dtcHistory.cleared")}</p>
                  ) : (
                    <div className="dtc-history__codes">
                      {r.codes.map((code) => (
                        <span key={code} className="dtc-list__code" title={describeDtc(code, i18n.language) ?? undefined}>
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  async function handleReadReadiness() {
    if (!connRef.current) return;
    setLoadingReadiness(true);
    const result = await connRef.current.readReadiness();
    setReadiness(result);
    setLoadingReadiness(false);
  }

  async function handleReadFreezeFrame() {
    if (!connRef.current) return;
    setLoadingFreeze(true);
    const result = await connRef.current.readFreezeFrame(["rpm", "speedKmh", "coolantTempC", "engineLoadPercent"]);
    setFreezeFrame(result);
    setLoadingFreeze(false);
  }

  async function handleReadVin() {
    if (!connRef.current) return;
    setLoadingVin(true);
    const result = await connRef.current.readVin();
    setVin(result);
    setLoadingVin(false);
  }

  async function handleReadEcuInfo() {
    if (!connRef.current) return;
    setLoadingEcuInfo(true);
    const [name, calId, proto] = await Promise.all([
      connRef.current.readEcuName(),
      connRef.current.readCalibrationId(),
      connRef.current.detectProtocol(),
    ]);
    setEcuName(name);
    setCalibrationId(calId);
    setProtocol(proto);
    setLoadingEcuInfo(false);
  }

  async function handleSaveAlarms() {
    await upsertObdProfile(vehicle.id, { alarms });
    setAlarmTriggered(null);
  }

  function handleStartRecording() {
    recordStartRef.current = Date.now();
    samplesRef.current = [];
    setChartData([]);
    setRecording(true);
  }

  async function handleStopAndSave() {
    setRecording(false);
    const samples = samplesRef.current;
    if (samples.length === 0 || connRef.current?.isDemo) return;

    const session: LogSession = {
      id: generateId(),
      vehicleId: vehicle.id,
      startedAt: new Date(recordStartRef.current).toISOString(),
      durationMs: samples[samples.length - 1].t,
      samples,
      maxRpm: Math.max(...samples.map((s) => s.rpm ?? 0)),
      maxSpeedKmh: Math.max(...samples.map((s) => s.speedKmh ?? 0)),
      maxCoolantTempC: Math.max(...samples.map((s) => s.coolantTempC ?? 0)),
    };

    setSessions((prev) => [...prev, session]);
    await putLogSession(session);
  }

  function handleDiscardRecording() {
    setRecording(false);
    samplesRef.current = [];
    setChartData([]);
  }

  async function handleDeleteSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    await deleteLogSession(id);
  }

  function handleExportSession(session: LogSession) {
    const csv = logSessionToCsv(session);
    exportTextFile(`sessione-${session.startedAt.slice(0, 10)}-${session.id.slice(0, 6)}.csv`, csv, "text/csv").catch(() => {
      setError(t("live.exportFailed"));
    });
  }

  function renderCard(key: keyof LiveReading) {
    const rawValue = reading[key];
    let displayValue: number | undefined = rawValue;
    let unit = GAUGE_UNITS[key] ?? EXTRA_UNITS[key] ?? "";
    if (rawValue !== undefined && TEMP_KEYS.has(key)) {
      displayValue = Math.round(celsiusToDisplayTemp(rawValue, temperatureUnit));
      unit = `°${temperatureUnit}`;
    } else if (rawValue !== undefined && DISTANCE_KEYS.has(key)) {
      displayValue = Math.round(kmToDisplayDistance(rawValue, distanceUnit));
      unit = distanceUnit;
    }
    const tone = rawValue !== undefined ? toneFor(key, rawValue, reading.rpm) : null;
    const bar = BAR_KEYS.has(key) && rawValue !== undefined ? Math.min(Math.max(rawValue / 100, 0), 1) : null;
    return (
      <div key={key} className={`live-card${tone ? ` live-card--${tone.color}` : ""}${tone?.tag ? " live-card--tagged" : ""}`}>
        <span className="live-card__label">{t(`live.gauges.${key}`)}</span>
        {tone?.tag && <span className="live-card__tag">{t(`live.tone.${tone.tag}`)}</span>}
        <span className="live-card__value">
          {displayValue !== undefined ? displayValue : "—"}
          <span className="live-card__unit">{unit}</span>
        </span>
        {bar !== null && (
          <span className="live-card__bar">
            <span style={{ width: `${bar * 100}%` }} />
          </span>
        )}
      </div>
    );
  }

  function renderLiveDashboard() {
    const diesel = vehicle.fuelType === "diesel";
    const rpmMax = diesel ? 5000 : 7000;
    const rpmRedFrom = diesel ? 4200 / 5000 : 6000 / 7000;

    // Dati che l'auto dichiara di non supportare: niente schede vuote, solo un elenco a scomparsa.
    const unavailable: string[] = [];
    const groups = LIVE_GROUPS.map((group) => ({
      id: group.id,
      keys: group.keys.filter((key) => {
        if (reading[key] !== undefined) return true;
        if (pidList && connRef.current?.isPidSupported(key as LivePidKey) === false) {
          unavailable.push(t(`live.gauges.${key}`));
          return false;
        }
        // i dati aggiuntivi compaiono solo quando arriva un valore; quelli di base mostrano "—" finché non arriva
        return !EXTRA_KEYS.includes(key);
      }),
    })).filter((group) => group.keys.length > 0);

    return (
      <div className="live-dash">
        <div className="live-hero">
          <ArcGauge value={reading.rpm} max={rpmMax} redFrom={rpmRedFrom} label={t("live.gauges.rpm")} unit={t("live.rpmUnit")} />
          <ArcGauge value={reading.speedKmh} max={200} label={t("live.gauges.speedKmh")} unit="km/h" />
        </div>

        {groups.map((group) => (
          <section key={group.id}>
            <h3 className="live-group-title">{t(group.id === "other" ? "live.extraTitle" : `live.groups.${group.id}`)}</h3>
            <div className="live-cards">{group.keys.map((key) => renderCard(key))}</div>
          </section>
        ))}

        {unavailable.length > 0 && (
          <details className="live-unavailable">
            <summary>{t("live.unavailable", { n: unavailable.length })}</summary>
            <p>{unavailable.join(", ")}</p>
          </details>
        )}
        <p className="obd-hint">{t("live.extraHint")}</p>
      </div>
    );
  }

  if (!supported && !nativeSupported && !(connRef.current?.isDemo && status !== "disconnected")) {
    return (
      <>
        <div className="empty-state">
          <p className="empty-state__title">{t("live.notSupportedTitle")}</p>
          <p className="empty-state__body">{t("live.notSupportedBody")}</p>
          <button type="button" className="btn btn--ghost btn--small" onClick={handleStartDemo}>
            {t("live.demo.start")}
          </button>
        </div>
        {renderDtcHistory()}
      </>
    );
  }

  const displayChartData = chartData.map((s) => ({
    ...s,
    coolantTempC: s.coolantTempC !== undefined ? celsiusToDisplayTemp(s.coolantTempC, temperatureUnit) : s.coolantTempC,
  }));

  return (
    <div>
      <div className="obd-status-bar">
        <span className={`obd-status-dot obd-status-dot--${status}`} />
        <span className="obd-status-text">
          {t(`live.status.${status}`)}
          {connRef.current?.lastDeviceName ? ` · ${connRef.current.lastDeviceName}` : ""}
        </span>
        {status === "disconnected" || status === "error" ? (
          <>
            <button type="button" className="btn btn--primary btn--small" onClick={handleConnect}>
              {t("live.connect")}
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={handleStartDemo}>
              {t("live.demo.start")}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--ghost btn--small" onClick={handleDisconnect}>
            {t("live.disconnect")}
          </button>
        )}
      </div>

      {status === "connected" && connRef.current?.isDemo && <p className="obd-demo-banner">{t("live.demo.banner")}</p>}

      {status === "connected" && !connRef.current?.isDemo && odometerKm !== null && !odometerDone && odometerKm > vehicle.currentKm && onOdometerKm && (
        <div className="obd-odometer">
          <p className="obd-odometer__title">{t("live.odometer.title")}</p>
          <p className="obd-odometer__body">
            {t("live.odometer.body", {
              carKm: formatDistance(odometerKm, distanceUnit, getNumberLocale(i18n.language)),
              diaryKm: formatDistance(vehicle.currentKm, distanceUnit, getNumberLocale(i18n.language)),
            })}
          </p>
          <div className="obd-odometer__actions">
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => {
                onOdometerKm(odometerKm);
                setOdometerDone(true);
              }}
            >
              {t("live.odometer.update")}
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setOdometerDone(true)}>
              {t("live.odometer.ignore")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {vehicleNote && <p className="form-error">{vehicleNote}</p>}
      {alarmTriggered && <p className="obd-alarm">⚠ {alarmTriggered}</p>}

      {(status === "connecting" || status === "initializing") && (
        <p className="obd-hint">{t("live.connectingHint")}</p>
      )}

      {status === "connected" && (
        <>
          <div className="live-tabs" role="tablist">
            {LIVE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={liveTab === tab}
                className={`live-tabs__tab${liveTab === tab ? " is-active" : ""}`}
                onClick={() => setLiveTab(tab)}
              >
                {t(`live.tabs.${tab}`)}
              </button>
            ))}
          </div>

          {liveTab === "live" && renderLiveDashboard()}

          {liveTab === "tools" && (
            <>
          {/* Registrazione sessione con grafico live */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.recording.title")}</h2>
              <div className="backup-panel__actions">
                {!recording ? (
                  <button type="button" className="btn btn--primary btn--small" onClick={handleStartRecording}>
                    {t("live.recording.start")}
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn--primary btn--small" onClick={handleStopAndSave}>
                      {t("live.recording.stop")}
                    </button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={handleDiscardRecording}>
                      {t("live.recording.cancel")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {(recording || chartData.length > 0) && (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={displayChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}s`}
                      tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }}
                      stroke="var(--text-muted)"
                    />
                    <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} stroke="var(--text-muted)" />
                    <Tooltip
                      contentStyle={{
                        fontFamily: "JetBrains Mono",
                        fontSize: 12,
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        borderRadius: 4,
                      }}
                      labelFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}s`}
                    />
                    <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
                    <Line type="monotone" dataKey="rpm" name={t("live.recording.chartRpm")} stroke="#e8a33d" dot={false} strokeWidth={2} />
                    <Line
                      type="monotone"
                      dataKey="speedKmh"
                      name={t("live.recording.chartSpeed")}
                      stroke="#5c7a52"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="coolantTempC"
                      name={t("live.recording.chartTemp")}
                      stroke="#b0432c"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {sessions.length > 0 && (
              <table className="data-table" style={{ marginTop: "1rem" }}>
                <thead>
                  <tr>
                    <th>{t("live.recording.columns.date")}</th>
                    <th>{t("live.recording.columns.duration")}</th>
                    <th>{t("live.recording.columns.maxRpm")}</th>
                    <th>{t("live.recording.columns.maxSpeed")}</th>
                    <th>{t("live.recording.columns.maxTemp", { unit: temperatureUnit })}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions
                    .slice()
                    .reverse()
                    .map((s) => (
                      <tr key={s.id}>
                        <td>{new Date(s.startedAt).toLocaleString(getNumberLocale(i18n.language))}</td>
                        <td className="mono">{Math.round(s.durationMs / 1000)}s</td>
                        <td className="mono">{Math.round(s.maxRpm ?? 0)}</td>
                        <td className="mono">{Math.round(s.maxSpeedKmh ?? 0)}</td>
                        <td className="mono">{Math.round(celsiusToDisplayTemp(s.maxCoolantTempC ?? 0, temperatureUnit))}°{temperatureUnit}</td>
                        <td style={{ display: "flex", gap: "0.4rem" }}>
                          <button type="button" className="btn btn--ghost btn--small" onClick={() => handleExportSession(s)}>
                            {t("live.recording.csv")}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--danger btn--small"
                            onClick={() => handleDeleteSession(s.id)}
                          >
                            {t("live.recording.delete")}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Soglie di allarme */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.alarms.title")}</h2>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="alarm-rpm">{t("live.alarms.maxRpm")}</label>
                <input
                  id="alarm-rpm"
                  type="number"
                  placeholder="4500"
                  value={alarms.maxRpm ?? ""}
                  onChange={(e) =>
                    setAlarms((prev) => ({ ...prev, maxRpm: e.target.value ? Number(e.target.value) : undefined }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="alarm-temp">{t("live.alarms.maxTemp", { unit: temperatureUnit })}</label>
                <input
                  id="alarm-temp"
                  type="number"
                  placeholder={String(Math.round(celsiusToDisplayTemp(105, temperatureUnit)))}
                  value={alarms.maxCoolantTempC !== undefined ? Math.round(celsiusToDisplayTemp(alarms.maxCoolantTempC, temperatureUnit)) : ""}
                  onChange={(e) => {
                    const typed = e.target.value ? Number(e.target.value) : undefined;
                    setAlarms((prev) => ({
                      ...prev,
                      maxCoolantTempC: typed !== undefined ? displayTempToCelsius(typed, temperatureUnit) : undefined,
                    }));
                  }}
                />
              </div>
            </div>
            <button type="button" className="btn btn--ghost btn--small" onClick={handleSaveAlarms}>
              {t("live.alarms.save")}
            </button>
          </div>
            </>
          )}

          {liveTab === "diagnosis" && (
            <>
          {/* VIN e info centralina */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.vehicleId.title")}</h2>
              <div className="backup-panel__actions">
                <button type="button" className="btn btn--ghost btn--small" onClick={handleReadVin} disabled={loadingVin}>
                  {loadingVin ? t("live.vehicleId.reading") : t("live.vehicleId.readVin")}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={handleReadEcuInfo}
                  disabled={loadingEcuInfo}
                >
                  {loadingEcuInfo ? t("live.vehicleId.reading") : t("live.vehicleId.ecuInfo")}
                </button>
              </div>
            </div>
            {vin && <p className="obd-vin">{vin}</p>}
            {(ecuName || calibrationId || protocol) && (
              <dl className="ecu-info">
                {protocol && (
                  <div className="ecu-info__row">
                    <dt>{t("live.vehicleId.protocol")}</dt>
                    <dd>{localizeObdText(PROTOCOL_DESCRIPTIONS[protocol] ?? protocol, t)}</dd>
                  </div>
                )}
                {ecuName && (
                  <div className="ecu-info__row">
                    <dt>{t("live.vehicleId.ecu")}</dt>
                    <dd>{ecuName}</dd>
                  </div>
                )}
                {calibrationId && (
                  <div className="ecu-info__row">
                    <dt>{t("live.vehicleId.calibrationId")}</dt>
                    <dd>{calibrationId}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* DTC */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.dtc.title")}</h2>
            </div>
            <div className="backup-panel__actions">
              {DTC_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn btn--small ${dtcMode === mode && dtcCodes !== null ? "btn--primary" : "btn--ghost"}`}
                  onClick={() => handleReadDtc(mode)}
                  disabled={loadingDtc}
                >
                  {t(DTC_MODE_I18N_KEYS[mode])}
                </button>
              ))}
            </div>

            <p className="obd-hint">{t("live.dtc.noClearHint")}</p>

            {dtcCodes !== null &&
              (dtcCodes.length === 0 ? (
                <p className="obd-hint">{t("live.dtc.none", { mode: t(DTC_MODE_I18N_KEYS[dtcMode]).toLowerCase() })}</p>
              ) : (
                <ul className="dtc-list dtc-list--described">
                  {dtcCodes.map((code) => {
                    const description = describeDtc(code, i18n.language);
                    return (
                      <li key={code} className="dtc-list__item dtc-list__item--described">
                        <span className="dtc-list__code">{code}</span>
                        <span className="dtc-list__desc">
                          {description ?? t(isManufacturerSpecificDtc(code) ? "live.dtc.unknownCode" : "live.dtc.unknownGeneric")}
                        </span>
                        {(() => {
                          const seen = previousOccurrences(dtcHistory, code, currentReadingId);
                          return seen ? (
                            <span className="dtc-list__seen">
                              {t("live.dtcHistory.seenBefore", {
                                n: seen.count,
                                date: formatReadingDate(seen.first.date),
                                km: formatDistance(seen.first.km, distanceUnit, getNumberLocale(i18n.language)),
                              })}
                            </span>
                          ) : null;
                        })()}
                      </li>
                    );
                  })}
                </ul>
              ))}

            {dtcCodes !== null && dtcCodes.some((c) => isManufacturerSpecificDtc(c)) && (
              <p className="obd-hint">{t("live.dtc.manufacturerNote")}</p>
            )}
          </div>

          {renderDtcHistory()}

          {/* Readiness monitors */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.readiness.title")}</h2>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={handleReadReadiness}
                disabled={loadingReadiness}
              >
                {loadingReadiness ? t("live.vehicleId.reading") : t("live.readiness.verify")}
              </button>
            </div>
            {readiness && (
              <>
                <p className="obd-hint">
                  {t("live.readiness.milStatus", {
                    status: readiness.milOn ? t("live.readiness.milOn") : t("live.readiness.milOff"),
                    count: readiness.storedCodesCount,
                  })}
                </p>
                <ul className="monitor-list">
                  {readiness.monitors.map((m) => (
                    <li key={m.label} className="monitor-list__item">
                      <span
                        className={`monitor-list__dot ${
                          !m.supported ? "monitor-list__dot--na" : m.ready ? "monitor-list__dot--ok" : "monitor-list__dot--pending"
                        }`}
                      />
                      <span>{localizeObdText(m.label, t)}</span>
                      <span className="monitor-list__status">
                        {!m.supported ? t("live.readiness.notSupported") : m.ready ? t("live.readiness.ready") : t("live.readiness.notReady")}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Freeze frame */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.freezeFrame.title")}</h2>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={handleReadFreezeFrame}
                disabled={loadingFreeze}
              >
                {loadingFreeze ? t("live.vehicleId.reading") : t("live.freezeFrame.read")}
              </button>
            </div>
            {freezeFrame && (
              <div className="stat-row">
                {Object.entries(freezeFrame).map(([key, value]) => {
                  const isTemp = key === "coolantTempC" || key === "intakeTempC";
                  const displayValue =
                    value !== undefined && value !== null && isTemp
                      ? Math.round(celsiusToDisplayTemp(value as number, temperatureUnit))
                      : value;
                  return (
                    <div className="stat-chip" key={key}>
                      <span className="stat-chip__label">{t(`live.gauges.${key}`, key)}</span>
                      <span className="stat-chip__value">
                        {displayValue ?? "—"}
                        {isTemp && displayValue !== undefined && displayValue !== null ? `°${temperatureUnit}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
            </>
          )}
        </>
      )}

      {status === "disconnected" && <p className="obd-hint">{t("live.disconnectedHint")}</p>}

      {showRequirementNotice && (
        <ObdRequirementNotice
          onContinue={handleNoticeContinue}
          onClose={() => setShowRequirementNotice(false)}
          isNative={nativeSupported}
        />
      )}

      {status !== "connected" && renderDtcHistory()}

      {showDevicePicker && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal__header">
              <h2>{t("live.pickDeviceTitle")}</h2>
              <button type="button" className="modal__close" onClick={() => setShowDevicePicker(false)} aria-label={t("common.close")}>
                ×
              </button>
            </div>
            {devicePickerError && <p className="form-error">{devicePickerError}</p>}
            {pairedDevices.length === 0 ? (
              <p className="empty-state__body">
                {t("live.noPairedDevices")}
              </p>
            ) : (
              <ul className="device-picker-list">
                {pairedDevices.map((d) => (
                  <li key={d.address}>
                    <button type="button" className="device-picker-item" onClick={() => performConnectNative(d)}>
                      <span className="device-picker-item__name">{d.name}</span>
                      <span className="device-picker-item__address">{d.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setShowDevicePicker(false)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn--ghost" onClick={handleOpenDevicePicker}>
                {t("live.refreshDevices")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
