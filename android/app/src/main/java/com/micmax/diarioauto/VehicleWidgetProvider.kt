package com.micmax.diarioauto

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * Widget per la home di Android: mostra il veicolo principale, il suo
 * chilometraggio e la scadenza più urgente. I dati arrivano dall'app React
 * tramite @capacitor/preferences (vedi utils/widgetData.ts sul lato
 * TypeScript), che su Android scrive in un file SharedPreferences
 * chiamato "CapacitorStorage" — lo stesso che leggiamo qui.
 *
 * Il widget vive in un processo/contesto separato dalla WebView: non può
 * leggere IndexedDB direttamente, da qui la necessità di questo piccolo
 * "ponte" tramite SharedPreferences.
 */
class VehicleWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {
        private const val PREFS_NAME = "CapacitorStorage"
        private const val DATA_KEY = "widget_vehicle_data"

        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_vehicle)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(DATA_KEY, null)

            if (json != null) {
                try {
                    val data = JSONObject(json)
                    views.setTextViewText(R.id.widget_vehicle_name, data.optString("vehicleName"))
                    views.setTextViewText(R.id.widget_km, data.optString("km"))

                    val reminder = if (data.isNull("reminderLabel")) null else data.optString("reminderLabel")
                    if (!reminder.isNullOrEmpty()) {
                        views.setTextViewText(R.id.widget_reminder, reminder)
                        views.setViewVisibility(R.id.widget_reminder, View.VISIBLE)
                    } else {
                        views.setViewVisibility(R.id.widget_reminder, View.GONE)
                    }
                } catch (e: Exception) {
                    setEmptyState(views)
                }
            } else {
                setEmptyState(views)
            }

            // Tocco sul widget: apre l'app.
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            manager.updateAppWidget(widgetId, views)
        }

        private fun setEmptyState(views: RemoteViews) {
            views.setTextViewText(R.id.widget_vehicle_name, "Diario Auto")
            views.setTextViewText(R.id.widget_km, "Apri l'app per iniziare")
            views.setViewVisibility(R.id.widget_reminder, View.GONE)
        }
    }
}
