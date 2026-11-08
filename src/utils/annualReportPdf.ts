import type { PDFFont, PDFPage, RGB } from "pdf-lib";

export interface ReportCategory {
  label: string;
  value: number;
  valueLabel: string;
  /** Colore della categoria, [r, g, b] tra 0 e 1. */
  color: [number, number, number];
}

export interface ReportMaintenanceRow {
  date: string;
  description: string;
  km: string;
  cost: string;
}

export interface AnnualReportParams {
  title: string;
  subtitle: string;
  /** Scritto grande in alto a destra: l'anno, o "Sempre". */
  periodLabel: string;
  vehicleName: string;
  vehicleInfo: string;
  /** Immagine dell'auto (PNG o JPEG), facoltativa. */
  vehicleImage?: { bytes: Uint8Array; type: "png" | "jpg" };
  /** Icona dell'app (PNG), facoltativa. */
  icon?: Uint8Array;
  kpis: { label: string; value: string }[];
  chartTitle: string;
  bars: { label: string; value: number }[];
  categoriesTitle: string;
  categories: ReportCategory[];
  maintenanceTitle: string;
  maintenanceColumns: { date: string; description: string; km: string; cost: string };
  maintenance: ReportMaintenanceRow[];
  noMaintenance: string;
  /** Riga in fondo, per esempio il rimborso dei viaggi di lavoro. */
  footerNote?: string;
  pageLabel: (page: number, total: number) => string;
}

const W = 595.28; // A4
const H = 841.89;
const M = 46;

// Helvetica standard sa scrivere solo l'alfabeto latino (più €): il resto diventa "?".
const pdfSafe = (s: string) => s.replace(/[→·]/g, (c) => (c === "→" ? "-" : "·")).replace(/[^\x20-\x7E\xA0-\xFF€]/g, "?");

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let s = pdfSafe(text);
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > maxWidth) s = s.slice(0, -1);
  return `${s}...`;
}

/** Riepilogo annuale di un'auto in PDF, generato sul telefono: i dati non escono dal dispositivo. */
export async function generateAnnualReportPdf(p: AnnualReportParams): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const AMBER = rgb(0.96, 0.56, 0.12);
  const DARK = rgb(0.09, 0.09, 0.1);
  const GRAY = rgb(0.44, 0.44, 0.46);
  const LIGHT = rgb(0.96, 0.957, 0.945);
  const LINE = rgb(0.9, 0.89, 0.87);
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${p.title} ${p.periodLabel} - ${p.vehicleName}`));
  doc.setCreator("Diario Auto");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let page = doc.addPage([W, H]);
  pages.push(page);
  let y = H - M;

  const text = (s: string, x: number, yy: number, size: number, font: PDFFont = regular, color: RGB = DARK) =>
    page.drawText(pdfSafe(s), { x, y: yy, size, font, color });
  const rightText = (s: string, xRight: number, yy: number, size: number, font: PDFFont = regular, color: RGB = DARK) => {
    const t = pdfSafe(s);
    page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y: yy, size, font, color });
  };
  const newPageIfNeeded = (need: number) => {
    if (y - need >= M + 30) return;
    page = doc.addPage([W, H]);
    pages.push(page);
    y = H - M;
  };

  // Intestazione: icona, titolo, periodo grande
  let tx = M;
  if (p.icon) {
    try {
      const img = await doc.embedPng(p.icon);
      page.drawImage(img, { x: M, y: y - 34, width: 36, height: 36 });
      tx = M + 48;
    } catch {
      // icona non leggibile: si va avanti senza
    }
  }
  text(p.title, tx, y - 18, 21, bold);
  text(p.subtitle, tx, y - 33, 10, regular, GRAY);
  rightText(p.periodLabel, W - M, y - 26, 28, bold, AMBER);
  y -= 48;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 2.5, color: AMBER });
  y -= 18;

  // Auto
  let vx = M;
  if (p.vehicleImage) {
    try {
      const img = p.vehicleImage.type === "png" ? await doc.embedPng(p.vehicleImage.bytes) : await doc.embedJpg(p.vehicleImage.bytes);
      const h = 54;
      const w = Math.min(110, (img.width / img.height) * h);
      page.drawImage(img, { x: M, y: y - h, width: w, height: h });
      vx = M + w + 14;
    } catch {
      // immagine non leggibile: solo testo
    }
  }
  text(fit(p.vehicleName, bold, 15, W - M - vx), vx, y - 24, 15, bold);
  text(fit(p.vehicleInfo, regular, 10, W - M - vx), vx, y - 40, 10, regular, GRAY);
  y -= 70;

  // Numeri principali
  const gap = 8;
  const boxW = (W - 2 * M - gap * (p.kpis.length - 1)) / p.kpis.length;
  p.kpis.forEach((k, i) => {
    const x = M + i * (boxW + gap);
    page.drawRectangle({ x, y: y - 50, width: boxW, height: 50, color: LIGHT });
    text(fit(k.label, regular, 8.5, boxW - 16), x + 9, y - 17, 8.5, regular, GRAY);
    text(fit(k.value, bold, 14, boxW - 16), x + 9, y - 37, 14, bold);
  });
  y -= 72;

  // Grafico a barre
  text(p.chartTitle.toUpperCase(), M, y, 9.5, bold, GRAY);
  y -= 12;
  const chartH = 110;
  const max = Math.max(1, ...p.bars.map((b) => b.value));
  const n = Math.max(1, p.bars.length);
  const slot = (W - 2 * M) / n;
  const barW = Math.min(30, slot * 0.7);
  p.bars.forEach((b, i) => {
    const h = (b.value / max) * (chartH - 6);
    const x = M + i * slot + (slot - barW) / 2;
    if (h > 0) page.drawRectangle({ x, y: y - chartH + 12, width: barW, height: h, color: AMBER });
    const lw = regular.widthOfTextAtSize(pdfSafe(b.label), 7.5);
    text(b.label, M + i * slot + (slot - lw) / 2, y - chartH, 7.5, regular, GRAY);
  });
  page.drawLine({ start: { x: M, y: y - chartH + 12 }, end: { x: W - M, y: y - chartH + 12 }, thickness: 0.6, color: LINE });
  y -= chartH + 24;

  // Categorie
  text(p.categoriesTitle.toUpperCase(), M, y, 9.5, bold, GRAY);
  y -= 8;
  const total = p.categories.reduce((s, c) => s + c.value, 0);
  for (const c of p.categories) {
    newPageIfNeeded(22);
    y -= 18;
    page.drawRectangle({ x: M, y: y + 1, width: 7, height: 7, color: rgb(...c.color) });
    text(fit(c.label, regular, 10.5, 300), M + 14, y, 10.5);
    rightText(c.valueLabel, W - M - 46, y, 10.5, bold);
    rightText(`${total > 0 ? Math.round((c.value / total) * 100) : 0}%`, W - M, y, 10, regular, GRAY);
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.5, color: LINE });
  }
  y -= 30;

  // Manutenzioni
  newPageIfNeeded(60);
  text(p.maintenanceTitle.toUpperCase(), M, y, 9.5, bold, GRAY);
  y -= 18;
  const cols = { date: M, description: M + 74, km: W - M - 150, costRight: W - M };
  const header = () => {
    text(p.maintenanceColumns.date, cols.date, y, 9, bold, GRAY);
    text(p.maintenanceColumns.description, cols.description, y, 9, bold, GRAY);
    text(p.maintenanceColumns.km, cols.km, y, 9, bold, GRAY);
    rightText(p.maintenanceColumns.cost, cols.costRight, y, 9, bold, GRAY);
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.5, color: LINE });
  };
  if (p.maintenance.length === 0) {
    text(p.noMaintenance, M, y, 10, regular, GRAY);
    y -= 16;
  } else {
    header();
    for (const r of p.maintenance) {
      const before = page;
      newPageIfNeeded(20);
      if (page !== before) header();
      y -= 18;
      text(fit(r.date, regular, 10, 70), cols.date, y, 10);
      text(fit(r.description, regular, 10, cols.km - cols.description - 10), cols.description, y, 10);
      text(fit(r.km, regular, 10, 80), cols.km, y, 10);
      rightText(r.cost, cols.costRight, y, 10);
      page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.5, color: LINE });
    }
  }

  // Piè di pagina su ogni pagina
  pages.forEach((pg, i) => {
    page = pg;
    if (i === pages.length - 1 && p.footerNote) text(fit(p.footerNote, regular, 8.5, 360), M, M - 10, 8.5, regular, GRAY);
    rightText(p.pageLabel(i + 1, pages.length), W - M, M - 10, 8.5, regular, GRAY);
  });

  return doc.save();
}

/** Converte un'immagine (anche WebP o foto) in PNG con il canvas, per poterla mettere nel PDF. */
export async function imageToPng(src: string, maxWidth = 360): Promise<Uint8Array | null> {
  if (typeof document === "undefined") return null;
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
