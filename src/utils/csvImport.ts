// Importazione di rifornimenti da file CSV di altre app (Fuelio, Drivvo, fogli
// di calcolo) o dall'esportazione CSV di Diario Auto stessa.
//
// Non si dà per scontato un formato preciso: si cerca la riga di intestazione
// e si riconoscono le colonne dal nome (in più lingue). Le colonne non
// riconosciute si possono scegliere a mano nell'anteprima.

export type CsvField = "date" | "km" | "liters" | "totalCost" | "unitPrice" | "fullTank" | "notes";

export type ColumnMapping = Partial<Record<CsvField, number>>;

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

export interface ImportedFuelRow {
  date: string; // AAAA-MM-GG
  km: number;
  liters: number;
  totalCost: number;
  fullTank: boolean;
  notes?: string;
}

export interface ImportResult {
  rows: ImportedFuelRow[];
  /** Righe scartate perché senza data, km o litri validi. */
  skipped: number;
}

// Parole che identificano ogni colonna (minuscole, senza accenti). L'ordine conta:
// per il prezzo, "totale" va cercato prima di "prezzo" (che può essere al litro).
const FIELD_KEYWORDS: Record<CsvField, string[]> = {
  date: ["data", "date", "datum", "fecha", "дата", "tanggal"],
  km: ["odo", "odometer", "odometro", "contachilometri", "chilometraggio", "km", "kilometerstand", "mileage", "kilometraje", "quilometragem", "пробег"],
  liters: ["litri", "litres", "liters", "liter", "litros", "fuel (", "quantity", "quantita", "volume", "menge", "kwh", "литр"],
  totalCost: ["costo", "total cost", "totale", "total", "importo", "amount", "kosten", "betrag", "coste", "custo", "сумма", "price (optional)"],
  unitPrice: ["prezzo/l", "prezzo al litro", "price/l", "price per", "volumeprice", "unit price", "preis/l", "precio/l", "preco/l", "prezzo unitario"],
  fullTank: ["pieno", "full", "voll", "lleno", "cheio", "полный"],
  notes: ["note", "notes", "notizen", "notas", "заметки", "catatan"],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Divide il testo CSV in righe e celle, con virgolette e separatore , ; o tabulazione. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const sample = clean.split(/\r?\n/).slice(0, 20).join("\n");
  const counts = { ",": 0, ";": 0, "\t": 0 } as Record<string, number>;
  for (const ch of sample) if (ch in counts) counts[ch]++;
  const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

/** Indovina la colonna di ogni campo dai nomi dell'intestazione. */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  const norm = headers.map(normalize);
  const order: CsvField[] = ["date", "km", "unitPrice", "liters", "totalCost", "fullTank", "notes"];
  for (const field of order) {
    for (const keyword of FIELD_KEYWORDS[field]) {
      const idx = norm.findIndex((h, i) => !used.has(i) && (keyword.length <= 3 ? h === keyword || h.startsWith(`${keyword} `) || h.startsWith(`${keyword}(`) : h.includes(keyword)));
      if (idx !== -1) {
        mapping[field] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return mapping;
}

/**
 * Trova la tabella dei rifornimenti: la prima riga che ha almeno una colonna
 * data e una km fa da intestazione; i dati finiscono alla riga vuota di fine
 * file o a una nuova sezione (Fuelio separa le sezioni con "## ...").
 */
export function findTable(rows: string[][]): CsvTable | null {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.startsWith("#")) continue;
    const m = detectMapping(rows[i]);
    if (m.date === undefined || m.km === undefined) continue;
    const data: string[][] = [];
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j][0]?.startsWith("#")) break;
      data.push(rows[j]);
    }
    return { headers: rows[i], rows: data };
  }
  return null;
}

/** Numero scritto all'italiana ("1.234,56") o all'inglese ("1,234.56"). */
export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma !== -1) s = s.replace(/,/g, "");
  else if (lastComma === -1 && (s.match(/\./g)?.length ?? 0) > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Km: sono interi, quindi "1.250" o "1,250" sono migliaia, non decimali. */
export function parseKm(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.replace(/[^\d.,]/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  return parseNumber(raw);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Data in AAAA-MM-GG da "2026-03-15", "15/03/2026", "15.03.2026", "15-03-26", con o senza ora. */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) {
    let [a, b] = [+m[1], +m[2]];
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    // Giorno prima del mese (uso europeo); se il secondo numero è > 12 è per forza mese/giorno.
    if (b > 12 && a <= 12) [a, b] = [b, a];
    return valid(year, b, a);
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1950 || y > 2100) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function parseFull(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === "") return true;
  return /^(1|si|sì|yes|y|true|x|ja|oui|sim|да|ya|vero|full|pieno)$/i.test(normalize(raw)) || normalize(raw) === "si";
}

/** Converte le righe della tabella in rifornimenti secondo la mappatura delle colonne. */
export function convertRows(table: CsvTable, mapping: ColumnMapping): ImportResult {
  const rows: ImportedFuelRow[] = [];
  let skipped = 0;
  for (const r of table.rows) {
    const get = (f: CsvField) => (mapping[f] !== undefined ? r[mapping[f]!] : undefined);
    const date = parseDate(get("date"));
    const km = parseKm(get("km"));
    const liters = parseNumber(get("liters"));
    let total = parseNumber(get("totalCost"));
    const unit = parseNumber(get("unitPrice"));
    if ((total === null || total <= 0) && unit !== null && liters !== null) total = unit * liters;
    if (!date || km === null || km < 0 || liters === null || liters <= 0) {
      skipped++;
      continue;
    }
    const notes = get("notes")?.trim();
    rows.push({
      date,
      km: Math.round(km),
      liters: Math.round(liters * 100) / 100,
      totalCost: Math.round((total ?? 0) * 100) / 100,
      fullTank: parseFull(get("fullTank")),
      ...(notes ? { notes } : {}),
    });
  }
  return { rows, skipped };
}

/** Tiene solo le righe non già presenti (stessa data e stessi km di un rifornimento esistente). */
export function withoutDuplicates(rows: ImportedFuelRow[], existing: { date: string; km: number }[], toLocalDate: (iso: string) => string): ImportedFuelRow[] {
  const keys = new Set(existing.map((e) => `${toLocalDate(e.date)}|${Math.round(e.km)}`));
  return rows.filter((r) => !keys.has(`${r.date}|${r.km}`));
}
