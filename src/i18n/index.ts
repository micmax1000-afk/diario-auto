import i18n from "i18next";
import { initReactI18next } from "react-i18next";

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

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
const FALLBACK_LNG = "it";
const STORAGE_KEY = "diario-auto:language";

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

// Ogni lingua è ~30-50KB di JSON: importarle tutte sempre appesantiva il
// bundle iniziale per ogni utente, indipendentemente dalla lingua che usa
// davvero. Ora si carica solo quella che serve, più l'italiano come
// fallback se diverso, e le altre solo se l'utente le seleziona a mano.
const LOCALE_LOADERS: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  it: () => import("./locales/it.json"),
  en: () => import("./locales/en.json"),
  es: () => import("./locales/es.json"),
  fr: () => import("./locales/fr.json"),
  pt: () => import("./locales/pt.json"),
  ar: () => import("./locales/ar.json"),
  de: () => import("./locales/de.json"),
  ru: () => import("./locales/ru.json"),
  id: () => import("./locales/id.json"),
  hi: () => import("./locales/hi.json"),
};

function detectInitialLanguage(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_CODES.includes(stored)) return stored;
  } catch {
    // localStorage non disponibile (privacy mode ecc.): si passa oltre
  }
  const navLang = (navigator.language || "it").split("-")[0];
  return SUPPORTED_CODES.includes(navLang) ? navLang : FALLBACK_LNG;
}

/** Carica (se non già presente) il bundle di una lingua e lo registra in i18next. */
export async function loadLanguage(code: string): Promise<void> {
  if (!SUPPORTED_CODES.includes(code)) return;
  if (i18n.hasResourceBundle(code, "translation")) return;
  const loader = LOCALE_LOADERS[code];
  if (!loader) return;
  const mod = await loader();
  i18n.addResourceBundle(code, "translation", mod.default);
}

/** Cambia lingua caricando prima il bundle se necessario. Da usare al posto di i18n.changeLanguage diretto. */
export async function changeLanguage(code: string): Promise<void> {
  await loadLanguage(code);
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // privacy mode: la preferenza semplicemente non persiste tra sessioni
  }
  await i18n.changeLanguage(code);
}

let initPromise: Promise<typeof i18n> | null = null;

/** Inizializza i18next caricando solo la lingua iniziale (+ fallback italiano). Va atteso prima del primo render. */
export function initI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const initialLang = detectInitialLanguage();
    const codesToLoad = initialLang === FALLBACK_LNG ? [FALLBACK_LNG] : [initialLang, FALLBACK_LNG];
    const loaded = await Promise.all(
      codesToLoad.map(async (code) => [code, (await LOCALE_LOADERS[code]()).default] as const),
    );

    await i18n.use(initReactI18next).init({
      resources: Object.fromEntries(loaded.map(([code, data]) => [code, { translation: data }])),
      lng: initialLang,
      fallbackLng: FALLBACK_LNG,
      supportedLngs: SUPPORTED_CODES,
      interpolation: {
        escapeValue: false, // React già gestisce l'escaping
      },
    });

    applyDocumentDirection(i18n.language);
    i18n.on("languageChanged", applyDocumentDirection);

    return i18n;
  })();

  return initPromise;
}

export default i18n;
