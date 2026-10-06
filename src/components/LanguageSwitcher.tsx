import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, changeLanguage } from "../i18n";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      className="language-switcher"
      value={i18n.language.split("-")[0]}
      onChange={(e) => changeLanguage(e.target.value)}
      aria-label="Language"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
