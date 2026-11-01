import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../contexts/AppSettingsContext";
import QuickEntryHeader from "./QuickEntryHeader";

// ANTEPRIMA: distributori e prezzi d'esempio. Nella versione vera arrivano dai
// dati aperti del Ministero (prezzi alle 8 del giorno prima), filtrati per distanza.
type Fuel = "benzina" | "gasolio" | "gpl" | "metano";
interface Station { id: string; name: string; address: string; km: number; prices: Partial<Record<Fuel, { self?: number; served?: number }>> }

const SAMPLE: Station[] = [
  { id: "1", name: "Distributore indipendente", address: "Via Emilia 120", km: 1.2, prices: { benzina: { self: 1.729, served: 1.889 }, gasolio: { self: 1.659 }, gpl: { served: 0.699 } } },
  { id: "2", name: "Stazione di servizio Centro", address: "Viale Roma 8", km: 0.6, prices: { benzina: { self: 1.789, served: 1.949 }, gasolio: { self: 1.709, served: 1.869 } } },
  { id: "3", name: "Area di servizio Tangenziale", address: "Tangenziale Est, uscita 5", km: 3.4, prices: { benzina: { self: 1.759 }, gasolio: { self: 1.689 }, metano: { served: 1.399 } } },
  { id: "4", name: "Stazione Nord", address: "Via Milano 45", km: 2.1, prices: { benzina: { self: 1.819 }, gasolio: { self: 1.739 }, gpl: { served: 0.729 } } },
  { id: "5", name: "Distributore Lago", address: "Strada Provinciale 12", km: 4.8, prices: { benzina: { self: 1.739 }, gasolio: { self: 1.669 } } },
];

interface Props {
  onBack: () => void;
  onUsePrice: (price: number) => void;
}

export default function FuelStations({ onBack, onUsePrice }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const [fuel, setFuel] = useState<Fuel>("benzina");
  const [self, setSelf] = useState(true);
  const [sort, setSort] = useState<"price" | "distance">("price");
  const [radius, setRadius] = useState(5);

  const rows = SAMPLE.map((s) => {
    const p = s.prices[fuel];
    return { s, price: self ? p?.self : p?.served };
  })
    .filter((r): r is { s: Station; price: number } => r.price !== undefined && r.s.km <= radius)
    .sort((a, b) => (sort === "price" ? a.price - b.price || a.s.km - b.s.km : a.s.km - b.s.km));
  const avg = rows.length ? rows.reduce((sum, r) => sum + r.price, 0) / rows.length : 0;
  const best = rows.reduce<typeof rows[number] | null>((m, r) => (!m || r.price < m.price ? r : m), null);
  const saving = best ? (avg - best.price) * 40 : 0;
  const km = (n: number) => `${n.toLocaleString(i18n.language, { maximumFractionDigits: 1 })} km`;

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
          {(["benzina", "gasolio", "gpl", "metano"] as Fuel[]).map((f) => (
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

        {best && rows.length > 1 && saving > 0.2 && (
          <p className="stations__tip">{t("stations.saving", { name: best.s.name, amount: formatMoney(saving) })}</p>
        )}

        {rows.length === 0 ? (
          <div className="empty-state"><p className="empty-state__title">{t("stations.none")}</p></div>
        ) : (
          <div className="stations__list">
            {rows.map((r) => (
              <article key={r.s.id} className={`station${best?.s.id === r.s.id ? " is-best" : ""}`}>
                <div className="station__top">
                  <span className="station__info">
                    <b>{r.s.name}</b>
                    <small>{r.s.address} · {km(r.s.km)}</small>
                  </span>
                  <span className="station__price">
                    {formatMoney(r.price, 3)}
                    <small>/{fuel === "metano" ? "kg" : "l"}</small>
                  </span>
                </div>
                {best?.s.id === r.s.id && <span className="station__badge">{t("stations.cheapest")}</span>}
                <div className="station__actions">
                  <button type="button" className="btn btn--ghost btn--small">{t("stations.navigate")}</button>
                  <button type="button" className="btn btn--primary btn--small" onClick={() => onUsePrice(r.price)}>{t("stations.usePrice")}</button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="stations__source">{t("stations.source")}</p>
      </div>
    </div>
  );
}
