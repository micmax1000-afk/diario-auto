import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TripEntry, Vehicle } from "../types";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { generateId } from "../utils/storage";
import { isoToLocalDate, localDateString, localDateToIso } from "../utils/dates";
import { useCurrencySymbol } from "../utils/useCurrencySymbol";

interface Props {
  vehicle: Vehicle;
  trip?: TripEntry;
  /** Tariffa €/km; null finché l'utente non la imposta. */
  rate: number | null;
  /** Partenza dell'ultimo viaggio, proposta per i nuovi. */
  lastFrom?: string;
  onSave: (trip: TripEntry, alsoExpense: boolean) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const num = (v: string) => {
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const str = (n: number | undefined) => (n ? String(n).replace(".", ",") : "");
const money = (n: number | undefined) => (n ? n.toFixed(2).replace(".", ",") : "");

export default function TripForm({ vehicle, trip, rate, lastFrom, onSave, onDelete, onClose }: Props) {
  const { t } = useTranslation();
  const { formatMoney } = useAppSettings();
  const cur = useCurrencySymbol();
  const [work, setWork] = useState(trip?.work ?? true);
  const [date, setDate] = useState(trip ? isoToLocalDate(trip.date) : localDateString());
  const [from, setFrom] = useState(trip?.from ?? lastFrom ?? "");
  const [to, setTo] = useState(trip?.to ?? "");
  const [purpose, setPurpose] = useState(trip?.purpose ?? "");
  const [byOdometer, setByOdometer] = useState(trip?.kmStart !== undefined);
  const [oneWay, setOneWay] = useState(trip?.oneWayKm ? str(trip.oneWayKm) : trip && trip.kmStart === undefined ? str(trip.distanceKm) : "");
  const [roundTrip, setRoundTrip] = useState(trip?.roundTrip ?? true);
  const [kmStart, setKmStart] = useState(trip?.kmStart !== undefined ? String(trip.kmStart) : String(vehicle.currentKm || ""));
  const [kmEnd, setKmEnd] = useState(trip?.kmEnd !== undefined ? String(trip.kmEnd) : "");
  const [toll, setToll] = useState(money(trip?.toll));
  const [parking, setParking] = useState(money(trip?.parking));
  const [other, setOther] = useState(money(trip?.otherCost));
  const [otherWhat, setOtherWhat] = useState(trip?.otherWhat ?? "");
  const [alsoExpense, setAlsoExpense] = useState(trip ? (trip.linkedExpenseIds?.length ?? 0) > 0 : true);
  const [error, setError] = useState("");

  const distance = byOdometer ? Math.max(0, num(kmEnd) - num(kmStart)) : num(oneWay) * (roundTrip ? 2 : 1);
  const extras = num(toll) + num(parking) + num(other);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (byOdometer && num(kmEnd) <= num(kmStart)) {
      setError(t("tripForm.errorOdometer"));
      return;
    }
    if (distance <= 0) {
      setError(t("tripForm.errorKm"));
      return;
    }
    const entry: TripEntry = {
      id: trip?.id ?? generateId(),
      vehicleId: vehicle.id,
      date: localDateToIso(date, trip?.date),
      work,
      from: from.trim() || undefined,
      to: to.trim() || undefined,
      purpose: work ? purpose.trim() || undefined : undefined,
      distanceKm: Math.round(distance * 10) / 10,
      oneWayKm: byOdometer ? undefined : num(oneWay),
      roundTrip: byOdometer ? undefined : roundTrip,
      kmStart: byOdometer ? num(kmStart) : undefined,
      kmEnd: byOdometer ? num(kmEnd) : undefined,
      toll: work && num(toll) ? num(toll) : undefined,
      parking: work && num(parking) ? num(parking) : undefined,
      otherCost: work && num(other) ? num(other) : undefined,
      otherWhat: work && num(other) ? otherWhat.trim() || undefined : undefined,
      linkedExpenseIds: trip?.linkedExpenseIds,
      createdAt: trip?.createdAt,
    };
    onSave(entry, work && alsoExpense);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="trip-form-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="trip-form-title">{trip ? t("tripForm.titleEdit") : t("tripForm.titleNew")}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="commute-toggle" role="tablist">
            <button type="button" role="tab" aria-selected={work} className={work ? "is-active" : ""} onClick={() => setWork(true)}>
              {t("trips.work")}
            </button>
            <button type="button" role="tab" aria-selected={!work} className={!work ? "is-active" : ""} onClick={() => setWork(false)}>
              {t("trips.private")}
            </button>
          </div>

          <div className="field">
            <label htmlFor="trip-date">{t("tripForm.date")}</label>
            <input id="trip-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="trip-from">{t("tripForm.from")}</label>
              <input id="trip-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t("tripForm.fromPh")} />
            </div>
            <div className="field">
              <label htmlFor="trip-to">{t("tripForm.to")}</label>
              <input id="trip-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("tripForm.toPh")} />
            </div>
          </div>
          {work && (
            <div className="field">
              <label htmlFor="trip-purpose">{t("tripForm.purpose")}</label>
              <input id="trip-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("tripForm.purposePh")} />
            </div>
          )}

          <div className="commute-toggle trips-kmmode" role="tablist">
            <button type="button" role="tab" aria-selected={!byOdometer} className={!byOdometer ? "is-active" : ""} onClick={() => setByOdometer(false)}>
              {t("tripForm.byDistance")}
            </button>
            <button type="button" role="tab" aria-selected={byOdometer} className={byOdometer ? "is-active" : ""} onClick={() => setByOdometer(true)}>
              {t("tripForm.byOdometer")}
            </button>
          </div>
          {byOdometer ? (
            <>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="trip-k1">{t("tripForm.kmStart")}</label>
                  <input id="trip-k1" inputMode="numeric" value={kmStart} onChange={(e) => setKmStart(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="trip-k2">{t("tripForm.kmEnd")}</label>
                  <input id="trip-k2" inputMode="numeric" value={kmEnd} onChange={(e) => setKmEnd(e.target.value)} />
                </div>
              </div>
              <small className="vform-hint">{t("tripForm.odometerHint")}</small>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="trip-km">{t("tripForm.km")}</label>
                <input id="trip-km" inputMode="decimal" value={oneWay} onChange={(e) => setOneWay(e.target.value)} />
              </div>
              <div className="field field--checkbox">
                <label htmlFor="trip-rt">
                  <input id="trip-rt" type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
                  {t("tripForm.roundTrip")}
                </label>
              </div>
            </>
          )}

          {work && (
            <>
              <p className="trips-section">
                {t("tripForm.expenses")} <small>{t("vehicleForm.optional")}</small>
              </p>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="trip-toll">{t("tripForm.toll")} ({cur})</label>
                  <input id="trip-toll" inputMode="decimal" value={toll} onChange={(e) => setToll(e.target.value)} placeholder="0,00" />
                </div>
                <div className="field">
                  <label htmlFor="trip-park">{t("tripForm.parking")} ({cur})</label>
                  <input id="trip-park" inputMode="decimal" value={parking} onChange={(e) => setParking(e.target.value)} placeholder="0,00" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="trip-other">{t("tripForm.other")} ({cur})</label>
                  <input id="trip-other" inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} placeholder="0,00" />
                </div>
                <div className="field">
                  <label htmlFor="trip-otherwhat">{t("tripForm.otherWhat")}</label>
                  <input id="trip-otherwhat" value={otherWhat} onChange={(e) => setOtherWhat(e.target.value)} placeholder={t("tripForm.otherPh")} />
                </div>
              </div>
              <div className="field field--checkbox">
                <label htmlFor="trip-also">
                  <input id="trip-also" type="checkbox" checked={alsoExpense} onChange={(e) => setAlsoExpense(e.target.checked)} />
                  {t("tripForm.alsoExpense")}
                </label>
              </div>
            </>
          )}

          {work && (distance > 0 || extras > 0) && (
            <div className="trips-preview">
              {rate !== null ? (
                <div className="trips-preview__row">
                  <span>{distance.toLocaleString()} km × {formatMoney(rate, 2)}</span>
                  <span>{formatMoney(distance * rate)}</span>
                </div>
              ) : (
                <div className="trips-preview__row">
                  <span>{t("tripForm.noRate", { km: distance.toLocaleString() })}</span>
                </div>
              )}
              {num(toll) > 0 && <div className="trips-preview__row"><span>{t("tripForm.toll")}</span><span>{formatMoney(num(toll))}</span></div>}
              {num(parking) > 0 && <div className="trips-preview__row"><span>{t("tripForm.parking")}</span><span>{formatMoney(num(parking))}</span></div>}
              {num(other) > 0 && <div className="trips-preview__row"><span>{otherWhat.trim() || t("tripForm.other")}</span><span>{formatMoney(num(other))}</span></div>}
              <div className="trips-preview__row trips-preview__tot">
                <span>{t("trips.refund")}</span>
                <b>{formatMoney(distance * (rate ?? 0) + extras)}</b>
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            {onDelete && (
              <button type="button" className="btn btn--ghost btn--danger modal__delete" onClick={onDelete}>
                {t("common.delete")}
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn--primary">{t("tripForm.save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
