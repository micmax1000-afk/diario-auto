// Notifiche per le scadenze in arrivo (entro 30 giorni) o scadute.
//
// Due modalità, scelte automaticamente in base a dove gira l'app:
//
// - App nativa Android (Capacitor): usa il plugin @capacitor/local-notifications.
//   Qui il vantaggio vero è che una scadenza con data può essere programmata
//   in anticipo con scheduleUpcomingReminders() e il sistema operativo la fa
//   comparire ESATTAMENTE in quel giorno, anche ad app chiusa da giorni —
//   cosa impossibile con le notifiche del browser.
// - Browser/PWA: usa la Web Notification API, con il limite onesto di sempre —
//   funziona solo quando l'app è aperta nel momento del controllo, non c'è un
//   server dietro che la "svegli". Su iPhone il supporto è comunque limitato
//   anche ad app aperta, e richiede iOS 16.4+ con la PWA installata in Home.
//
// Le scadenze basate sui km (non su una data) non si possono programmare in
// anticipo in nessuno dei due casi — nessuno sa quando l'utente percorrerà
// quel chilometraggio — quindi restano controllate solo all'apertura
// dell'app, in entrambe le modalità.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { localDateString } from "./dates";

const LAST_NOTIFIED_KEY = "diario-auto:reminder-notifications-sent";
const NOTIFICATIONS_ENABLED_KEY = "diario-auto:notifications-enabled";

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** ID numerico stabile (32 bit) richiesto da LocalNotifications, derivato dall'id stringa del promemoria. */
function hashToInt32(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // forza a 32 bit
  }
  return hash === 0 ? 1 : Math.abs(hash);
}

export function areNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

/** true se l'utente non ha mai scelto (né concesso né negato né disattivato). */
function neverDecided(): boolean {
  try {
    return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === null;
  } catch {
    return false;
  }
}

// Avvisa i componenti quando le notifiche vengono attivate o disattivate
// (anche in automatico, da un'altra parte dell'app).
const changeEvents = new EventTarget();

export function onNotificationsChange(listener: () => void): () => void {
  changeEvents.addEventListener("change", listener);
  return () => changeEvents.removeEventListener("change", listener);
}

function emitChange(): void {
  changeEvents.dispatchEvent(new Event("change"));
}

/**
 * Notifiche automatiche sull'app Android: la prima volta che ci sono
 * scadenze, chiede il permesso da sola (su Android 13+ compare la finestra
 * di sistema) invece di aspettare che l'utente trovi il pulsante. Se l'utente
 * ha già risposto o le ha disattivate, non chiede più nulla.
 */
export async function autoEnableNotifications(): Promise<boolean> {
  if (!isNative() || !neverDecided()) return areNotificationsEnabled();
  try {
    return await enableNotifications();
  } catch {
    return false;
  }
}

export function isNotificationSupported(): boolean {
  // Sull'app nativa il plugin è sempre disponibile (è compilato dentro
  // l'APK); nel browser dipende dal supporto della Web Notification API.
  if (isNative()) return true;
  return typeof window !== "undefined" && "Notification" in window;
}

export async function enableNotifications(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  let granted: boolean;
  if (isNative()) {
    const result = await LocalNotifications.requestPermissions();
    granted = result.display === "granted";
  } else {
    const permission = await Notification.requestPermission();
    granted = permission === "granted";
  }

  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(granted));
  } catch {
    // ignorato
  }
  emitChange();
  return granted;
}

export function disableNotifications(): void {
  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
  } catch {
    // ignorato
  }
  emitChange();
  if (isNative()) {
    // Ripulisce anche le notifiche già programmate in anticipo, altrimenti
    // arriverebbero comunque più avanti nonostante l'utente le abbia disattivate.
    LocalNotifications.getPending()
      .then(({ notifications }) => {
        if (notifications.length > 0) {
          LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
        }
      })
      .catch(() => {
        // se il plugin non risponde non blocchiamo la disattivazione lato app
      });
  }
}

function getNotifiedToday(): Set<string> {
  try {
    const raw = localStorage.getItem(LAST_NOTIFIED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date: string; ids: string[] };
    const today = localDateString();
    if (parsed.date !== today) return new Set(); // reset ad ogni nuovo giorno
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function markNotifiedToday(ids: string[]): void {
  try {
    const today = localDateString();
    localStorage.setItem(LAST_NOTIFIED_KEY, JSON.stringify({ date: today, ids }));
  } catch {
    // ignorato
  }
}

export interface NotifiableReminder {
  id: string;
  label: string;
  vehicleName: string;
  status: "overdue" | "soon";
  dueDate?: string;
}

export interface NotificationLabels {
  overdue: string;
  soon: string;
  dueOnPrefix: string; // es. "scadenza" — verrà anteposto a " {{date}}"
}

/** Mostra subito una notifica per ciascun promemoria scaduto/in arrivo (usato per i promemoria a km, controllabili solo ad app aperta). Al massimo una per promemoria al giorno. */
export function notifyDueReminders(items: NotifiableReminder[], labels: NotificationLabels, locale: string): void {
  if (!areNotificationsEnabled() || !isNotificationSupported()) return;
  if (!isNative() && Notification.permission !== "granted") return;
  if (items.length === 0) return;

  const alreadyNotified = getNotifiedToday();
  const toNotify = items.filter((item) => !alreadyNotified.has(item.id));
  if (toNotify.length === 0) return;

  for (const item of toNotify) {
    const statusLabel = item.status === "overdue" ? labels.overdue : labels.soon;
    const dateLabel = item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale) : "";
    const title = `${statusLabel}: ${item.label}`;
    const body = `${item.vehicleName}${dateLabel ? ` · ${labels.dueOnPrefix} ${dateLabel}` : ""}`;

    if (isNative()) {
      LocalNotifications.schedule({
        notifications: [{ id: hashToInt32(item.id), title, body }],
      }).catch(() => {
        // un singolo fallimento di scheduling non deve bloccare gli altri promemoria
      });
    } else {
      new Notification(title, { body, tag: item.id });
    }
  }

  markNotifiedToday([...alreadyNotified, ...toNotify.map((i) => i.id)]);
}

export interface SchedulableReminder {
  id: string;
  label: string;
  vehicleName: string;
  dueDate: string; // solo i promemoria con data, non quelli a km
}

/**
 * Programma in anticipo, sul sistema operativo, le notifiche per i
 * promemoria con data futura — il vantaggio vero dell'app nativa rispetto
 * al browser: arrivano anche se l'app resta chiusa fino a quel giorno.
 * Da richiamare ogni volta che i promemoria cambiano (aggiunta, modifica,
 * completamento, cancellazione): ad ogni chiamata ripulisce tutto il
 * programmato e lo ricrea da zero dallo stato attuale, così scadenze
 * modificate o rimosse non lasciano notifiche "fantasma".
 */
/** Giorni prima della scadenza in cui arriva un avviso (0 = il giorno stesso). */
export const REMINDER_ADVANCE_DAYS = [30, 7, 0] as const;

/**
 * Notifiche da programmare per una scadenza con data: 30 e 7 giorni prima e il
 * giorno stesso, alle 9 del mattino, solo quelle ancora nel futuro.
 */
export function plannedReminderNotifications(dueDate: string, now = Date.now()): { daysBefore: number; at: Date }[] {
  return REMINDER_ADVANCE_DAYS.map((daysBefore) => {
    const at = new Date(dueDate);
    at.setDate(at.getDate() - daysBefore);
    // Le 9 del mattino, non mezzanotte: un avviso a mezzanotte non è utile a nessuno.
    at.setHours(9, 0, 0, 0);
    return { daysBefore, at };
  }).filter((n) => n.at.getTime() > now);
}

/**
 * Programma in anticipo, sul sistema operativo, le notifiche per i
 * promemoria con data futura — il vantaggio vero dell'app nativa rispetto
 * al browser: arrivano anche se l'app resta chiusa fino a quel giorno.
 * Da richiamare ogni volta che i promemoria cambiano (aggiunta, modifica,
 * completamento, cancellazione): ad ogni chiamata ripulisce tutto il
 * programmato e lo ricrea da zero dallo stato attuale, così scadenze
 * modificate o rimosse non lasciano notifiche "fantasma".
 */
export async function scheduleUpcomingReminders(
  items: SchedulableReminder[],
  labels: { dueOnPrefix: string; inDays: (days: number) => string },
  locale: string,
): Promise<void> {
  if (!isNative() || !areNotificationsEnabled()) return;

  try {
    const { notifications: pending } = await LocalNotifications.getPending();
    if (pending.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
    }

    const toSchedule = items.flatMap((item) => {
      const dateLabel = new Date(item.dueDate).toLocaleDateString(locale);
      return plannedReminderNotifications(item.dueDate).map(({ daysBefore, at }) => ({
        id: hashToInt32(daysBefore === 0 ? item.id : `${item.id}:${daysBefore}`),
        title: daysBefore === 0 ? item.label : `${item.label} · ${labels.inDays(daysBefore)}`,
        body: `${item.vehicleName} · ${labels.dueOnPrefix} ${dateLabel}`,
        schedule: { at, allowWhileIdle: true },
      }));
    });

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch {
    // se il sistema di scheduling non risponde, i promemoria restano comunque
    // controllati ad ogni apertura dell'app tramite notifyDueReminders
  }
}
