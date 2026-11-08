package com.micmax.diarioauto

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import com.micmax.diarioauto.WidgetCommon.text

/**
 * Widget grande per la home di Android: auto principale, km, scadenza più
 * urgente, consumo e i pulsanti "Rifornimento" e "A voce". I dati arrivano
 * dall'app React (vedi utils/widgetData.ts): il widget vive fuori dalla
 * WebView e non può leggere IndexedDB.
 */
class VehicleWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {
        const val DATA_KEY = "widget_vehicle_data"

        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_vehicle)
            val data = WidgetCommon.readJson(context, DATA_KEY)

            if (data != null) {
                views.setTextViewText(R.id.widget_vehicle_name, data.text("vehicleName") ?: context.getString(R.string.widget_label_vehicle))
                val plate = data.text("plate")
                views.setViewVisibility(R.id.widget_plate, if (plate != null) View.VISIBLE else View.GONE)
                views.setTextViewText(R.id.widget_plate, plate ?: "")
                views.setTextViewText(R.id.widget_km, data.text("km") ?: "—")

                val labels = data.optJSONObject("labels")
                views.setViewVisibility(R.id.widget_chips, View.VISIBLE)
                views.setTextViewText(R.id.widget_deadline_label, labels?.text("deadline") ?: "")
                val reminder = data.text("reminderLabel")
                views.setTextViewText(R.id.widget_reminder, reminder ?: (labels?.text("noDeadline") ?: "—"))
                val reminderColor = if (reminder != null && data.optBoolean("reminderOverdue")) R.color.widget_red else R.color.widget_text
                views.setTextColor(R.id.widget_reminder, context.getColor(reminderColor))

                val consumption = data.text("consumption")
                views.setViewVisibility(R.id.widget_consumption_box, if (consumption != null) View.VISIBLE else View.GONE)
                views.setTextViewText(R.id.widget_consumption_label, labels?.text("consumption") ?: "")
                views.setTextViewText(R.id.widget_consumption, consumption ?: "")

                views.setViewVisibility(R.id.widget_buttons, View.VISIBLE)
                views.setTextViewText(R.id.widget_btn_fuel, labels?.text("fuel") ?: "+")
                views.setOnClickPendingIntent(R.id.widget_btn_fuel, WidgetCommon.openApp(context, 11, "fuel"))
                val voice = data.optBoolean("voice")
                views.setViewVisibility(R.id.widget_btn_voice, if (voice) View.VISIBLE else View.GONE)
                views.setTextViewText(R.id.widget_btn_voice, labels?.text("voice") ?: "")
                views.setOnClickPendingIntent(R.id.widget_btn_voice, WidgetCommon.openApp(context, 12, "voice"))
            } else {
                views.setTextViewText(R.id.widget_vehicle_name, context.getString(R.string.widget_label_vehicle))
                views.setViewVisibility(R.id.widget_plate, View.GONE)
                views.setTextViewText(R.id.widget_km, context.getString(R.string.widget_open_app))
                views.setViewVisibility(R.id.widget_chips, View.GONE)
                views.setViewVisibility(R.id.widget_buttons, View.GONE)
            }

            // Tocco sul resto del widget: apre l'app.
            views.setOnClickPendingIntent(R.id.widget_root, WidgetCommon.openApp(context, 10))
            manager.updateAppWidget(widgetId, views)
        }
    }
}
