// Dati mostrati dal widget nella home di Android (veicolo principale, km,
// prossima scadenza). Il widget è codice nativo che vive FUORI dalla
// WebView — non può leggere IndexedDB direttamente — quindi gli passiamo
// un piccolo riepilogo tramite @capacitor/preferences, che su Android
// scrive in un file SharedPreferences ("CapacitorStorage") leggibile dal
// provider nativo del widget (vedi VehicleWidgetProvider.kt).
//
// Dopo aver scritto il dato, un piccolo plugin nativo (WidgetRefreshPlugin)
// forza l'aggiornamento immediato del widget: senza, Android lo
// aggiornerebbe comunque da solo, ma non prima di ~30 minuti.

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import NativeWidgetRefresh from "./nativeWidgetRefresh";

const WIDGET_DATA_KEY = "widget_vehicle_data";

export interface WidgetData {
  vehicleName: string;
  km: string; // già formattato per la visualizzazione, es. "30.000 km"
  reminderLabel: string | null; // es. "Bollo tra 12 giorni" — null se nessuna scadenza imminente
}

export async function updateWidgetData(data: WidgetData): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key: WIDGET_DATA_KEY, value: JSON.stringify(data) });
    await NativeWidgetRefresh.refresh();
  } catch {
    // il widget è una comodità, non una funzione critica: un fallimento qui
    // non deve interrompere il resto dell'app
  }
}
