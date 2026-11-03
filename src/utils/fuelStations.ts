// Distributori vicini dai dati aperti del Ministero delle Imprese e del Made in Italy
// (Osservaprezzi carburanti, licenza IODL 2.0): anagrafica degli impianti attivi e
// prezzi comunicati alle 8 del giorno prima. Si scaricano interi (alcuni MB) e si
// tengono solo gli impianti vicini.

import { CapacitorHttp } from "@capacitor/core";
import { getMeta, setMeta } from "./db";

export type StationFuel = "benzina" | "gasolio" | "gpl" | "metano";

export interface Station {
  id: string;
  brand: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  km: number;
  prices: Partial<Record<StationFuel, { self?: number; served?: number; updated?: string }>>;
  province?: string;
}

export const MIMIT_STATIONS_URL = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv";
export const MIMIT_PRICES_URL = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv";

/**
 * Legge un CSV del Ministero: la prima riga può essere "Estrazione del ...",
 * l'intestazione è la riga con "idImpianto"; il separatore può essere ";" o "|".
 */
export function parseMimitCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /idimpianto/i.test(l));
  if (headerIdx < 0) return [];
  const header = lines[headerIdx];
  const sep = (header.match(/\|/g)?.length ?? 0) > (header.match(/;/g)?.length ?? 0) ? "|" : ";";
  const keys = header.split(sep).map((k) => k.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = line.split(sep);
    const row: Record<string, string> = {};
    keys.forEach((k, j) => (row[k] = (cells[j] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Solo i carburanti "normali": le versioni premium (Blue Diesel, 98 ottani...) non si confrontano. */
function fuelOf(desc: string): StationFuel | null {
  const d = desc.trim().toLowerCase();
  if (d === "benzina") return "benzina";
  if (d === "gasolio") return "gasolio";
  if (d === "gpl") return "gpl";
  if (d === "metano") return "metano";
  return null;
}

const num = (s: string | undefined) => Number((s ?? "").replace(",", "."));
const pick = (row: Record<string, string>, ...names: string[]) => names.map((n) => row[n]).find((v) => v !== undefined) ?? "";

export function buildStations(
  registry: Record<string, string>[],
  prices: Record<string, string>[],
  lat: number,
  lng: number,
  radiusKm: number,
): Station[] {
  const near = new Map<string, Station>();
  for (const r of registry) {
    const sLat = num(pick(r, "latitudine", "lat"));
    const sLng = num(pick(r, "longitudine", "lng", "lon"));
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng) || (sLat === 0 && sLng === 0)) continue;
    const km = distanceKm(lat, lng, sLat, sLng);
    if (km > radiusKm) continue;
    const id = pick(r, "idimpianto");
    const brand = pick(r, "bandiera") || pick(r, "gestore");
    near.set(id, {
      id,
      brand,
      name: pick(r, "nome impianto", "nomeimpianto") || brand,
      address: [pick(r, "indirizzo"), pick(r, "comune")].filter(Boolean).join(", "),
      lat: sLat,
      lng: sLng,
      km,
      prices: {},
      province: pick(r, "provincia").toUpperCase() || undefined,
    });
  }
  for (const p of prices) {
    const s = near.get(pick(p, "idimpianto"));
    const fuel = fuelOf(pick(p, "desccarburante"));
    const price = num(pick(p, "prezzo"));
    if (!s || !fuel || !(price > 0)) continue;
    const slot = (s.prices[fuel] ??= {});
    const isSelf = pick(p, "isself") === "1";
    const key = isSelf ? "self" : "served";
    if (slot[key] === undefined || price < slot[key]!) slot[key] = price;
    slot.updated = pick(p, "dtcomu") || slot.updated;
  }
  // Coordinate sbagliate nell'anagrafica (es. un impianto di Modena con le coordinate
  // del centro di Milano): se è l'unico della sua provincia tra quelli vicini, si scarta.
  const byProvince = new Map<string, number>();
  for (const s of near.values()) if (s.province) byProvince.set(s.province, (byProvince.get(s.province) ?? 0) + 1);
  const main = [...byProvince.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return [...near.values()].filter(
    (s) => Object.keys(s.prices).length > 0 && !(near.size >= 10 && s.province && s.province !== main && byProvince.get(s.province) === 1),
  );
}

const CACHE_KEY = "stations-cache";
interface Cache { at: number; lat: number; lng: number; radiusKm: number; stations: Station[] }

/**
 * Distributori entro 30 km. Riusa i dati salvati se hanno meno di 6 ore e la
 * posizione è cambiata di poco; altrimenti riscarica dal Ministero (serve
 * l'app Android: il sito non permette il download da una pagina web).
 */
export async function loadNearbyStations(
  lat: number,
  lng: number,
  force = false,
  onStage?: (stage: "download" | "read") => void,
): Promise<{ stations: Station[]; at: number }> {
  const radiusKm = 30;
  if (!force) {
    const raw = await getMeta(CACHE_KEY);
    if (raw) {
      try {
        const c = JSON.parse(raw) as Cache;
        // i dati coprono 30 km: spostandosi di qualche km bastano ancora, si ricalcolano solo le distanze
        if (c.radiusKm >= radiusKm && Date.now() - c.at < 6 * 3600_000 && distanceKm(lat, lng, c.lat, c.lng) < 5) {
          return { stations: c.stations.map((s) => ({ ...s, km: distanceKm(lat, lng, s.lat, s.lng) })), at: c.at };
        }
      } catch {
        /* cache rovinata: si riscarica */
      }
    }
  }
  onStage?.("download");
  // Tempi massimi: senza, se il sito non risponde la pagina resterebbe in attesa per sempre.
  const get = (url: string) =>
    withTimeout(CapacitorHttp.get({ url, responseType: "text", connectTimeout: 20_000, readTimeout: 60_000 }), 90_000, "timeout");
  const [reg, pri] = await Promise.all([get(MIMIT_STATIONS_URL), get(MIMIT_PRICES_URL)]);
  if (reg.status !== 200 || pri.status !== 200) throw new Error(`HTTP ${reg.status}/${pri.status}`);
  onStage?.("read");
  await new Promise((r) => setTimeout(r, 0)); // lascia disegnare "Leggo i prezzi…" prima del lavoro pesante
  const stations = buildStations(parseMimitCsv(String(reg.data)), parseMimitCsv(String(pri.data)), lat, lng, radiusKm);
  if (stations.length === 0 && String(pri.data).length < 1000) throw new Error("dati vuoti");
  const cache: Cache = { at: Date.now(), lat, lng, radiusKm, stations };
  await setMeta(CACHE_KEY, JSON.stringify(cache));
  return { stations, at: cache.at };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
