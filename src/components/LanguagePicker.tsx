import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, changeLanguage, isRtlLanguage } from "../i18n";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { CURRENCIES } from "../utils/settings";

interface Props {
  onDone: () => void;
}

/**
 * Prima schermata vista da un nuovo utente: sceglie la lingua invece del
 * vecchio percorso introduttivo a più schermate. La lingua rilevata
 * automaticamente dal dispositivo è già pre-selezionata; toccandone
 * un'altra si vede subito il cambio (stesso comportamento della lista
 * lingue nelle Impostazioni), "Continua" conferma e apre l'app.
 * Sotto c'è la valuta, già stimata dalla regione del telefono: così chi
 * la trova sbagliata la corregge prima di inserire i primi importi.
 */
export default function LanguagePicker({ onDone }: Props) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState(i18n.language.split("-")[0]);
  const rtl = isRtlLanguage(selected);
  const { currency, setCurrency } = useAppSettings();

  async function handleSelect(code: string) {
    setSelected(code);
    await changeLanguage(code);
  }

  return (
    <div className="language-picker" dir={rtl ? "rtl" : "ltr"}>
      <div className="language-picker__header">
        <h1>{t("languagePicker.title")}</h1>
      </div>
      <ul className="language-picker__list">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <li key={lang.code}>
            <button
              type="button"
              className="language-picker__row"
              onClick={() => handleSelect(lang.code)}
            >
              <span>{lang.label}</span>
              {selected === lang.code && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="language-picker__footer">
        <label className="language-picker__currency">
          <span>{t("languagePicker.currency")}</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} — {t(c.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--primary language-picker__ok"
          onClick={() => {
            // Salva la valuta anche se lasciata com'era: da qui in poi è una scelta, non una stima.
            setCurrency(currency);
            onDone();
          }}
        >
          {t("languagePicker.continue")}
        </button>
      </div>
    </div>
  );
}
