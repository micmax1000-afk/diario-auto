import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchNearbyStations, type FuelApiType, type FuelStation } from "../utils/fuelPriceApi";
import { geocodeAddress } from "../utils/geocoding";

interface Props {
  initialFuel?: FuelApiType;
  onSelect: (price: number, label: string) => void;
  onClose: () => void;
}

const FUEL_OPTIONS: { value: FuelApiType; label: string }[] = [
  { value: "benzina", label: "Benzina" },
  { value: "gasolio", label: "Gasolio" },
];

// Colore del marker in base alla fascia di prezzo rispetto ai risultati trovati
// (economico/medio/caro), come nei siti di riferimento del settore.
function priceColor(price: number, min: number, max: number): string {
  if (max <= min) return "#2e8b57";
  const ratio = (price - min) / (max - min);
  if (ratio <= 1 / 3) return "#2e8b57"; // verde: economico
  if (ratio <= 2 / 3) return "#d99a2b"; // ambra: medio
  return "#c0392b"; // rosso: caro
}

function makeDotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "fuel-price-dot",
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export default function FuelPriceMap({ initialFuel = "benzina", onSelect, onClose }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [fuel, setFuel] = useState<FuelApiType>(initialFuel);
  const [addressQuery, setAddressQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [stationCount, setStationCount] = useState(0);

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

    fetchNearbyStations(position.lat, position.lng, fuel, 15, 25)
      .then((stations) => {
        if (cancelled) return;
        renderMarkers(stations);
        setStationCount(stations.length);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setError(
          "Impossibile contattare il servizio prezzi in questo momento (può capitare al primo avvio, riprova tra qualche secondo).",
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, fuel]);

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("Il browser non supporta la geolocalizzazione. Cerca invece un indirizzo o comune qui sopra.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setStatus("error");
        setError("Posizione non disponibile (permesso negato o non supportato). Cerca invece un indirizzo o comune.");
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
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
      setPosition({ lat: result.lat, lng: result.lng });
    } catch {
      setStatus("error");
      setError("Ricerca indirizzo non disponibile in questo momento. Riprova tra poco.");
    }
  }

  function renderMarkers(stations: FuelStation[]) {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (stations.length === 0) return;

    const prices = stations.map((s) => s.prezzo);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    for (const s of stations) {
      const color = priceColor(s.prezzo, min, max);
      const marker = L.marker([s.latitudine, s.longitudine], { icon: makeDotIcon(color) }).addTo(map);
      const modeLabel = s.self ? "self" : "servito";
      marker.bindPopup(
        `<strong>${escapeHtml(s.gestore)}</strong><br/>` +
          `${escapeHtml(s.indirizzo)}<br/>` +
          `€ ${s.prezzo.toFixed(3)}/l (${modeLabel})<br/>` +
          `<button class="fuel-map-select-btn btn btn--primary btn--small" type="button">Usa questo prezzo</button>`,
      );
      marker.on("popupopen", () => {
        const btn = document.querySelector(".fuel-map-select-btn");
        btn?.addEventListener("click", () => onSelect(s.prezzo, `${s.gestore} · ${s.indirizzo}`), { once: true });
      });
      markersRef.current.push(marker);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fuel-map-title">
      <div className="modal modal--wide">
        <div className="modal__header">
          <h2 id="fuel-map-title">Prezzi carburante sulla mappa</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <div className="field-row" style={{ padding: "0 1rem", alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="fuel-map-type">Carburante</label>
            <select id="fuel-map-type" value={fuel} onChange={(e) => setFuel(e.target.value as FuelApiType)}>
              {FUEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="fuel-map-address">Comune, CAP o indirizzo</label>
            <input
              id="fuel-map-address"
              type="text"
              placeholder="es. Brescia, oppure 25100"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchAddress();
                }
              }}
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
          <p className="empty-state__body" style={{ padding: "0.5rem 1rem 0" }}>
            Ricerca distributori vicini… (può richiedere fino a un minuto al primo avvio)
          </p>
        )}
        {status === "ready" && (
          <p className="empty-state__body" style={{ padding: "0.5rem 1rem 0" }}>
            {stationCount} distributori trovati. Verde = economico, ambra = medio, rosso = caro.
          </p>
        )}
        {error && <p className="form-error" style={{ margin: "0.5rem 1rem 0" }}>{error}</p>}

        <div ref={mapContainerRef} style={{ height: "420px", width: "100%", marginTop: "0.75rem" }} />

        <p className="empty-state__body" style={{ padding: "0.75rem 1rem 1rem" }}>
          Tocca un distributore sulla mappa e poi "Usa questo prezzo" per compilare automaticamente il campo.
          Dati: Ministero delle Imprese e del Made in Italy (open data), via prezzi-carburante.onrender.com.
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
