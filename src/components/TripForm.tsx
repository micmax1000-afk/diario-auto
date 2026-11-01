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
  const [toll, setToll] = useState(trip?.extra ? String(trip.extra) : "");
  const [parking, setParking] = useState("");
  const [other, setOther] = useState("");
  const [otherWhat, setOtherWhat] = useState("");
  const [alsoExpense, setAlsoExpense] = useState(true);
  const num = (v: string) => Number(v.replace(",", ".")) || 0;
  const extras = num(toll) + num(parking) + num(other);
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
            <>
              <p className="trips-section">{t("tripForm.expenses", "Spese del viaggio")} <small>{t("vehicleForm.optional")}</small></p>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="trip-toll">{t("tripForm.toll", "Pedaggio autostrada")}</label>
                  <input id="trip-toll" inputMode="decimal" value={toll} onChange={(e) => setToll(e.target.value)} placeholder="0,00" />
                </div>
                <div className="field">
                  <label htmlFor="trip-park">{t("tripForm.parking", "Parcheggio")}</label>
                  <input id="trip-park" inputMode="decimal" value={parking} onChange={(e) => setParking(e.target.value)} placeholder="0,00" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="trip-other">{t("tripForm.other", "Altre spese")}</label>
                  <input id="trip-other" inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} placeholder="0,00" />
                </div>
                <div className="field">
                  <label htmlFor="trip-otherwhat">{t("tripForm.otherWhat", "Per cosa")}</label>
                  <input id="trip-otherwhat" value={otherWhat} onChange={(e) => setOtherWhat(e.target.value)} placeholder={t("tripForm.otherPh", "pranzo, treno, taxi…")} />
                </div>
              </div>
              <div className="field field--checkbox">
                <label htmlFor="trip-also">
                  <input id="trip-also" type="checkbox" checked={alsoExpense} onChange={(e) => setAlsoExpense(e.target.checked)} />
                  {t("tripForm.alsoExpense", "Pedaggio e parcheggio anche nelle Spese dell'auto")}
                </label>
              </div>
            </>
          )}
          {work && (dist > 0 || extras > 0) && (
            <div className="trips-preview">
              <div className="trips-preview__row"><span>{dist} km × {formatMoney(rate, 2)}</span><span>{formatMoney(dist * rate)}</span></div>
              {num(toll) > 0 && <div className="trips-preview__row"><span>{t("tripForm.toll", "Pedaggio autostrada")}</span><span>{formatMoney(num(toll))}</span></div>}
              {num(parking) > 0 && <div className="trips-preview__row"><span>{t("tripForm.parking", "Parcheggio")}</span><span>{formatMoney(num(parking))}</span></div>}
              {num(other) > 0 && <div className="trips-preview__row"><span>{otherWhat || t("tripForm.other", "Altre spese")}</span><span>{formatMoney(num(other))}</span></div>}
              <div className="trips-preview__row trips-preview__tot"><span>{t("tripForm.preview", "Rimborso")}</span><b>{formatMoney(dist * rate + extras)}</b></div>
            </div>
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
