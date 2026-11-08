package com.micmax.diarioauto

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import com.micmax.diarioauto.WidgetCommon.text

/** Widget piccolo: le tre scadenze più vicine (le scadute in rosso). */
class DeadlinesWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {
        const val DATA_KEY = "widget_deadlines_data"
        private val ROWS = intArrayOf(R.id.widget_deadline_1, R.id.widget_deadline_2, R.id.widget_deadline_3)

        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_deadlines)
            val data = WidgetCommon.readJson(context, DATA_KEY)
            val items = data?.optJSONArray("items")
            val count = items?.length() ?: 0

            views.setTextViewText(R.id.widget_deadlines_title, data?.text("title") ?: context.getString(R.string.widget_label_deadlines))
            views.setViewVisibility(R.id.widget_deadlines_empty, if (count == 0) View.VISIBLE else View.GONE)
            views.setTextViewText(R.id.widget_deadlines_empty, if (data != null) data.text("empty") ?: "" else context.getString(R.string.widget_open_app))

            for (i in ROWS.indices) {
                val item = if (items != null && i < count) items.optJSONObject(i) else null
                if (item == null) {
                    views.setViewVisibility(ROWS[i], View.GONE)
                    continue
                }
                val label = item.text("label") ?: ""
                val whenText = item.text("when")
                views.setTextViewText(ROWS[i], if (whenText != null) "$label · $whenText" else label)
                val color = if (item.optBoolean("overdue")) R.color.widget_red else R.color.widget_text
                views.setTextColor(ROWS[i], context.getColor(color))
                views.setViewVisibility(ROWS[i], View.VISIBLE)
            }
            views.setOnClickPendingIntent(R.id.widget_root, WidgetCommon.openApp(context, 30))
            manager.updateAppWidget(widgetId, views)
        }
    }
}
