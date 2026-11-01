import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { useAppSettings } from "../contexts/AppSettingsContext";
import type { Trip } from "./TripsPanel";

// ANTEPRIMA: il modulo non salva.
export default function TripForm({ vehicle, trip, rate, onClose }: { vehicle: Vehicle; trip?: Trip; rate: number; onClose: () => void }) {
  const { t } = useTranslation();
  const { formatMoney } = useAppSettings();
  const [work, setWork] = useState(trip?.work ?? true);
  const [roundTrip, setRoundTrip] = useState(trip?.roundTrip ?? true);
  const [byOdometer, setByOdometer] = useState(false);
  const [km, setKm] = useState(trip ? String(trip.km) : "");
  const [extra, setExtra] = useState(trip?.extra ? String(trip.extra) : "");
  const dist = (Number(km) || 0) * (roundTrip ? 2 : 1);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal__header">
          <h2>{trip ? t("tripForm.titleEdit", "Modifica viaggio") : t("tripForm.titleNew", "Nuovo viaggio")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onClose(); }}>
          <div className="commute-toggle" role="tablist">
            <button type="button" role="tab" aria-selected={work} className={work ? "is-active" : ""} onClick={() => setWork(true)}>
              {t("trips.work", "Lavoro")}
            </button>
            <button type="button" role="tab" aria-selected={!work} className={!work ? "is-active" : ""} onClick={() => setWork(false)}>
              {t("trips.private", "Privato")}
            </button>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="trip-date">{t("tripForm.date", "Data")}</label>
              <input id="trip-date" type="date" defaultValue={trip?.date ?? "2026-11-06"} />
            </div>
            <div className="field">
              <label htmlFor="trip-vehicle">{t("tripForm.vehicle", "Veicolo")}</label>
              <input id="trip-vehicle" value={vehicle.name} readOnly />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="trip-from">{t("tripForm.from", "Da")}</label>
              <input id="trip-from" defaultValue={trip?.from ?? "Milano"} placeholder="Partenza" />
            </div>
            <div className="field">
              <label htmlFor="trip-to">{t("tripForm.to", "A")}</label>
              <input id="trip-to" defaultValue={trip?.to ?? ""} placeholder="Destinazione" />
            </div>
          </div>
          {work && (
            <div className="field">
              <label htmlFor="trip-purpose">{t("tripForm.purpose", "Motivo")}</label>
              <input id="trip-purpose" defaultValue={trip?.purpose ?? ""} placeholder={t("tripForm.purposePh", "es. visita cliente, riunione")} />
            </div>
          )}

          <div className="commute-toggle trips-kmmode" role="tablist">
            <button type="button" role="tab" aria-selected={!byOdometer} className={!byOdometer ? "is-active" : ""} onClick={() => setByOdometer(false)}>
              {t("tripForm.byDistance", "Distanza")}
            </button>
            <button type="button" role="tab" aria-selected={byOdometer} className={byOdometer ? "is-active" : ""} onClick={() => setByOdometer(true)}>
              {t("tripForm.byOdometer", "Contachilometri")}
            </button>
          </div>
          {byOdometer ? (
            <div className="field-row">
              <div className="field">
                <label htmlFor="trip-k1">{t("tripForm.kmStart", "Km alla partenza")}</label>
                <input id="trip-k1" inputMode="numeric" defaultValue="70100" />
              </div>
              <div className="field">
                <label htmlFor="trip-k2">{t("tripForm.kmEnd", "Km all'arrivo")}</label>
                <input id="trip-k2" inputMode="numeric" placeholder="70152" />
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="trip-km">{t("tripForm.km", "Km di sola andata")}</label>
              <input id="trip-km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="52" />
            </div>
          )}
          <div className="field field--checkbox">
            <label htmlFor="trip-rt">
              <input id="trip-rt" type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
              {t("tripForm.roundTrip", "Andata e ritorno")}
            </label>
          </div>
          {work && (
            <div className="field">
              <label htmlFor="trip-extra">{t("tripForm.extra", "Pedaggi e parcheggio (€, facoltativo)")}</label>
              <input id="trip-extra" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0,00" />
            </div>
          )}
          {work && dist > 0 && (
            <p className="trips-preview">
              {t("tripForm.preview", "Rimborso")}: <b>{formatMoney(dist * rate + (Number(extra.replace(",", ".")) || 0))}</b>
              <small> · {dist} km × {formatMoney(rate, 2)}</small>
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn--primary">{t("tripForm.save", "Salva viaggio")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
