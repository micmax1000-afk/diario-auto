import type { PDFFont } from "pdf-lib";

export interface PassportEntry {
  dateLabel: string;
  kmLabel: string;
  categoryLabel: string;
  description: string;
  costLabel: string;
  workshop: string;
}

export interface PassportLabels {
  title: string;
  subtitle: string;
  plate: string;
  year: string;
  fuelType: string;
  currentKm: string;
  columnDate: string;
  columnKm: string;
  columnCategory: string;
  columnDescription: string;
  columnCost: string;
  columnWorkshop: string;
  totalInterventions: string;
  totalCost: string;
  generatedBy: string;
  noEntries: string;
}

export interface PassportParams {
  vehicleName: string;
  vehiclePlate?: string;
  vehicleYear?: number;
  fuelTypeLabel: string;
  currentKmLabel: string;
  entries: PassportEntry[];
  totalCostLabel: string;
  generatedOnLabel: string;
  labels: PassportLabels;
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

// Larghezze colonne tabella (punti), somma = area utile pagina
const COLS = { date: 62, km: 55, category: 75, description: 155, cost: 55, workshop: 88 };

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Genera il PDF del passaporto manutenzione, interamente lato client: nessun
 * dato lascia il dispositivo. Font standard (Helvetica) — rende
 * correttamente alfabeto latino; russo/hindi/arabo non sono supportati da
 * questo font e non renderizzerebbero correttamente (limite noto, non
 * ancora risolto con un font Unicode completo).
 */
export async function generateMaintenancePassportPdf(params: PassportParams): Promise<Uint8Array> {
  // Caricamento dinamico: pdf-lib pesa parecchio (~400KB) e serve solo a chi
  // genera davvero il passaporto — non ha senso scaricarlo per tutti al
  // primo avvio dell'app.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const AMBER = rgb(0.96, 0.56, 0.12);
  const DARK = rgb(0.12, 0.13, 0.15);
  const GRAY = rgb(0.45, 0.45, 0.48);
  const LIGHT_LINE = rgb(0.85, 0.85, 0.85);

  const { labels } = params;
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 30) {
      newPage();
      drawTableHeader();
    }
  }

  function drawHeader() {
    page.drawText(labels.title, { x: MARGIN, y, size: 22, font: fontBold, color: DARK });
    y -= 20;
    page.drawText(labels.subtitle, { x: MARGIN, y, size: 10, font: fontRegular, color: GRAY });
    y -= 28;

    page.drawRectangle({ x: MARGIN, y: y - 62, width: PAGE_WIDTH - MARGIN * 2, height: 62, color: rgb(0.96, 0.96, 0.95) });
    const infoX = MARGIN + 14;
    let infoY = y - 18;
    page.drawText(params.vehicleName, { x: infoX, y: infoY, size: 14, font: fontBold, color: DARK });
    infoY -= 18;
    const line2Parts: string[] = [];
    if (params.vehiclePlate) line2Parts.push(`${labels.plate}: ${params.vehiclePlate}`);
    if (params.vehicleYear) line2Parts.push(`${labels.year}: ${params.vehicleYear}`);
    line2Parts.push(`${labels.fuelType}: ${params.fuelTypeLabel}`);
    page.drawText(line2Parts.join("   ·   "), { x: infoX, y: infoY, size: 9.5, font: fontRegular, color: GRAY });
    infoY -= 16;
    page.drawText(`${labels.currentKm}: ${params.currentKmLabel}`, { x: infoX, y: infoY, size: 9.5, font: fontRegular, color: GRAY });

    y -= 80;
  }

  function drawTableHeader() {
    const headerY = y;
    page.drawRectangle({ x: MARGIN, y: headerY - 20, width: PAGE_WIDTH - MARGIN * 2, height: 20, color: AMBER });
    let x = MARGIN + 6;
    const headerCells: [string, number][] = [
      [labels.columnDate, COLS.date],
      [labels.columnKm, COLS.km],
      [labels.columnCategory, COLS.category],
      [labels.columnDescription, COLS.description],
      [labels.columnCost, COLS.cost],
      [labels.columnWorkshop, COLS.workshop],
    ];
    for (const [text, width] of headerCells) {
      page.drawText(text, { x, y: headerY - 14, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
      x += width;
    }
    y -= 24;
  }

  drawHeader();
  drawTableHeader();

  if (params.entries.length === 0) {
    page.drawText(labels.noEntries, { x: MARGIN, y: y - 10, size: 10, font: fontRegular, color: GRAY });
    y -= 30;
  }

  for (let i = 0; i < params.entries.length; i++) {
    const entry = params.entries[i];
    const descLines = wrapText(entry.description, fontRegular, 8.5, COLS.description - 8);
    const workshopLines = wrapText(entry.workshop || "—", fontRegular, 8.5, COLS.workshop - 8);
    const rowLines = Math.max(descLines.length, workshopLines.length, 1);
    const rowHeight = rowLines * 11 + 8;

    ensureSpace(rowHeight);

    if (i % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: PAGE_WIDTH - MARGIN * 2, height: rowHeight, color: rgb(0.975, 0.975, 0.97) });
    }

    let x = MARGIN + 6;
    const topY = y - 11;
    page.drawText(entry.dateLabel, { x, y: topY, size: 8.5, font: fontRegular, color: DARK });
    x += COLS.date;
    page.drawText(entry.kmLabel, { x, y: topY, size: 8.5, font: fontRegular, color: DARK });
    x += COLS.km;
    page.drawText(entry.categoryLabel, { x, y: topY, size: 8.5, font: fontRegular, color: DARK });
    x += COLS.category;

    let lineY = topY;
    for (const line of descLines) {
      page.drawText(line, { x, y: lineY, size: 8.5, font: fontRegular, color: DARK });
      lineY -= 11;
    }
    x += COLS.description;

    page.drawText(entry.costLabel, { x, y: topY, size: 8.5, font: fontBold, color: DARK });
    x += COLS.cost;

    lineY = topY;
    for (const line of workshopLines) {
      page.drawText(line, { x, y: lineY, size: 8.5, font: fontRegular, color: GRAY });
      lineY -= 11;
    }

    y -= rowHeight;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: LIGHT_LINE,
    });
  }

  ensureSpace(50);
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: DARK });
  y -= 20;
  page.drawText(`${labels.totalInterventions}: ${params.entries.length}`, { x: MARGIN, y, size: 10, font: fontBold, color: DARK });
  page.drawText(`${labels.totalCost}: ${params.totalCostLabel}`, {
    x: PAGE_WIDTH - MARGIN - fontBold.widthOfTextAtSize(`${labels.totalCost}: ${params.totalCostLabel}`, 10),
    y,
    size: 10,
    font: fontBold,
    color: DARK,
  });

  // Piè di pagina su tutte le pagine generate
  const pages = doc.getPages();
  for (const p of pages) {
    p.drawText(`${labels.generatedBy} — ${params.generatedOnLabel}`, {
      x: MARGIN,
      y: 20,
      size: 7.5,
      font: fontRegular,
      color: GRAY,
    });
  }

  return doc.save();
}

export function downloadPdfBytes(filename: string, bytes: Uint8Array): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
