import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Station } from "../utils/fuelStations";

export interface MapRow {
  s: Station;
  price: number;
}

interface Props {
  center: { lat: number; lng: number };
  rows: MapRow[];
  /** Prezzi di tutti i distributori della zona: i colori dicono quanto conviene rispetto a questi. */
  areaPrices: number[];
  selectedId: string | null;
  formatPrice: (n: number) => string;
  onSelect: (id: string) => void;
}

// Mappe OpenFreeMap: dati OpenStreetMap, gratuite, senza chiave.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Colore per fascia di prezzo: quota di distributori più economici (a pari prezzo, stesso colore). */
function priceColor(price: number, all: number[]): string {
  const cheaper = all.filter((p) => p < price).length;
  const t = all.length > 1 ? cheaper / all.length : 0;
  return t < 0.34 ? "#1f9d55" : t < 0.67 ? "#e3a008" : "#d64545";
}

/** Mappa dei distributori: un'etichetta con il prezzo per ciascuno, il tocco la seleziona. */
export default function StationsMap({ center, rows, areaPrices, selectedId, formatPrice, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // attribuzione chiusa in un "i" (resta toccabile), così non copre la mappa
    m.once("load", () => box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // la mappa si crea una volta sola; gli spostamenti aggiornano solo i segnaposto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const best = Math.min(...rows.map((r) => r.price));
    const here = document.createElement("div");
    here.className = "smap-me";
    markers.current.push(new maplibregl.Marker({ element: here }).setLngLat([center.lng, center.lat]).addTo(m));
    // i più cari sotto, i più economici sopra
    for (const r of [...rows].sort((a, b) => b.price - a.price)) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `smap-pin${r.s.id === selectedId ? " is-on" : ""}${r.price === best ? " is-best" : ""}`;
      el.style.setProperty("--pin", priceColor(r.price, areaPrices));
      el.textContent = `${r.price === best ? "★ " : ""}${formatPrice(r.price)}`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(r.s.id);
      });
      markers.current.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([r.s.lng, r.s.lat]).addTo(m));
    }
    if (rows.length) {
      const b = new maplibregl.LngLatBounds([center.lng, center.lat], [center.lng, center.lat]);
      rows.forEach((r) => b.extend([r.s.lng, r.s.lat]));
      m.fitBounds(b, { padding: 50, maxZoom: 15, duration: 0 });
    }
  }, [rows, areaPrices, selectedId, center.lat, center.lng, formatPrice, onSelect]);

  return <div ref={box} className="smap" />;
}
