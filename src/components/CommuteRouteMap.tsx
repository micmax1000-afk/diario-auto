import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress, type GeocodeResult } from "../utils/geocoding";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getDrivingRoute, type RouteResult } from "../utils/routing";
import AddressAutocompleteInput from "./AddressAutocompleteInput";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface Props {
  initialOrigin?: string;
  initialDestination?: string;
  onSelect: (kmOneWay: number, label: string) => void;
  onClose: () => void;
}

export default function CommuteRouteMap({ initialOrigin = "", initialDestination = "", onSelect, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [originPicked, setOriginPicked] = useState<GeocodeResult | null>(null);
  const [destinationPicked, setDestinationPicked] = useState<GeocodeResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);

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

  async function handleCalculate() {
    if (!origin.trim() || !destination.trim()) {
      setError(t("commuteRouteMap.errorBothFields"));
      return;
    }

    setStatus("loading");
    setError(null);
    setRoute(null);

    try {
      const [originPoint, destPoint] = await Promise.all([
        originPicked && originPicked.displayName === origin.trim() ? Promise.resolve(originPicked) : geocodeAddress(origin, i18n.language),
        destinationPicked && destinationPicked.displayName === destination.trim()
          ? Promise.resolve(destinationPicked)
          : geocodeAddress(destination, i18n.language),
      ]);

      if (!originPoint) {
        setStatus("error");
        setError(t("commuteRouteMap.errorNotFound", { query: origin }));
        return;
      }
      if (!destPoint) {
        setStatus("error");
        setError(t("commuteRouteMap.errorNotFound", { query: destination }));
        return;
      }

      const result = await getDrivingRoute(originPoint, destPoint);
      setRoute(result);
      setStatus("ready");
      drawRoute(originPoint, destPoint, result);
    } catch {
      setStatus("error");
      setError(t("commuteRouteMap.errorGeneric"));
    }
  }

  function drawRoute(
    originPoint: { lat: number; lng: number },
    destPoint: { lat: number; lng: number },
    result: RouteResult,
  ) {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    routeLayerRef.current?.remove();
    routeLayerRef.current = null;

    const originMarker = L.marker([originPoint.lat, originPoint.lng], { icon: markerIcon })
      .addTo(map)
      .bindPopup(t("commuteRouteMap.originMarker"));
    const destMarker = L.marker([destPoint.lat, destPoint.lng], { icon: markerIcon })
      .addTo(map)
      .bindPopup(t("commuteRouteMap.destinationMarker"));
    markersRef.current = [originMarker, destMarker];

    const latLngs = result.geometry.map((p) => [p.lat, p.lng] as [number, number]);
    const polyline = L.polyline(latLngs, { color: "#f5901f", weight: 4 }).addTo(map);
    routeLayerRef.current = polyline;

    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
  }

  function handleUseRoute() {
    if (!route) return;
    onSelect(route.distanceKm, `${origin.trim()} → ${destination.trim()}`);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="commute-route-title">
      <div className="modal modal--wide">
        <div className="modal__header">
          <h2 id="commute-route-title">{t("commuteRouteMap.title")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div className="field-row" style={{ padding: "0 1rem" }}>
          <AddressAutocompleteInput
            id="route-origin"
            label={t("commuteRouteMap.origin")}
            placeholder={t("commuteRouteMap.originPlaceholder")}
            value={origin}
            onChange={(v) => {
              setOrigin(v);
              setOriginPicked(null);
            }}
            onSelectSuggestion={(result) => {
              setOrigin(result.displayName);
              setOriginPicked(result);
            }}
          />
          <AddressAutocompleteInput
            id="route-destination"
            label={t("commuteRouteMap.destination")}
            placeholder={t("commuteRouteMap.destinationPlaceholder")}
            value={destination}
            onChange={(v) => {
              setDestination(v);
              setDestinationPicked(null);
            }}
            onSelectSuggestion={(result) => {
              setDestination(result.displayName);
              setDestinationPicked(result);
            }}
          />
        </div>

        <div style={{ padding: "0 1rem 0.75rem" }}>
          <button type="button" className="btn btn--primary btn--small" onClick={handleCalculate} disabled={status === "loading"}>
            {status === "loading" ? t("commuteRouteMap.calculating") : t("commuteRouteMap.calculate")}
          </button>
        </div>

        {error && <p className="form-error" style={{ margin: "0 1rem 0.75rem" }}>{error}</p>}

        <div ref={mapContainerRef} style={{ height: "380px", width: "100%" }} />

        {route && (
          <div className="stat-row" style={{ padding: "0.75rem 1rem 0" }}>
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commuteRouteMap.distance")}</span>
              <span className="stat-chip__value">
                {kmToDisplayDistance(route.distanceKm, distanceUnit).toFixed(1)} {distanceUnit}
              </span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">{t("commuteRouteMap.duration")}</span>
              <span className="stat-chip__value">{Math.round(route.durationMin)} min</span>
            </div>
          </div>
        )}

        <p className="empty-state__body" style={{ padding: "0.75rem 1rem 1rem" }}>
          {t("commuteRouteMap.hint")}
        </p>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t("commuteRouteMap.cancel")}
          </button>
          <button type="button" className="btn btn--primary" onClick={handleUseRoute} disabled={!route}>
            {t("commuteRouteMap.useRoute")}
          </button>
        </div>
      </div>
    </div>
  );
}
