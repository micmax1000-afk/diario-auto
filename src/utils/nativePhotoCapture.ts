// Cattura foto per gli allegati di manutenzioni/spese.
//
// Su app nativa usa il plugin ufficiale @capacitor/camera invece del
// semplice <input type="file" accept="image/*">: quest'ultimo spesso
// soffre di problemi di affidabilità nelle WebView quando apre direttamente
// la fotocamera (intent di cattura e permessi gestiti in modo incoerente a
// seconda del produttore del telefono), mentre il plugin nativo gestisce
// tutto questo in modo robusto e testato da Capacitor stesso.
//
// Nel browser (web) resta il normale input file, che lì funziona bene —
// vedi PhotoPicker.tsx per la UI che sceglie il percorso giusto.

import { Camera, MediaTypeSelection } from "@capacitor/camera";
import { Filesystem } from "@capacitor/filesystem";

async function uriToDataUrl(uri: string): Promise<string> {
  // Nessun "directory" specificata: Filesystem tratta "path" come un URI
  // assoluto, esattamente quello restituito dalla fotocamera/galleria.
  const { data } = await Filesystem.readFile({ path: uri });
  return `data:image/jpeg;base64,${data}`;
}

/** Scatta una nuova foto con la fotocamera del dispositivo. Restituisce null se l'utente annulla. */
export async function takeNativePhoto(): Promise<string | null> {
  const result = await Camera.takePhoto({ quality: 85 });
  if (!result.uri) return null;
  return uriToDataUrl(result.uri);
}

/** Sceglie una foto già presente nella galleria. Restituisce null se l'utente annulla o non seleziona nulla. */
export async function chooseNativePhotoFromGallery(): Promise<string | null> {
  const result = await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo });
  const first = result.results[0];
  if (!first?.uri) return null;
  return uriToDataUrl(first.uri);
}
