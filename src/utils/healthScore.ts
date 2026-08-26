import type { Reminder, MaintenanceEntry, LogSession } from "../types";
import { isReminderDue, type ConsumptionPoint } from "./calculations";

export interface HealthScoreBreakdown {
  score: number; // 0-100, indice complessivo
  maintenance: number; // 0-100
  deadlines: number; // 0-100
  consumption: number; // 0-100
  dataQuality: number; // 0-100, quanto storico ha l'utente registrato
  obd?: number; // 0-100, presente solo se ci sono sessioni OBD registrate
}

/**
 * Indice gestionale dell'auto (0-100), NON una diagnosi meccanica: riflette
 * quanto bene lo storico registrato nell'app è tenuto sotto controllo
 * (scadenze rispettate, manutenzione regolare, consumo stabile, dati
 * sufficienti). Se l'utente non ha mai collegato l'OBD, quella componente
 * viene esclusa e il peso ridistribuito sulle altre — non penalizziamo chi
 * non usa la diagnostica.
 */
export function calculateHealthScore(params: {
  reminders: Reminder[];
  maintenanceEntries: MaintenanceEntry[];
  currentKm: number;
  consumptionPoints: ConsumptionPoint[];
  logSessions: LogSession[];
}): HealthScoreBreakdown {
  const { reminders, maintenanceEntries, currentKm, consumptionPoints, logSessions } = params;

  // ---------- Scadenze: percentuale non scadute/urgenti ----------
  const activeReminders = reminders.filter((r) => !r.completed);
  const deadlinesScore =
    activeReminders.length === 0
      ? 100 // nessuna scadenza tracciata: non penalizziamo, semplicemente non c'è dato negativo
      : Math.round(
          (activeReminders.filter((r) => isReminderDue(r.dueDate, r.dueKm, currentKm) === "ok").length /
            activeReminders.length) *
            100,
        );

  // ---------- Manutenzione: regolarità negli ultimi 12 mesi rispetto alla cronologia ----------
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const recentMaintenance = maintenanceEntries.filter((e) => new Date(e.date).getTime() >= oneYearAgo);
  // euristica semplice: un intervento ogni ~6 mesi è "regolare" (score 100), zero interventi in un'auto
  // con più di un anno di storico è un segnale di possibile trascuratezza (ma non certezza)
  let maintenanceScore = 100;
  if (maintenanceEntries.length > 0) {
    maintenanceScore = recentMaintenance.length >= 2 ? 100 : recentMaintenance.length === 1 ? 75 : 50;
  }

  // ---------- Consumo: stabilità (bassa variabilità) tra gli ultimi rifornimenti ----------
  let consumptionScore = 100;
  if (consumptionPoints.length >= 3) {
    const recent = consumptionPoints.slice(-6);
    const avg = recent.reduce((s, p) => s + p.kmPerLiter, 0) / recent.length;
    const variance = recent.reduce((s, p) => s + (p.kmPerLiter - avg) ** 2, 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avg > 0 ? stdDev / avg : 0;
    // variazione contenuta (<15%) = consumo stabile = punteggio alto
    consumptionScore = Math.max(0, Math.round(100 - coefficientOfVariation * 300));
  }

  // ---------- Qualità dati: quanto storico ha registrato l'utente ----------
  const dataPoints = maintenanceEntries.length + consumptionPoints.length + reminders.length;
  const dataQualityScore = Math.min(100, Math.round((dataPoints / 10) * 100));

  const hasObdData = logSessions.length > 0;
  const obdScore = hasObdData ? 100 : undefined; // placeholder: analisi DTC reale è un passo successivo

  // ---------- Pesi: redistribuiti se manca l'OBD ----------
  const weights = hasObdData
    ? { maintenance: 0.3, deadlines: 0.25, consumption: 0.15, dataQuality: 0.1, obd: 0.2 }
    : { maintenance: 0.35, deadlines: 0.3, consumption: 0.2, dataQuality: 0.15, obd: 0 };

  const score = Math.round(
    maintenanceScore * weights.maintenance +
      deadlinesScore * weights.deadlines +
      consumptionScore * weights.consumption +
      dataQualityScore * weights.dataQuality +
      (obdScore ?? 0) * weights.obd,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    maintenance: maintenanceScore,
    deadlines: deadlinesScore,
    consumption: consumptionScore,
    dataQuality: dataQualityScore,
    obd: obdScore,
  };
}

export function healthScoreLevel(score: number): "good" | "warning" | "critical" {
  if (score >= 75) return "good";
  if (score >= 50) return "warning";
  return "critical";
}
