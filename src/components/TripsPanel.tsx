import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getNumberLocale } from "../utils/locale";
import TripForm from "./TripForm";

// ANTEPRIMA: dati d'esempio, niente salvataggio.
export interface Trip {
  id: string;
  date: string;
  work: boolean;
  from: string;
  to: string;
  km: number;
  roundTrip: boolean;
  purpose?: string;
  extra?: number; // pedaggi e parcheggio da rimborsare
}

const SAMPLE: Trip[] = [
  { id: "t1", date: "2026-11-05", work: true, from: "Milano", to: "Bergamo", km: 52, roundTrip: true, purpose: "Visita cliente Rossi Srl", extra: 4.6 },
  { id: "t2", date: "2026-11-04", work: false, from: "Milano", to: "Lago di Como", km: 61, roundTrip: true },
  { id: "t3", date: "2026-11-03", work: true, from: "Milano", to: "Brescia", km: 94, roundTrip: true, purpose: "Riunione di progetto", extra: 9.8 },
  { id: "t4", date: "2026-11-02", work: true, from: "Milano", to: "Monza", km: 21, roundTrip: false, purpose: "Consegna materiale" },
];

const RATE = 0.3;

export default function TripsPanel({ vehicle }: { vehicle: Vehicle }) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const dist = (tr: Trip) => tr.km * (tr.roundTrip ? 2 : 1);
  const work = SAMPLE.filter((tr) => tr.work);
  const workKm = work.reduce((s, tr) => s + dist(tr), 0);
  const privateKm = SAMPLE.filter((tr) => !tr.work).reduce((s, tr) => s + dist(tr), 0);
  const extra = work.reduce((s, tr) => s + (tr.extra ?? 0), 0);
  const refund = workKm * RATE + extra;
  const workPct = (workKm / (workKm + privateKm)) * 100;
  const km = (n: number) => n.toLocaleString(locale);

  return (
    <>
      <div className="screen-head">
        <h2 className="screen-title">{t("trips.title", "Viaggi di lavoro")}</h2>
        <p className="screen-sub">{t("trips.subtitle", "Km per lavoro e rimborso chilometrico")}</p>
      </div>

      <section className="fc-sum">
        <div className="fc-sum__top">
          <span className="fc-sum__label">{t("trips.refund", "Rimborso da chiedere")}</span>
          <select className="fc-sum__period" defaultValue="month" aria-label={t("trips.period", "Periodo")}>
            <option value="month">{t("trips.thisMonth", "Novembre 2026")}</option>
            <option value="prev">{t("trips.lastMonth", "Ottobre 2026")}</option>
            <option value="year">{t("trips.thisYear", "Quest'anno")}</option>
          </select>
        </div>
        <div className="fc-sum__total">{formatMoney(refund)}</div>
        <div className="fc-sum__kpis">
          <div className="fc-sum__kpi">
            <span>{t("trips.workKm", "Km di lavoro")}</span>
            <b>{km(workKm)} <small>km</small></b>
          </div>
          <div className="fc-sum__kpi">
            <span>{t("trips.tolls", "Pedaggi e sosta")}</span>
            <b>{formatMoney(extra)}</b>
          </div>
          <button type="button" className="fc-sum__kpi trips-rate">
            <span>{t("trips.rate", "Tariffa")} ✎</span>
            <b>{formatMoney(RATE, 2)}<small>/km</small></b>
          </button>
        </div>
        <div className="trips-split" aria-hidden="true">
          <i style={{ width: `${workPct}%` }} />
        </div>
        <div className="trips-split__legend">
          <span><i className="is-work" /> {t("trips.work", "Lavoro")} {km(workKm)} km</span>
          <span><i /> {t("trips.private", "Privato")} {km(privateKm)} km</span>
        </div>
      </section>

      <div className="screen-actions trips-actions">
        <button type="button" className="big-btn" onClick={() => setShowForm(true)}>
          + {t("trips.new", "Nuovo viaggio")}
        </button>
        <button type="button" className="btn btn--ghost trips-export">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
          {t("trips.export", "Esporta per il rimborso (PDF o CSV)")}
        </button>
      </div>

      <section className="fc-month">
        <div className="fc-month__head">
          <span className="fc-month__label">Novembre 2026</span>
          <span className="fc-month__total">{SAMPLE.length}× · <b>{km(workKm + privateKm)} km</b></span>
        </div>
        <div className="mlist">
          {SAMPLE.map((tr) => (
            <div key={tr.id} className={`mrow${tr.work ? "" : " trips-row--private"}`} role="button" tabIndex={0} onClick={() => setEditing(tr)}>
              <div className={`record-card__icon record-card__icon--${tr.work ? "amber" : "cyan"}`}>
                <svg viewBox="0 0 24 24">
                  {tr.work ? (
                    <path d="M4 8h16v11H4zM9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M4 13h16" />
                  ) : (
                    <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />
                  )}
                </svg>
              </div>
              <span className="mrow__mid">
                <span className="mrow__title">
                  {tr.from} → {tr.to}
                </span>
                <span className="mrow__sub">
                  {[tr.purpose ?? t("trips.private", "Privato"), new Date(tr.date).toLocaleDateString(locale, { day: "numeric", month: "short" }), `${km(dist(tr))} km${tr.roundTrip ? ` · ${t("trips.roundTripShort", "A/R")}` : ""}`].join(" · ")}
                </span>
              </span>
              <span className="mrow__end">
                <span className="mrow__amt">{tr.work ? formatMoney(dist(tr) * RATE + (tr.extra ?? 0)) : "—"}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {(showForm || editing) && <TripForm vehicle={vehicle} trip={editing ?? undefined} rate={RATE} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </>
  );
}
