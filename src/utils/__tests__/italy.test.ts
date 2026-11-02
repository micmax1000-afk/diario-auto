import { afterEach, describe, expect, it, vi } from "vitest";
import { isInItaly, isLikelyItaly } from "../settings";

const setLangs = (languages: string[]) => vi.stubGlobal("navigator", { languages, language: languages[0] });

describe("solo in Italia", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("regione del telefono italiana, anche con l'app in inglese", () => {
    setLangs(["en-IT"]);
    expect(isLikelyItaly("en")).toBe(true);
  });

  it("app in italiano senza altra regione", () => {
    setLangs(["it"]);
    expect(isLikelyItaly("it")).toBe(true);
  });

  it("fuori Italia: no", () => {
    setLangs(["de-DE"]);
    expect(isLikelyItaly("de")).toBe(false);
    setLangs(["it-DE"]);
    expect(isLikelyItaly("it")).toBe(false);
  });

  it("coordinate dentro e fuori dall'Italia", () => {
    expect(isInItaly(45.4642, 9.19)).toBe(true); // Milano
    expect(isInItaly(37.5, 15.08)).toBe(true); // Catania
    expect(isInItaly(48.85, 2.35)).toBe(false); // Parigi
  });
});
