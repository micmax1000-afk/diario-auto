// Geocodifica indirizzi/comuni tramite Nominatim (OpenStreetMap), servizio
// pubblico gratuito. Nessuna chiave richiesta; limite di cortesia ~1 richiesta/sec.

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=" +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { "Accept-Language": "it" } });
  if (!res.ok) {
    throw new Error(`Geocodifica fallita (${res.status})`);
  }
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (data.length === 0) return null;
  const first = data[0];
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), displayName: first.display_name };
}
