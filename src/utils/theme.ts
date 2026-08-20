export type Theme = "light" | "dark";

const THEME_KEY = "diario-auto:theme";

export function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignorato
  }
}

function getSystemPreference(): Theme {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export function getInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemPreference();
}

const THEME_COLORS: Record<Theme, string> = {
  dark: "#0a0c0f",
  light: "#f2ecdd",
};

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
}
