import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle, Reminder, MaintenanceEntry, FuelEntry, ChargingEntry, ExpenseEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import UpcomingReminders from "./UpcomingReminders";
import CategoryIcon from "./CategoryIcon";
import CartoonCar from "./CartoonCar";
import { shade } from "../utils/bodyTypes";
import { getMeta, setMeta } from "../utils/db";
import { daysSince } from "../utils/storage";
import { resolveVehicleColors } from "../utils/vehicleColor";
import {
  calculateConsumption,
  averageConsumption,
  calculateElectricConsumption,
  averageElectricConsumption,
  mainFuelSource,
} from "../utils/calculations";
import { isoToLocalDate, localMonthString } from "../utils/dates";
import { reminderStatus } from "../utils/kmForecast";

export type ActivityKind = "fuel" | "charging" | "maintenance" | "expense";

interface Props {
  vehicles: Vehicle[];
  reminders: Reminder[];
  maintenanceEntries: MaintenanceEntry[];
  fuelEntries: FuelEntry[];
  chargingEntries: ChargingEntry[];
  expenseEntries: ExpenseEntry[];
  /** Veicolo mostrato nella scheda in primo piano (si cambia scorrendo). */
  currentVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  onAddVehicle: () => void;
  onOpenReminder: (vehicleId: string) => void;
  onOpenReminders: () => void;
  onOpenStats: () => void;
  onOpenActivity: (vehicleId: string, kind: ActivityKind) => void;
  onOpenSettings: () => void;
  onOpenBackup: () => void;
}

const BACKUP_STALE_DAYS = 30;
const BACKUP_NAG_SNOOZE_DAYS = 7;
const BACKUP_NAG_KEY = "backup-nag-snoozed";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export default function Dashboard({
  vehicles,
  reminders,
  maintenanceEntries,
  fuelEntries,
  chargingEntries,
  expenseEntries,
  currentVehicleId,
  onSelectVehicle,
  onAddVehicle,
  onOpenReminder,
  onOpenReminders,
  onOpenStats,
  onOpenActivity,
  onOpenSettings,
  onOpenBackup,
}: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit, formatMoney } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const activeVehicles = vehicles.filter((v) => !v.archived);
  const current = activeVehicles.find((v) => v.id === currentVehicleId) ?? activeVehicles[0];
  const colors = resolveVehicleColors(vehicles);

  // ---- Avviso backup vecchio (come prima) ----
  const [backupStaleDays, setBackupStaleDays] = useState<number | null>(null);
  const oldestCreated = vehicles.map((v) => v.createdAt).filter(Boolean).sort()[0];
  const hasVehicles = vehicles.length > 0;
  useEffect(() => {
    if (!hasVehicles) return;
    let cancelled = false;
    (async () => {
      try {
        const snoozed = await getMeta(BACKUP_NAG_KEY);
        if (snoozed && daysSince(snoozed) < BACKUP_NAG_SNOOZE_DAYS) return;
        const last = await getMeta("last-backup");
        const reference = last ?? oldestCreated;
        if (!reference) return;
        const days = daysSince(reference);
        if (!cancelled && days >= BACKUP_STALE_DAYS) setBackupStaleDays(days);
      } catch {
        /* nessun avviso se non si riesce a leggere */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasVehicles, oldestCreated]);
  function snoozeBackupNag() {
    setBackupStaleDays(null);
    void setMeta(BACKUP_NAG_KEY, new Date().toISOString());
  }

  // ---- Carosello: scorrendo di lato cambia il veicolo in primo piano ----
  const carouselRef = useRef<HTMLDivElement>(null);
  const currentIndex = current ? activeVehicles.findIndex((v) => v.id === current.id) : 0;
  useLayoutEffect(() => {
    const el = carouselRef.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const step = card.offsetWidth + 12;
    // In arabo (da destra a sinistra) scrollLeft va verso i negativi.
    const target = (getComputedStyle(el).direction === "rtl" ? -1 : 1) * currentIndex * step;
    if (Math.abs(el.scrollLeft - target) > 4) el.scrollLeft = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeVehicles.length]);
  const scrollTimer = useRef<number | undefined>(undefined);
  function handleScroll() {
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = carouselRef.current;
      const card = el?.firstElementChild as HTMLElement | null;
      if (!el || !card) return;
      const i = Math.round(Math.abs(el.scrollLeft) / (card.offsetWidth + 12));
      const v = activeVehicles[i];
      if (v && v.id !== current?.id) onSelectVehicle(v.id);
    }, 120);
  }

  const greeting = (() => {
    const h = new Date().getHours();
    return t(h < 12 ? "home.greetingMorning" : h < 18 ? "home.greetingAfternoon" : "home.greetingEvening");
  })();
  const today = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  const header = (
    <div className="home-head">
      <div>
        <p className="home-head__hello">{greeting} · {today}</p>
        <h1 className="home-head__title">{t("home.title")}</h1>
      </div>
      <button type="button" className="home-round" onClick={onOpenSettings} aria-label={t("home.menu")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );

  if (!current) {
    return (
      <div className="home">
        {header}
        <section className="home-welcome">
          <span className="home-welcome__plus" aria-hidden="true">+</span>
          <h2>{t("home.welcomeTitle")}</h2>
          <p>{t("home.welcomeBody")}</p>
          <button type="button" className="btn btn--primary" onClick={onAddVehicle}>
            {t("home.welcomeCta")}
          </button>
        </section>
      </div>
    );
  }

  // ---- Numeri del mese per il veicolo in primo piano ----
  const ym = localMonthString();
  const inMonth = (d: string) => isoToLocalDate(d).slice(0, 7) === ym;
  const electric = current.fuelType === "elettrico";
  const vFuel = fuelEntries.filter((e) => e.vehicleId === current.id);
  const vCharge = chargingEntries.filter((e) => e.vehicleId === current.id);
  const vMaint = maintenanceEntries.filter((e) => e.vehicleId === current.id);
  const vExp = expenseEntries.filter((e) => e.vehicleId === current.id);
  const sum = (list: { d: string; v: number }[], keep: (d: string) => boolean) => list.filter((x) => keep(x.d)).reduce((a, x) => a + x.v, 0);
  const allCosts = [
    ...vFuel.map((e) => ({ d: e.date, v: e.totalCost })),
    ...vCharge.map((e) => ({ d: e.date, v: e.totalCost })),
    ...vMaint.map((e) => ({ d: e.date, v: e.cost })),
    ...vExp.map((e) => ({ d: e.date, v: e.amount })),
  ];
  const monthSpend = sum(allCosts, inMonth);
  const per100 = electric
    ? averageElectricConsumption(calculateElectricConsumption(vCharge))
    : (() => {
        const kmPerL = averageConsumption(calculateConsumption(vFuel), mainFuelSource(current.fuelType));
        return kmPerL ? 100 / kmPerL : null;
      })();
  const yearAgo = Date.now() - YEAR_MS;
  const inYear = (d: string) => new Date(d).getTime() >= yearAgo;
  const yearKms = [...vFuel, ...vCharge].filter((e) => inYear(e.date)).map((e) => e.km);
  const yearKm = yearKms.length > 1 ? Math.max(...yearKms) - Math.min(...yearKms) : 0;
  const costPerKm = yearKm > 0 ? sum(allCosts, inYear) / yearKm : null;
  const monthName = new Date().toLocaleDateString(locale, { month: "long" });

  // ---- Attività recente ----
  type Activity = { key: string; kind: ActivityKind; category: string; date: string; title: string; sub: string; amount: number };
  const unit = electric ? "kWh" : "l";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const activities: Activity[] = [
    ...vFuel.map((e) => ({ key: "f" + e.id, kind: "fuel" as const, category: e.source, date: e.date, title: t(e.fullTank ? "home.fullTank" : "home.partialFill"), sub: `${fmtDate(e.date)} · ${e.liters.toLocaleString(locale, { maximumFractionDigits: 1 })} ${e.source === "elettrico" ? "kWh" : unit} · ${formatDistance(e.km, distanceUnit, locale)}`, amount: e.totalCost })),
    ...vCharge.map((e) => ({ key: "c" + e.id, kind: "charging" as const, category: "", date: e.date, title: t("home.charge"), sub: `${fmtDate(e.date)} · ${e.kWh.toLocaleString(locale, { maximumFractionDigits: 1 })} kWh · ${formatDistance(e.km, distanceUnit, locale)}`, amount: e.totalCost })),
    ...vMaint.map((e) => ({ key: "m" + e.id, kind: "maintenance" as const, category: e.category, date: e.date, title: t(`maintenanceCategory.${e.category}`), sub: [fmtDate(e.date), e.description].filter(Boolean).join(" · "), amount: e.cost })),
    ...vExp.map((e) => ({ key: "e" + e.id, kind: "expense" as const, category: e.category, date: e.date, title: t(`expenseCategory.${e.category}`), sub: [fmtDate(e.date), e.description].filter(Boolean).join(" · "), amount: e.amount })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="home">
      {header}

      <div className="home-carousel" ref={carouselRef} onScroll={handleScroll}>
        {activeVehicles.map((v) => {
          const color = colors[v.id] ?? "#4f9dff";
          const open = reminders
            .filter((r) => r.vehicleId === v.id && !r.completed)
            .map((r) => ({ r, s: reminderStatus(r, v.currentKm) }))
            .filter((x) => x.s !== "ok")
            .sort((a, b) => (a.s === "overdue" ? -1 : 0) - (b.s === "overdue" ? -1 : 0));
          const top = open[0];
          const style = v.photo
            ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.62)), url(${v.photo})` }
            : { backgroundImage: `linear-gradient(135deg, ${shade(color, -0.12)}, ${shade(color, -0.45)})` };
          return (
            <section key={v.id} className={`home-hero${v.photo ? " home-hero--photo" : ""}`} style={style} aria-label={v.name}>
              <div className="home-hero__top">
                {!v.photo && (
                  <span className="home-hero__badge">
                    <CartoonCar bodyType={v.bodyType} color={color} />
                  </span>
                )}
                <div className="home-hero__id">
                  <h2 className="home-hero__name">{v.name}</h2>
                  {v.plate && <span className="home-hero__plate">{v.plate}</span>}
                </div>
              </div>
              <p className="home-hero__label">{t("home.odometer")}</p>
              <p className="home-hero__km">{formatDistance(v.currentKm, distanceUnit, locale)}</p>
              {top ? (
                <button type="button" className={`home-hero__alert is-${top.s}`} onClick={() => onOpenReminder(v.id)}>
                  <span className="home-hero__alert-dot" aria-hidden="true">!</span>
                  <span className="home-hero__alert-text">
                    {top.r.label} · {t(top.s === "overdue" ? "home.overdue" : "home.soon")}
                  </span>
                  <span className="home-hero__alert-go">{t(top.s === "overdue" ? "home.renew" : "home.view")} ›</span>
                </button>
              ) : (
                <p className="home-hero__alert is-ok">
                  <span className="home-hero__alert-dot" aria-hidden="true">✓</span>
                  <span className="home-hero__alert-text">{t("home.allClear")}</span>
                </p>
              )}
            </section>
          );
        })}
        <button type="button" className="home-hero home-hero--add" onClick={onAddVehicle}>
          <span className="home-hero__plus" aria-hidden="true">+</span>
          {t("home.addVehicle")}
        </button>
      </div>
      {activeVehicles.length > 1 && (
        <div className="home-dots" aria-hidden="true">
          {activeVehicles.map((v) => (
            <i key={v.id} className={v.id === current.id ? "is-on" : ""} />
          ))}
        </div>
      )}

      {backupStaleDays !== null && (
        <section className="dash-backup-nag" role="status">
          <span>{t("dashboardGarage.backupNag", { days: backupStaleDays })}</span>
          <span className="dash-backup-nag__actions">
            <button type="button" className="dash-link" onClick={onOpenBackup}>
              {t("dashboardGarage.backupNagAction")}
            </button>
            <button type="button" className="dash-link" onClick={snoozeBackupNag}>
              {t("dashboardGarage.backupNagLater")}
            </button>
          </span>
        </section>
      )}

      <div className="home-sect">
        <h2>{t("home.thisMonth")}</h2>
        <button type="button" onClick={onOpenStats}>{t("home.statsLink")} ›</button>
      </div>
      <button type="button" className="home-kpis" onClick={onOpenStats}>
        <span className="home-kpi">
          <span className="home-kpi__label">{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
          <b>{formatMoney(monthSpend, 0)}</b>
        </span>
        <span className="home-kpi">
          <span className="home-kpi__label">{t("home.consumption")}</span>
          <b>
            {per100 !== null ? per100.toLocaleString(locale, { maximumFractionDigits: 1 }) : "–"} <small>{electric ? "kWh/100" : "l/100"}</small>
          </b>
        </span>
        <span className="home-kpi">
          <span className="home-kpi__label">{t("home.costPerKm")}</span>
          <b>{costPerKm !== null ? formatMoney(costPerKm, 2) : "–"}</b>
        </span>
      </button>

      <div className="home-sect">
        <h2>{t("home.upcoming")}</h2>
        <button type="button" onClick={onOpenReminders}>{t("home.all")}</button>
      </div>
      {reminders.some((r) => r.vehicleId === current.id && !r.completed && reminderStatus(r, current.currentKm) !== "ok") ? (
        <UpcomingReminders vehicles={[current]} reminders={reminders} distanceUnit={distanceUnit} onOpenReminder={onOpenReminder} limit={3} />
      ) : (
        <p className="home-empty">{t("home.noUpcoming")}</p>
      )}

      <div className="home-sect">
        <h2>{t("home.recent")}</h2>
      </div>
      {activities.length === 0 ? (
        <p className="home-empty">{t("home.recentEmpty")}</p>
      ) : (
        <div className="home-list">
          {activities.map((a) => (
            <button key={a.key} type="button" className="home-item" onClick={() => onOpenActivity(current.id, a.kind)}>
              <CategoryIcon kind={a.kind} category={a.category} />
              <span className="home-item__mid">
                <span className="home-item__title">{a.title}</span>
                <span className="home-item__sub">{a.sub}</span>
              </span>
              <span className="home-item__amt">{formatMoney(a.amount)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
