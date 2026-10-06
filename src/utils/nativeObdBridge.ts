// Bridge verso il plugin nativo Android (Kotlin) che parla Bluetooth
// Classic/RFCOMM con l'adattatore OBD2 — la parte che Web Bluetooth non può
// raggiungere in nessun browser. Il plugin vero e proprio vive in
// android/app/src/main/java/com/micmax/diarioauto/ObdBluetoothPlugin.kt
//
// Fuori da un'app Capacitor nativa (cioè nel normale browser) questo modulo
// non viene mai usato: obd.ts sceglie il trasporto giusto a runtime in base
// a Capacitor.isNativePlatform().

import { registerPlugin } from "@capacitor/core";

export interface PairedDevice {
  name: string;
  address: string;
}

export interface ObdBluetoothPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  listPairedDevices(): Promise<{ devices: PairedDevice[] }>;
  connect(options: { address: string }): Promise<void>;
  write(options: { data: string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(
    eventName: "dataReceived",
    listenerFunc: (event: { data: string }) => void,
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: "disconnected",
    listenerFunc: () => void,
  ): Promise<{ remove: () => void }>;
}

const NativeObdBluetooth = registerPlugin<ObdBluetoothPlugin>("ObdBluetooth");

export default NativeObdBluetooth;
