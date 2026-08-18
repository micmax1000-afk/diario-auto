// Geocodifica indirizzi/comuni tramite Nominatim (OpenStreetMap), servizio
// pubblico gratuito. Nessuna chiave richiesta; limite di cortesia ~1 richiesta/sec.

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const results = await searchAddressSuggestions(query, 1);
  return results[0] ?? null;
}

export async function searchAddressSuggestions(query: string, limit = 5): Promise<GeocodeResult[]> {
  if (query.trim().length < 2) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&countrycodes=it&q=` +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { "Accept-Language": "it" } });
  if (!res.ok) {
    throw new Error(`Ricerca fallita (${res.status})`);
  }
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return data.map((d) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), displayName: d.display_name }));
}
