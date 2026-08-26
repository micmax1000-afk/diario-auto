import { useTranslation } from "react-i18next";
import type { Vehicle } from "../types";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import CategoryIcon from "./CategoryIcon";

interface Props {
  vehicle: Vehicle;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onQuickKm: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function VehicleCard({ vehicle, onOpen, onEdit, onQuickKm, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const { distanceUnit } = useAppSettings();

  return (
    <article className="vehicle-card">
      <button
        type="button"
        className="vehicle-card__stamp"
        onClick={() => onQuickKm(vehicle.id)}
        title={t("vehicleCard.updateKm")}
      >
        <span className="vehicle-card__stamp-km">
          {kmToDisplayDistance(vehicle.currentKm, distanceUnit).toLocaleString(getNumberLocale(i18n.language), { maximumFractionDigits: 0 })}
        </span>
        <span className="vehicle-card__stamp-unit">{distanceUnit}</span>
      </button>

      <header className="vehicle-card__header" onClick={() => onOpen(vehicle.id)} role="button" tabIndex={0}>
        <CategoryIcon kind="fuel" category={vehicle.fuelType} size="small" />
        <h3 className="vehicle-card__name">{vehicle.name}</h3>
        {vehicle.year && <span className="vehicle-card__year">{vehicle.year}</span>}
      </header>

      <dl className="vehicle-card__facts">
        <div className="vehicle-card__fact">
          <dt>{t("vehicleCard.fuelType")}</dt>
          <dd>{t(`fuelType.${vehicle.fuelType}`)}</dd>
        </div>
        {vehicle.plate && (
          <div className="vehicle-card__fact">
            <dt>{t("vehicleCard.plate")}</dt>
            <dd>{vehicle.plate}</dd>
          </div>
        )}
      </dl>

      {vehicle.notes && <p className="vehicle-card__notes">{vehicle.notes}</p>}

      <footer className="vehicle-card__footer">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => onOpen(vehicle.id)}>
          {t("vehicles.open")}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => onEdit(vehicle.id)}>
          {t("vehicles.edit")}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--danger btn--small"
          onClick={() => onDelete(vehicle.id)}
        >
          {t("vehicles.markSold")}
        </button>
      </footer>
    </article>
  );
}
