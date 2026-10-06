interface Props {
  title: string;
  urgentCount?: number;
  onOpenMenu: () => void;
  onOpenNotifications: () => void;
}

export default function TopAppBar({ title, urgentCount = 0, onOpenMenu, onOpenNotifications }: Props) {
  return (
    <header className="dash-header">
      <button type="button" className="dash-icon-btn" onClick={onOpenMenu} aria-label="menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
      <div className="dash-header__logo">
        <strong>{title}</strong>
      </div>
      <button type="button" className="dash-icon-btn dash-icon-btn--bell" onClick={onOpenNotifications} aria-label="notifiche">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {urgentCount > 0 && <span className="dash-header__badge">{urgentCount > 9 ? "9+" : urgentCount}</span>}
      </button>
    </header>
  );
}
