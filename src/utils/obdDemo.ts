import {
  ObdConnection,
  PIDS,
  type DtcMode,
  type FreezeFrameResult,
  type LivePidKey,
  type LiveReading,
  type ReadinessResult,
} from "./obd";

/**
 * Collegamento simulato per la modalità Demo: nessun Bluetooth, nessuna auto.
 * Produce valori plausibili che variano nel tempo, così si può provare tutta
 * l'app senza adattatore. I dati non vengono mai salvati nel diario.
 */
export class DemoObdConnection extends ObdConnection {
  private startedAt = Date.now();

  constructor() {
    super();
    this.isDemo = true;
    this.lastDeviceName = "Demo";
    this.vehicleResponds = true;
    this.supportedPids = new Set(Object.values(PIDS).map((d) => d.pid).filter((pid) => pid !== "A6"));
  }

  async connectDemo(): Promise<void> {
    this.setStatus("connecting");
    await new Promise((r) => setTimeout(r, 700));
    this.startedAt = Date.now();
    this.setStatus("connected");
  }

  isPidSupported(key: LivePidKey): boolean | null {
    return key === "odometerKm" ? false : true;
  }

  private simulate(key: LivePidKey): number {
    const t = (Date.now() - this.startedAt) / 1000;
    const wave = (period: number, phase = 0) => (Math.sin((t / period) * 2 * Math.PI + phase) + 1) / 2;
    const speed = Math.round(20 + 70 * wave(40));
    const rpm = Math.round(850 + speed * 28 + 150 * wave(7));
    const warm = Math.min(1, t / 90);
    switch (key) {
      case "rpm": return rpm;
      case "speedKmh": return speed;
      case "coolantTempC": return Math.round(35 + 55 * warm);
      case "intakeTempC": return Math.round(22 + 8 * warm);
      case "throttlePercent": return Math.round((12 + 40 * wave(9)) * 10) / 10;
      case "fuelLevelPercent": return 62;
      case "batteryVoltage": return Math.round((14.1 + 0.2 * wave(11)) * 10) / 10;
      case "engineLoadPercent": return Math.round((20 + 45 * wave(9)) * 10) / 10;
      case "mafGs": return Math.round((3 + 18 * wave(9)) * 10) / 10;
      case "mapKpa": return Math.round(35 + 55 * wave(9));
      case "fuelTrimShortB1": return Math.round((-3 + 6 * wave(5)) * 10) / 10;
      case "fuelTrimLongB1": return 1.6;
      case "fuelPressureKpa": return 330;
      case "o2Bank1Sensor1V": return Math.round((0.1 + 0.8 * wave(1.3)) * 100) / 100;
      case "timingAdvanceDeg": return Math.round((10 + 14 * wave(9)) * 10) / 10;
      case "ambientTempC": return 19;
      case "oilTempC": return Math.round(30 + 62 * warm);
      case "baroKpa": return 101;
      case "pedalPercent": return Math.round((10 + 38 * wave(9)) * 10) / 10;
      case "runTimeMin": return Math.floor(t / 60);
      case "distSinceClearedKm": return 412;
      case "distMilOnKm": return 0;
      case "catalystTempC": return Math.round(250 + 350 * warm);
      default: return 0;
    }
  }

  async readPid(key: LivePidKey): Promise<number | null> {
    if (key === "odometerKm") return null;
    return this.simulate(key);
  }

  async readLiveData(keys: LivePidKey[], onValue?: (key: LivePidKey, value: number) => void): Promise<LiveReading> {
    const result: LiveReading = {};
    for (const key of keys) {
      const value = this.simulate(key);
      (result as Record<string, number>)[key] = value;
      onValue?.(key, value);
    }
    await new Promise((r) => setTimeout(r, 300));
    return result;
  }

  async readOdometerKm(): Promise<number | null> {
    return null;
  }

  async detectProtocol(): Promise<string | null> {
    return "6";
  }

  async readVin(): Promise<string | null> {
    return "DEMO0000000000000";
  }

  async readEcuName(): Promise<string | null> {
    return "DEMO-ECU";
  }

  async readCalibrationId(): Promise<string | null> {
    return "DEMO-1.0";
  }

  async readDtcCodes(mode: DtcMode = "03"): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 400));
    if (mode === "03") return ["P0420", "P0171"];
    if (mode === "07") return ["P0301"];
    return [];
  }

  async readReadiness(): Promise<ReadinessResult | null> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      milOn: true,
      storedCodesCount: 2,
      monitors: [
        { label: "Catalizzatore", supported: true, ready: false },
        { label: "Sistema evaporativo (EVAP)", supported: true, ready: true },
        { label: "Sonda lambda (O2)", supported: true, ready: true },
        { label: "Riscaldamento sonda lambda", supported: true, ready: true },
        { label: "Ricircolo gas di scarico (EGR)", supported: false, ready: false },
      ],
    };
  }

  async readFreezeFrame(): Promise<FreezeFrameResult> {
    return { rpm: 2150, speedKmh: 62, coolantTempC: 88, engineLoadPercent: 43.5 };
  }

  async disconnect(): Promise<void> {
    this.setStatus("disconnected");
    this.onDisconnected?.();
  }
}
