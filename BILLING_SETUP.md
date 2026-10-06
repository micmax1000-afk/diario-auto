# Sblocco Pro con Google Play Billing — guida

Diario Auto è un'app Android nativa (Capacitor). Lo sblocco **Pro** è un
**acquisto singolo "per sempre"** (prodotto gestito, non abbonamento).

> Questa guida sostituisce quella precedente, che descriveva il vecchio
> approccio TWA / Digital Goods API / Bubblewrap. Non serve più: la cartella
> `twa-assets/` e `twa-manifest.json` sono rimasti solo come archivio e si
> possono eliminare.

## Cosa c'è già nel codice

| Pezzo | Dove |
|---|---|
| Plugin nativo Kotlin (Google Play Billing Library 7.1.1) | `android/app/src/main/java/com/micmax/diarioauto/PlayBillingPlugin.kt` |
| Ponte TypeScript verso il plugin | `src/services/billing/nativePlayBilling.ts`, `src/services/billing/digitalGoods.ts` |
| Hook React (acquisto, ripristino, stato) | `src/services/billing/usePremiumPurchase.ts`, `useProStatus.ts` |
| Schermata "Diario Auto Premium" | `src/components/PremiumScreen.tsx` |

ID del prodotto (deve essere **identico** in Play Console):

```
diario_auto_pro_lifetime
```

Come funziona: all'avvio e dalla schermata Premium l'app chiede a Google Play
gli acquisti già fatti dall'account (`queryPurchases`); se trova il prodotto,
sblocca Pro. "Ripristina acquisto" rifà la stessa verifica (utile dopo una
reinstallazione o su un altro telefono con lo stesso account Google).
L'acquisto viene confermato ("acknowledge") dal plugin: se non viene
confermato entro 3 giorni Google lo rimborsa in automatico.

## Cosa devi fare tu, nell'ordine

### 1. Account sviluppatore Google Play
Registrati su <https://play.google.com/console> (costo una tantum, circa 25 USD).
Gli account personali nuovi hanno requisiti aggiuntivi per la pubblicazione
pubblica (ad esempio un periodo di test chiuso con un numero minimo di tester):
controlla le regole attuali nella Console, cambiano nel tempo.

### 2. Crea l'app e la firma
1. Console → **Crea app**, nome "Diario Auto", lingua predefinita, app gratuita (l'acquisto Pro è dentro l'app).
2. Genera il keystore di rilascio (una volta sola, conservalo con la password: se lo perdi non potrai più aggiornare l'app). Vedi `ANDROID_BUILD.md`.
3. Costruisci l'AAB firmato: `npm run android:release`.
4. Lascia attiva la **firma app di Google Play** (Play App Signing, è il default).

### 3. Carica una prima versione in test interno
Il prodotto in-app si può creare solo dopo aver caricato un AAB che include il permesso di fatturazione (la libreria lo aggiunge da sola).

1. Console → **Test → Test interno → Crea nuova release** → carica l'AAB.
2. **Tester**: crea una lista e aggiungi la tua email Google.
3. Salva e pubblica la release di test interno. Dopo qualche minuto/ora compare il link di partecipazione al test: aprilo dal telefono con lo stesso account e installa **da Play Store**.

### 4. Crea il prodotto
Console → **Monetizza → Prodotti → Prodotti in-app → Crea prodotto**:
- **ID prodotto**: `diario_auto_pro_lifetime` (non si può cambiare dopo)
- Nome e descrizione: es. "Diario Auto Pro", "Sblocca per sempre tutte le funzioni Pro"
- **Prezzo**: scegli il prezzo base (Google calcola le altre valute)
- Stato: **Attivo**

### 5. Tester di licenza (acquisti di prova gratuiti)
Console → **Impostazioni → Test della licenza** → aggiungi la tua email. Con quell'account gli acquisti non addebitano nulla e sono marcati come test.

### 6. Prova
1. Installa dal link di test interno (non dall'APK di debug).
2. Apri **Passa a Pro** → deve comparire il prezzo reale → **Sblocca per sempre**.
3. Chiudi e riapri l'app: Pro deve restare sbloccato.
4. Disinstalla, reinstalla, **Ripristina acquisto**: deve ritrovarlo.

Se compare "Google Play non raggiungibile al momento": controlla di avere internet, di aver fatto l'accesso a Play Store con l'account tester e che l'app sia installata dal link di test (non da APK diretto).

## Limiti da conoscere (onestà)

- **Nessuna verifica lato server.** L'app si fida della risposta di Google Play sul telefono. Per un acquisto singolo di questo tipo è una scelta comune e semplice, ma su un telefono modificato (root) lo sblocco può essere aggirato. Se in futuro serve, si aggiunge un piccolo backend che verifica il `purchaseToken` con la Google Play Developer API.
- **Prezzi, tasse e commissioni** li gestisce Google Play: controlla le condizioni attuali nella Console prima di pubblicare.
- **Acquisti in sospeso** (es. pagamento in contanti in alcuni paesi): il plugin abilita gli acquisti in sospeso; Pro si sblocca solo quando Google segna l'acquisto come completato.
- Dichiara nella scheda "Sicurezza dei dati" e nella norma sulla privacy che l'acquisto è gestito da Google Play (l'app non vede né salva dati di pagamento).
