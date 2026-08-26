import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getNumberLocale } from "../utils/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { Vehicle, LogSession, LogSample, AlarmThresholds } from "../types";
import { ObdConnection, type LiveReading, type ObdStatus, type DtcMode, type ReadinessResult, PROTOCOL_DESCRIPTIONS } from "../utils/obd";
import { describeDtc } from "../utils/dtcCodes";
import { getMeta, setMeta } from "../utils/db";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { celsiusToDisplayTemp, displayTempToCelsius } from "../utils/settings";
import ObdRequirementNotice from "./ObdRequirementNotice";
import {
  generateId,
  getObdProfile,
  upsertObdProfile,
  loadLogSessionsForVehicle,
  putLogSession,
  deleteLogSession,
  logSessionToCsv,
  downloadTextFile,
} from "../utils/storage";

interface Props {
  vehicle: Vehicle;
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

const POLL_KEYS = GAUGE_KEYS;

const DTC_MODES: DtcMode[] = ["03", "07", "0A"];
const DTC_MODE_I18N_KEYS: Record<DtcMode, string> = { "03": "live.dtcModes.stored", "07": "live.dtcModes.pending", "0A": "live.dtcModes.permanent" };

export default function LiveDataPanel({ vehicle }: Props) {
  const { t, i18n } = useTranslation();
  const { temperatureUnit, formatTemperature } = useAppSettings();
  const connRef = useRef<ObdConnection | null>(null);
  const [status, setStatus] = useState<ObdStatus>("disconnected");
  const [showRequirementNotice, setShowRequirementNotice] = useState(false);
  const [reading, setReading] = useState<LiveReading>({});
  const [error, setError] = useState<string | null>(null);

  const [dtcMode, setDtcMode] = useState<DtcMode>("03");
  const [dtcCodes, setDtcCodes] = useState<string[] | null>(null);
  const [loadingDtc, setLoadingDtc] = useState(false);

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

  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLog, setTerminalLog] = useState<{ cmd: string; response: string }[]>([]);
  const [terminalBusy, setTerminalBusy] = useState(false);

  const [accelArmed, setAccelArmed] = useState(false);
  const [accelStartTime, setAccelStartTime] = useState<number | null>(null);
  const [accelResultMs, setAccelResultMs] = useState<number | null>(null);

  const [customPid, setCustomPid] = useState("");
  const [customPidResult, setCustomPidResult] = useState<string | null>(null);

  const [alarms, setAlarms] = useState<AlarmThresholds>({});
  const [alarmTriggered, setAlarmTriggered] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [chartData, setChartData] = useState<LogSample[]>([]);
  const recordStartRef = useRef<number>(0);
  const samplesRef = useRef<LogSample[]>([]);

  const [sessions, setSessions] = useState<LogSession[]>([]);

  const supported = ObdConnection.isSupported();

  // carica profilo OBD (soglie allarme) e sessioni salvate per questo veicolo
  useEffect(() => {
    getObdProfile(vehicle.id).then((profile) => setAlarms(profile?.alarms ?? {}));
    loadLogSessionsForVehicle(vehicle.id).then(setSessions);
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

    async function loop() {
      while (!cancelled && connRef.current?.status === "connected") {
        const data = await connRef.current.readLiveData(POLL_KEYS);
        if (cancelled) break;

        setReading((prev) => ({ ...prev, ...data }));

        if (data.speedKmh !== undefined) {
          setAccelArmed((armed) => {
            if (armed && data.speedKmh! > 0) {
              setAccelStartTime(Date.now());
              return false; // partenza rilevata, il cronometro ora è attivo
            }
            return armed;
          });
          setAccelStartTime((start) => {
            if (start !== null && data.speedKmh! >= 100) {
              setAccelResultMs(Date.now() - start);
              return null; // test concluso
            }
            return start;
          });
        }

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

  async function performConnect() {
    setError(null);
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
      const detectedProtocol = await conn.detectProtocol();
      await upsertObdProfile(vehicle.id, {
        lastDeviceId: conn.lastDeviceId ?? undefined,
        protocol: detectedProtocol ?? savedProfile?.protocol,
      });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Connection failed.");
    }
  }

  async function handleConnect() {
    const seen = await getMeta("obd:requirementNoticeSeen");
    if (seen === "true") {
      await performConnect();
    } else {
      setShowRequirementNotice(true);
    }
  }

  async function handleNoticeContinue(dontShowAgain: boolean) {
    setShowRequirementNotice(false);
    if (dontShowAgain) {
      await setMeta("obd:requirementNoticeSeen", "true");
    }
    await performConnect();
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
  }

  async function handleClearDtc() {
    if (!connRef.current) return;
    const ok = await connRef.current.clearDtcCodes();
    if (ok) setDtcCodes([]);
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

  function handleArmAccelTest() {
    setAccelArmed(true);
    setAccelStartTime(null);
    setAccelResultMs(null);
  }

  function handleCancelAccelTest() {
    setAccelArmed(false);
    setAccelStartTime(null);
  }

  async function handleSendTerminalCommand() {
    if (!connRef.current || !terminalInput.trim()) return;
    const cmd = terminalInput.trim();
    setTerminalBusy(true);
    try {
      const response = await connRef.current.sendCommand(cmd);
      setTerminalLog((prev) => [...prev, { cmd, response: response || t("live.terminal.noResponse") }].slice(-20));
    } catch (e) {
      setTerminalLog((prev) =>
        [...prev, { cmd, response: e instanceof Error ? e.message : "Error" }].slice(-20),
      );
    }
    setTerminalInput("");
    setTerminalBusy(false);
  }

  async function handleReadCustomPid() {
    if (!connRef.current || !customPid.trim()) return;
    const bytes = await connRef.current.readCustomPid(customPid);
    setCustomPidResult(
      bytes ? t("live.customPid.resultBytes", { bytes: bytes.join(", ") }) : t("live.customPid.resultNone"),
    );
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
    if (samples.length === 0) return;

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
    downloadTextFile(`sessione-${session.startedAt.slice(0, 10)}-${session.id.slice(0, 6)}.csv`, csv, "text/csv");
  }

  if (!supported) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("live.notSupportedTitle")}</p>
        <p className="empty-state__body">{t("live.notSupportedBody")}</p>
      </div>
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
          <button type="button" className="btn btn--primary btn--small" onClick={handleConnect}>
            {t("live.connect")}
          </button>
        ) : (
          <button type="button" className="btn btn--ghost btn--small" onClick={handleDisconnect}>
            {t("live.disconnect")}
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {alarmTriggered && <p className="obd-alarm">⚠ {alarmTriggered}</p>}

      {(status === "connecting" || status === "initializing") && (
        <p className="obd-hint">{t("live.connectingHint")}</p>
      )}

      {status === "connected" && (
        <>
          <div className="gauge-grid">
            {GAUGE_KEYS.map((key) => {
              const rawValue = reading[key];
              const isTemp = key === "coolantTempC" || key === "intakeTempC";
              const displayValue =
                rawValue !== undefined && isTemp
                  ? Math.round(celsiusToDisplayTemp(rawValue, temperatureUnit))
                  : rawValue;
              const unit = isTemp ? `°${temperatureUnit}` : GAUGE_UNITS[key];
              return (
                <div key={key} className="gauge-card">
                  <span className="gauge-card__label">{t(`live.gauges.${key}`)}</span>
                  <span className="gauge-card__value">
                    {displayValue !== undefined ? displayValue : "—"}
                    <span className="gauge-card__unit">{unit}</span>
                  </span>
                </div>
              );
            })}
          </div>

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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6dcc4" />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}s`}
                      tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }}
                      stroke="#8a8172"
                    />
                    <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} stroke="#8a8172" />
                    <Tooltip
                      contentStyle={{
                        fontFamily: "JetBrains Mono",
                        fontSize: 12,
                        background: "#f2ecdd",
                        border: "1px solid #e6dcc4",
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

          {/* Test accelerazione 0-100 */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.accelTest.title")}</h2>
            </div>
            <p className="obd-hint">{t("live.accelTest.hint")}</p>
            <div className="backup-panel__actions">
              {!accelArmed && accelStartTime === null ? (
                <button type="button" className="btn btn--primary btn--small" onClick={handleArmAccelTest}>
                  {t("live.accelTest.arm")}
                </button>
              ) : (
                <button type="button" className="btn btn--ghost btn--small" onClick={handleCancelAccelTest}>
                  {t("live.accelTest.cancel")}
                </button>
              )}
            </div>
            {accelArmed && <p className="obd-hint">{t("live.accelTest.waiting")}</p>}
            {accelStartTime !== null && <p className="obd-hint">{t("live.accelTest.running")}</p>}
            {accelResultMs !== null && (
              <p className="obd-vin">{(accelResultMs / 1000).toFixed(1)} s</p>
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
                    <dd>{PROTOCOL_DESCRIPTIONS[protocol] ?? protocol}</dd>
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
              {dtcCodes && dtcCodes.length > 0 && dtcMode === "03" && (
                <button type="button" className="btn btn--ghost btn--danger btn--small" onClick={handleClearDtc}>
                  {t("live.dtc.clear")}
                </button>
              )}
            </div>

            {dtcCodes !== null &&
              (dtcCodes.length === 0 ? (
                <p className="obd-hint">{t("live.dtc.none", { mode: t(DTC_MODE_I18N_KEYS[dtcMode]).toLowerCase() })}</p>
              ) : (
                <ul className="dtc-list dtc-list--described">
                  {dtcCodes.map((code) => {
                    const description = describeDtc(code);
                    return (
                      <li key={code} className="dtc-list__item dtc-list__item--described">
                        <span className="dtc-list__code">{code}</span>
                        <span className="dtc-list__desc">
                          {description ?? "Manufacturer-specific code: not in the generic dictionary."}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>

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
                      <span>{m.label}</span>
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

          {/* PID personalizzato */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.customPid.title")}</h2>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="custom-pid">{t("live.customPid.label")}</label>
                <input
                  id="custom-pid"
                  type="text"
                  placeholder="1F"
                  value={customPid}
                  onChange={(e) => setCustomPid(e.target.value)}
                />
              </div>
              <div className="field field--checkbox">
                <button type="button" className="btn btn--ghost" onClick={handleReadCustomPid}>
                  {t("live.customPid.read")}
                </button>
              </div>
            </div>
            {customPidResult && <p className="obd-hint">{customPidResult}</p>}
            <p className="obd-hint">{t("live.customPid.hint")}</p>
          </div>

          {/* Terminale avanzato */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>{t("live.terminal.title")}</h2>
            </div>
            <p className="obd-hint">{t("live.terminal.hint")}</p>
            <div className="field-row">
              <div className="field">
                <input
                  type="text"
                  placeholder="ATRV"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendTerminalCommand()}
                />
              </div>
              <div className="field field--checkbox">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleSendTerminalCommand}
                  disabled={terminalBusy}
                >
                  {terminalBusy ? t("live.terminal.sending") : t("live.terminal.send")}
                </button>
              </div>
            </div>
            {terminalLog.length > 0 && (
              <div className="terminal-log">
                {terminalLog.map((entry, i) => (
                  <div key={i} className="terminal-log__entry">
                    <span className="terminal-log__cmd">&gt; {entry.cmd}</span>
                    <span className="terminal-log__response">{entry.response}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {status === "disconnected" && <p className="obd-hint">{t("live.disconnectedHint")}</p>}

      {showRequirementNotice && (
        <ObdRequirementNotice
          onContinue={handleNoticeContinue}
          onClose={() => setShowRequirementNotice(false)}
        />
      )}
    </div>
  );
}
