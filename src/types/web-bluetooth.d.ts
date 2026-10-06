// Dichiarazioni minime per la Web Bluetooth API.
// TypeScript non include questi tipi nella libreria DOM standard.

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly value: DataView | null;
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: "characteristicvaluechanged",
    listener: (event: Event) => void,
  ): void;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: "gattserverdisconnected", listener: (event: Event) => void): void;
}

interface RequestDeviceOptions {
  filters?: { services?: string[]; name?: string; namePrefix?: string }[];
  optionalServices?: string[];
  acceptAllDevices?: boolean;
}

interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  getDevices?(): Promise<BluetoothDevice[]>;
}

interface Navigator {
  readonly bluetooth: Bluetooth;
}
