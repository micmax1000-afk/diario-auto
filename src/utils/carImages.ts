import type { BodyType, Vehicle } from "../types";
import citycar from "../assets/cars/citycar.webp";
import hatchback from "../assets/cars/hatchback.webp";
import sedan from "../assets/cars/sedan.webp";
import premium from "../assets/cars/premium.webp";
import suv from "../assets/cars/suv.webp";
import suvlarge from "../assets/cars/suvlarge.webp";
import wagon from "../assets/cars/wagon.webp";
import coupe from "../assets/cars/coupe.webp";
import convertible from "../assets/cars/convertible.webp";
import mpv from "../assets/cars/mpv.webp";
import van from "../assets/cars/van.webp";
import pickup from "../assets/cars/pickup.webp";

/** Immagine (già scontornata) di ogni tipo di carrozzeria. */
export const CAR_IMAGES: Record<BodyType, string> = {
  citycar, hatchback, sedan, premium, suv, suvlarge, wagon, coupe, convertible, mpv, van, pickup,
};

/** Cosa mostrare per un veicolo: la sua foto, altrimenti l'immagine del tipo scelto, altrimenti niente. */
export function vehicleVisual(v: Pick<Vehicle, "photo" | "bodyType">): { src: string; isPhoto: boolean } | null {
  if (v.photo) return { src: v.photo, isPhoto: true };
  if (v.bodyType && CAR_IMAGES[v.bodyType]) return { src: CAR_IMAGES[v.bodyType], isPhoto: false };
  return null;
}
