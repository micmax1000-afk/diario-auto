import { useTranslation } from "react-i18next";

// "statistiche" e "impostazioni" non sono più nella barra (si aprono dalla Home),
// ma restano schermate principali.
export type TabId = "garage" | "movimenti" | "manutenzione" | "obd" | "statistiche" | "impostazioni";

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  urgentCount?: number;
  /** Tasto + centrale: apre il foglio "Cosa vuoi registrare?". */
  onAdd: () => void;
  addOpen?: boolean;
}

function Icon({ name }: { name: string }) {
  if (name === "garage") return <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-2v-7H6v7H4a1 1 0 0 1-1-1z" />;
  if (name === "movimenti") return <path d="M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 22h10M3 10h10M16 6.5l2.5 2.5V17a1.5 1.5 0 0 0 3 0v-5.5a2 2 0 0 0-.6-1.4L18 7" />;
  if (name === "manutenzione") return <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />;
  if (name === "obd") return <><path d="M3 7.5h18l-1.8 8.6a2 2 0 0 1-2 1.6H6.8a2 2 0 0 1-2-1.6L3 7.5z" /><path d="M7.5 11h.01M10.5 11h.01M13.5 11h.01M16.5 11h.01M9 14.3h.01M12 14.3h.01M15 14.3h.01" strokeWidth="2.6" strokeLinecap="round" /></>;
  return null;
}

export default function BottomTabBar({ active, onChange, urgentCount = 0, onAdd, addOpen = false }: Props) {
  const { t } = useTranslation();
  const tab = (id: TabId, label: string) => (
    <button
      key={id}
      type="button"
      className={`bottom-tabbar__item ${active === id ? "is-active" : ""}`}
      onClick={() => onChange(id)}
      title={label}
      aria-label={label}
      aria-current={active === id ? "page" : undefined}
    >
      <span className="bottom-tabbar__icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <Icon name={id} />
        </svg>
        {id === "manutenzione" && urgentCount > 0 && <span className="bottom-tabbar__badge">{urgentCount > 9 ? "9+" : urgentCount}</span>}
      </span>
    </button>
  );
  return (
    <nav className="bottom-tabbar" aria-label={t("bottomNav.ariaLabel")}>
      {tab("garage", t("bottomNav.home"))}
      {tab("movimenti", t("bottomNav.movements", "Rifornimento"))}
      <button
        type="button"
        className={`bottom-tabbar__fab${addOpen ? " is-open" : ""}`}
        onClick={onAdd}
        aria-label={t("addSheet.open")}
        aria-expanded={addOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {tab("manutenzione", t("bottomNav.maintenance"))}
      {tab("obd", t("bottomNav.obd"))}
    </nav>
  );
}
