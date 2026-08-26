import { useTranslation } from "react-i18next";

export type TabId = "garage" | "rifornimento" | "ricarica" | "promemoria" | "manutenzione" | "statistiche";

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  urgentCount?: number; // badge sul tab Promemoria
}

export default function BottomTabBar({ active, onChange, urgentCount = 0 }: Props) {
  const { t } = useTranslation();
  return (
    <nav className="bottom-tabbar" aria-label={t("bottomNav.ariaLabel")}>
      <button
        type="button"
        className={`bottom-tabbar__item ${active === "garage" ? "is-active" : ""}`}
        onClick={() => onChange("garage")}
        title={t("bottomNav.garage")}
        aria-label={t("bottomNav.garage")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-2v-7H6v7H4a1 1 0 0 1-1-1z" />
          <path d="M8 21v-5h8v5" />
        </svg>
      </button>

      <button
        type="button"
        className={`bottom-tabbar__item ${active === "rifornimento" ? "is-active" : ""}`}
        onClick={() => onChange("rifornimento")}
        title={t("bottomNav.fuel")}
        aria-label={t("bottomNav.fuel")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 21V6a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 12 6v15" />
          <path d="M3 21h10M12 10h1.8L17 12.5V18a1.5 1.5 0 0 1-1.5 1.5" />
          <path d="M12 6.5h1.5L17 9.5v1" />
          <circle cx="7.5" cy="8" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <button
        type="button"
        className={`bottom-tabbar__item ${active === "ricarica" ? "is-active" : ""}`}
        onClick={() => onChange("ricarica")}
        title={t("bottomNav.charging")}
        aria-label={t("bottomNav.charging")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
        </svg>
      </button>

      <button
        type="button"
        className={`bottom-tabbar__item ${active === "promemoria" ? "is-active" : ""}`}
        onClick={() => onChange("promemoria")}
        title={t("bottomNav.reminders")}
        aria-label={t("bottomNav.reminders")}
      >
        <div className="bottom-tabbar__icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {urgentCount > 0 && (
            <span className="bottom-tabbar__badge">{urgentCount > 9 ? "9+" : urgentCount}</span>
          )}
        </div>
      </button>

      <button
        type="button"
        className={`bottom-tabbar__item ${active === "manutenzione" ? "is-active" : ""}`}
        onClick={() => onChange("manutenzione")}
        title={t("bottomNav.maintenance")}
        aria-label={t("bottomNav.maintenance")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </button>

      <button
        type="button"
        className={`bottom-tabbar__item ${active === "statistiche" ? "is-active" : ""}`}
        onClick={() => onChange("statistiche")}
        title={t("bottomNav.stats")}
        aria-label={t("bottomNav.stats")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      </button>
    </nav>
  );
}
