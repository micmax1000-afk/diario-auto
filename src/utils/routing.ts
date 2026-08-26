// Calcolo del percorso stradale tramite OSRM (Open Source Routing Machine),
// server demo pubblico e gratuito (project-osrm.org). Adatto a un uso personale
// con volumi bassi; se in futuro diventasse instabile si può sostituire con
// un'altra istanza OSRM pubblica o autogestita, senza cambiare il resto dell'app.

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  geometry: RoutePoint[]; // punti del percorso, per disegnare la linea sulla mappa
}

export async function getDrivingRoute(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Calcolo percorso fallito (${res.status})`);
  }
  const data = (await res.json()) as {
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  if (!data.routes || data.routes.length === 0) {
    throw new Error("Nessun percorso trovato tra i due punti.");
  }
  const route = data.routes[0];
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}
