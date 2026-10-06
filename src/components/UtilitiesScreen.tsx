import { useTranslation } from "react-i18next";
import QuickEntryHeader from "./QuickEntryHeader";

interface Props {
  onClose: () => void;
  onOpenReminders: () => void;
  onOpenExpenses: () => void;
  onOpenCommute: () => void;
  onOpenKmHistory: () => void;
}

const ROW_ICONS: Record<string, string> = {
  calendar: "M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  folder: "M4 6a1 1 0 0 1 1-1h4.5l2 2H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6z",
  wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM3 10h18M15 14h3",
  route: "M4 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm16-16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 18C6 12 10 12 12 9s4-3 4-3M8 20h8a2 2 0 0 0 2-2v-1",
  chart: "M4 20V10M11 20V4M18 20v-7",
};

export default function UtilitiesScreen({
  onClose,
  onOpenReminders,
  onOpenExpenses,
  onOpenCommute,
  onOpenKmHistory,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="settings-embedded">
      <QuickEntryHeader title={t("utilities.title", "Utilità")} onBack={onClose} tone="blue" />

      <div className="settings-list">
        <div className="settings-row" onClick={onOpenReminders} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.calendar} /></svg></span>
          <span className="settings-row__label">{t("dashboardGarage.deadlines", "Scadenze")}</span>
          <span className="settings-row__chevron">›</span>
        </div>

        <div className="settings-row" onClick={onOpenExpenses} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.wallet} /></svg></span>
          <span className="settings-row__label">{t("expenses.title", "Spese (bollo, assicurazione...)")}</span>
          <span className="settings-row__chevron">›</span>
        </div>

        <div className="settings-row" onClick={onOpenKmHistory} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.chart} /></svg></span>
          <span className="settings-row__label">{t("kmHistory.title", "Cronologia km")}</span>
          <span className="settings-row__chevron">›</span>
        </div>

        <div className="settings-row" onClick={onOpenCommute} role="button" tabIndex={0}>
          <span className="settings-row__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={ROW_ICONS.route} /></svg></span>
          <span className="settings-row__label">{t("detail.tabs.commute", "Tragitto")}</span>
          <span className="settings-row__chevron">›</span>
        </div>
      </div>
    </div>
  );
}
