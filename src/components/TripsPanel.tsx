import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TripEntry, Vehicle } from "../types";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { getNumberLocale } from "../utils/locale";
import { getMeta, setMeta } from "../utils/db";
import { localDateString } from "../utils/dates";
import { exportPdfBytes, exportTextFile } from "../utils/nativeFileExport";
import { tripExtras, tripRefund, tripTotals, tripsInPeriod, tripsToCsv, type TripPeriod } from "../utils/trips";
import { useBackButtonClose } from "../utils/backButtonStack";
import TripForm from "./TripForm";
import PremiumScreen from "./PremiumScreen";
import { useProStatus } from "../services/billing/useProStatus";

const RATE_KEY = "trip-rate";

interface Props {
  vehicle: Vehicle;
  trips: TripEntry[];
  onSave: (trip: TripEntry, alsoExpense: boolean) => void;
  onDelete: (id: string) => void;
}

export default function TripsPanel({ vehicle, trips, onSave, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const [period, setPeriod] = useState<TripPeriod>("month");
  const [rate, setRate] = useState<number | null>(null);
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const [form, setForm] = useState<{ trip?: TripEntry } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  // l'export del rimborso (PDF e CSV) fa parte del Pro; con l'interruttore spento è libero
  const { isPro } = useProStatus();
  const [showPremium, setShowPremium] = useState(false);
  useBackButtonClose(rateDraft !== null, () => setRateDraft(null));

  useEffect(() => {
    getMeta(RATE_KEY).then((v) => {
      const n = v ? Number(v) : NaN;
      setRate(Number.isFinite(n) && n > 0 ? n : null);
    });
  }, []);

  async function saveRate() {
    const n = Number((rateDraft ?? "").replace(",", "."));
    const value = Number.isFinite(n) && n > 0 ? n : null;
    setRate(value);
    await setMeta(RATE_KEY, value ? String(value) : "");
    setRateDraft(null);
  }

  const shown = tripsInPeriod(trips, period);
  const totals = tripTotals(shown, rate);
  const km = (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 1 })} km`;
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const route = (tr: TripEntry) => [tr.from, tr.to].filter(Boolean).join(" → ") || t("trips.noRoute");
  const now = new Date();
  const periodLabel =
    period === "month" || period === "lastMonth"
      ? new Date(now.getFullYear(), now.getMonth() - (period === "lastMonth" ? 1 : 0), 15).toLocaleDateString(locale, { month: "long", year: "numeric" })
      : period === "year"
        ? String(now.getFullYear())
        : t("trips.period_all");
  const workPct = totals.workKm + totals.privateKm > 0 ? (totals.workKm / (totals.workKm + totals.privateKm)) * 100 : 0;
  const lastFrom = [...trips].sort((a, b) => b.date.localeCompare(a.date)).find((tr) => tr.from)?.from;

  const groups: { key: string; label: string; items: TripEntry[] }[] = [];
  for (const tr of shown) {
    const d = new Date(tr.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: d.toLocaleDateString(locale, { month: "long", year: "numeric" }), items: [] }));
    g.items.push(tr);
  }

  const fileBase = `rimborso-km-${vehicle.name.replace(/\s+/g, "-").toLowerCase()}-${localDateString()}`;

  async function exportCsv() {
    if (!isPro) return setShowPremium(true);
    const labels = Object.fromEntries(
      ["date", "vehicle", "from", "to", "purpose", "km", "rate", "kmAmount", "toll", "parking", "other", "otherWhat", "total"].map((k) => [k, t(`trips.csv.${k}`)]),
    );
    try {
      await exportTextFile(`${fileBase}.csv`, tripsToCsv(shown, vehicle.name, rate, labels), "text/csv");
      setNotice({ text: t("trips.exportedCsv"), error: false });
    } catch {
      setNotice({ text: t("trips.exportFailed"), error: true });
    }
  }

  async function exportPdf() {
    if (!isPro) return setShowPremium(true);
    const work = [...shown].filter((tr) => tr.work).sort((a, b) => a.date.localeCompare(b.date));
    try {
      const { generateTripReportPdf } = await import("../utils/tripReportPdf");
      const bytes = await generateTripReportPdf({
        title: t("trips.pdfTitle"),
        info: [
          [vehicle.name, vehicle.plate].filter(Boolean).join(" · "),
          `${t("trips.period")}: ${periodLabel}`,
          `${t("trips.rate")}: ${rate !== null ? `${formatMoney(rate, 2)}/km` : t("trips.rateNotSet")}`,
        ],
        columns: {
          date: t("trips.csv.date"), route: t("trips.pdfRoute"), purpose: t("trips.csv.purpose"), km: "km",
          kmAmount: t("trips.csv.kmAmount"), extras: t("trips.pdfExtras"), total: t("trips.csv.total"),
        },
        rows: work.map((tr) => ({
          date: new Date(tr.date).toLocaleDateString(locale),
          route: route(tr),
          purpose: [tr.purpose, tr.otherWhat].filter(Boolean).join(" · "),
          km: tr.distanceKm.toLocaleString(locale),
          kmAmount: rate !== null ? formatMoney(tr.distanceKm * rate) : "—",
          extras: tripExtras(tr) > 0 ? formatMoney(tripExtras(tr)) : "",
          total: formatMoney(tripRefund(tr, rate)),
        })),
        totals: [
          { label: t("trips.workKm"), value: km(totals.workKm) },
          { label: t("trips.expenses"), value: formatMoney(totals.extras) },
          { label: t("trips.refund"), value: formatMoney(totals.refund) },
        ],
        footer: t("trips.pdfFooter", { date: new Date().toLocaleDateString(locale) }),
      });
      await exportPdfBytes(`${fileBase}.pdf`, bytes);
      setNotice({ text: t("trips.exportedPdf"), error: false });
    } catch {
      setNotice({ text: t("trips.exportFailed"), error: true });
    }
  }

  return (
    <>
      <div className="screen-head">
        <h2 className="screen-title">{t("trips.title")}</h2>
        <p className="screen-sub">{t("trips.subtitle")}</p>
      </div>

      <section className="fc-sum">
        <div className="fc-sum__top">
          <span className="fc-sum__label">{t("trips.refund")}</span>
          <select className="fc-sum__period" value={period} onChange={(e) => setPeriod(e.target.value as TripPeriod)} aria-label={t("trips.period")}>
            {(["month", "lastMonth", "year", "all"] as TripPeriod[]).map((p) => (
              <option key={p} value={p}>{t(`trips.period_${p}`)}</option>
            ))}
          </select>
        </div>
        <div className="fc-sum__total">{rate === null && totals.extras === 0 ? "—" : formatMoney(totals.refund)}</div>
        <div className="fc-sum__kpis">
          <div className="fc-sum__kpi">
            <span>{t("trips.workKm")}</span>
            <b>{totals.workKm.toLocaleString(locale, { maximumFractionDigits: 1 })} <small>km</small></b>
          </div>
          <div className="fc-sum__kpi">
            <span>{t("trips.expenses")}</span>
            <b>{formatMoney(totals.extras)}</b>
          </div>
          <button type="button" className="fc-sum__kpi trips-rate" onClick={() => setRateDraft(rate !== null ? String(rate).replace(".", ",") : "")}>
            <span>{t("trips.rate")} ✎</span>
            <b>{rate !== null ? <>{formatMoney(rate, 2)}<small>/km</small></> : <small className="trips-rate__set">{t("trips.setRate")}</small>}</b>
          </button>
        </div>
        {totals.workKm + totals.privateKm > 0 && (
          <>
            <div className="trips-split" aria-hidden="true">
              <i style={{ width: `${workPct}%` }} />
            </div>
            <div className="trips-split__legend">
              <span><i className="is-work" /> {t("trips.work")} {km(totals.workKm)}</span>
              <span><i /> {t("trips.private")} {km(totals.privateKm)}</span>
            </div>
          </>
        )}
      </section>

      {rate === null && (
        <button type="button" className="trips-ratehint" onClick={() => setRateDraft("")}>
          {t("trips.rateHint")}
        </button>
      )}

      <div className="screen-actions trips-actions">
        <button type="button" className="big-btn" onClick={() => setForm({})}>
          + {t("trips.new")}
        </button>
        {totals.workTrips > 0 && (
          <div className="trips-export">
            <button type="button" className="btn btn--ghost" onClick={exportPdf}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
              {t("trips.exportPdf")}
              {!isPro && " 🔒"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={exportCsv}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
              {t("trips.exportCsv")}
              {!isPro && " 🔒"}
            </button>
          </div>
        )}
        {notice && <p role="status" className={`backup-panel__message backup-panel__message--${notice.error ? "error" : "ok"}`}>{notice.text}</p>}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">{trips.length === 0 ? t("trips.emptyTitle") : t("trips.emptyPeriod")}</p>
          {trips.length === 0 && <p className="empty-state__body">{t("trips.emptyBody")}</p>}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="fc-month">
            <div className="fc-month__head">
              <span className="fc-month__label">{g.label}</span>
              <span className="fc-month__total">
                {g.items.length}× · <b>{km(g.items.reduce((s, tr) => s + tr.distanceKm, 0))}</b>
              </span>
            </div>
            <div className="mlist">
              {g.items.map((tr) => (
                <div
                  key={tr.id}
                  className={`mrow${tr.work ? "" : " trips-row--private"}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t("common.edit")} · ${route(tr)}`}
                  onClick={() => setForm({ trip: tr })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setForm({ trip: tr });
                    }
                  }}
                >
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
                    <span className="mrow__title">{route(tr)}</span>
                    <span className="mrow__sub">
                      {[tr.work ? tr.purpose : t("trips.private"), dateLabel(tr.date), `${km(tr.distanceKm)}${tr.roundTrip ? ` · ${t("trips.roundTripShort")}` : ""}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="mrow__end">
                    <span className="mrow__amt">{tr.work && (rate !== null || tripExtras(tr) > 0) ? formatMoney(tripRefund(tr, rate)) : "—"}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {rateDraft !== null && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="trip-rate-title">
          <div className="modal">
            <div className="modal__header">
              <h2 id="trip-rate-title">{t("trips.rateTitle")}</h2>
              <button type="button" className="modal__close" onClick={() => setRateDraft(null)} aria-label={t("common.close")}>×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void saveRate(); }}>
              <div className="field">
                <label htmlFor="trip-rate">{t("trips.rateLabel")}</label>
                <input id="trip-rate" inputMode="decimal" autoFocus value={rateDraft} onChange={(e) => setRateDraft(e.target.value)} placeholder="0,30" />
                <small>{t("trips.rateHelp")}</small>
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setRateDraft(null)}>{t("common.cancel")}</button>
                <button type="submit" className="btn btn--primary">{t("trips.saveRate")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {form && (
        <TripForm
          vehicle={vehicle}
          trip={form.trip}
          rate={rate}
          lastFrom={lastFrom}
          onSave={(trip, alsoExpense) => { onSave(trip, alsoExpense); setForm(null); }}
          onDelete={form.trip ? () => { onDelete(form.trip!.id); setForm(null); } : undefined}
          onClose={() => setForm(null)}
        />
      )}
      {showPremium && <PremiumScreen onClose={() => setShowPremium(false)} />}
    </>
  );
}
