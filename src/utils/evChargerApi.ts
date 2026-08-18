// Client per l'API pubblica Open Charge Map (registro globale delle colonnine
// di ricarica elettrica). Gratuita, supporta CORS diretto dal browser, nessuna
// chiave obbligatoria per un uso leggero come questo.
// https://openchargemap.org/site/develop/api

const API_BASE = "https://api.openchargemap.io/v3/poi/";

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

interface OcmConnectionRaw {
  PowerKW?: number;
  Quantity?: number;
  ConnectionType?: { Title?: string };
}

interface OcmPoiRaw {
  ID: number;
  AddressInfo: {
    Title?: string;
    AddressLine1?: string;
    Town?: string;
    Latitude: number;
    Longitude: number;
    Distance?: number;
  };
  OperatorInfo?: { Title?: string };
  Connections?: OcmConnectionRaw[];
}

export async function fetchNearbyChargers(lat: number, lng: number, distanceKm = 15, maxResults = 25): Promise<ChargerStation[]> {
  const url =
    `${API_BASE}?output=json&countrycode=IT&latitude=${lat}&longitude=${lng}` +
    `&distance=${distanceKm}&distanceunit=KM&maxresults=${maxResults}&compact=true&verbose=false`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Richiesta fallita (${res.status})`);
  }
  const data = (await res.json()) as OcmPoiRaw[];

  return data.map((poi) => {
    const connections: ChargerConnection[] = (poi.Connections ?? []).map((c) => ({
      connectionType: c.ConnectionType?.Title,
      powerKW: c.PowerKW,
      quantity: c.Quantity,
    }));
    const powers = connections.map((c) => c.powerKW).filter((p): p is number => typeof p === "number");

    return {
      id: poi.ID,
      title: poi.AddressInfo.Title || poi.OperatorInfo?.Title || "Punto di ricarica",
      address: [poi.AddressInfo.AddressLine1, poi.AddressInfo.Town].filter(Boolean).join(", "),
      operator: poi.OperatorInfo?.Title,
      distanceKm: poi.AddressInfo.Distance,
      latitude: poi.AddressInfo.Latitude,
      longitude: poi.AddressInfo.Longitude,
      connections,
      maxPowerKW: powers.length > 0 ? Math.max(...powers) : null,
    };
  });
}
