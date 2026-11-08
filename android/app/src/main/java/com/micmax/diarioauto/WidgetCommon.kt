package com.micmax.diarioauto

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONObject

/**
 * Pezzi in comune tra i widget: lettura dei dati scritti dall'app React in
 * SharedPreferences ("CapacitorStorage", vedi utils/widgetData.ts) e
 * apertura dell'app, eventualmente su una funzione precisa tramite
 * l'indirizzo diarioauto://shortcut/... gestito da App.tsx.
 */
object WidgetCommon {
    private const val PREFS_NAME = "CapacitorStorage"

    fun readJson(context: Context, key: String): JSONObject? {
        val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(key, null) ?: return null
        return try {
            JSONObject(raw)
        } catch (e: Exception) {
            null
        }
    }

    /** Stringa del JSON, oppure null se manca o è vuota. */
    fun JSONObject.text(name: String): String? {
        if (isNull(name)) return null
        val s = optString(name, "")
        return s.ifEmpty { null }
    }

    fun openApp(context: Context, requestCode: Int, shortcut: String? = null): PendingIntent {
        val intent = if (shortcut != null) {
            Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse("diarioauto://shortcut/$shortcut")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        } else {
            context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
