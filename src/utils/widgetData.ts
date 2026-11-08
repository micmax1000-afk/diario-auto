// Dati mostrati dai widget nella home di Android. I widget sono codice nativo
// che vive FUORI dalla WebView — non possono leggere IndexedDB — quindi gli
// passiamo un piccolo riepilogo già pronto (testi tradotti e formattati)
// tramite @capacitor/preferences, che su Android scrive nel file
// SharedPreferences "CapacitorStorage", letto dai provider nativi
// (VehicleWidgetProvider, StationWidgetProvider, DeadlinesWidgetProvider).
//
// Dopo aver scritto i dati, il plugin nativo WidgetRefresh aggiorna subito
// i widget: senza, Android lo farebbe da solo, ma non prima di ~30 minuti.

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import NativeWidgetRefresh from "./nativeWidgetRefresh";

const VEHICLE_KEY = "widget_vehicle_data";
const STATION_KEY = "widget_station_data";
const DEADLINES_KEY = "widget_deadlines_data";

/** Widget grande: auto principale, km, scadenza più urgente, consumo e pulsanti. */
export interface WidgetData {
  vehicleName: string;
  plate?: string;
  km: string; // già formattato, es. "30.000 km"
  reminderLabel: string | null; // es. "Bollo · in scadenza" — null se nessuna scadenza vicina
  reminderOverdue?: boolean;
  consumption?: string | null; // es. "5,8 l/100"
  /** Colore principale scelto nell'app (blue, orange, ...): il widget lo usa per il pulsante "A voce". */
  accent?: string;
  /** Pulsante "A voce" (solo con l'app in italiano). */
  voice?: boolean;
  labels?: { deadline: string; consumption: string; noDeadline: string; fuel: string; voice: string };
}

/** Widget piccolo: distributore più economico visto l'ultima volta nell'app. */
export interface StationWidgetData {
  title: string; // es. "Gasolio"
  subtitle: string; // es. "Il più economico"
  price: string; // es. "€ 1,739"
  place: string; // es. "Agip Eni · 1,2 km"
  note: string; // es. "Aggiornato l'8 nov"
}

/** Widget piccolo: le scadenze più vicine. */
export interface DeadlinesWidgetData {
  title: string;
  empty: string;
  items: { label: string; when: string; overdue: boolean }[];
}

async function write(key: string, value: unknown): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key, value: JSON.stringify(value) });
    await NativeWidgetRefresh.refresh();
  } catch {
    // i widget sono una comodità, non una funzione critica: un errore qui
    // non deve interrompere il resto dell'app
  }
}

export function updateWidgetData(data: WidgetData): Promise<void> {
  return write(VEHICLE_KEY, data);
}

export function updateStationWidget(data: StationWidgetData): Promise<void> {
  return write(STATION_KEY, data);
}

export function updateDeadlinesWidget(data: DeadlinesWidgetData): Promise<void> {
  return write(DEADLINES_KEY, data);
}
