// Client per le colonnine di ricarica elettrica tramite Overpass API, il
// motore di query di OpenStreetMap. Gratuito, senza chiave, senza
// registrazione — stesso principio "no-key" già usato per Nominatim (ricerca
// indirizzi) e OSRM (percorso del tragitto).
// https://wiki.openstreetmap.org/wiki/Overpass_API

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export interface ChargerConnection {
  connectionType?: string;
  powerKW?: number;
  quantity?: number;
}

export interface ChargerStation {
  id: number;
  title: string;
  address: string;
  operator?: string;
  distanceKm?: number;
  latitude: number;
  longitude: number;
  connections: ChargerConnection[];
  maxPowerKW: number | null;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function parsePowerKW(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.match(/[\d.]+/);
  return match ? Number(match[0]) : undefined;
}

function parseConnections(tags: Record<string, string>): ChargerConnection[] {
  const connections: ChargerConnection[] = [];
  for (const key of Object.keys(tags)) {
    if (!key.startsWith("socket:")) continue;
    if (key.endsWith(":output") || key.endsWith(":voltage") || key.endsWith(":current")) continue;

    const connectionType = key.slice("socket:".length);
    const rawQuantity = tags[key];
    const quantity = /^\d+$/.test(rawQuantity) ? Number(rawQuantity) : undefined;
    const powerKW = parsePowerKW(tags[`${key}:output`]);

    connections.push({ connectionType, powerKW, quantity });
  }
  return connections;
}

export async function fetchNearbyChargers(lat: number, lng: number, distanceKm = 15, maxResults = 30): Promise<ChargerStation[]> {
  const radiusM = Math.round(distanceKm * 1000);
  const query =
    `[out:json][timeout:25];` +
    `(node["amenity"="charging_station"](around:${radiusM},${lat},${lng});` +
    `way["amenity"="charging_station"](around:${radiusM},${lat},${lng}););` +
    `out center ${maxResults};`;

  const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Richiesta fallita (${res.status})`);
  }
  const data = (await res.json()) as { elements: OverpassElement[] };

  return data.elements.map((el) => {
    const tags = el.tags ?? {};
    const latitude = el.lat ?? el.center?.lat ?? 0;
    const longitude = el.lon ?? el.center?.lon ?? 0;
    const connections = parseConnections(tags);
    const powers = connections.map((c) => c.powerKW).filter((p): p is number => typeof p === "number");

    const addressParts = [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean);

    return {
      id: el.id,
      title: tags.name || tags.operator || tags.brand || "Punto di ricarica",
      address: addressParts.join(" "),
      operator: tags.operator || tags.brand || tags.network,
      latitude,
      longitude,
      connections,
      maxPowerKW: powers.length > 0 ? Math.max(...powers) : null,
    };
  });
}
