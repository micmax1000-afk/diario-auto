export type Theme = "light" | "dark";
/** Scelta dell'utente: "auto" segue il tema del telefono. */
export type ThemeMode = Theme | "auto";
export type Accent = "orange" | "blue" | "teal" | "violet" | "pink" | "graphite";
export type TextSize = "normal" | "large";

const THEME_KEY = "diario-auto:theme";
const ACCENT_KEY = "diario-auto:accent";
const TEXT_KEY = "diario-auto:text-size";

/** Colori principali disponibili, con il colore del pallino nel selettore. */
export const ACCENTS: { id: Accent; swatch: string }[] = [
  { id: "orange", swatch: "#f5901f" },
  { id: "blue", swatch: "#3b7ff5" },
  { id: "teal", swatch: "#14b8a6" },
  { id: "violet", swatch: "#8b5cf6" },
  { id: "pink", swatch: "#e8508a" },
  { id: "graphite", swatch: "#4b5563" },
];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignorato
  }
}

export function getStoredThemeMode(): ThemeMode {
  const value = read(THEME_KEY);
  return value === "light" || value === "dark" ? value : "auto";
}

export function setStoredThemeMode(mode: ThemeMode): void {
  write(THEME_KEY, mode);
}

function systemPrefersLight(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(mode: ThemeMode): Theme {
  if (mode !== "auto") return mode;
  return systemPrefersLight() ? "light" : "dark";
}

export function getInitialTheme(): Theme {
  return resolveTheme(getStoredThemeMode());
}

/** Avvisa quando il telefono passa da chiaro a scuro (serve solo con "Automatico"). */
export function onSystemThemeChange(cb: () => void): () => void {
  const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: light)") : undefined;
  if (!mq) return () => undefined;
  mq.addEventListener?.("change", cb);
  return () => mq.removeEventListener?.("change", cb);
}

const THEME_COLORS: Record<Theme, string> = {
  dark: "#0a0c0f",
  light: "#ffffff",
};

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
}

export function getStoredAccent(): Accent {
  const value = read(ACCENT_KEY);
  return ACCENTS.some((a) => a.id === value) ? (value as Accent) : "orange";
}

export function applyAccent(accent: Accent): void {
  if (typeof document === "undefined") return;
  if (accent === "orange") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", accent);
}

export function setAccent(accent: Accent): void {
  write(ACCENT_KEY, accent);
  applyAccent(accent);
}

export function getStoredTextSize(): TextSize {
  return read(TEXT_KEY) === "large" ? "large" : "normal";
}

export function applyTextSize(size: TextSize): void {
  if (typeof document === "undefined") return;
  if (size === "large") document.documentElement.setAttribute("data-text", "large");
  else document.documentElement.removeAttribute("data-text");
}

export function setTextSize(size: TextSize): void {
  write(TEXT_KEY, size);
  applyTextSize(size);
}

/** All'avvio: tema, colore principale e dimensione del testo salvati. */
export function applyStoredAppearance(): void {
  applyTheme(getInitialTheme());
  applyAccent(getStoredAccent());
  applyTextSize(getStoredTextSize());
}

/** Aspetto da salvare nel backup, così su un telefono nuovo l'app torna com'era. */
export interface AppearanceBackup {
  theme: ThemeMode;
  accent: Accent;
  textSize: TextSize;
}

export function readAppearance(): AppearanceBackup {
  return { theme: getStoredThemeMode(), accent: getStoredAccent(), textSize: getStoredTextSize() };
}

/** Ripristina l'aspetto da un backup, ignorando valori sconosciuti. */
export function restoreAppearance(a: Partial<Record<keyof AppearanceBackup, unknown>> | undefined): void {
  if (!a || typeof a !== "object") return;
  if (a.theme === "auto" || a.theme === "light" || a.theme === "dark") setStoredThemeMode(a.theme);
  if (ACCENTS.some((x) => x.id === a.accent)) write(ACCENT_KEY, a.accent as Accent);
  if (a.textSize === "normal" || a.textSize === "large") write(TEXT_KEY, a.textSize);
  applyStoredAppearance();
}
