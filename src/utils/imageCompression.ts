// Comprime un'immagine caricata dall'utente prima di salvarla, per limitare
// l'impatto sul localStorage (che ha in genere solo 5-10MB disponibili in totale).
// Ridimensiona al massimo lato specificato e ricomprime in JPEG a qualità moderata.

const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.6;

/** Area da tenere, in frazioni (0-1) della larghezza e dell'altezza dell'originale. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CompressOptions {
  /** Se indicato (larghezza/altezza, es. 16/9) l'immagine viene ritagliata al centro in quel formato. */
  aspect?: number;
  /** Ritaglio scelto dall'utente: ha la precedenza su `aspect`. */
  crop?: CropRect;
}

export function compressImage(source: File | string, options: CompressOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    function loadImage(dataUrl: string) {
      const img = new Image();
      img.onerror = () => reject(new Error("Immagine non valida."));
      img.onload = () => {
        // Area dell'originale da usare: tutta, oppure un ritaglio centrato nel formato richiesto.
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;
        if (options.crop) {
          sx = Math.round(options.crop.x * img.width);
          sy = Math.round(options.crop.y * img.height);
          sw = Math.max(1, Math.round(options.crop.w * img.width));
          sh = Math.max(1, Math.round(options.crop.h * img.height));
        } else if (options.aspect) {
          if (sw / sh > options.aspect) {
            sw = Math.round(sh * options.aspect);
            sx = Math.round((img.width - sw) / 2);
          } else {
            sh = Math.round(sw / options.aspect);
            sy = Math.round((img.height - sh) / 2);
          }
        }

        let width = sw;
        let height = sh;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas non disponibile."));
          return;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = dataUrl;
    }

    if (typeof source === "string") {
      loadImage(source);
      return;
    }

    readFileAsDataUrl(source).then(loadImage, reject);
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lettura file non riuscita."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** Stima approssimativa dei KB occupati da una data URL (base64). */
export function estimateDataUrlKb(dataUrl: string): number {
  return Math.round((dataUrl.length * 0.75) / 1024);
}
