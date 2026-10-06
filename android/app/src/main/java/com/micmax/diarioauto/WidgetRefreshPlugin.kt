package com.micmax.diarioauto

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Forza l'aggiornamento immediato del widget nella home, subito dopo che
 * l'app React ha scritto i nuovi dati in Preferences. Senza questo, Android
 * aggiornerebbe comunque il widget da solo, ma non prima di ~30 minuti —
 * il minimo imposto dal sistema per gli aggiornamenti periodici automatici.
 */
@CapacitorPlugin(name = "WidgetRefresh")
class WidgetRefreshPlugin : Plugin() {

    @PluginMethod
    fun refresh(call: PluginCall) {
        val manager = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, VehicleWidgetProvider::class.java)
        val ids = manager.getAppWidgetIds(component)

        if (ids.isNotEmpty()) {
            val intent = Intent(context, VehicleWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        call.resolve(JSObject())
    }
}
