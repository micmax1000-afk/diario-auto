// Comprime un'immagine caricata dall'utente prima di salvarla, per limitare
// l'impatto sul localStorage (che ha in genere solo 5-10MB disponibili in totale).
// Ridimensiona al massimo lato specificato e ricomprime in JPEG a qualità moderata.

const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.6;

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lettura file non riuscita."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Immagine non valida."));
      img.onload = () => {
        let { width, height } = img;
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
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Stima approssimativa dei KB occupati da una data URL (base64). */
export function estimateDataUrlKb(dataUrl: string): number {
  return Math.round((dataUrl.length * 0.75) / 1024);
}
