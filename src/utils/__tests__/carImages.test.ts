import { describe, expect, it } from "vitest";
import { availableCarColors, carImage, resolveCarColor, vehicleVisual, DEFAULT_CAR_COLOR } from "../carImages";
import { BODY_TYPES } from "../bodyTypes";

describe("vehicleVisual", () => {
  it("la foto dell'utente ha la precedenza sul tipo", () => {
    expect(vehicleVisual({ photo: "data:image/jpeg;base64,xx", bodyType: "suv" })).toEqual({ src: "data:image/jpeg;base64,xx", isPhoto: true });
  });

  it("senza foto usa l'immagine del tipo scelto, in grigio scuro se non c'è un colore", () => {
    expect(vehicleVisual({ bodyType: "suvlarge" })).toEqual({ src: carImage("suvlarge", "grigio"), isPhoto: false });
    expect(vehicleVisual({ bodyType: "suvlarge", carColor: "rosso" })?.src).toBe(carImage("suvlarge", "rosso"));
  });

  it("senza foto né tipo non mostra nulla", () => {
    expect(vehicleVisual({})).toBeNull();
  });
});

describe("colori dell'auto", () => {
  it("il colore di partenza è il grigio scuro", () => {
    expect(DEFAULT_CAR_COLOR).toBe("grigio");
  });

  it("ogni carrozzeria ha un'immagine per ogni suo colore, tutte diverse", () => {
    const seen = new Set<string>();
    for (const b of BODY_TYPES) {
      for (const c of availableCarColors(b)) {
        const src = carImage(b, c);
        expect(src).toBeTruthy();
        seen.add(src);
      }
    }
    expect(seen.size).toBe(84);
  });

  it("i colori vivaci ci sono solo per le sei carrozzerie adatte", () => {
    expect(availableCarColors("citycar")).toHaveLength(10);
    expect(availableCarColors("van")).toEqual(["bianco", "argento", "grigio", "nero"]);
  });

  it("un colore non disponibile per la carrozzeria torna al grigio scuro", () => {
    expect(resolveCarColor("van", "rosso")).toBe("grigio");
    expect(resolveCarColor("citycar", "rosso")).toBe("rosso");
    expect(resolveCarColor("suv", undefined)).toBe("grigio");
  });
});
