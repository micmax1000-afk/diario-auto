// Decodifica delle risposte ELM327 ai comandi dei codici errore (03, 07, 0A).
//
// Il formato cambia con il protocollo dell'auto:
// - CAN (protocolli 6-9, quasi tutte le auto dal 2008): dopo "43" c'è un byte
//   con il numero di codici, poi 2 byte per codice. Con più di 2 codici la
//   risposta arriva su più righe numerate "0:", "1:", ... precedute dal numero
//   di byte (es. "00A").
// - Protocolli più vecchi (ISO 9141, KWP2000, J1850): niente contatore, ogni
//   riga è "43" + 3 codici (6 byte), completata con "00 00".
// Più centraline (motore, cambio...) possono rispondere ognuna con la sua riga.

const FIRST_CHAR = ["P", "C", "B", "U"];

function decodePair(a: number, b: number): string {
  const rest = ((a & 0x0f) << 8) | b;
  return `${FIRST_CHAR[(a >> 6) & 0x03]}${(a >> 4) & 0x03}${rest.toString(16).toUpperCase().padStart(3, "0")}`;
}

function lineBytes(line: string): number[] {
  const compact = line.replace(/\s+/g, "");
  const tokens = /^[0-9A-F]+$/.test(compact) && !/\s/.test(line.trim()) && compact.length % 2 === 0 ? compact.match(/../g) ?? [] : line.trim().split(/\s+/);
  return tokens.map((t) => parseInt(t, 16)).filter((n) => !Number.isNaN(n));
}

/** Messaggi di risposta (byte, a partire dal byte di modalità) ricostruiti dalle righe dell'adattatore. */
function splitMessages(raw: string, modeByte: number): { bytes: number[]; multiFrame: boolean }[] {
  const lines = raw
    .toUpperCase()
    .replace(/>/g, "")
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const messages: { bytes: number[]; multiFrame: boolean }[] = [];
  let current: { bytes: number[]; multiFrame: boolean } | null = null;
  for (const line of lines) {
    if (/^[0-9A-F]{3}$/.test(line)) continue; // numero di byte prima di una risposta multi-riga
    const frame = /^([0-9A-F]):\s*(.*)$/.exec(line);
    if (frame) {
      const bytes = lineBytes(frame[2]);
      if (frame[1] === "0" || !current) {
        current = { bytes, multiFrame: true };
        messages.push(current);
      } else {
        current.bytes.push(...bytes);
      }
      continue;
    }
    const bytes = lineBytes(line);
    if (bytes[0] === modeByte) {
      current = { bytes, multiFrame: false };
      messages.push(current);
    } else if (current) {
      current.bytes.push(...bytes);
    }
  }
  return messages.filter((m) => m.bytes[0] === modeByte);
}

/**
 * Codici errore contenuti nella risposta. isCan: true/false se il protocollo è
 * noto, null per dedurlo dalla risposta (una riga CAN ha un numero dispari di
 * byte dopo "43": il contatore più 2 byte per codice).
 */
export function decodeDtcResponse(raw: string, responseMode: string, isCan: boolean | null): string[] {
  const upper = raw.toUpperCase();
  if (upper.includes("NO DATA") || upper.includes("ERROR") || upper.includes("UNABLE")) return [];

  const modeByte = parseInt(responseMode, 16);
  const codes = new Set<string>();
  for (const message of splitMessages(raw, modeByte)) {
    const data = message.bytes.slice(1);
    const can = isCan ?? (message.multiFrame || data.length % 2 === 1);
    const pairs = can ? data.slice(1, 1 + 2 * (data[0] ?? 0)) : data;
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      if (pairs[i] === 0 && pairs[i + 1] === 0) continue;
      codes.add(decodePair(pairs[i], pairs[i + 1]));
    }
  }
  return [...codes];
}

/** true se il protocollo ELM327 (cifra di ATDPN) è un CAN, null se sconosciuto. */
export function isCanProtocol(protocol: string | null | undefined): boolean | null {
  if (!protocol) return null;
  return ["6", "7", "8", "9", "A", "B", "C"].includes(protocol.toUpperCase());
}

/**
 * Codice generico (stesso significato su tutte le auto, standard SAE J2012) o
 * specifico del costruttore: P1, P30-P33, B1/B2, C1/C2, U1/U2.
 */
export function isManufacturerSpecificDtc(code: string): boolean {
  const c = code.toUpperCase();
  if (c[0] === "P") return c[1] === "1" || (c[1] === "3" && "0123".includes(c[2]));
  return c[1] === "1" || c[1] === "2";
}
