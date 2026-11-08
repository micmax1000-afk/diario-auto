package com.micmax.diarioauto

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Forza l'aggiornamento immediato dei widget nella home, subito dopo che
 * l'app React ha scritto i nuovi dati in Preferences. Senza questo, Android
 * aggiornerebbe comunque i widget da soli, ma non prima di ~30 minuti —
 * il minimo imposto dal sistema per gli aggiornamenti periodici automatici.
 */
@CapacitorPlugin(name = "WidgetRefresh")
class WidgetRefreshPlugin : Plugin() {

    @PluginMethod
    fun refresh(call: PluginCall) {
        val manager = AppWidgetManager.getInstance(context)
        val providers: List<Class<out AppWidgetProvider>> = listOf(
            VehicleWidgetProvider::class.java,
            StationWidgetProvider::class.java,
            DeadlinesWidgetProvider::class.java,
        )
        for (provider in providers) {
            val ids = manager.getAppWidgetIds(ComponentName(context, provider))
            if (ids.isEmpty()) continue
            val intent = Intent(context, provider).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
        call.resolve(JSObject())
    }
}
