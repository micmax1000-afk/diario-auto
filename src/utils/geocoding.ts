// Geocodifica indirizzi/comuni tramite Nominatim (OpenStreetMap), servizio
// pubblico gratuito e globale. Nessuna chiave richiesta; limite di cortesia
// ~1 richiesta/sec.

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(query: string, language = "en"): Promise<GeocodeResult | null> {
  const results = await searchAddressSuggestions(query, 1, language);
  return results[0] ?? null;
}

/**
 * @param language codice lingua (es. i18n.language dell'app: "it", "en", "hi", ...)
 * usato solo per chiedere a Nominatim i nomi dei luoghi in quella lingua quando
 * disponibili — NON limita la ricerca a nessun paese, resta sempre globale.
 */
export async function searchAddressSuggestions(query: string, limit = 5, language = "en"): Promise<GeocodeResult[]> {
  if (query.trim().length < 2) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=` + encodeURIComponent(query);
  const res = await fetch(url, { headers: { "Accept-Language": language } });
  if (!res.ok) {
    throw new Error(`Ricerca fallita (${res.status})`);
  }
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return data.map((d) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), displayName: d.display_name }));
}
