// Comunicazione con adattatori OBD2 ELM327 via Web Bluetooth (BLE).
//
// Gli adattatori ELM327 BLE più comuni (Vgate iCar Pro, Veepeak OBDCheck BLE, cloni
// generici) espongono un servizio "seriale" su GATT, ma non esiste un UUID
// universale: proviamo in sequenza i più diffusi.

// Servizio "Nordic UART" (nRF UART) — usato da diversi cloni ELM327 BLE
const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // scrittura verso l'adattatore
const NUS_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notifiche dall'adattatore

// Servizio "HM-10 style" — usato da Vgate iCar Pro BLE, Veepeak e molti altri
const HM10_SERVICE = "0000ffe0-0000-1000-8000-00805f9b34fb";
const HM10_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb"; // stesso characteristic per tx e rx

interface ProfileMatch {
  serviceUuid: string;
  writeUuid: string;
  notifyUuid: string;
}

const KNOWN_PROFILES: ProfileMatch[] = [
  { serviceUuid: NUS_SERVICE, writeUuid: NUS_TX, notifyUuid: NUS_RX },
  { serviceUuid: HM10_SERVICE, writeUuid: HM10_CHAR, notifyUuid: HM10_CHAR },
];

export interface LiveReading {
  rpm?: number;
  speedKmh?: number;
  coolantTempC?: number;
  intakeTempC?: number;
  throttlePercent?: number;
  fuelLevelPercent?: number;
  batteryVoltage?: number;
  engineLoadPercent?: number;
  mafGs?: number; // portata aria massica, grammi/secondo
  fuelTrimShortB1?: number; // %, correzione carburazione a breve termine banco 1
  fuelTrimLongB1?: number; // %, correzione carburazione a lungo termine banco 1
  fuelPressureKpa?: number;
  o2Bank1Sensor1V?: number; // tensione sonda lambda banco1 sensore1
  mapKpa?: number; // pressione assoluta collettore (proxy per boost turbo)
  timingAdvanceDeg?: number;
}

export type ObdStatus = "disconnected" | "connecting" | "initializing" | "connected" | "error";

export type DtcMode = "03" | "07" | "0A"; // memorizzati / pending / permanenti

// PID standard OBD-II Mode 01, con relativa funzione di parsing della risposta esadecimale
interface PidDefinition {
  pid: string;
  parse: (data: number[]) => number;
}

const PIDS: Record<string, PidDefinition> = {
  rpm: { pid: "0C", parse: (d) => (d[0] * 256 + d[1]) / 4 },
  speedKmh: { pid: "0D", parse: (d) => d[0] },
  coolantTempC: { pid: "05", parse: (d) => d[0] - 40 },
  intakeTempC: { pid: "0F", parse: (d) => d[0] - 40 },
  throttlePercent: { pid: "11", parse: (d) => (d[0] * 100) / 255 },
  fuelLevelPercent: { pid: "2F", parse: (d) => (d[0] * 100) / 255 },
  batteryVoltage: { pid: "42", parse: (d) => (d[0] * 256 + d[1]) / 1000 },
  engineLoadPercent: { pid: "04", parse: (d) => (d[0] * 100) / 255 },
  mafGs: { pid: "10", parse: (d) => (d[0] * 256 + d[1]) / 100 },
  fuelTrimShortB1: { pid: "06", parse: (d) => (d[0] - 128) * (100 / 128) },
  fuelTrimLongB1: { pid: "07", parse: (d) => (d[0] - 128) * (100 / 128) },
  fuelPressureKpa: { pid: "0A", parse: (d) => d[0] * 3 },
  o2Bank1Sensor1V: { pid: "14", parse: (d) => d[0] / 200 },
  mapKpa: { pid: "0B", parse: (d) => d[0] },
  timingAdvanceDeg: { pid: "0E", parse: (d) => d[0] / 2 - 64 },
};

export type LivePidKey = keyof typeof PIDS;

const READINESS_MONITOR_LABELS_SPARK: { bit: number; label: string }[] = [
  { bit: 0, label: "Catalizzatore" },
  { bit: 1, label: "Catalizzatore riscaldato" },
  { bit: 2, label: "Sistema evaporativo (EVAP)" },
  { bit: 3, label: "Aria secondaria" },
  { bit: 5, label: "Sonda lambda (O2)" },
  { bit: 6, label: "Riscaldamento sonda lambda" },
  { bit: 7, label: "Ricircolo gas di scarico (EGR)" },
];

export interface ReadinessResult {
  milOn: boolean;
  storedCodesCount: number;
  monitors: { label: string; ready: boolean; supported: boolean }[];
}

export interface FreezeFrameResult {
  [key: string]: number | undefined;
}

export const PROTOCOL_DESCRIPTIONS: Record<string, string> = {
  "0": "Automatico",
  "1": "SAE J1850 PWM (41.6 kbaud)",
  "2": "SAE J1850 VPW (10.4 kbaud)",
  "3": "ISO 9141-2 (5 baud init)",
  "4": "ISO 14230-4 KWP (5 baud init)",
  "5": "ISO 14230-4 KWP (fast init)",
  "6": "ISO 15765-4 CAN (11 bit ID, 500 kbaud)",
  "7": "ISO 15765-4 CAN (29 bit ID, 500 kbaud)",
  "8": "ISO 15765-4 CAN (11 bit ID, 250 kbaud)",
  "9": "ISO 15765-4 CAN (29 bit ID, 250 kbaud)",
  A: "SAE J1939 CAN (29 bit ID, 250 kbaud)",
};

export class ObdConnection {
  private device: BluetoothDevice | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
  private buffer = "";
  private pendingResolve: ((value: string) => void) | null = null;

  public status: ObdStatus = "disconnected";
  public onStatusChange?: (status: ObdStatus) => void;
  public onDisconnected?: () => void;
  public lastDeviceId: string | null = null;
  public lastDeviceName: string | null = null;

  private setStatus(status: ObdStatus) {
    this.status = status;
    this.onStatusChange?.(status);
  }

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  /** Alcuni browser Chromium espongono navigator.bluetooth.getDevices() per i device già autorizzati. */
  static supportsAutoReconnect(): boolean {
    return ObdConnection.isSupported() && typeof navigator.bluetooth.getDevices === "function";
  }

  /** Prova a riconnettersi in automatico a un device già autorizzato in precedenza (stesso id). */
  async tryAutoReconnect(preferredDeviceId?: string, protocol?: string): Promise<boolean> {
    if (!ObdConnection.supportsAutoReconnect() || !navigator.bluetooth.getDevices) return false;
    try {
      const devices = await navigator.bluetooth.getDevices();
      const target = preferredDeviceId ? devices.find((d) => d.id === preferredDeviceId) : devices[0];
      if (!target) return false;

      await this.connectToDevice(target, protocol);
      return true;
    } catch {
      return false;
    }
  }

  async connect(protocol?: string): Promise<void> {
    if (!ObdConnection.isSupported()) {
      throw new Error("Questo browser non supporta Web Bluetooth. Usa Chrome o Edge su Android.");
    }

    this.setStatus("connecting");

    const allServiceUuids = KNOWN_PROFILES.map((p) => p.serviceUuid);

    const device = await navigator.bluetooth.requestDevice({
      filters: allServiceUuids.map((uuid) => ({ services: [uuid] })),
      optionalServices: allServiceUuids,
    });

    await this.connectToDevice(device, protocol);
  }

  private async connectToDevice(device: BluetoothDevice, protocol?: string): Promise<void> {
    this.setStatus("connecting");
    this.device = device;
    this.lastDeviceId = device.id ?? null;
    this.lastDeviceName = device.name ?? null;

    device.addEventListener("gattserverdisconnected", () => {
      this.setStatus("disconnected");
      this.onDisconnected?.();
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error("Connessione GATT non riuscita.");

    let matched: ProfileMatch | null = null;
    for (const profile of KNOWN_PROFILES) {
      try {
        const service = await server.getPrimaryService(profile.serviceUuid);
        const writeChar = await service.getCharacteristic(profile.writeUuid);
        const notifyChar = await service.getCharacteristic(profile.notifyUuid);
        this.writeChar = writeChar;
        this.notifyChar = notifyChar;
        matched = profile;
        break;
      } catch {
        // profilo non disponibile su questo device, provo il prossimo
      }
    }

    if (!matched || !this.writeChar || !this.notifyChar) {
      throw new Error("Adattatore non riconosciuto: nessun servizio Bluetooth compatibile trovato.");
    }

    await this.notifyChar.startNotifications();
    this.notifyChar.addEventListener("characteristicvaluechanged", this.handleNotification);

    this.setStatus("initializing");
    await this.initializeElm327(protocol);
    this.setStatus("connected");
  }

  private handleNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;
    const text = new TextDecoder().decode(value);
    this.buffer += text;

    if (this.buffer.includes(">")) {
      const response = this.buffer;
      this.buffer = "";
      this.pendingResolve?.(response);
      this.pendingResolve = null;
    }
  };

  /** Invia un comando grezzo (AT o OBD) e ritorna la risposta testuale non elaborata. Per il terminale avanzato. */
  async sendCommand(command: string, timeoutMs = 4000): Promise<string> {
    const raw = await this.sendRaw(command, timeoutMs);
    return this.cleanResponse(raw);
  }

  private async sendRaw(command: string, timeoutMs = 4000): Promise<string> {
    if (!this.writeChar) throw new Error("Non connesso.");

    const responsePromise = new Promise<string>((resolve, reject) => {
      this.pendingResolve = resolve;
      setTimeout(() => {
        if (this.pendingResolve) {
          this.pendingResolve = null;
          reject(new Error(`Timeout in attesa di risposta a "${command}"`));
        }
      }, timeoutMs);
    });

    const payload = new TextEncoder().encode(command + "\r");
    await this.writeChar.writeValue(payload);

    return responsePromise;
  }

  private async initializeElm327(protocol?: string): Promise<void> {
    await this.sendRaw("ATZ").catch(() => "");
    await new Promise((r) => setTimeout(r, 400));
    await this.sendRaw("ATE0").catch(() => "");
    await this.sendRaw("ATL0").catch(() => "");
    await this.sendRaw("ATS0").catch(() => "");
    await this.sendRaw("ATH0").catch(() => "");
    await this.sendRaw(protocol ? `ATSP${protocol}` : "ATSP0").catch(() => "");
  }

  /** Rileva il protocollo OBD attualmente in uso dopo la connessione (utile da salvare nel profilo veicolo). */
  async detectProtocol(): Promise<string | null> {
    try {
      const raw = await this.sendRaw("ATDPN");
      const cleaned = raw.replace(/>/g, "").replace(/[\r\n]/g, "").trim();
      return cleaned || null;
    } catch {
      return null;
    }
  }

  private cleanResponse(raw: string): string {
    return raw.replace(/>/g, "").replace(/[\r\n]/g, " ").trim().toUpperCase();
  }

  private parseHexResponse(raw: string, mode: string, expectedPid?: string): number[] | null {
    const cleaned = this.cleanResponse(raw);
    if (cleaned.includes("NO DATA") || cleaned.includes("ERROR") || cleaned === "") return null;

    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const modeIdx = tokens.findIndex((t) => t === mode);
    if (modeIdx === -1) return null;

    let dataTokens: string[];
    if (expectedPid) {
      if (tokens[modeIdx + 1] !== expectedPid) return null;
      dataTokens = tokens.slice(modeIdx + 2);
    } else {
      dataTokens = tokens.slice(modeIdx + 1);
    }

    const bytes = dataTokens.map((t) => parseInt(t, 16)).filter((n) => !Number.isNaN(n));
    return bytes.length > 0 ? bytes : null;
  }

  async readPid(key: LivePidKey): Promise<number | null> {
    const def = PIDS[key];
    if (!def) return null;
    try {
      const raw = await this.sendRaw(`01${def.pid}`);
      const bytes = this.parseHexResponse(raw, "41", def.pid);
      if (!bytes) return null;
      return def.parse(bytes);
    } catch {
      return null;
    }
  }

  async readLiveData(keys: LivePidKey[]): Promise<LiveReading> {
    const result: LiveReading = {};
    for (const key of keys) {
      const value = await this.readPid(key);
      if (value !== null && !Number.isNaN(value)) {
        (result as Record<string, number>)[key] = Math.round(value * 10) / 10;
      }
    }
    return result;
  }

  /** Legge un PID Mode 01 non standard/personalizzato, ritorna i byte grezzi (decimali). */
  async readCustomPid(pidHex: string): Promise<number[] | null> {
    const clean = pidHex.trim().toUpperCase().replace(/^0X/, "");
    if (!/^[0-9A-F]{2}$/.test(clean)) return null;
    try {
      const raw = await this.sendRaw(`01${clean}`);
      return this.parseHexResponse(raw, "41", clean);
    } catch {
      return null;
    }
  }

  /** Legge un campo testuale Mode 09 (VIN=02, ID calibrazione=04, nome UCE=0A), gestendo risposte multi-riga. */
  private async readMode09Text(pid: string, timeoutMs = 6000): Promise<string | null> {
    try {
      const raw = await this.sendRaw(`09${pid}`, timeoutMs);
      const cleaned = this.cleanResponse(raw);
      if (cleaned.includes("NO DATA") || cleaned.includes("ERROR") || cleaned === "") return null;

      const tokens = cleaned.split(/\s+/).filter(Boolean);
      const bytes: number[] = [];
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === "49" && tokens[i + 1] === pid) {
          const lineBytes = tokens.slice(i + 3);
          for (const t of lineBytes) {
            const n = parseInt(t, 16);
            if (!Number.isNaN(n)) bytes.push(n);
          }
        }
      }
      if (bytes.length === 0) return null;
      const text = bytes
        .map((b) => String.fromCharCode(b))
        .join("")
        .replace(/\0/g, "")
        .trim();
      return text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }

  /** Legge il VIN (Mode 09 PID 02). La risposta ELM327 arriva spesso su più righe. */
  async readVin(): Promise<string | null> {
    const text = await this.readMode09Text("02");
    if (!text) return null;
    const vin = text.replace(/[^A-Z0-9]/gi, "");
    return vin.length >= 11 ? vin : null;
  }

  /** Legge il nome/identificativo della centralina motore (Mode 09 PID 0A), es. "ECM-EngineControl". */
  async readEcuName(): Promise<string | null> {
    return this.readMode09Text("0A");
  }

  /** Legge l'ID di calibrazione/firmware della centralina (Mode 09 PID 04). */
  async readCalibrationId(): Promise<string | null> {
    return this.readMode09Text("04");
  }

  /** Legge i codici errore per una delle tre modalità: memorizzati (03), pending (07), permanenti (0A). */
  async readDtcCodes(mode: DtcMode = "03"): Promise<string[]> {
    const responseMode = mode === "03" ? "43" : mode === "07" ? "47" : "4A";
    try {
      const raw = await this.sendRaw(mode);
      const bytes = this.parseHexResponse(raw, responseMode);
      if (!bytes) return [];

      const codes: string[] = [];
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const a = bytes[i];
        const b = bytes[i + 1];
        if (a === 0 && b === 0) continue;

        const firstCharMap = ["P", "C", "B", "U"];
        const firstChar = firstCharMap[(a >> 6) & 0x03];
        const secondDigit = (a >> 4) & 0x03;
        const rest = ((a & 0x0f) << 8) | b;
        const code = `${firstChar}${secondDigit}${rest.toString(16).toUpperCase().padStart(3, "0")}`;
        codes.push(code);
      }
      return codes;
    } catch {
      return [];
    }
  }

  /** Cancella i codici errore memorizzati/pending e spegne la spia motore (Mode 04). */
  async clearDtcCodes(): Promise<boolean> {
    try {
      const raw = await this.sendRaw("04");
      return !this.cleanResponse(raw).includes("ERROR");
    } catch {
      return false;
    }
  }

  /** Stato spia motore e monitor di controllo emissioni (Mode 01 PID 01), per veicoli benzina/GPL. */
  async readReadiness(): Promise<ReadinessResult | null> {
    try {
      const raw = await this.sendRaw("0101");
      const bytes = this.parseHexResponse(raw, "41", "01");
      if (!bytes || bytes.length < 4) return null;

      const [a, , c, d] = bytes;
      const milOn = (a & 0x80) !== 0;
      const storedCodesCount = a & 0x7f;

      // byte C: bit=1 → monitor supportato dal veicolo; byte D: bit=1 → monitor non ancora completato
      const monitors = READINESS_MONITOR_LABELS_SPARK.map(({ bit, label }) => {
        const supported = ((c >> bit) & 0x01) === 1;
        const ready = supported ? ((d >> bit) & 0x01) === 0 : false;
        return { label, supported, ready };
      });

      return { milOn, storedCodesCount, monitors };
    } catch {
      return null;
    }
  }

  /** Legge il freeze frame (Mode 02, frame 0) per un set di PID standard. */
  async readFreezeFrame(keys: LivePidKey[]): Promise<FreezeFrameResult> {
    const result: FreezeFrameResult = {};
    for (const key of keys) {
      const def = PIDS[key];
      if (!def) continue;
      try {
        const raw = await this.sendRaw(`02${def.pid}00`);
        const bytes = this.parseHexResponse(raw, "42", def.pid);
        if (bytes) {
          const value = def.parse(bytes);
          if (!Number.isNaN(value)) result[key] = Math.round(value * 10) / 10;
        }
      } catch {
        // PID non disponibile in freeze frame, si ignora
      }
    }
    return result;
  }

  async disconnect(): Promise<void> {
    this.notifyChar?.removeEventListener("characteristicvaluechanged", this.handleNotification);
    this.device?.gatt?.disconnect();
    this.device = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.setStatus("disconnected");
  }
}
