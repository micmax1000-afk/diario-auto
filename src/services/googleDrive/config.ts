// SOSTITUISCI questo valore con il tuo vero Client ID OAuth, ottenuto da
// Google Cloud Console (vedi GOOGLE_DRIVE_SETUP.md per la guida passo passo).
// Non è un segreto da nascondere: i Client ID OAuth per app web pubbliche
// sono pensati per stare nel codice frontend, la sicurezza è garantita dagli
// "Authorized JavaScript origins" configurati lato Google, non dal nasconderlo.
export const GOOGLE_DRIVE_CLIENT_ID = "SOSTITUISCI-CON-IL-TUO-CLIENT-ID.apps.googleusercontent.com";

// drive.file: l'app vede SOLO i file che crea lei stessa, mai il resto del
// Drive dell'utente — il permesso meno invasivo possibile per questo scopo.
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function isGoogleDriveConfigured(): boolean {
  return !GOOGLE_DRIVE_CLIENT_ID.startsWith("SOSTITUISCI");
}
