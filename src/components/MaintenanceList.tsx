import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MaintenanceEntry } from "../types";
import { getNumberLocale } from "../utils/locale";
import { kmToDisplayDistance } from "../utils/settings";
import { useAppSettings } from "../contexts/AppSettingsContext";
import CategoryIcon from "./CategoryIcon";

interface Props {
  entries: MaintenanceEntry[];
  onEdit: (entry: MaintenanceEntry) => void;
}

export default function MaintenanceList({ entries, onEdit }: Props) {
  const { t, i18n } = useTranslation();
  const { formatMoney, distanceUnit } = useAppSettings();
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const sorted = [...entries].sort((a, b) => b.km - a.km);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{t("maintenance.emptyTitle")}</p>
        <p className="empty-state__body">{t("maintenance.emptyBody")}</p>
      </div>
    );
  }

  const locale = getNumberLocale(i18n.language);

  return (
    <div>
      <div className="mlist">
        {sorted.map((entry) => {
          const title = t(`maintenanceCategory.${entry.category}`);
          const sub = [
            entry.description,
            `${kmToDisplayDistance(entry.km, distanceUnit).toLocaleString(locale, { maximumFractionDigits: 0 })} ${distanceUnit}`,
            entry.workshop,
          ].filter(Boolean).join(" · ");
          return (
            <div
              key={entry.id}
              className="mrow"
              aria-label={`${t("common.edit")} · ${title}`}
              role="button"
              tabIndex={0}
              onClick={() => onEdit(entry)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEdit(entry);
                }
              }}
            >
              <CategoryIcon kind="maintenance" category={entry.category} />
              <span className="mrow__mid">
                <span className="mrow__title">{title}</span>
                <span className="mrow__sub">{sub}</span>
                {entry.partsCost !== undefined && entry.laborCost !== undefined && (
                  <span className="mrow__sub">
                    {t("maintenance.partsLabor", { parts: formatMoney(entry.partsCost), labor: formatMoney(entry.laborCost) })}
                  </span>
                )}
              </span>
              {entry.photo && (
                <button
                  type="button"
                  className="mrow__photo"
                  aria-label={t("vehicleForm.photo")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomPhoto(entry.photo!);
                  }}
                >
                  <img src={entry.photo} alt="" />
                </button>
              )}
              <span className="mrow__end">
                <span className="mrow__amt">{formatMoney(entry.cost)}</span>
                <span className="mrow__date">
                  {new Date(entry.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "2-digit" })}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {zoomPhoto && (
        <div className="modal-overlay" onClick={() => setZoomPhoto(null)}>
          <img src={zoomPhoto} alt="" className="photo-zoom" />
        </div>
      )}
    </div>
  );
}
