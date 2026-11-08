package com.micmax.diarioauto

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.micmax.diarioauto.WidgetCommon.text

/**
 * Widget piccolo: il distributore più economico trovato l'ultima volta in
 * "Distributori vicini". Non scarica i prezzi da solo: li aggiorna l'app.
 * Il tocco apre direttamente i distributori.
 */
class StationWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {
        const val DATA_KEY = "widget_station_data"

        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_station)
            val data = WidgetCommon.readJson(context, DATA_KEY)
            if (data != null) {
                views.setTextViewText(R.id.widget_station_title, data.text("title") ?: context.getString(R.string.widget_label_station))
                views.setTextViewText(R.id.widget_station_subtitle, data.text("subtitle") ?: "")
                views.setTextViewText(R.id.widget_station_price, data.text("price") ?: "—")
                views.setTextViewText(R.id.widget_station_place, data.text("place") ?: "")
                views.setTextViewText(R.id.widget_station_note, data.text("note") ?: "")
            } else {
                views.setTextViewText(R.id.widget_station_title, context.getString(R.string.widget_label_station))
                views.setTextViewText(R.id.widget_station_subtitle, "")
                views.setTextViewText(R.id.widget_station_price, "—")
                views.setTextViewText(R.id.widget_station_place, context.getString(R.string.widget_open_app))
                views.setTextViewText(R.id.widget_station_note, "")
            }
            views.setOnClickPendingIntent(R.id.widget_root, WidgetCommon.openApp(context, 20, "stations"))
            manager.updateAppWidget(widgetId, views)
        }
    }
}
