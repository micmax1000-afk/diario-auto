import { useTranslation } from "react-i18next";

export type TabId = "garage" | "movimenti" | "manutenzione" | "statistiche" | "impostazioni";

interface Props { active: TabId; onChange: (tab: TabId) => void; urgentCount?: number; }

function Icon({ name }: { name: string }) {
  if (name === "garage") return <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-2v-7H6v7H4a1 1 0 0 1-1-1z" />;
  if (name === "movimenti") return <path d="M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 22h10M3 10h10M16 6.5l2.5 2.5V17a1.5 1.5 0 0 0 3 0v-5.5a2 2 0 0 0-.6-1.4L18 7" />;
  if (name === "manutenzione") return <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />;
  if (name === "statistiche") return <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>;
  if (name === "impostazioni") return <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>;
}

export default function BottomTabBar({ active, onChange, urgentCount = 0 }: Props) {
  const { t } = useTranslation();
  const items: Array<{ id: TabId; label: string; icon: string }> = [
    { id: "garage", label: t("bottomNav.garage"), icon: "garage" },
    { id: "movimenti", label: t("bottomNav.movements", "Rifornimento"), icon: "movimenti" },
    { id: "manutenzione", label: t("bottomNav.maintenance"), icon: "manutenzione" },
    { id: "statistiche", label: t("bottomNav.stats"), icon: "statistiche" },
    { id: "impostazioni", label: t("settingsScreen.title", "Impostazioni"), icon: "impostazioni" },
  ];
  return <nav className="bottom-tabbar" aria-label={t("bottomNav.ariaLabel")}>
    {items.map((item) => <button key={item.id} type="button" className={`bottom-tabbar__item ${active === item.id ? "is-active" : ""}`} onClick={() => onChange(item.id)} title={item.label} aria-label={item.label}>
      <span className="bottom-tabbar__icon-wrap"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><Icon name={item.icon} /></svg>
        {item.id === "manutenzione" && urgentCount > 0 && <span className="bottom-tabbar__badge">{urgentCount > 9 ? "9+" : urgentCount}</span>}
      </span>
    </button>)}
  </nav>;
}
