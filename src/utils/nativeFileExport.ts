// Esportazione file (backup JSON, CSV, PDF) — due percorsi:
//
// - App nativa Android (Capacitor): il trucco del browser "<a download>" qui
//   sotto spesso non fa nulla di visibile, perché il contenitore nativo non
//   ha una vera cartella "Downloads" collegata a quel meccanismo. Il modo
//   corretto è scrivere il file nella cache dell'app e aprire il menu di
//   condivisione nativo di Android (Salva su Drive, invia per email, salva
//   nei File, ecc.) — è anche più comodo per l'utente, non solo più
//   affidabile.
// - Browser/PWA: resta il download diretto di sempre, che lì funziona bene.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

async function shareFromCache(filename: string): Promise<void> {
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await Share.share({ title: filename, files: [uri] });
}

/** Esporta un file di testo (JSON, CSV). Su app nativa apre il menu di condivisione; nel browser scarica direttamente. */
export async function exportTextFile(filename: string, content: string, mimeType: string): Promise<void> {
  if (isNative()) {
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await shareFromCache(filename);
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Converte byte grezzi in base64 senza passare da un'unica chiamata String.fromCharCode gigante (che fallisce su file grandi). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000; // elaborato a blocchi per non superare i limiti degli argomenti della funzione
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Esporta un PDF (byte grezzi). Su app nativa apre il menu di condivisione; nel browser scarica direttamente. */
export async function exportPdfBytes(filename: string, bytes: Uint8Array): Promise<void> {
  if (isNative()) {
    await Filesystem.writeFile({
      path: filename,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
    });
    await shareFromCache(filename);
    return;
  }

  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
