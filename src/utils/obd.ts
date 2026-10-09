// Comunicazione con adattatori OBD2 ELM327 via Web Bluetooth (BLE) nel
// browser, oppure via Bluetooth Classic/RFCOMM nativo quando l'app gira
// dentro Capacitor (vedi nativeObdBridge.ts + il plugin Kotlin). I due
// trasporti condividono lo stesso protocollo ELM327: cambia solo come i
// byte vengono spediti e ricevuti, la logica dei comandi sotto è identica.
//
// Gli adattatori ELM327 BLE più comuni (Vgate iCar Pro, Veepeak OBDCheck BLE, cloni
// generici) espongono un servizio "seriale" su GATT, ma non esiste un UUID
// universale: proviamo in sequenza i più diffusi.

import { Capacitor } from "@capacitor/core";
import NativeObdBluetooth, { type PairedDevice } from "./nativeObdBridge";
import { decodeDtcResponse, decodeFreezeFrameDtc, isCanProtocol } from "./obdDtc";

export type { PairedDevice };

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
  // Dati aggiuntivi: compaiono solo se l'auto li dichiara tra i PID supportati.
  ambientTempC?: number;
  oilTempC?: number;
  baroKpa?: number; // pressione atmosferica
  pedalPercent?: number; // posizione pedale acceleratore
  runTimeMin?: number; // minuti dall'avviamento del motore
  distSinceClearedKm?: number; // km percorsi dall'ultima cancellazione dei codici
  distMilOnKm?: number; // km percorsi con la spia motore accesa
  catalystTempC?: number; // temperatura catalizzatore banco 1 sensore 1
}

export type ObdStatus = "disconnected" | "connecting" | "initializing" | "connected" | "error";

export type DtcMode = "03" | "07" | "0A"; // memorizzati / pending / permanenti

// PID standard OBD-II Mode 01, con relativa funzione di parsing della risposta esadecimale
interface PidDefinition {
  pid: string;
  parse: (data: number[]) => number;
}

export const PIDS: Record<string, PidDefinition> = {
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
  ambientTempC: { pid: "46", parse: (d) => d[0] - 40 },
  oilTempC: { pid: "5C", parse: (d) => d[0] - 40 },
  baroKpa: { pid: "33", parse: (d) => d[0] },
  pedalPercent: { pid: "49", parse: (d) => (d[0] * 100) / 255 },
  runTimeMin: { pid: "1F", parse: (d) => Math.floor((d[0] * 256 + d[1]) / 60) },
  distSinceClearedKm: { pid: "31", parse: (d) => d[0] * 256 + d[1] },
  distMilOnKm: { pid: "21", parse: (d) => d[0] * 256 + d[1] },
  // Contachilometri (PID 01A6, solo alcune auto recenti): 4 byte, unità di 0,1 km.
  odometerKm: { pid: "A6", parse: (d) => (d[0] * 16777216 + d[1] * 65536 + d[2] * 256 + d[3]) / 10 },
  catalystTempC: { pid: "3C", parse: (d) => (d[0] * 256 + d[1]) / 10 - 40 },
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

// Motori diesel (accensione per compressione): stessi bit, significato diverso (SAE J1979).
const READINESS_MONITOR_LABELS_DIESEL: { bit: number; label: string }[] = [
  { bit: 0, label: "Catalizzatore NMHC" },
  { bit: 1, label: "Riduzione NOx / SCR (AdBlue)" },
  { bit: 3, label: "Pressione di sovralimentazione" },
  { bit: 5, label: "Sensore gas di scarico" },
  { bit: 6, label: "Filtro antiparticolato (FAP/DPF)" },
  { bit: 7, label: "EGR / fasatura variabile" },
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

// Testi italiani prodotti dalla logica OBD (etichette, protocollo, errori):
// la chiave di traduzione corrispondente sta in "obdText" nei file delle lingue.
const OBD_TEXT_KEYS: Record<string, string> = {
  "Catalizzatore": "catalyst",
  "Catalizzatore riscaldato": "heatedCatalyst",
  "Sistema evaporativo (EVAP)": "evap",
  "Aria secondaria": "secondaryAir",
  "Sonda lambda (O2)": "o2Sensor",
  "Riscaldamento sonda lambda": "o2Heater",
  "Ricircolo gas di scarico (EGR)": "egr",
  "Catalizzatore NMHC": "nmhcCatalyst",
  "Riduzione NOx / SCR (AdBlue)": "noxScr",
  "Pressione di sovralimentazione": "boostPressure",
  "Sensore gas di scarico": "exhaustGasSensor",
  "Filtro antiparticolato (FAP/DPF)": "particulateFilter",
  "EGR / fasatura variabile": "egrVvt",
  "Automatico": "automatic",
  "Questo browser non supporta Web Bluetooth. Usa Chrome o Edge su Android.": "noWebBluetooth",
  "Il Bluetooth nativo è disponibile solo nell'app Android, non nel browser.": "nativeOnlyInApp",
  "Connessione GATT non riuscita.": "gattFailed",
  "Adattatore non riconosciuto: nessun servizio Bluetooth compatibile trovato.": "adapterUnknown",
  "Non connesso.": "notConnected",
  "Impossibile leggere i dispositivi accoppiati.": "pairedDevicesError",
};

/** Traduce nella lingua dell'app i testi OBD (scritti in italiano nella logica di connessione). */
export function localizeObdText(text: string, t: (key: string, options?: Record<string, string>) => string): string {
  const key = OBD_TEXT_KEYS[text];
  if (key) return t(`obdText.${key}`);
  const timeout = /^Timeout in attesa di risposta a "(.*)"$/.exec(text);
  if (timeout) return t("obdText.timeout", { command: timeout[1] });
  return text;
}

export class ObdConnection {
  private device: BluetoothDevice | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
  private buffer = "";
  private pendingResolve: ((value: string) => void) | null = null;

  // "ble": Web Bluetooth nel browser. "native": Bluetooth Classic/RFCOMM
  // tramite il plugin Kotlin, disponibile solo dentro l'app Android.
  private transport: "ble" | "native" = "ble";
  private nativeListeners: Array<{ remove: () => void }> = [];

  public status: ObdStatus = "disconnected";
  public onStatusChange?: (status: ObdStatus) => void;
  public onDisconnected?: () => void;
  public lastDeviceId: string | null = null;
  public lastDeviceName: string | null = null;
  /** true solo per la modalità demo (dati simulati, nessun adattatore). */
  public isDemo = false;

  protected setStatus(status: ObdStatus) {
    this.status = status;
    this.onStatusChange?.(status);
  }

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  /** True dentro l'app Android nativa (Capacitor): lì si usa il Bluetooth Classic invece del Web Bluetooth. */
  static isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Elenco degli adattatori già accoppiati nelle Impostazioni Android — solo su piattaforma nativa. */
  static async listPairedDevices(): Promise<PairedDevice[]> {
    const { devices } = await NativeObdBluetooth.listPairedDevices();
    return devices;
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

    this.transport = "ble";
    this.setStatus("connecting");

    const allServiceUuids = KNOWN_PROFILES.map((p) => p.serviceUuid);

    const device = await navigator.bluetooth.requestDevice({
      filters: allServiceUuids.map((uuid) => ({ services: [uuid] })),
      optionalServices: allServiceUuids,
    });

    await this.connectToDevice(device, protocol);
  }

  /**
   * Connessione via Bluetooth Classic (RFCOMM/SPP), solo su Android nativo.
   * A differenza del BLE, qui l'adattatore va prima accoppiato dalle
   * Impostazioni di sistema Android — vedi listPairedDevices().
   */
  async connectNative(address: string, deviceName: string, protocol?: string): Promise<void> {
    if (!ObdConnection.isNativePlatform()) {
      throw new Error("Il Bluetooth nativo è disponibile solo nell'app Android, non nel browser.");
    }

    this.transport = "native";
    this.setStatus("connecting");
    this.lastDeviceId = address;
    this.lastDeviceName = deviceName;

    const dataListener = await NativeObdBluetooth.addListener("dataReceived", (event) => {
      this.buffer += event.data;
      if (this.buffer.includes(">")) {
        const response = this.buffer;
        this.buffer = "";
        this.pendingResolve?.(response);
        this.pendingResolve = null;
      }
    });
    const disconnectListener = await NativeObdBluetooth.addListener("disconnected", () => {
      this.setStatus("disconnected");
      this.onDisconnected?.();
    });
    this.nativeListeners = [dataListener, disconnectListener];

    await NativeObdBluetooth.connect({ address });

    this.setStatus("initializing");
    await this.initializeElm327(protocol);
    await this.warmUp();
    this.setStatus("connected");
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
    await this.warmUp();
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


  // Un solo comando alla volta: lettura live, lettura codici e riconnessione non
  // devono mai sovrapporsi, altrimenti le risposte si mescolano.
  private commandQueue: Promise<unknown> = Promise.resolve();

  private sendRaw(command: string, timeoutMs = 4000): Promise<string> {
    const run = () => this.sendRawNow(command, timeoutMs);
    const result = this.commandQueue.then(run, run);
    this.commandQueue = result.catch(() => undefined);
    return result;
  }

  private async sendRawNow(command: string, timeoutMs: number): Promise<string> {
    if (this.transport === "ble" && !this.writeChar) throw new Error("Non connesso.");

    // Scarta eventuali residui di risposte precedenti arrivate in ritardo.
    this.buffer = "";

    let timer: ReturnType<typeof setTimeout> | undefined;
    let resolver: ((value: string) => void) | null = null;

    const responsePromise = new Promise<string>((resolve, reject) => {
      resolver = (value: string) => {
        clearTimeout(timer);
        resolve(value);
      };
      this.pendingResolve = resolver;
      // Il timer appartiene a QUESTO comando: scaduto, libera solo il proprio
      // slot (mai quello di un comando successivo) e rifiuta la propria promessa.
      timer = setTimeout(() => {
        if (this.pendingResolve === resolver) this.pendingResolve = null;
        reject(new Error(`Timeout in attesa di risposta a "${command}"`));
      }, timeoutMs);
    });

    try {
      if (this.transport === "native") {
        await NativeObdBluetooth.write({ data: command });
      } else {
        const payload = new TextEncoder().encode(command + "\r");
        await this.writeChar!.writeValue(payload);
      }
    } catch (e) {
      clearTimeout(timer);
      if (this.pendingResolve === resolver) this.pendingResolve = null;
      throw e;
    }

    try {
      return await responsePromise;
    } catch (e) {
      // Dopo un timeout la risposta potrebbe arrivare comunque, in ritardo:
      // si aspetta un attimo e si svuota il buffer così non viene scambiata
      // per la risposta del comando successivo.
      await new Promise((r) => setTimeout(r, 300));
      this.buffer = "";
      throw e;
    }
  }

  /** Valori salvati in passato come "A6" (prefisso "automatico" di ATDPN) o "0": si usa solo la cifra del protocollo. */
  private normalizeProtocol(protocol?: string | null): string | null {
    if (!protocol) return null;
    const p = protocol.trim().toUpperCase();
    const digit = p.length === 2 && p.startsWith("A") ? p[1] : p;
    return digit && digit !== "0" ? digit : null;
  }

  private async initializeElm327(protocol?: string): Promise<void> {
    // ATZ può richiedere un paio di secondi sui cloni più lenti.
    const reset = await this.sendRaw("ATZ", 6000).catch(() => null);
    if (reset === null) {
      const probe = await this.sendRaw("ATI", 3000).catch(() => null);
      if (probe === null) throw new Error("ADAPTER_SILENT");
    }
    await new Promise((r) => setTimeout(r, 400));
    await this.sendRaw("ATE0").catch(() => "");
    await this.sendRaw("ATL0").catch(() => "");
    await this.sendRaw("ATS1").catch(() => ""); // risposte con spazi tra i byte (più leggibili nel terminale)
    await this.sendRaw("ATH0").catch(() => "");
    const chosen = this.normalizeProtocol(protocol);
    this.protocolDigit = chosen;
    await this.sendRaw(chosen ? `ATSP${chosen}` : "ATSP0").catch(() => "");
  }

  /** Protocollo in uso (cifra di ATSP/ATDPN), serve a decodificare i codici errore; null se non noto. */
  private protocolDigit: string | null = null;

  /** true/false dopo il primo contatto con l'auto, null se non ancora provato. */
  public vehicleResponds: boolean | null = null;
  /** Ultima risposta grezza dell'adattatore al primo contatto (utile per capire cosa non va). */
  public warmUpReply: string | null = null;

  /** PID Mode 01 dichiarati dall'auto (es. "5C"); null finché non sono stati letti o se la lettura non è riuscita. */
  public supportedPids: Set<string> | null = null;

  /**
   * Legge l'elenco dei PID supportati: la risposta a 0100, 0120, 0140, 0160 è
   * una maschera di 32 bit (un bit per PID); l'ultimo bit dice se esiste il
   * blocco successivo. Serve per chiedere all'auto solo ciò che sa fornire.
   */
  private async loadSupportedPids(): Promise<void> {
    const found = new Set<string>();
    try {
      for (const base of [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0]) {
        const baseHex = base.toString(16).toUpperCase().padStart(2, "0");
        const raw = await this.sendRaw(`01${baseHex}`, 5000);
        const bytes = this.parseHexResponse(raw, "41", baseHex);
        if (!bytes || bytes.length < 4) break;
        for (let i = 0; i < 32; i++) {
          if (bytes[i >> 3] & (0x80 >> (i & 7))) {
            found.add((base + i + 1).toString(16).toUpperCase().padStart(2, "0"));
          }
        }
        const nextBlockSupported = (bytes[3] & 0x01) === 1;
        if (!nextBlockSupported) break;
      }
    } catch {
      // se la lettura fallisce si resta senza elenco: i dati aggiuntivi
      // vengono comunque provati e mostrati solo se arriva una risposta
    }
    this.supportedPids = found.size > 0 ? found : null;
  }

  /** true/false se l'elenco dei PID è noto, null se non lo è (in quel caso conviene provare comunque). */
  isPidSupported(key: LivePidKey): boolean | null {
    if (!this.supportedPids) return null;
    return this.supportedPids.has(PIDS[key].pid);
  }

  /**
   * Primo contatto con l'auto. Con il protocollo automatico, la prima richiesta
   * avvia una ricerca che sulle auto più vecchie può durare 10-20 secondi:
   * senza attenderla, le richieste successive scadono tutte.
   */
  private async warmUp(): Promise<void> {
    this.vehicleResponds = null;
    this.warmUpReply = null;
    try {
      const raw = await this.sendRaw("0100", 25000);
      this.warmUpReply = this.cleanResponse(raw) || null;
      this.vehicleResponds = this.parseHexResponse(raw, "41", "00") !== null;
    } catch {
      this.vehicleResponds = false;
    }
    this.supportedPids = null;
    if (this.vehicleResponds) await this.loadSupportedPids();
  }

  /** Rileva il protocollo OBD attualmente in uso dopo la connessione (utile da salvare nel profilo veicolo). */
  async detectProtocol(): Promise<string | null> {
    try {
      const raw = await this.sendRaw("ATDPN");
      const cleaned = raw.replace(/>/g, "").replace(/[\r\n]/g, "").trim();
      const digit = this.normalizeProtocol(cleaned);
      if (digit) this.protocolDigit = digit;
      return digit;
    } catch {
      return null;
    }
  }

  private cleanResponse(raw: string): string {
    return raw.replace(/>/g, "").replace(/[\r\n]/g, " ").trim().toUpperCase();
  }

  /**
   * Risposta divisa in byte esadecimali, con o senza spazi tra i byte: molti
   * adattatori rispondono "4100BE3EB81B" invece di "41 00 BE 3E B8 1B", a
   * seconda della loro configurazione. Toglie anche i prefissi di riga delle
   * risposte multi-riga ("0:", "1:", ...).
   */
  private hexTokens(raw: string): string[] {
    const cleaned = this.cleanResponse(raw).replace(/(^|\s)[0-9A-F]:/g, " ");
    return cleaned
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((t) => (/^[0-9A-F]{4,}$/.test(t) && t.length % 2 === 0 ? (t.match(/../g) as string[]) : [t]));
  }

  private parseHexResponse(raw: string, mode: string, expectedPid?: string): number[] | null {
    const cleaned = this.cleanResponse(raw);
    if (cleaned.includes("NO DATA") || cleaned.includes("ERROR") || cleaned === "") return null;

    const tokens = this.hexTokens(raw);
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

  async readLiveData(keys: LivePidKey[], onValue?: (key: LivePidKey, value: number) => void): Promise<LiveReading> {
    const result: LiveReading = {};
    for (const key of keys) {
      const value = await this.readPid(key);
      if (value !== null && !Number.isNaN(value)) {
        const rounded = Math.round(value * 10) / 10;
        (result as Record<string, number>)[key] = rounded;
        // Ogni valore appare subito, senza aspettare la fine del giro completo.
        onValue?.(key, rounded);
      }
    }
    return result;
  }


  /** Legge un campo testuale Mode 09 (VIN=02, ID calibrazione=04, nome UCE=0A), gestendo risposte multi-riga. */
  private async readMode09Text(pid: string, timeoutMs = 6000): Promise<string | null> {
    try {
      const raw = await this.sendRaw(`09${pid}`, timeoutMs);
      const cleaned = this.cleanResponse(raw);
      if (cleaned.includes("NO DATA") || cleaned.includes("ERROR") || cleaned === "") return null;

      const tokens = this.hexTokens(raw);
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
      return decodeDtcResponse(raw, responseMode, isCanProtocol(this.protocolDigit));
    } catch {
      return [];
    }
  }

  /**
   * Chilometri letti dal contachilometri del veicolo, solo se l'auto lo fornisce
   * (PID 01A6): null se non è supportato o la lettura non riesce.
   */
  async readOdometerKm(): Promise<number | null> {
    if (this.isPidSupported("odometerKm") === false) return null;
    const value = await this.readPid("odometerKm");
    if (value === null || Number.isNaN(value) || value <= 0) return null;
    return Math.round(value);
  }

  /** Stato spia motore e monitor di controllo emissioni (Mode 01 PID 01), benzina/GPL o diesel. */
  async readReadiness(): Promise<ReadinessResult | null> {
    try {
      const raw = await this.sendRaw("0101");
      const bytes = this.parseHexResponse(raw, "41", "01");
      if (!bytes || bytes.length < 4) return null;

      const [a, b, c, d] = bytes;
      const milOn = (a & 0x80) !== 0;
      const storedCodesCount = a & 0x7f;
      // byte B, bit 3: 1 = motore diesel, i monitor dei byte C/D hanno un altro significato
      const diesel = (b & 0x08) !== 0;

      // byte C: bit=1 → monitor supportato dal veicolo; byte D: bit=1 → monitor non ancora completato
      const labels = diesel ? READINESS_MONITOR_LABELS_DIESEL : READINESS_MONITOR_LABELS_SPARK;
      const monitors = labels.map(({ bit, label }) => {
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
        // Risposta: 42 <PID> <numero frame> <dati>: il numero del frame va saltato.
        const bytes = this.parseHexResponse(raw, "42", def.pid)?.slice(1);
        if (bytes && bytes.length > 0) {
          const value = def.parse(bytes);
          if (!Number.isNaN(value)) result[key] = Math.round(value * 10) / 10;
        }
      } catch {
        // PID non disponibile in freeze frame, si ignora
      }
    }
    return result;
  }

  /** Codice errore che ha fatto registrare il freeze frame (Mode 02 PID 02), null se nessuno. */
  async readFreezeFrameDtc(): Promise<string | null> {
    try {
      return decodeFreezeFrameDtc(await this.sendRaw("020200"));
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport === "native") {
      this.nativeListeners.forEach((l) => l.remove());
      this.nativeListeners = [];
      await NativeObdBluetooth.disconnect().catch(() => {});
    } else {
      this.notifyChar?.removeEventListener("characteristicvaluechanged", this.handleNotification);
      this.device?.gatt?.disconnect();
      this.device = null;
      this.writeChar = null;
      this.notifyChar = null;
    }
    this.setStatus("disconnected");
  }
}
