import { describe, expect, it } from "vitest";
import { CAR_IMAGES, vehicleVisual } from "../carImages";
import { BODY_TYPES } from "../bodyTypes";

describe("vehicleVisual", () => {
  it("la foto dell'utente ha la precedenza sul tipo", () => {
    expect(vehicleVisual({ photo: "data:image/jpeg;base64,xx", bodyType: "suv" })).toEqual({ src: "data:image/jpeg;base64,xx", isPhoto: true });
  });

  it("senza foto usa l'immagine del tipo scelto", () => {
    expect(vehicleVisual({ bodyType: "suvlarge" })).toEqual({ src: CAR_IMAGES.suvlarge, isPhoto: false });
  });

  it("senza foto né tipo non mostra nulla", () => {
    expect(vehicleVisual({})).toBeNull();
  });

  it("ogni tipo di carrozzeria ha la sua immagine", () => {
    for (const b of BODY_TYPES) expect(CAR_IMAGES[b]).toBeTruthy();
  });
});
