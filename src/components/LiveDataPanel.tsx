import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { Vehicle, LogSession, LogSample, AlarmThresholds } from "../types";
import { ObdConnection, type LiveReading, type ObdStatus, type DtcMode, type ReadinessResult, PROTOCOL_DESCRIPTIONS } from "../utils/obd";
import { describeDtc } from "../utils/dtcCodes";
import {
  generateId,
  getObdProfile,
  upsertObdProfile,
  loadLogSessions,
  saveLogSessions,
  logSessionToCsv,
  downloadTextFile,
} from "../utils/storage";

interface Props {
  vehicle: Vehicle;
}

const STATUS_LABELS: Record<ObdStatus, string> = {
  disconnected: "Non connesso",
  connecting: "Selezione dispositivo…",
  initializing: "Inizializzazione adattatore…",
  connected: "Connesso",
  error: "Errore",
};

const GAUGES: { key: keyof LiveReading; label: string; unit: string }[] = [
  { key: "rpm", label: "Giri motore", unit: "rpm" },
  { key: "speedKmh", label: "Velocità", unit: "km/h" },
  { key: "coolantTempC", label: "Temp. liquido", unit: "°C" },
  { key: "intakeTempC", label: "Temp. aspirazione", unit: "°C" },
  { key: "throttlePercent", label: "Farfalla", unit: "%" },
  { key: "fuelLevelPercent", label: "Livello carburante", unit: "%" },
  { key: "engineLoadPercent", label: "Carico motore", unit: "%" },
  { key: "batteryVoltage", label: "Batteria", unit: "V" },
  { key: "mafGs", label: "Portata aria (MAF)", unit: "g/s" },
  { key: "mapKpa", label: "Pressione collettore", unit: "kPa" },
  { key: "fuelTrimShortB1", label: "Fuel trim breve", unit: "%" },
  { key: "fuelTrimLongB1", label: "Fuel trim lungo", unit: "%" },
  { key: "fuelPressureKpa", label: "Pressione carburante", unit: "kPa" },
  { key: "o2Bank1Sensor1V", label: "Sonda lambda B1S1", unit: "V" },
  { key: "timingAdvanceDeg", label: "Anticipo accensione", unit: "°" },
];

const POLL_KEYS = GAUGES.map((g) => g.key);

const DTC_MODE_LABELS: Record<DtcMode, string> = {
  "03": "Memorizzati",
  "07": "Pending",
  "0A": "Permanenti",
};

export default function LiveDataPanel({ vehicle }: Props) {
  const connRef = useRef<ObdConnection | null>(null);
  const [status, setStatus] = useState<ObdStatus>("disconnected");
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

  const [alarms, setAlarms] = useState<AlarmThresholds>(() => getObdProfile(vehicle.id)?.alarms ?? {});
  const [alarmTriggered, setAlarmTriggered] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [chartData, setChartData] = useState<LogSample[]>([]);
  const recordStartRef = useRef<number>(0);
  const samplesRef = useRef<LogSample[]>([]);

  const [sessions, setSessions] = useState<LogSession[]>(() =>
    loadLogSessions().filter((s) => s.vehicleId === vehicle.id),
  );

  const supported = ObdConnection.isSupported();

  useEffect(() => {
    return () => {
      connRef.current?.disconnect();
    };
  }, []);

  // tentativo di riconnessione automatica all'apertura, se il browser lo consente
  useEffect(() => {
    if (!ObdConnection.supportsAutoReconnect()) return;
    const profile = getObdProfile(vehicle.id);
    if (!profile?.lastDeviceId) return;

    const conn = new ObdConnection();
    conn.onStatusChange = setStatus;
    conn.onDisconnected = () => {
      setStatus("disconnected");
      setReading({});
    };
    connRef.current = conn;
    conn.tryAutoReconnect(profile.lastDeviceId, profile.protocol).catch(() => {});
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
          setAlarmTriggered(`Giri motore oltre soglia: ${Math.round(data.rpm)} rpm`);
        } else if (alarms.maxCoolantTempC && data.coolantTempC && data.coolantTempC > alarms.maxCoolantTempC) {
          setAlarmTriggered(`Temperatura liquido oltre soglia: ${data.coolantTempC}°C`);
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

  async function handleConnect() {
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
      const savedProfile = getObdProfile(vehicle.id);
      await conn.connect(savedProfile?.protocol);
      const protocol = await conn.detectProtocol();
      upsertObdProfile(vehicle.id, {
        lastDeviceId: conn.lastDeviceId ?? undefined,
        protocol: protocol ?? savedProfile?.protocol,
      });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Connessione non riuscita.");
    }
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
      setTerminalLog((prev) => [...prev, { cmd, response: response || "(nessuna risposta)" }].slice(-20));
    } catch (e) {
      setTerminalLog((prev) =>
        [...prev, { cmd, response: e instanceof Error ? e.message : "Errore" }].slice(-20),
      );
    }
    setTerminalInput("");
    setTerminalBusy(false);
  }

  async function handleReadCustomPid() {
    if (!connRef.current || !customPid.trim()) return;
    const bytes = await connRef.current.readCustomPid(customPid);
    setCustomPidResult(bytes ? `Byte: ${bytes.join(", ")} (dec)` : "Nessun dato per questo PID");
  }

  function handleSaveAlarms() {
    upsertObdProfile(vehicle.id, { alarms });
    setAlarmTriggered(null);
  }

  function handleStartRecording() {
    recordStartRef.current = Date.now();
    samplesRef.current = [];
    setChartData([]);
    setRecording(true);
  }

  function handleStopAndSave() {
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

    const all = [...loadLogSessions(), session];
    saveLogSessions(all);
    setSessions(all.filter((s) => s.vehicleId === vehicle.id));
  }

  function handleDiscardRecording() {
    setRecording(false);
    samplesRef.current = [];
    setChartData([]);
  }

  function handleDeleteSession(id: string) {
    const all = loadLogSessions().filter((s) => s.id !== id);
    saveLogSessions(all);
    setSessions(all.filter((s) => s.vehicleId === vehicle.id));
  }

  function handleExportSession(session: LogSession) {
    const csv = logSessionToCsv(session);
    downloadTextFile(`sessione-${session.startedAt.slice(0, 10)}-${session.id.slice(0, 6)}.csv`, csv, "text/csv");
  }

  if (!supported) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Web Bluetooth non disponibile</p>
        <p className="empty-state__body">
          Questa funzione richiede Chrome o Edge su Android (o desktop). Safari su iPhone non supporta la
          connessione Bluetooth dal browser.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="obd-status-bar">
        <span className={`obd-status-dot obd-status-dot--${status}`} />
        <span className="obd-status-text">
          {STATUS_LABELS[status]}
          {connRef.current?.lastDeviceName ? ` · ${connRef.current.lastDeviceName}` : ""}
        </span>
        {status === "disconnected" || status === "error" ? (
          <button type="button" className="btn btn--primary btn--small" onClick={handleConnect}>
            Collega adattatore OBD2
          </button>
        ) : (
          <button type="button" className="btn btn--ghost btn--small" onClick={handleDisconnect}>
            Disconnetti
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {alarmTriggered && <p className="obd-alarm">⚠ {alarmTriggered}</p>}

      {(status === "connecting" || status === "initializing") && (
        <p className="obd-hint">Segui la richiesta del browser per selezionare il tuo adattatore OBD2 Bluetooth.</p>
      )}

      {status === "connected" && (
        <>
          <div className="gauge-grid">
            {GAUGES.map((g) => {
              const value = reading[g.key];
              return (
                <div key={g.key} className="gauge-card">
                  <span className="gauge-card__label">{g.label}</span>
                  <span className="gauge-card__value">
                    {value !== undefined ? value : "—"}
                    <span className="gauge-card__unit">{g.unit}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Registrazione sessione con grafico live */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>Registrazione sessione</h2>
              <div className="backup-panel__actions">
                {!recording ? (
                  <button type="button" className="btn btn--primary btn--small" onClick={handleStartRecording}>
                    ● Avvia registrazione
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn--primary btn--small" onClick={handleStopAndSave}>
                      ■ Ferma e salva
                    </button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={handleDiscardRecording}>
                      Annulla
                    </button>
                  </>
                )}
              </div>
            </div>

            {(recording || chartData.length > 0) && (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                    <Line type="monotone" dataKey="rpm" name="Giri" stroke="#e8a33d" dot={false} strokeWidth={2} />
                    <Line
                      type="monotone"
                      dataKey="speedKmh"
                      name="Velocità"
                      stroke="#5c7a52"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="coolantTempC"
                      name="Temp. liquido"
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
                    <th>Data</th>
                    <th>Durata</th>
                    <th>Max rpm</th>
                    <th>Max km/h</th>
                    <th>Max °C</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions
                    .slice()
                    .reverse()
                    .map((s) => (
                      <tr key={s.id}>
                        <td>{new Date(s.startedAt).toLocaleString("it-IT")}</td>
                        <td className="mono">{Math.round(s.durationMs / 1000)}s</td>
                        <td className="mono">{Math.round(s.maxRpm ?? 0)}</td>
                        <td className="mono">{Math.round(s.maxSpeedKmh ?? 0)}</td>
                        <td className="mono">{Math.round(s.maxCoolantTempC ?? 0)}</td>
                        <td style={{ display: "flex", gap: "0.4rem" }}>
                          <button type="button" className="btn btn--ghost btn--small" onClick={() => handleExportSession(s)}>
                            CSV
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--danger btn--small"
                            onClick={() => handleDeleteSession(s.id)}
                          >
                            Elimina
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
              <h2>Test accelerazione 0-100 km/h</h2>
            </div>
            <p className="obd-hint">
              Stima approssimativa (la lettura velocità è campionata ogni ~1,2s, quindi il tempo non è preciso
              come un cronometro dedicato). Da fermo, premi "Armato" e parti.
            </p>
            <div className="backup-panel__actions">
              {!accelArmed && accelStartTime === null ? (
                <button type="button" className="btn btn--primary btn--small" onClick={handleArmAccelTest}>
                  Armato — pronto a partire
                </button>
              ) : (
                <button type="button" className="btn btn--ghost btn--small" onClick={handleCancelAccelTest}>
                  Annulla
                </button>
              )}
            </div>
            {accelArmed && <p className="obd-hint">In attesa che l'auto inizi a muoversi…</p>}
            {accelStartTime !== null && <p className="obd-hint">Cronometro in corso…</p>}
            {accelResultMs !== null && (
              <p className="obd-vin">{(accelResultMs / 1000).toFixed(1)} s</p>
            )}
          </div>

          {/* Soglie di allarme */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>Soglie di allarme</h2>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="alarm-rpm">Giri motore massimi</label>
                <input
                  id="alarm-rpm"
                  type="number"
                  placeholder="es. 4500"
                  value={alarms.maxRpm ?? ""}
                  onChange={(e) =>
                    setAlarms((prev) => ({ ...prev, maxRpm: e.target.value ? Number(e.target.value) : undefined }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="alarm-temp">Temperatura liquido massima (°C)</label>
                <input
                  id="alarm-temp"
                  type="number"
                  placeholder="es. 105"
                  value={alarms.maxCoolantTempC ?? ""}
                  onChange={(e) =>
                    setAlarms((prev) => ({
                      ...prev,
                      maxCoolantTempC: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
            </div>
            <button type="button" className="btn btn--ghost btn--small" onClick={handleSaveAlarms}>
              Salva soglie
            </button>
          </div>

          {/* VIN e info centralina */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>Identificazione veicolo</h2>
              <div className="backup-panel__actions">
                <button type="button" className="btn btn--ghost btn--small" onClick={handleReadVin} disabled={loadingVin}>
                  {loadingVin ? "Lettura…" : "Leggi VIN"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={handleReadEcuInfo}
                  disabled={loadingEcuInfo}
                >
                  {loadingEcuInfo ? "Lettura…" : "Info centralina"}
                </button>
              </div>
            </div>
            {vin && <p className="obd-vin">{vin}</p>}
            {(ecuName || calibrationId || protocol) && (
              <dl className="ecu-info">
                {protocol && (
                  <div className="ecu-info__row">
                    <dt>Protocollo</dt>
                    <dd>{PROTOCOL_DESCRIPTIONS[protocol] ?? protocol}</dd>
                  </div>
                )}
                {ecuName && (
                  <div className="ecu-info__row">
                    <dt>Centralina</dt>
                    <dd>{ecuName}</dd>
                  </div>
                )}
                {calibrationId && (
                  <div className="ecu-info__row">
                    <dt>ID calibrazione</dt>
                    <dd>{calibrationId}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* DTC */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>Codici errore (DTC)</h2>
            </div>
            <div className="backup-panel__actions">
              {(Object.keys(DTC_MODE_LABELS) as DtcMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn btn--small ${dtcMode === mode && dtcCodes !== null ? "btn--primary" : "btn--ghost"}`}
                  onClick={() => handleReadDtc(mode)}
                  disabled={loadingDtc}
                >
                  {DTC_MODE_LABELS[mode]}
                </button>
              ))}
              {dtcCodes && dtcCodes.length > 0 && dtcMode === "03" && (
                <button type="button" className="btn btn--ghost btn--danger btn--small" onClick={handleClearDtc}>
                  Cancella codici
                </button>
              )}
            </div>

            {dtcCodes !== null &&
              (dtcCodes.length === 0 ? (
                <p className="obd-hint">Nessun codice {DTC_MODE_LABELS[dtcMode].toLowerCase()}.</p>
              ) : (
                <ul className="dtc-list dtc-list--described">
                  {dtcCodes.map((code) => {
                    const description = describeDtc(code);
                    return (
                      <li key={code} className="dtc-list__item dtc-list__item--described">
                        <span className="dtc-list__code">{code}</span>
                        <span className="dtc-list__desc">
                          {description ?? "Codice specifico del costruttore: non presente nel dizionario generico."}
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
              <h2>Readiness monitor (pre-revisione)</h2>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={handleReadReadiness}
                disabled={loadingReadiness}
              >
                {loadingReadiness ? "Lettura…" : "Verifica"}
              </button>
            </div>
            {readiness && (
              <>
                <p className="obd-hint">
                  Spia motore: {readiness.milOn ? "ACCESA" : "spenta"} · Codici memorizzati:{" "}
                  {readiness.storedCodesCount}
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
                        {!m.supported ? "non supportato" : m.ready ? "pronto" : "non completato"}
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
              <h2>Freeze frame</h2>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={handleReadFreezeFrame}
                disabled={loadingFreeze}
              >
                {loadingFreeze ? "Lettura…" : "Leggi ultimo freeze frame"}
              </button>
            </div>
            {freezeFrame && (
              <div className="stat-row">
                {Object.entries(freezeFrame).map(([key, value]) => (
                  <div className="stat-chip" key={key}>
                    <span className="stat-chip__label">{GAUGES.find((g) => g.key === key)?.label ?? key}</span>
                    <span className="stat-chip__value">{value ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PID personalizzato */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>PID personalizzato</h2>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="custom-pid">Codice PID (esadecimale, es. 1F)</label>
                <input
                  id="custom-pid"
                  type="text"
                  placeholder="es. 1F"
                  value={customPid}
                  onChange={(e) => setCustomPid(e.target.value)}
                />
              </div>
              <div className="field field--checkbox">
                <button type="button" className="btn btn--ghost" onClick={handleReadCustomPid}>
                  Leggi PID
                </button>
              </div>
            </div>
            {customPidResult && <p className="obd-hint">{customPidResult}</p>}
            <p className="obd-hint">
              Restituisce i byte grezzi: utile per PID specifici del costruttore non presenti tra quelli standard.
            </p>
          </div>

          {/* Terminale avanzato */}
          <div className="obd-block">
            <div className="section-head section-head--tight">
              <h2>Terminale</h2>
            </div>
            <p className="obd-hint">
              Invia comandi AT o OBD grezzi direttamente all'adattatore (es. <code>ATI</code>, <code>0100</code>,{" "}
              <code>ATRV</code>). Per utenti esperti: comandi errati non danneggiano l'auto ma possono richiedere
              di riconnettersi.
            </p>
            <div className="field-row">
              <div className="field">
                <input
                  type="text"
                  placeholder="es. ATRV"
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
                  {terminalBusy ? "Invio…" : "Invia"}
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

      {status === "disconnected" && (
        <p className="obd-hint">
          Collega un adattatore OBD2 Bluetooth Low Energy (es. Vgate iCar Pro BLE, Veepeak OBDCheck BLE) alla
          presa OBD2 dell'auto, accendi il quadro e premi "Collega adattatore".
        </p>
      )}
    </div>
  );
}
