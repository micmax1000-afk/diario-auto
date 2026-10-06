package com.micmax.diarioauto

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Plugin nativo per collegare un adattatore OBD2 via Bluetooth Classic
 * (profilo SPP/RFCOMM), la parte che Web Bluetooth non può raggiungere
 * in nessun browser. Usa la stessa identica sequenza di comandi
 * ELM327 (AT..., 01xx, ecc.) già presente in src/utils/obd.ts: qui
 * cambia solo il trasporto dei byte, non il protocollo.
 *
 * Flusso lato JS/TS:
 *   1. isSupported()          -> il telefono ha il Bluetooth?
 *   2. listPairedDevices()    -> elenco degli adattatori già accoppiati
 *                                nelle Impostazioni Android di sistema
 *   3. connect({ address })   -> apre il socket RFCOMM
 *   4. write({ data })        -> invia un comando (es. "ATZ")
 *      evento "dataReceived"  -> ogni volta che arrivano byte in risposta
 *      evento "disconnected"  -> se la connessione cade in modo imprevisto
 *   5. disconnect()           -> chiude tutto
 */
@CapacitorPlugin(
    name = "ObdBluetooth",
    permissions = [
        // Entrambi insieme in un solo alias: CONNECT serve per aprire il
        // socket, SCAN per cancelDiscovery() in connect() — chiederne uno
        // solo (come succedeva prima) fa crashare l'app con
        // SecurityException non appena si usa l'altro.
        Permission(
            strings = [Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN],
            alias = "bluetooth",
        ),
    ],
)
class ObdBluetoothPlugin : Plugin() {

    // UUID standard del profilo SPP (Serial Port Profile) — non è specifico
    // di nessun produttore, è lo stesso per qualunque adattatore ELM327
    // Bluetooth Classic (Veepeak, OBDLink, i cloni economici, ecc.).
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    private var socket: BluetoothSocket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null
    private val readLoopActive = AtomicBoolean(false)
    private var readThread: Thread? = null

    private fun bluetoothAdapter(): BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()

    private fun hasBluetoothPermission(): Boolean {
        // Sotto Android 12 (API 31) i permessi BLUETOOTH_CONNECT/SCAN non
        // esistono come permessi runtime: basta la dichiarazione BLUETOOTH
        // nel manifest, già presente.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        // Con più stringhe sotto lo stesso alias, Capacitor segnala GRANTED
        // solo se sono concesse entrambe — esattamente il controllo che serve qui.
        return getPermissionState("bluetooth") == com.getcapacitor.PermissionState.GRANTED
    }

    @PluginMethod
    fun isSupported(call: PluginCall) {
        val ret = JSObject()
        ret.put("supported", bluetoothAdapter() != null)
        call.resolve(ret)
    }

    /**
     * Elenca i dispositivi Bluetooth Classic già accoppiati dall'utente
     * nelle Impostazioni di sistema Android. A differenza del Web
     * Bluetooth (che scopre i dispositivi al volo), qui l'abbinamento
     * va fatto una volta sola da Android stesso, di solito con PIN
     * 1234 o 0000 — standard su quasi tutti i cloni ELM327.
     */
    @PluginMethod
    fun listPairedDevices(call: PluginCall) {
        if (!ensurePermission(call)) return

        val adapter = bluetoothAdapter()
        if (adapter == null) {
            call.reject("Bluetooth non disponibile su questo dispositivo.")
            return
        }
        if (!adapter.isEnabled) {
            call.reject("Il Bluetooth è spento. Accendilo dalle impostazioni del telefono.")
            return
        }

        val devices: Set<BluetoothDevice> = try {
            adapter.bondedDevices
        } catch (e: SecurityException) {
            call.reject("Permesso Bluetooth mancante.", e)
            return
        }

        val array = JSArray()
        for (device in devices) {
            val entry = JSObject()
            entry.put("name", device.name ?: device.address)
            entry.put("address", device.address)
            array.put(entry)
        }
        val ret = JSObject()
        ret.put("devices", array)
        call.resolve(ret)
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    fun connect(call: PluginCall) {
        if (!ensurePermission(call)) return

        val address = call.getString("address")
        if (address.isNullOrBlank()) {
            call.reject("Manca l'indirizzo del dispositivo.")
            return
        }

        val adapter = bluetoothAdapter()
        if (adapter == null) {
            call.reject("Bluetooth non disponibile su questo dispositivo.")
            return
        }

        Thread {
            try {
                disconnectInternal()

                val device = adapter.getRemoteDevice(address)
                // Durante la scoperta attiva le connessioni SPP sono molto
                // meno affidabili: la si interrompe sempre prima di aprire
                // il socket, anche se qui non l'abbiamo avviata noi. Avvolta
                // in un try/catch: è solo un'ottimizzazione, non deve mai
                // far fallire l'intera connessione se per qualche motivo il
                // permesso non risultasse ancora concesso in quel momento.
                try {
                    adapter.cancelDiscovery()
                } catch (e: SecurityException) {
                    // si prosegue comunque: nel peggiore dei casi la connessione
                    // sarà solo leggermente meno reattiva, non fallirà del tutto
                }

                val newSocket = device.createRfcommSocketToServiceRecord(sppUuid)
                newSocket.connect()

                socket = newSocket
                inputStream = newSocket.inputStream
                outputStream = newSocket.outputStream

                startReadLoop()

                activity?.runOnUiThread { call.resolve() }
            } catch (e: IOException) {
                activity?.runOnUiThread {
                    call.reject("Connessione fallita: verifica che l'adattatore sia acceso e accoppiato.", e)
                }
                disconnectInternal()
            }
        }.start()
    }

    @PluginMethod
    fun write(call: PluginCall) {
        val data = call.getString("data")
        if (data == null) {
            call.reject("Manca il testo da inviare.")
            return
        }
        val out = outputStream
        if (out == null) {
            call.reject("Non connesso.")
            return
        }
        Thread {
            try {
                // \r è il terminatore di comando standard ELM327, identico
                // a quello già usato dal trasporto BLE in obd.ts.
                out.write((data + "\r").toByteArray(Charsets.US_ASCII))
                out.flush()
                activity?.runOnUiThread { call.resolve() }
            } catch (e: IOException) {
                activity?.runOnUiThread { call.reject("Invio fallito.", e) }
            }
        }.start()
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        disconnectInternal()
        call.resolve()
    }

    private fun startReadLoop() {
        readLoopActive.set(true)
        val stream = inputStream ?: return
        readThread = Thread {
            val buffer = ByteArray(1024)
            while (readLoopActive.get()) {
                try {
                    val count = stream.read(buffer)
                    if (count < 0) break
                    val text = String(buffer, 0, count, Charsets.US_ASCII)
                    val data = JSObject()
                    data.put("data", text)
                    activity?.runOnUiThread { notifyListeners("dataReceived", data) }
                } catch (e: IOException) {
                    break
                }
            }
            // Se usciamo dal ciclo mentre la connessione doveva essere
            // ancora attiva, è una disconnessione imprevista (adattatore
            // spento, fuori portata, ecc.) e non una chiusura richiesta
            // dall'utente — avvisiamo il lato JS in entrambi i casi, così
            // l'interfaccia può sempre tornare allo stato "disconnesso".
            activity?.runOnUiThread { notifyListeners("disconnected", JSObject()) }
        }
        readThread?.start()
    }

    private fun disconnectInternal() {
        readLoopActive.set(false)
        try { inputStream?.close() } catch (_: IOException) {}
        try { outputStream?.close() } catch (_: IOException) {}
        try { socket?.close() } catch (_: IOException) {}
        inputStream = null
        outputStream = null
        socket = null
    }

    /** Se il permesso manca lo richiede e basta: il chiamante riproverà dopo il risultato. */
    private fun ensurePermission(call: PluginCall): Boolean {
        if (hasBluetoothPermission()) return true
        requestPermissionForAlias("bluetooth", call, "onPermissionResult")
        return false
    }

    @PermissionCallback
    private fun onPermissionResult(call: PluginCall) {
        if (!hasBluetoothPermission()) {
            call.reject("Permesso Bluetooth negato.")
            return
        }
        when (call.methodName) {
            "connect" -> connect(call)
            "listPairedDevices" -> listPairedDevices(call)
            else -> call.reject("Permesso concesso, ma l'operazione richiesta non è nota.")
        }
    }

    override fun handleOnDestroy() {
        disconnectInternal()
        super.handleOnDestroy()
    }
}
