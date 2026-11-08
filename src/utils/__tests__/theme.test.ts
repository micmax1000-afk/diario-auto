import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCENTS,
  applyStoredAppearance,
  getStoredAccent,
  getStoredTextSize,
  getStoredThemeMode,
  resolveTheme,
  setAccent,
  setStoredThemeMode,
  setTextSize,
} from "../theme";

// Ambiente di test senza DOM: bastano localStorage, gli attributi di <html> e matchMedia.
function fakeEnv(systemLight: boolean) {
  const store = new Map<string, string>();
  const attrs = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: systemLight }) });
  vi.stubGlobal("document", {
    documentElement: {
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k),
    },
    querySelector: () => null,
  });
  return { store, attrs };
}

describe("tema", () => {
  afterEach(() => vi.unstubAllGlobals());

  describe("con il telefono in chiaro", () => {
    let env: ReturnType<typeof fakeEnv>;
    beforeEach(() => {
      env = fakeEnv(true);
    });

    it("senza scelta salvata parte da Automatico, Arancione, testo Normale", () => {
      expect(getStoredThemeMode()).toBe("auto");
      expect(getStoredAccent()).toBe("orange");
      expect(getStoredTextSize()).toBe("normal");
    });

    it("Automatico segue il telefono, Chiaro e Scuro no", () => {
      expect(resolveTheme("auto")).toBe("light");
      expect(resolveTheme("dark")).toBe("dark");
    });

    it("tiene la scelta di chi aveva già Scuro o Chiaro", () => {
      env.store.set("diario-auto:theme", "dark");
      expect(getStoredThemeMode()).toBe("dark");
      setStoredThemeMode("auto");
      expect(getStoredThemeMode()).toBe("auto");
    });

    it("colore e testo vengono salvati e applicati a <html>", () => {
      setAccent("blue");
      setTextSize("large");
      expect(env.attrs.get("data-accent")).toBe("blue");
      expect(env.attrs.get("data-text")).toBe("large");
      setAccent("orange");
      setTextSize("normal");
      expect(env.attrs.has("data-accent")).toBe(false);
      expect(env.attrs.has("data-text")).toBe(false);
    });

    it("all'avvio rimette tutto com'era e ignora valori sconosciuti", () => {
      env.store.set("diario-auto:theme", "dark");
      env.store.set("diario-auto:accent", "teal");
      env.store.set("diario-auto:text-size", "large");
      applyStoredAppearance();
      expect(env.attrs.get("data-theme")).toBe("dark");
      expect(env.attrs.get("data-accent")).toBe("teal");
      expect(env.attrs.get("data-text")).toBe("large");
      env.store.set("diario-auto:accent", "giallo");
      expect(getStoredAccent()).toBe("orange");
    });
  });

  it("Automatico con il telefono in scuro dà il tema scuro", () => {
    fakeEnv(false);
    expect(resolveTheme("auto")).toBe("dark");
  });

  it("ci sono i sei colori principali", () => {
    expect(ACCENTS.map((a) => a.id)).toEqual(["orange", "blue", "teal", "violet", "pink", "graphite"]);
  });
});
