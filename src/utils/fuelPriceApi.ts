// Client per l'API pubblica prezzi-carburante (dati aperti MIMIT).
// https://github.com/dstmrk/prezzi-carburante — nessuna chiave richiesta.
// Nota: è un servizio gratuito su Render "free tier": la prima chiamata dopo
// un periodo di inattività può richiedere anche 30-60 secondi (cold start).

const API_BASE = "https://prezzi-carburante.onrender.com/api";

export type FuelApiType = "benzina" | "gasolio";

export interface FuelStation {
  ranking?: number;
  gestore: string;
  indirizzo: string;
  prezzo: number;
  self: boolean;
  data: string; // data/ora ultima comunicazione prezzo, formato it
  distanza: string; // km, come stringa
  latitudine: number;
  longitudine: number;
}

export async function fetchNearbyStations(
  lat: number,
  lng: number,
  fuel: FuelApiType,
  distanceKm = 15,
  results = 15,
): Promise<FuelStation[]> {
  const url = `${API_BASE}/distributori?latitude=${lat}&longitude=${lng}&distance=${distanceKm}&fuel=${fuel}&results=${results}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Richiesta fallita (${res.status})`);
  }
  const data = (await res.json()) as FuelStation[];
  return data;
}
