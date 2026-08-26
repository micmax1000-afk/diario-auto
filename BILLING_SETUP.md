# Diario Auto → App Android (TWA) + Google Play Billing

Questa guida copre esattamente i due pezzi richiesti:
1. Wrapper Digital Goods API (frontend) — **fatto, nel codice**
2. Scaffolding Bubblewrap + `assetlinks.json` — **preparato, ma richiede alcuni passaggi tuoi**

---

## 1. Cosa è già pronto nel codice

- `src/services/billing/digitalGoodsTypes.ts` — dichiarazioni TypeScript per la Digital Goods API (non è nei tipi standard del browser)
- `src/services/billing/digitalGoods.ts` — wrapper con:
  - `isDigitalGoodsAvailable()` — rileva se sei dentro una TWA con Play Billing
  - `listAvailableProducts()` — recupera prezzo/periodo dei piani abbonamento
  - `purchaseSubscription(productId)` — avvia l'acquisto via `PaymentRequest`
  - `listActivePurchases()` — per verificare l'entitlement all'avvio dell'app
- `src/services/billing/usePremiumPurchase.ts` — hook React che espone tutto questo
- `src/components/PremiumScreen.tsx` — UI che mostra:
  - "Verifica disponibilità…" mentre controlla
  - **"Disponibile solo dall'app Android"** se apri l'app nel browser normale (mai un bottone rotto)
  - I piani con prezzo reale e pulsante "Abbonati" se sei dentro la TWA

Questo pezzo **compila, non si rompe fuori dalla TWA**, ma il pulsante "Abbonati" funzionerà solo dopo aver completato i passaggi 2-5 qui sotto — prima non ci sono prodotti da vendere.

**Cosa manca ancora, onestamente**: il backend che verifica il `purchaseToken` (passaggio 6). Senza quello, un acquisto tecnicamente riesce lato Google ma l'app non può sapere in modo sicuro se sbloccare Premium — per questo `PremiumScreen` non attiva nulla da sola, si limita a passare il token a un callback (`onPurchaseToken`) che oggi non è ancora collegato a niente.

---

## 2. Cosa devi fare tu — nell'ordine

### 2.1 Metti assetlinks.json nella radice del progetto — nessun repository separato necessario

A differenza di GitHub Pages, **Cloudflare Pages pubblica il progetto alla radice del dominio** (`tuo-progetto.pages.dev/`, non sotto un sottopercorso). Questo significa che non serve più il repository separato che avremmo dovuto creare per GitHub Pages: basta che `.well-known/assetlinks.json` sia dentro la cartella pubblicata dal progetto `diario-auto` stesso.

```
1. Copia twa-assets/assetlinks.json → public/.well-known/assetlinks.json (dentro questo stesso progetto)
2. Fai commit e push: Cloudflare Pages ripubblica automaticamente
```

Il contenuto del file (in `twa-assets/assetlinks.json` in questo progetto) ha un placeholder per l'impronta SHA256 — la trovi al passaggio 2.3.

### 2.2 Installa Bubblewrap

Sul tuo computer (serve Node.js e JDK 17+):

```bash
npm i -g @bubblewrap/cli
bubblewrap doctor   # verifica che Android SDK/JDK siano ok, li scarica se mancano
```

### 2.3 Genera il progetto Android

Dalla cartella di questo progetto (dove c'è `twa-manifest.json`):

```bash
bubblewrap init --manifest=./twa-manifest.json
```

Ti chiederà di creare (o riusare) un keystore per firmare l'app. Alla fine del processo, Bubblewrap stampa l'**impronta SHA256** del certificato — copiala subito, ti serve al passaggio 2.4.

Se in seguito attivi **Play App Signing** (consigliato, è lo standard oggi — Google gestisce la chiave di firma finale), l'impronta SHA256 corretta la trovi invece in:
`Play Console → il tuo'app → Configurazione → Integrità dell'app → Firma dell'app`

Usa quella impronta, non quella del tuo keystore locale, se hai attivato Play App Signing.

### 2.4 Completa assetlinks.json

In questo stesso progetto, dentro `public/.well-known/assetlinks.json`, sostituisci `PLACEHOLDER_SOSTITUISCI_CON_LA_TUA_IMPRONTA_SHA256` con l'impronta reale (formato `AA:BB:CC:...`, con i due punti). Fai commit e push — Cloudflare Pages ripubblica automaticamente in pochi secondi.

Verifica che sia raggiungibile (sostituisci con il tuo URL Cloudflare reale):
```bash
curl https://diario-auto.mic-max-1000.workers.dev/.well-known/assetlinks.json
```

### 2.5 Crea il prodotto in-app (acquisto singolo, non abbonamento)

`Play Console → la tua app → Monetizzazione → Prodotti in-app` (**non** "Prodotti in abbonamento" — Diario Auto Pro è uno sblocco a vita, un solo pagamento)

Crea un prodotto gestito con ID **esattamente uguale** a quello nel codice:
- `diario_auto_pro_lifetime` (vedi `src/services/billing/digitalGoods.ts`, oggetto `PRODUCT_IDS`)

Imposta il prezzo (es. €4,99). Se cambi l'ID in Play Console, aggiornalo anche nel codice (o viceversa) — devono coincidere esattamente.

**Prezzo di lancio**: nella stessa schermata del prodotto, Play Console permette di impostare uno **sconto promozionale** con data di inizio/fine — usalo per il classico "prezzo di lancio per le prime settimane" senza bisogno di codice.

**Fase 1 — nessuna verifica server-side**: dato che questo è un acquisto singolo senza servizi ricorrenti a tuo carico, l'app verifica l'acquisto direttamente interrogando Google Play (`isProUnlocked()` in `digitalGoods.ts`), senza bisogno di un backend. È una scelta pragmatica adatta a questa fase — se in futuro aggiungi funzioni con costi ricorrenti (cloud, AI), quelle richiederanno invece la verifica server-side descritta più sotto.

### 2.6 Costruisci e carica l'AAB

```bash
bubblewrap build
```

Genera un file `.aab` firmato, da caricare in Play Console (traccia interna/chiusa per i primi test, poi produzione).

---

## 3. Fase 1 è autosufficiente — nessun backend richiesto

Con acquisto singolo verificato direttamente via Google Play (`isProUnlocked()`), **la Fase 1 non ha bisogno di nessun server tuo**: zero costi di infrastruttura, coerente con l'obiettivo di questa fase.

Il limite onesto di questo approccio: un utente molto motivato a non pagare potrebbe, in teoria, manomettere l'app per bypassare il controllo `isProUnlocked()` (è comunque codice client-side). Non è un rischio nullo, ma è lo stesso compromesso che quasi tutte le app "unlock a vita" senza backend accettano — il costo di costruire un server di verifica solo per questo non si giustifica finché non hai anche altre funzioni che *devono* passare da un server.

## 4. Quando aggiungerai funzioni con costi ricorrenti (Fase 2 — cloud/AI)

A quel punto, e solo a quel punto, servirà:
1. Un service account Google Cloud collegato al progetto Play Console (lo generi tu da Google Cloud Console → IAM)
2. Un endpoint backend che chiama la Google Play Developer API per verificare gli acquisti prima di sbloccare le funzioni cloud/AI
3. Un sistema di autenticazione utente (oggi non esiste: l'app è completamente locale)

Non costruirlo ora — sarebbe codice che non potresti testare senza le funzioni che dipendono da esso.
