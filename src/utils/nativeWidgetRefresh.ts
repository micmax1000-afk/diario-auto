// Bridge verso il piccolo plugin nativo che forza l'aggiornamento immediato
// del widget nella home — vedi WidgetRefreshPlugin.kt. Senza, il widget si
// aggiornerebbe comunque da solo, ma non prima di ~30 minuti (il minimo
// imposto da Android per gli aggiornamenti periodici dei widget).

import { registerPlugin } from "@capacitor/core";

export interface WidgetRefreshPlugin {
  refresh(): Promise<void>;
}

const NativeWidgetRefresh = registerPlugin<WidgetRefreshPlugin>("WidgetRefresh");

export default NativeWidgetRefresh;
