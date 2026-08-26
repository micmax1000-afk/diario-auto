// Notifiche del browser per le scadenze in arrivo (entro 30 giorni) o scadute.
// Limite onesto da sapere: funzionano quando il telefono/computer ha
// l'app aperta (o installata come PWA su Android/desktop) nel momento in cui
// il controllo viene eseguito — non c'è un server dietro che possa "svegliare"
// l'app quando è chiusa. Su iPhone il supporto alle notifiche web è limitato
// anche ad app aperta, e richiede iOS 16.4+ con la PWA installata in Home.

const LAST_NOTIFIED_KEY = "diario-auto:reminder-notifications-sent";
const NOTIFICATIONS_ENABLED_KEY = "diario-auto:notifications-enabled";

export function areNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function enableNotifications(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  const permission = await Notification.requestPermission();
  const granted = permission === "granted";
  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(granted));
  } catch {
    // ignorato
  }
  return granted;
}

export function disableNotifications(): void {
  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
  } catch {
    // ignorato
  }
}

function getNotifiedToday(): Set<string> {
  try {
    const raw = localStorage.getItem(LAST_NOTIFIED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date: string; ids: string[] };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return new Set(); // reset ad ogni nuovo giorno
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function markNotifiedToday(ids: string[]): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
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

// Mostra al massimo una notifica per promemoria al giorno (evita spam ad ogni
// apertura dell'app nella stessa giornata).
export function notifyDueReminders(items: NotifiableReminder[], labels: NotificationLabels, locale: string): void {
  if (!areNotificationsEnabled() || !isNotificationSupported() || Notification.permission !== "granted") return;
  if (items.length === 0) return;

  const alreadyNotified = getNotifiedToday();
  const toNotify = items.filter((item) => !alreadyNotified.has(item.id));
  if (toNotify.length === 0) return;

  for (const item of toNotify) {
    const statusLabel = item.status === "overdue" ? labels.overdue : labels.soon;
    const dateLabel = item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale) : "";
    new Notification(`${statusLabel}: ${item.label}`, {
      body: `${item.vehicleName}${dateLabel ? ` · ${labels.dueOnPrefix} ${dateLabel}` : ""}`,
      tag: item.id, // sostituisce eventuali notifiche precedenti per lo stesso promemoria
    });
  }

  markNotifiedToday([...alreadyNotified, ...toNotify.map((i) => i.id)]);
}
