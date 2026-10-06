package com.micmax.diarioauto

import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Plugin nativo per lo sblocco Pro (acquisto singolo, non abbonamento) via
 * Google Play Billing. Sostituisce la Digital Goods API del vecchio
 * approccio TWA — quell'API esiste solo dentro una Trusted Web Activity,
 * non in un'app Capacitor come questa, quindi qui serve parlare
 * direttamente con la libreria ufficiale di Google.
 *
 * Flusso lato JS/TS:
 *   1. getStatus()      -> "ready" se Play Billing è raggiungibile
 *   2. queryProducts()  -> prezzo/descrizione del prodotto "Pro Lifetime"
 *   3. queryPurchases() -> acquisti già di proprietà dell'utente (per
 *                          sapere se Pro è già sbloccato, o per "Ripristina")
 *   4. purchase()       -> avvia il flusso di acquisto Google; il risultato
 *                          arriva in modo asincrono dal listener e viene
 *                          restituito come risposta a questa stessa chiamata
 *
 * Il prodotto va creato nella Play Console come "Prodotto gestito"
 * (one-time, NON abbonamento) con ID esattamente "diario_auto_pro_lifetime",
 * identico alla costante PRODUCT_ID lato TypeScript.
 */
@CapacitorPlugin(name = "PlayBilling")
class PlayBillingPlugin : Plugin(), PurchasesUpdatedListener {

    private val productId = "diario_auto_pro_lifetime"

    private var billingClient: BillingClient? = null
    private var connecting = false

    // La chiamata JS di purchase() resta "in sospeso" finché non arriva il
    // risultato dal listener di Google, che è asincrono e disaccoppiato
    // dalla chiamata che ha avviato il flusso.
    private var pendingPurchaseCall: PluginCall? = null

    private fun getOrCreateClient(): BillingClient {
        val existing = billingClient
        if (existing != null) return existing

        val pendingPurchasesParams = PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()

        val client = BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases(pendingPurchasesParams)
            .build()
        billingClient = client
        return client
    }

    private fun ensureConnected(onReady: (Boolean) -> Unit) {
        val client = getOrCreateClient()
        if (client.isReady) {
            onReady(true)
            return
        }
        if (connecting) {
            // Già in corso un tentativo di connessione: evita di avviarne un secondo in parallelo.
            onReady(false)
            return
        }
        connecting = true
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                connecting = false
                onReady(billingResult.responseCode == BillingClient.BillingResponseCode.OK)
            }

            override fun onBillingServiceDisconnected() {
                connecting = false
            }
        })
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        ensureConnected { ready ->
            val ret = JSObject()
            ret.put("status", if (ready) "ready" else "unavailable")
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun queryProducts(call: PluginCall) {
        ensureConnected { ready ->
            if (!ready) {
                call.resolve(JSObject().put("products", JSArray()))
                return@ensureConnected
            }

            val product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
            val params = QueryProductDetailsParams.newBuilder()
                .setProductList(listOf(product))
                .build()

            billingClient?.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
                val array = JSArray()
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    for (details in productDetailsList) {
                        val offer = details.oneTimePurchaseOfferDetails
                        val entry = JSObject()
                        entry.put("itemId", details.productId)
                        entry.put("title", details.title)
                        entry.put("description", details.description)
                        entry.put("priceValue", offer?.formattedPrice ?: "")
                        entry.put("priceCurrency", offer?.priceCurrencyCode ?: "")
                        array.put(entry)
                    }
                }
                activity?.runOnUiThread {
                    call.resolve(JSObject().put("products", array))
                }
            }
        }
    }

    @PluginMethod
    fun queryPurchases(call: PluginCall) {
        ensureConnected { ready ->
            if (!ready) {
                call.resolve(JSObject().put("purchases", JSArray()))
                return@ensureConnected
            }

            val params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()

            billingClient?.queryPurchasesAsync(params) { billingResult, purchases ->
                val array = JSArray()
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    for (purchase in purchases) {
                        // Un acquisto arrivato ma non ancora confermato (es. app chiusa
                        // subito dopo il pagamento) va confermato ora, altrimenti Google
                        // lo rimborsa automaticamente dopo 3 giorni.
                        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged) {
                            acknowledge(purchase)
                        }
                        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                            for (product in purchase.products) {
                                val entry = JSObject()
                                entry.put("itemId", product)
                                entry.put("purchaseToken", purchase.purchaseToken)
                                array.put(entry)
                            }
                        }
                    }
                }
                activity?.runOnUiThread {
                    call.resolve(JSObject().put("purchases", array))
                }
            }
        }
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        call.setKeepAlive(true)
        ensureConnected { ready ->
            if (!ready) {
                call.resolve(JSObject().put("success", false).put("errorReason", "unavailable"))
                return@ensureConnected
            }

            val product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
            val queryParams = QueryProductDetailsParams.newBuilder()
                .setProductList(listOf(product))
                .build()

            billingClient?.queryProductDetailsAsync(queryParams) { billingResult, productDetailsList ->
                val details = productDetailsList.firstOrNull()
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK || details == null) {
                    activity?.runOnUiThread {
                        call.resolve(JSObject().put("success", false).put("errorReason", "unavailable"))
                    }
                    return@queryProductDetailsAsync
                }

                val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .build()
                val flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(listOf(productDetailsParams))
                    .build()

                pendingPurchaseCall = call
                activity?.runOnUiThread {
                    billingClient?.launchBillingFlow(activity!!, flowParams)
                }
            }
        }
    }

    // Chiamato da Google quando l'utente completa, annulla o fallisce il pagamento.
    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: MutableList<Purchase>?) {
        val call = pendingPurchaseCall
        pendingPurchaseCall = null
        if (call == null) return

        when (billingResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                val purchase = purchases?.firstOrNull { it.products.contains(productId) }
                if (purchase == null) {
                    call.resolve(JSObject().put("success", false).put("errorReason", "failed"))
                    return
                }
                if (!purchase.isAcknowledged) {
                    acknowledge(purchase)
                }
                val ret = JSObject()
                ret.put("success", true)
                ret.put("purchaseToken", purchase.purchaseToken)
                call.resolve(ret)
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                call.resolve(JSObject().put("success", false).put("errorReason", "cancelled"))
            }
            else -> {
                call.resolve(JSObject().put("success", false).put("errorReason", "failed"))
            }
        }
    }

    /** Conferma l'acquisto presso Google — obbligatorio entro 3 giorni o viene rimborsato in automatico. */
    private fun acknowledge(purchase: Purchase) {
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        billingClient?.acknowledgePurchase(params) { /* nessuna azione necessaria sul risultato */ }
    }

    override fun handleOnDestroy() {
        billingClient?.endConnection()
        super.handleOnDestroy()
    }
}
