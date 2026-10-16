package com.micmax.diarioauto

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Apre la pagina di sistema delle notifiche di Diario Auto. Serve quando
 * Android ha bloccato il permesso (dopo due "Non consentire" la finestra di
 * richiesta non compare più): l'unico modo di riattivarle è da lì.
 */
@CapacitorPlugin(name = "NotificationSettings")
class NotificationSettingsPlugin : Plugin() {

    @PluginMethod
    fun open(call: PluginCall) {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
            call.resolve(JSObject())
        } catch (e: Exception) {
            call.reject("Impossibile aprire le impostazioni", e)
        }
    }
}
