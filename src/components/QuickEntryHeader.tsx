import { useTranslation } from "react-i18next";

interface Props {
  title: string;
  onBack: () => void;
  tone?: "blue" | "green";
}

export default function QuickEntryHeader({ title, onBack, tone = "blue" }: Props) {
  const { t } = useTranslation();
  return (
    <header className={`quick-entry-page__header quick-entry-page__header--${tone}`}>
      <button type="button" className="quick-entry-page__back" onClick={onBack} aria-label={t("common.back")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <h1>{title}</h1>
      <span className="quick-entry-page__header-spacer" />
    </header>
  );
}
