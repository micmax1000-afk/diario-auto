import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import it from "./locales/it.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import pt from "./locales/pt.json";
import ar from "./locales/ar.json";
import de from "./locales/de.json";
import ru from "./locales/ru.json";
import id from "./locales/id.json";
import hi from "./locales/hi.json";

export const SUPPORTED_LANGUAGES = [
  { code: "it", label: "Italiano" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" },
  { code: "ru", label: "Русский" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "hi", label: "हिन्दी" },
  { code: "ar", label: "العربية" },
];

export const RTL_LANGUAGES = ["ar"];

export function isRtlLanguage(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang.split("-")[0]);
}

/** Applica direzione del testo (RTL/LTR) e lingua al documento HTML. */
function applyDocumentDirection(lang: string) {
  const code = lang.split("-")[0];
  document.documentElement.lang = code;
  document.documentElement.dir = isRtlLanguage(code) ? "rtl" : "ltr";
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: it },
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      pt: { translation: pt },
      ar: { translation: ar },
      de: { translation: de },
      ru: { translation: ru },
      id: { translation: id },
      hi: { translation: hi },
    },
    fallbackLng: "it",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: {
      escapeValue: false, // React già gestisce l'escaping
    },
    detection: {
      // preferenza salvata manualmente > lingua del dispositivo/browser
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "diario-auto:language",
      caches: ["localStorage"],
    },
  });

// imposta subito la direzione corretta e la aggiorna a ogni cambio lingua
applyDocumentDirection(i18n.language);
i18n.on("languageChanged", applyDocumentDirection);

export default i18n;
