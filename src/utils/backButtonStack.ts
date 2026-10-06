// Gestione del tasto/gesto "indietro" hardware di Android.
//
// Il problema che risolve: questa è una SPA con schermate e moduli gestiti
// tramite stato React (showX / setShowX), non tramite URL/cronologia del
// browser. Senza questo file, il tasto indietro di Android non saprebbe
// nulla di "cosa è aperto adesso" e — nella modalità nativa Capacitor —
// rischia di uscire di colpo dall'app anche con un modulo aperto e dati non
// salvati (es. un rifornimento a metà compilazione).
//
// Come funziona: ogni modulo/schermata "chiudibile" si registra qui mentre
// è aperta, tramite l'hook useBackButtonClose qui sotto. Quando l'utente
// preme indietro, App.tsx (unico punto che ascolta l'evento nativo) chiude
// solo l'elemento aperto più di recente — esattamente come se l'utente
// avesse premuto il suo pulsante "Annulla"/"×"/"← Indietro" in schermo.
// Se non c'è nulla di aperto, il tasto indietro si comporta come su
// qualunque altra app Android: se premuto due volte entro 2 secondi, esce.

import { useEffect } from "react";

type Closer = () => void;

const stack: Closer[] = [];

function push(closer: Closer) {
  stack.push(closer);
}

function pop(closer: Closer) {
  const index = stack.lastIndexOf(closer);
  if (index !== -1) stack.splice(index, 1);
}

/** Chiude l'elemento aperto più di recente. Restituisce false se non c'era nulla da chiudere. */
export function triggerTopBackHandler(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

/**
 * Registra `onClose` come gestore del tasto indietro finché `isOpen` è vero.
 * Da chiamare in ogni componente che rappresenta un modulo, una schermata
 * sovrapposta o un dialogo che l'utente può chiudere — non solo nei form.
 */
export function useBackButtonClose(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;
    push(onClose);
    return () => pop(onClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
