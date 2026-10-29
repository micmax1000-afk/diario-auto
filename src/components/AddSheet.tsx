import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FuelEntry, Vehicle } from "../types";
import { getNumberLocale } from "../utils/locale";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { useBackButtonClose } from "../utils/backButtonStack";
import ActionGridIcon from "./ActionGridIcon";
import CartoonCar from "./CartoonCar";

export type AddAction = "fuel" | "fuelRepeat" | "charge" | "maintenance" | "km" | "expense" | "reminder";

interface Props {
  vehicle: Vehicle;
  vehicles: Vehicle[];
  colors: Record<string, string>;
  /** Ultimo rifornimento del veicolo, per proporre "come l'ultimo". */
  lastFuel?: FuelEntry;
  onPick: (action: AddAction) => void;
  onChangeVehicle: (id: string) => void;
  onClose: () => void;
}

/**
 * Foglio che si apre dal tasto + della barra in basso: un solo posto da cui
 * registrare tutto per il veicolo in uso.
 */
export default function AddSheet({ vehicle, vehicles, colors, lastFuel, onPick, onChangeVehicle, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useAppSettings();
  const locale = getNumberLocale(i18n.language);
  const [choosing, setChoosing] = useState(false);
  useBackButtonClose(true, onClose);

  const canFuel = vehicle.fuelType !== "elettrico";
  const canCharge = vehicle.fuelType === "elettrico" || vehicle.fuelType === "ibrido";
  const tile = (action: AddAction, icon: Parameters<typeof ActionGridIcon>[0]["name"], tone: string, label: string) => (
    <button type="button" className="add-sheet__tile" onClick={() => onPick(action)}>
      <span className={`add-sheet__icon add-sheet__icon--${tone}`}>
        <ActionGridIcon name={icon} />
      </span>
      {label}
    </button>
  );

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="add-sheet-title">
        <span className="sheet__grab" aria-hidden="true" />
        <h2 id="add-sheet-title" className="sheet__title">{t("addSheet.title")}</h2>
        <p className="sheet__sub">
          {t("addSheet.for")} <b>{vehicle.name}</b>
          {vehicles.length > 1 && (
            <>
              {" · "}
              <button type="button" className="sheet__link" onClick={() => setChoosing((c) => !c)} aria-expanded={choosing}>
                {t("addSheet.change")} ▾
              </button>
            </>
          )}
        </p>

        {choosing ? (
          <div className="add-sheet__vehicles">
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`add-sheet__vehicle${v.id === vehicle.id ? " is-on" : ""}`}
                onClick={() => {
                  onChangeVehicle(v.id);
                  setChoosing(false);
                }}
              >
                <span className="add-sheet__thumb">
                  <CartoonCar bodyType={v.bodyType} color={colors[v.id] ?? "#4f9dff"} />
                </span>
                {v.name}
              </button>
            ))}
          </div>
        ) : (
          <>
            {canFuel && lastFuel && (
              <button type="button" className="add-sheet__repeat" onClick={() => onPick("fuelRepeat")}>
                <span className="add-sheet__icon add-sheet__icon--solid">
                  <ActionGridIcon name="fuel" />
                </span>
                <span className="add-sheet__repeat-text">
                  <b>{t("addSheet.repeatTitle")}</b>
                  <span>
                    {t("addSheet.repeatBody", {
                      cost: formatMoney(lastFuel.totalCost),
                      price: lastFuel.liters > 0 ? formatMoney(lastFuel.totalCost / lastFuel.liters, 3) : "–",
                    })}
                  </span>
                </span>
                <span className="add-sheet__go">{t("addSheet.yes")}</span>
              </button>
            )}
            <div className="add-sheet__grid">
              {canFuel && tile("fuel", "fuel", "green", t("addSheet.fuel"))}
              {canCharge && tile("charge", "bolt", "blue", t("addSheet.charge"))}
              {tile("maintenance", "wrench", "amber", t("addSheet.maintenance"))}
              {tile("km", "gauge", "amber", t("addSheet.km"))}
              {tile("expense", "folder", "red", t("addSheet.expense"))}
              {tile("reminder", "bell", "amber", t("addSheet.reminder"))}
            </div>
          </>
        )}
        <p className="sheet__hint">{t("addSheet.hint", { km: vehicle.currentKm.toLocaleString(locale) })}</p>
      </div>
    </>
  );
}
