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
    expect(seen.size).toBe(120);
  });

  it("ogni carrozzeria ha tutti e 10 i colori", () => {
    for (const b of BODY_TYPES) expect(availableCarColors(b)).toHaveLength(10);
  });

  it("senza colore, o con uno sconosciuto, si usa il grigio scuro", () => {
    expect(resolveCarColor("van", "rosso")).toBe("rosso");
    expect(resolveCarColor("van", "fucsia" as never)).toBe("grigio");
    expect(resolveCarColor("suv", undefined)).toBe("grigio");
  });
});
