import type { PDFFont } from "pdf-lib";

export interface TripReportRow {
  date: string;
  route: string;
  purpose: string;
  km: string;
  kmAmount: string;
  extras: string;
  total: string;
}

export interface TripReportParams {
  title: string;
  /** Righe sotto il titolo: veicolo, periodo, tariffa... */
  info: string[];
  columns: { date: string; route: string; purpose: string; km: string; kmAmount: string; extras: string; total: string };
  rows: TripReportRow[];
  totals: { label: string; value: string }[];
  footer: string;
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const COLS = { date: 58, route: 125, purpose: 112, km: 40, kmAmount: 58, extras: 62, total: 60 };

// Helvetica standard sa scrivere solo l'alfabeto latino (più €): il resto diventa "?".
const pdfSafe = (s: string) => s.replace(/→/g, "-").replace(/[^\x20-\x7E\xA0-\xFF€]/g, "?");

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let s = pdfSafe(text);
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > maxWidth) s = s.slice(0, -1);
  return `${s}...`;
}

/** PDF del rimborso chilometrico, generato sul telefono: i dati non escono dal dispositivo. */
export async function generateTripReportPdf(p: TripReportParams): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const AMBER = rgb(0.96, 0.56, 0.12);
  const DARK = rgb(0.12, 0.13, 0.15);
  const GRAY = rgb(0.45, 0.45, 0.48);
  const LINE = rgb(0.85, 0.85, 0.85);
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const order = ["date", "route", "purpose", "km", "kmAmount", "extras", "total"] as const;
  const right = new Set(["km", "kmAmount", "extras", "total"]);

  function drawRow(values: Record<(typeof order)[number], string>, font: PDFFont, size: number, color = DARK) {
    let x = MARGIN;
    for (const key of order) {
      const w = COLS[key];
      const text = fit(values[key], font, size, w - 6);
      const tx = right.has(key) ? x + w - 4 - font.widthOfTextAtSize(text, size) : x + 2;
      page.drawText(text, { x: tx, y, size, font, color });
      x += w;
    }
  }

  function tableHeader() {
    drawRow(p.columns, bold, 8.5, GRAY);
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: AMBER });
    y -= 14;
  }

  page.drawText(pdfSafe(p.title), { x: MARGIN, y, size: 20, font: bold, color: DARK });
  y -= 22;
  for (const line of p.info) {
    page.drawText(pdfSafe(line), { x: MARGIN, y, size: 10, font: regular, color: GRAY });
    y -= 14;
  }
  y -= 14;
  tableHeader();

  for (const row of p.rows) {
    if (y < MARGIN + 70) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      tableHeader();
    }
    drawRow(row, regular, 9);
    y -= 7;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: LINE });
    y -= 13;
  }

  y -= 8;
  for (const tot of p.totals) {
    if (y < MARGIN + 30) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    const last = tot === p.totals[p.totals.length - 1];
    const size = last ? 13 : 10;
    const font = last ? bold : regular;
    const value = pdfSafe(tot.value);
    page.drawText(pdfSafe(tot.label), { x: PAGE_WIDTH - MARGIN - 230, y, size, font, color: last ? DARK : GRAY });
    page.drawText(value, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(value, size), y, size, font, color: DARK });
    y -= last ? 20 : 15;
  }

  for (const pg of doc.getPages()) {
    pg.drawText(pdfSafe(p.footer), { x: MARGIN, y: MARGIN - 18, size: 8, font: regular, color: GRAY });
  }
  return doc.save();
}
