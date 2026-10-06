package com.micmax.diarioauto

import android.app.Activity
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope

/**
 * Plugin nativo per l'accesso a Google Drive dall'app — sostituisce il
 * login basato su popup web (Google Identity Services, in driveBackup.ts),
 * che Google blocca attivamente dentro le WebView native per motivi di
 * sicurezza (mostra "Questo browser o app potrebbe non essere sicura/o").
 *
 * Importante: qui serve un OAuth Client ID di tipo "Android" nella Google
 * Cloud Console (diverso da quello "Web" usato dal vecchio flusso), con
 * registrati il nome del pacchetto (com.micmax.diarioauto) e l'impronta
 * SHA-1 del certificato di firma — sia quello di debug che, più avanti,
 * quello di release. Vedi GOOGLE_DRIVE_SETUP.md.
 *
 * Il resto del codice di driveBackup.ts (carica/elenca/scarica i backup
 * via REST API con fetch()) resta invariato: quelle sono semplici chiamate
 * HTTP con un token Bearer, non toccate dal blocco di Google sulle WebView
 * — qui serve solo procurare quel token in modo diverso.
 */
@CapacitorPlugin(name = "GoogleDriveAuth")
class GoogleDriveAuthPlugin : Plugin() {

    // drive.file: l'app vede solo i file che crea lei stessa — stesso
    // permesso minimo già usato dal vecchio flusso web.
    private val driveScope = "https://www.googleapis.com/auth/drive.file"

    private fun signInClient(): GoogleSignInClient {
        val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope(driveScope))
            .build()
        return GoogleSignIn.getClient(context, options)
    }

    /** Account già collegato in precedenza, se c'è — per riconnettersi senza mostrare di nuovo la schermata di accesso. */
    private fun lastSignedInAccount(): GoogleSignInAccount? {
        val account = GoogleSignIn.getLastSignedInAccount(context) ?: return null
        val hasScope = GoogleSignIn.hasPermissions(account, Scope(driveScope))
        return if (hasScope) account else null
    }

    @PluginMethod
    fun getAccessToken(call: PluginCall) {
        val existing = lastSignedInAccount()
        if (existing != null) {
            resolveToken(call, existing)
            return
        }
        startActivityForResult(call, signInClient().signInIntent, "handleSignInResult")
    }

    @ActivityCallback
    private fun handleSignInResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("Accesso annullato", "cancelled")
            return
        }
        try {
            val account = GoogleSignIn.getSignedInAccountFromIntent(result.data).result
            resolveToken(call, account)
        } catch (e: ApiException) {
            call.reject("Autenticazione Google fallita", "auth_failed", e)
        }
    }

    /** GoogleAuthUtil.getToken fa una chiamata di rete: va eseguita fuori dal thread principale. */
    private fun resolveToken(call: PluginCall, account: GoogleSignInAccount) {
        Thread {
            try {
                val token = GoogleAuthUtil.getToken(context, account.account!!, "oauth2:$driveScope")
                val ret = JSObject()
                ret.put("accessToken", token)
                ret.put("email", account.email ?: "")
                activity?.runOnUiThread { call.resolve(ret) }
            } catch (e: Exception) {
                activity?.runOnUiThread { call.reject("Impossibile ottenere l'accesso a Google Drive", "network", e) }
            }
        }.start()
    }

    @PluginMethod
    fun signOut(call: PluginCall) {
        signInClient().signOut().addOnCompleteListener { call.resolve() }
    }
}
