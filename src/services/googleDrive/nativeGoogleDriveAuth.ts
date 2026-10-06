// Bridge verso il plugin nativo Android (Kotlin) che gestisce l'accesso
// Google per il backup su Drive. Il plugin vero e proprio vive in
// android/app/src/main/java/com/micmax/diarioauto/GoogleDriveAuthPlugin.kt
//
// Sostituisce il login basato su Google Identity Services (popup web), che
// Google blocca dentro le WebView native. Fuori da un'app Capacitor nativa
// (cioè nel normale browser) questo modulo non viene mai chiamato:
// driveBackup.ts sceglie il percorso giusto in base a
// Capacitor.isNativePlatform().

import { registerPlugin } from "@capacitor/core";

export interface NativeDriveToken {
  accessToken: string;
  email: string;
}

export interface GoogleDriveAuthPlugin {
  getAccessToken(): Promise<NativeDriveToken>;
  signOut(): Promise<void>;
}

const NativeGoogleDriveAuth = registerPlugin<GoogleDriveAuthPlugin>("GoogleDriveAuth");

export default NativeGoogleDriveAuth;
