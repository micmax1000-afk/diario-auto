import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { getNumberLocale } from "../utils/locale";
import { formatDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { useBackButtonClose } from "../utils/backButtonStack";
import { isRtlLanguage } from "../i18n";
import CartoonCar from "./CartoonCar";

interface Props {
  vehicle: Vehicle;
  vehicles?: Vehicle[];
  colors?: Record<string, string>;
  urgentCounts?: Record<string, number>;
  onBack: () => void;
  onSelect?: (vehicleId: string) => void;
  /** Voce in cima all'elenco (es. "Tutti i veicoli" nelle statistiche). */
  leading?: { label: string; sub: string; onClick: () => void; badge?: string };
}

function Thumb({ vehicle, color }: { vehicle: Vehicle; color: string }) {
  return vehicle.photo ? <img src={vehicle.photo} alt="" /> : <CartoonCar bodyType={vehicle.bodyType} color={color} />;
}

/**
 * Intestazione delle schermate del veicolo: indietro e il veicolo in uso.
 * Toccando il veicolo si apre l'elenco per sceglierne un altro.
 */
export default function VehicleHeader({ vehicle, vehicles = [], colors = {}, urgentCounts = {}, onBack, onSelect, leading }: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const [open, setOpen] = useState(false);
  useBackButtonClose(open, () => setOpen(false));
  const canSwitch = !!onSelect && (vehicles.length > 1 || !!leading);
  const urgent = urgentCounts[vehicle.id] ?? 0;
  const sub = (v: Vehicle) => [v.plate, formatDistance(v.currentKm, distanceUnit, locale)].filter(Boolean).join(" · ");

  return (
    <>
      <div className="vhead">
        <button type="button" className="vhead__back" onClick={onBack} aria-label={t("detail.back")} title={t("detail.back")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={isRtlLanguage(i18n.language) ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
          </svg>
        </button>
        <button
          type="button"
          className="vhead__chip"
          onClick={() => canSwitch && setOpen(true)}
          disabled={!canSwitch}
          aria-haspopup={canSwitch ? "dialog" : undefined}
          aria-label={canSwitch ? `${vehicle.name} · ${t("vehicleHeader.change")}` : vehicle.name}
        >
          <span className="vhead__thumb">
            <Thumb vehicle={vehicle} color={colors[vehicle.id] ?? "#4f9dff"} />
          </span>
          <span className="vhead__text">
            <h1 className="vhead__name">{vehicle.name}</h1>
            <span className="vhead__sub">{sub(vehicle)}</span>
          </span>
          {urgent > 0 && <span className="vhead__badge">{urgent > 9 ? "9+" : urgent}</span>}
          {canSwitch && (
            <svg className="vhead__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <>
          <div className="sheet-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="vhead-sheet-title">
            <span className="sheet__grab" aria-hidden="true" />
            <h2 id="vhead-sheet-title" className="sheet__title">{t("vehicleHeader.choose")}</h2>
            <div className="vpick">
              {leading && (
                <button
                  type="button"
                  className="vpick__item"
                  onClick={() => {
                    setOpen(false);
                    leading.onClick();
                  }}
                >
                  <span className="vpick__thumb vpick__thumb--all" aria-hidden="true">☰</span>
                  <span className="vpick__text">
                    <b>
                      {leading.label}
                      {leading.badge && <span className="vpick__pro">{leading.badge}</span>}
                    </b>
                    <span>{leading.sub}</span>
                  </span>
                </button>
              )}
              {vehicles.map((v) => {
                const n = urgentCounts[v.id] ?? 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`vpick__item${v.id === vehicle.id ? " is-on" : ""}`}
                    aria-current={v.id === vehicle.id ? "true" : undefined}
                    onClick={() => {
                      setOpen(false);
                      if (v.id !== vehicle.id) onSelect?.(v.id);
                    }}
                  >
                    <span className="vpick__thumb">
                      <Thumb vehicle={v} color={colors[v.id] ?? "#4f9dff"} />
                    </span>
                    <span className="vpick__text">
                      <b>{v.name}</b>
                      <span>{sub(v)}</span>
                    </span>
                    {n > 0 && <span className="vpick__badge">{t("vehicleHeader.toDo", { count: n })}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
