import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Geolocation } from "@capacitor/geolocation";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { distanceKm, loadNearbyStations, type Station, type StationFuel } from "../utils/fuelStations";
import { getMeta, setMeta } from "../utils/db";
import type { GeocodeResult } from "../utils/geocoding";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import QuickEntryHeader from "./QuickEntryHeader";
import { isInItaly } from "../utils/settings";

interface Props {
  defaultFuel: StationFuel;
  onBack: () => void;
  onUsePrice: (price: number) => void;
}

type Service = "all" | "self" | "served";
interface Place { name: string; lat: number; lng: number }
const PLACE_KEY = "stations-place";
const StationsMap = lazy(() => import("./StationsMap"));
const MAP_MAX = 25;
const PAGE = 30;
// Vista mappa dei distributori (OpenFreeMap).
const SHOW_MAP = true;

type State = { kind: "loading"; stage: "locate" | "download" | "read" } | { kind: "denied" } | { kind: "error"; detail: string } | { kind: "abroad" } | { kind: "ready"; stations: Station[]; at: number; center: { lat: number; lng: number } };

/** "VIA ROMA 1, MILANO" → "Via Roma 1, Milano" */
const tidyPart = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s,'(/-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()) : s);
const tidy = (s: string) => s.split(", ").map(tidyPart).join(", ");

export default function FuelStations({ defaultFuel, onBack, onUsePrice }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const [fuel, setFuel] = useState<StationFuel>(defaultFuel);
  const [service, setService] = useState<Service>("all");
  const [sort, setSort] = useState<"price" | "distance">("price");
  const [radius, setRadius] = useState(5);
  const [state, setState] = useState<State>({ kind: "loading", stage: "locate" });
  // Comune scelto a mano (null = posizione del telefono); editing = campo di ricerca aperto
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  // con altri filtri si riparte dai primi
  useEffect(() => setShown(PAGE), [fuel, service, sort, radius, place]);

  const center = useRef<{ lat: number; lng: number } | null>(null);
  const loadAt = useCallback(async (lat: number, lng: number, force: boolean) => {
    if (!isInItaly(lat, lng)) return setState({ kind: "abroad" });
    const { stations, at } = await loadNearbyStations(lat, lng, force, (stage) => setState({ kind: "loading", stage }));
    center.current = { lat, lng };
    setState({ kind: "ready", stations, at, center: { lat, lng } });
  }, []);

  const load = useCallback(async (force = false, chosen: Place | null = null) => {
    setState({ kind: "loading", stage: "locate" });
    try {
      if (chosen) return await loadAt(chosen.lat, chosen.lng, force);
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") perm = await Geolocation.requestPermissions({ permissions: ["coarseLocation"] });
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") return setState({ kind: "denied" });
      // posizione fresca (al massimo di 30 secondi fa); se il GPS è lento, quella approssimativa
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }).catch(() =>
        Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 }),
      );
      await loadAt(pos.coords.latitude, pos.coords.longitude, force);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).toLowerCase();
      setState(msg.includes("denied") || msg.includes("permission") ? { kind: "denied" } : { kind: "error", detail: String((e as Error)?.message ?? e).slice(0, 120) });
    }
  }, [loadAt]);

  useEffect(() => {
    getMeta(PLACE_KEY).then((raw) => {
      let saved: Place | null = null;
      try {
        saved = raw ? (JSON.parse(raw) as Place) : null;
      } catch {
        saved = null;
      }
      setPlace(saved);
      void load(false, saved);
    });
  }, [load]);

  // Con la posizione del telefono, segue gli spostamenti mentre la pagina è aperta:
  // oltre 250 m ricalcola le distanze (i prezzi già scaricati bastano).
  const following = place === null && state.kind === "ready";
  useEffect(() => {
    if (!following) return;
    let watchId: string | null = null;
    let cancelled = false;
    Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 }, (pos) => {
      if (!pos || cancelled) return;
      const { latitude: lat, longitude: lng } = pos.coords;
      const c = center.current;
      if (c && distanceKm(lat, lng, c.lat, c.lng) < 0.25) return;
      void loadAt(lat, lng, false).catch(() => {});
    })
      .then((id) => {
        if (cancelled) void Geolocation.clearWatch({ id });
        else watchId = id;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (watchId) void Geolocation.clearWatch({ id: watchId });
    };
  }, [following, loadAt]);

  function choosePlace(r: GeocodeResult) {
    const p: Place = { name: query.split(",")[0].trim() || r.displayName.split(",")[0], lat: r.lat, lng: r.lng };
    setPlace(p);
    setEditing(false);
    void setMeta(PLACE_KEY, JSON.stringify(p));
    void load(false, p);
  }
  function useGps() {
    setPlace(null);
    setEditing(false);
    void setMeta(PLACE_KEY, "");
    void load();
  }

  const rows =
    state.kind === "ready"
      ? state.stations
          .map((s) => {
            const p = s.prices[fuel];
            const self = p?.self;
            const served = p?.served;
            if (service === "self") return { s, price: self, isSelf: true };
            if (service === "served") return { s, price: served, isSelf: false };
            // Tutti: il prezzo più basso tra self e servito (il GPL è quasi sempre solo servito)
            if (self !== undefined && (served === undefined || self <= served)) return { s, price: self, isSelf: true };
            return { s, price: served, isSelf: false };
          })
          .filter((r): r is { s: Station; price: number; isSelf: boolean } => r.price !== undefined && r.s.km <= radius)
          .sort((a, b) => (sort === "price" ? a.price - b.price || a.s.km - b.s.km : a.s.km - b.s.km))
      : [];
  const avg = rows.length ? rows.reduce((sum, r) => sum + r.price, 0) / rows.length : 0;
  const best = rows.reduce<(typeof rows)[number] | null>((m, r) => (!m || r.price < m.price ? r : m), null);
  const saving = best ? (avg - best.price) * 40 : 0;
  const mapPrice = useCallback((n: number) => n.toLocaleString(i18n.language, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), [i18n.language]);
  const km = (n: number) => `${n.toLocaleString(i18n.language, { maximumFractionDigits: 1 })} km`;
  // Sulla mappa i primi 25 nell'ordine scelto (più vicini o più economici), sempre con
  // il più economico e quello selezionato: tutti insieme in città sarebbero troppi.
  const mapRows = (() => {
    const list = rows.slice(0, MAP_MAX);
    for (const extra of [best, rows.find((r) => r.s.id === selectedId)]) {
      if (extra && !list.includes(extra)) list.push(extra);
    }
    return list;
  })();
  const areaPrices = rows.map((r) => r.price);
  const card = (r: (typeof rows)[number]) => (
    <article key={r.s.id} className={`station${best?.s.id === r.s.id ? " is-best" : ""}`}>
                    <div className="station__top">
                      <span className="station__info">
                        <b>{r.s.brand}</b>
                        <small>{tidy(r.s.address)} · {km(r.s.km)}</small>
                      </span>
                      <span className="station__price">
                        {formatMoney(r.price, 3)}
                        <small>/{fuel === "metano" ? "kg" : "l"}</small>
                        {service === "all" && <em>{t(r.isSelf ? "stations.self" : "stations.served")}</em>}
                      </span>
                    </div>
                    {best?.s.id === r.s.id && <span className="station__badge">{t("stations.cheapest")}</span>}
                    <div className="station__actions">
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => navigate(r.s)}>{t("stations.navigate")}</button>
                      <button type="button" className="btn btn--primary btn--small" onClick={() => onUsePrice(r.price)}>{t("stations.usePrice")}</button>
                    </div>
                  </article>
  );
  const navigate = (s: Station) => {
    window.location.href = `geo:${s.lat},${s.lng}?q=${s.lat},${s.lng}(${encodeURIComponent(s.brand)})`;
  };

  return (
    <div className="quick-entry-page">
      <QuickEntryHeader title={t("stations.title")} onBack={onBack} tone="green" />
      <div className="quick-entry-page__body stations">
        <div className="stations__where">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
          <button type="button" className="stations__place" onClick={() => setEditing((v) => !v)}>
            <span>{place ? t("stations.nearPlace", { place: place.name }) : t("stations.near")}</span>
            <small>{t("stations.change")}</small>
          </button>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label={t("stations.radius")}>
            {[5, 10, 20, 30].map((r) => <option key={r} value={r}>{t("stations.within", { km: r })}</option>)}
          </select>
        </div>
        {(editing || state.kind === "denied") && (
          <div className="stations__search">
            <AddressAutocompleteInput
              id="stations-place"
              label={t("stations.placeLabel")}
              placeholder={t("stations.placePh")}
              value={query}
              onChange={setQuery}
              onSelectSuggestion={choosePlace}
            />
            {place && (
              <button type="button" className="dash-link" onClick={useGps}>
                {t("stations.useGps")}
              </button>
            )}
          </div>
        )}

        <div className="stations__fuels" role="tablist">
          {(["benzina", "gasolio", "gpl", "metano"] as StationFuel[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={fuel === f} className={fuel === f ? "is-active" : ""} onClick={() => setFuel(f)}>
              {t(`stations.fuel_${f}`)}
            </button>
          ))}
        </div>
        <div className="stations__opts">
          <div className="commute-toggle" role="tablist">
            {(["all", "self", "served"] as Service[]).map((sv) => (
              <button key={sv} type="button" role="tab" aria-selected={service === sv} className={service === sv ? "is-active" : ""} onClick={() => setService(sv)}>
                {t(sv === "all" ? "stations.all" : sv === "self" ? "stations.self" : "stations.served")}
              </button>
            ))}
          </div>
          {SHOW_MAP && <div className="stations__view" role="tablist">
            <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>{t("stations.list")}</button>
            <button type="button" role="tab" aria-selected={view === "map"} className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}>{t("stations.map")}</button>
          </div>}
          <select className="fc-sum__period" value={sort} onChange={(e) => setSort(e.target.value as "price" | "distance")} aria-label={t("stations.sort")}>
            <option value="price">{t("stations.byPrice")}</option>
            <option value="distance">{t("stations.byDistance")}</option>
          </select>
        </div>

        {state.kind === "loading" && <div className="empty-state"><p className="empty-state__title">{t(state.stage === "locate" ? "stations.locating" : state.stage === "read" ? "stations.reading" : "stations.loading")}</p><p className="empty-state__body">{t(state.stage === "download" ? "stations.loadingBody" : "stations.wait")}</p></div>}
        {state.kind === "denied" && (
          <div className="empty-state">
            <p className="empty-state__title">{t("stations.deniedTitle")}</p>
            <p className="empty-state__body">{t("stations.deniedBody")}</p>
            <button type="button" className="btn btn--ghost" onClick={() => void load()}>{t("stations.retry")}</button>
          </div>
        )}
        {state.kind === "abroad" && (
          <div className="empty-state">
            <p className="empty-state__title">{t("stations.abroadTitle")}</p>
            <p className="empty-state__body">{t("stations.abroadBody")}</p>
          </div>
        )}
        {state.kind === "error" && (
          <div className="empty-state">
            <p className="empty-state__title">{t("stations.errorTitle")}</p>
            <p className="empty-state__body">{t("stations.errorBody")}</p>
            <p className="stations__detail">{state.detail}</p>
            <button type="button" className="btn btn--primary" onClick={() => void load(true, place ?? null)}>{t("stations.retry")}</button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            {best && rows.length > 1 && saving > 0.2 && (
              <p className="stations__tip">{t("stations.saving", { name: best.s.brand, amount: formatMoney(saving) })}</p>
            )}
            {view === "map" && rows.length > 0 && (
              <>
                <Suspense fallback={<div className="smap" />}>
                  <StationsMap
                    center={state.center}
                    rows={mapRows}
                    areaPrices={areaPrices}
                    selectedId={selectedId}
                    formatPrice={mapPrice}
                    onSelect={setSelectedId}
                  />
                </Suspense>
                {(() => {
                  const sel = rows.find((r) => r.s.id === selectedId);
                  return sel ? card(sel) : <p className="stations__hint">{rows.length > MAP_MAX ? t(sort === "distance" ? "stations.mapTopNear" : "stations.mapTop", { count: MAP_MAX }) + " " : ""}{t("stations.tapPin")}</p>;
                })()}
              </>
            )}
            {view === "map" ? null : rows.length === 0 ? (
              <div className="empty-state"><p className="empty-state__title">{t("stations.none")}</p></div>
            ) : (
              <div className="stations__list">
                {rows.slice(0, shown).map((r) => card(r))}
                {rows.length > shown && (
                  <button type="button" className="btn btn--ghost stations__more" onClick={() => setShown((n) => n + PAGE)}>
                    {t("stations.more", { count: Math.min(PAGE, rows.length - shown), total: rows.length })}
                  </button>
                )}
              </div>
            )}
          </>
        )}
        <p className="stations__source">{t("stations.source")}</p>
      </div>
    </div>
  );
}
