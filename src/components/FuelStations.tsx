import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Geolocation } from "@capacitor/geolocation";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { loadNearbyStations, type Station, type StationFuel } from "../utils/fuelStations";
import QuickEntryHeader from "./QuickEntryHeader";

interface Props {
  defaultFuel: StationFuel;
  onBack: () => void;
  onUsePrice: (price: number) => void;
}

type State = { kind: "loading" } | { kind: "denied" } | { kind: "error" } | { kind: "ready"; stations: Station[]; at: number };

/** "VIA ROMA 1, MILANO" → "Via Roma 1, Milano" */
const tidy = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s,'(/-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()) : s);

export default function FuelStations({ defaultFuel, onBack, onUsePrice }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const [fuel, setFuel] = useState<StationFuel>(defaultFuel);
  const [self, setSelf] = useState(defaultFuel !== "gpl" && defaultFuel !== "metano");
  const [sort, setSort] = useState<"price" | "distance">("price");
  const [radius, setRadius] = useState(5);
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async (force = false) => {
    setState({ kind: "loading" });
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") perm = await Geolocation.requestPermissions({ permissions: ["coarseLocation"] });
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") return setState({ kind: "denied" });
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60_000 });
      const { stations, at } = await loadNearbyStations(pos.coords.latitude, pos.coords.longitude, force);
      setState({ kind: "ready", stations, at });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).toLowerCase();
      setState({ kind: msg.includes("denied") || msg.includes("permission") ? "denied" : "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows =
    state.kind === "ready"
      ? state.stations
          .map((s) => ({ s, price: self ? s.prices[fuel]?.self : s.prices[fuel]?.served }))
          .filter((r): r is { s: Station; price: number } => r.price !== undefined && r.s.km <= radius)
          .sort((a, b) => (sort === "price" ? a.price - b.price || a.s.km - b.s.km : a.s.km - b.s.km))
      : [];
  const avg = rows.length ? rows.reduce((sum, r) => sum + r.price, 0) / rows.length : 0;
  const best = rows.reduce<(typeof rows)[number] | null>((m, r) => (!m || r.price < m.price ? r : m), null);
  const saving = best ? (avg - best.price) * 40 : 0;
  const km = (n: number) => `${n.toLocaleString(i18n.language, { maximumFractionDigits: 1 })} km`;
  const navigate = (s: Station) => {
    window.location.href = `geo:${s.lat},${s.lng}?q=${s.lat},${s.lng}(${encodeURIComponent(s.brand)})`;
  };

  return (
    <div className="quick-entry-page">
      <QuickEntryHeader title={t("stations.title")} onBack={onBack} tone="green" />
      <div className="quick-entry-page__body stations">
        <div className="stations__where">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
          <span>{t("stations.near")}</span>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label={t("stations.radius")}>
            {[2, 5, 10].map((r) => <option key={r} value={r}>{t("stations.within", { km: r })}</option>)}
          </select>
        </div>

        <div className="stations__fuels" role="tablist">
          {(["benzina", "gasolio", "gpl", "metano"] as StationFuel[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={fuel === f} className={fuel === f ? "is-active" : ""} onClick={() => setFuel(f)}>
              {t(`stations.fuel_${f}`)}
            </button>
          ))}
        </div>
        <div className="stations__opts">
          <div className="commute-toggle" role="tablist">
            <button type="button" role="tab" aria-selected={self} className={self ? "is-active" : ""} onClick={() => setSelf(true)}>{t("stations.self")}</button>
            <button type="button" role="tab" aria-selected={!self} className={!self ? "is-active" : ""} onClick={() => setSelf(false)}>{t("stations.served")}</button>
          </div>
          <select className="fc-sum__period" value={sort} onChange={(e) => setSort(e.target.value as "price" | "distance")} aria-label={t("stations.sort")}>
            <option value="price">{t("stations.byPrice")}</option>
            <option value="distance">{t("stations.byDistance")}</option>
          </select>
        </div>

        {state.kind === "loading" && <div className="empty-state"><p className="empty-state__title">{t("stations.loading")}</p><p className="empty-state__body">{t("stations.loadingBody")}</p></div>}
        {state.kind === "denied" && (
          <div className="empty-state">
            <p className="empty-state__title">{t("stations.deniedTitle")}</p>
            <p className="empty-state__body">{t("stations.deniedBody")}</p>
            <button type="button" className="btn btn--primary" onClick={() => void load()}>{t("stations.retry")}</button>
          </div>
        )}
        {state.kind === "error" && (
          <div className="empty-state">
            <p className="empty-state__title">{t("stations.errorTitle")}</p>
            <p className="empty-state__body">{t("stations.errorBody")}</p>
            <button type="button" className="btn btn--primary" onClick={() => void load(true)}>{t("stations.retry")}</button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            {best && rows.length > 1 && saving > 0.2 && (
              <p className="stations__tip">{t("stations.saving", { name: best.s.brand, amount: formatMoney(saving) })}</p>
            )}
            {rows.length === 0 ? (
              <div className="empty-state"><p className="empty-state__title">{t("stations.none")}</p></div>
            ) : (
              <div className="stations__list">
                {rows.slice(0, 30).map((r) => (
                  <article key={r.s.id} className={`station${best?.s.id === r.s.id ? " is-best" : ""}`}>
                    <div className="station__top">
                      <span className="station__info">
                        <b>{r.s.brand}</b>
                        <small>{tidy(r.s.address)} · {km(r.s.km)}</small>
                      </span>
                      <span className="station__price">
                        {formatMoney(r.price, 3)}
                        <small>/{fuel === "metano" ? "kg" : "l"}</small>
                      </span>
                    </div>
                    {best?.s.id === r.s.id && <span className="station__badge">{t("stations.cheapest")}</span>}
                    <div className="station__actions">
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => navigate(r.s)}>{t("stations.navigate")}</button>
                      <button type="button" className="btn btn--primary btn--small" onClick={() => onUsePrice(r.price)}>{t("stations.usePrice")}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        <p className="stations__source">{t("stations.source")}</p>
      </div>
    </div>
  );
}
