import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchNearbyChargers, type ChargerStation } from "../utils/evChargerApi";
import { geocodeAddress, type GeocodeResult } from "../utils/geocoding";
import AddressAutocompleteInput from "./AddressAutocompleteInput";

interface Props {
  onSelect: (station: ChargerStation) => void;
  onClose: () => void;
}

function makeDotIcon(): L.DivIcon {
  return L.divIcon({
    className: "fuel-price-dot",
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:#2e7d32;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export default function EVChargerMap({ onSelect, onClose }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [addressQuery, setAddressQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [stationCount, setStationCount] = useState(0);
  const [searchRadiusKm, setSearchRadiusKm] = useState(25);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([41.9028, 12.4964], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (position && mapRef.current) {
      mapRef.current.setView([position.lat, position.lng], 13);
    }
  }, [position]);

  useEffect(() => {
    if (!position) return;
    let cancelled = false;

    setStatus("loading");
    setError(null);

    fetchNearbyChargers(position.lat, position.lng, searchRadiusKm, 40)
      .then((stations) => {
        if (cancelled) return;
        renderMarkers(stations);
        setStationCount(stations.length);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setError("Impossibile contattare il servizio mappe in questo momento. Riprova tra qualche secondo.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, searchRadiusKm]);

  function handleWiderSearch() {
    setSearchRadiusKm((r) => r + 25);
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("Il browser non supporta la geolocalizzazione. Cerca invece un indirizzo o comune qui sopra.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchRadiusKm(25);
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setStatus("error");
        setError("Posizione non disponibile (permesso negato o non supportato). Cerca invece un indirizzo o comune.");
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  function handleSelectSuggestion(result: GeocodeResult) {
    setAddressQuery(result.displayName);
    setError(null);
    setSearchRadiusKm(25);
    setPosition({ lat: result.lat, lng: result.lng });
  }

  async function handleSearchAddress() {
    if (!addressQuery.trim()) {
      setError("Inserisci un comune, CAP o indirizzo.");
      return;
    }
    setStatus("locating");
    setError(null);
    try {
      const result = await geocodeAddress(addressQuery);
      if (!result) {
        setStatus("error");
        setError(`Non trovo "${addressQuery}". Prova con un nome più preciso.`);
        return;
      }
      setSearchRadiusKm(25);
      setPosition({ lat: result.lat, lng: result.lng });
    } catch {
      setStatus("error");
      setError("Ricerca indirizzo non disponibile in questo momento. Riprova tra poco.");
    }
  }

  function renderMarkers(stations: ChargerStation[]) {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const s of stations) {
      const marker = L.marker([s.latitude, s.longitude], { icon: makeDotIcon() }).addTo(map);
      const connLabel =
        s.connections.length > 0
          ? s.connections
              .map((c) => `${c.connectionType ?? "presa"}${c.powerKW ? ` ${c.powerKW}kW` : ""}${c.quantity ? ` ×${c.quantity}` : ""}`)
              .join(", ")
          : "connettori non specificati";
      marker.bindPopup(
        `<strong>${escapeHtml(s.title)}</strong><br/>` +
          `${escapeHtml(s.address || s.operator || "")}<br/>` +
          `${escapeHtml(connLabel)}<br/>` +
          `<button class="ev-map-select-btn btn btn--primary btn--small" type="button">Usa questo punto</button>`,
      );
      marker.on("popupopen", () => {
        const btn = document.querySelector(".ev-map-select-btn");
        btn?.addEventListener("click", () => onSelect(s), { once: true });
      });
      markersRef.current.push(marker);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ev-map-title">
      <div className="modal modal--wide">
        <div className="modal__header">
          <h2 id="ev-map-title">Colonnine di ricarica sulla mappa</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <p className="empty-state__body" style={{ padding: "0 1rem" }}>
          Le colonnine vengono mostrate con il GPS del telefono attivo, oppure cercando un comune, CAP o
          indirizzo qui sotto. Il prezzo raramente è pubblico su questi dati: seleziona il punto per
          compilare la potenza (kW), poi inserisci tu il prezzo per kWh del tuo operatore.
        </p>

        <div className="field-row" style={{ padding: "0 1rem", alignItems: "flex-end" }}>
          <div style={{ flex: 2 }}>
            <AddressAutocompleteInput
              id="ev-map-address"
              label="Comune, CAP o indirizzo"
              placeholder="es. Brescia, oppure 25100"
              value={addressQuery}
              onChange={setAddressQuery}
              onSelectSuggestion={handleSelectSuggestion}
            />
          </div>
          <button type="button" className="btn btn--primary btn--small" onClick={handleSearchAddress}>
            Cerca
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={handleUseLocation}>
            Usa la mia posizione
          </button>
        </div>

        {status === "locating" && (
          <p className="empty-state__body" style={{ padding: "0.5rem 1rem 0" }}>Ricerca posizione…</p>
        )}
        {status === "loading" && (
          <p className="empty-state__body" style={{ padding: "0.5rem 1rem 0" }}>Ricerca colonnine vicine…</p>
        )}
        {status === "ready" && stationCount > 0 && (
          <p className="empty-state__body" style={{ padding: "0.5rem 1rem 0" }}>
            {stationCount} punti di ricarica trovati (raggio {searchRadiusKm} km).
          </p>
        )}
        {status === "ready" && stationCount === 0 && (
          <div className="empty-state" style={{ margin: "0.5rem 1rem 0" }}>
            <p className="empty-state__title">Nessun punto trovato nel raggio di {searchRadiusKm} km</p>
            <p className="empty-state__body">
              La copertura di OpenStreetMap varia da zona a zona. Prova ad allargare la ricerca o cerca una
              città più vicina.
            </p>
            <button type="button" className="btn btn--primary btn--small" onClick={handleWiderSearch}>
              Allarga la ricerca a {searchRadiusKm + 25} km
            </button>
          </div>
        )}
        {error && <p className="form-error" style={{ margin: "0.5rem 1rem 0" }}>{error}</p>}

        <div ref={mapContainerRef} style={{ height: "420px", width: "100%", marginTop: "0.75rem" }} />

        <p className="empty-state__body" style={{ padding: "0.75rem 1rem 1rem" }}>
          Dati: OpenStreetMap / Overpass API — nessuna chiave o registrazione richiesta.
        </p>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
