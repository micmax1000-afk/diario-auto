# Diario Auto

PWA per la gestione di manutenzione, consumi e scadenze dei veicoli.

## Funzionalità

**Live (OBD2 Bluetooth)**
- Connessione diretta via Web Bluetooth a un adattatore OBD2 BLE (Vgate iCar Pro BLE, Veepeak OBDCheck BLE e simili), con tentativo di riconnessione automatica al dispositivo già autorizzato
- 15 parametri in tempo reale: giri motore, velocità, temperature, farfalla, livello carburante, carico motore, batteria, portata aria (MAF), pressione collettore/turbo, fuel trim breve/lungo termine, pressione carburante, sonda lambda, anticipo accensione
- Lettura VIN (numero di telaio) dalla centralina
- Codici errore in tre modalità: memorizzati, pending, permanenti — con cancellazione
- Readiness monitor: stato dei controlli emissioni, utile per sapere in anticipo se l'auto passerà la revisione
- Freeze frame: condizioni del motore nel momento in cui è scattato l'ultimo errore
- Lettura PID personalizzati (byte grezzi), per parametri specifici del costruttore non standard
- Grafico live di giri/velocità/temperatura, con sessioni di guida registrabili, salvabili e esportabili in CSV
- Soglie di allarme personalizzabili (giri motore e temperatura massimi), salvate per veicolo
- Protocollo OBD rilevato e salvato per veicolo, per velocizzare le connessioni successive
- Info centralina: nome UCE, ID calibrazione/firmware, protocollo esteso in chiaro
- Codici DTC con descrizione in italiano per i codici generici P0xxx più comuni
- Terminale comandi AT/OBD grezzi, per chi vuole eseguire diagnosi avanzate manualmente
- Test accelerazione 0-100 km/h (stima approssimativa, basata sul campionamento della velocità)
- Richiede Chrome o Edge su Android o desktop — Safari/iOS non supporta Web Bluetooth

**Veicoli**
- Aggiunta, modifica e rimozione veicoli (nome, targa, alimentazione, km, anno, note)
- Aggiornamento rapido del chilometraggio con un tocco sul "timbro" km della card
- Selettore veicolo sempre visibile (quando ne hai più di uno), per passare da un'auto all'altra con un tocco senza tornare all'elenco
- "Segna come venduto" archivia un veicolo mantenendo tutto lo storico, invece di cancellarlo per sempre — ripristinabile in qualsiasi momento dalla sezione "Veicoli venduti"; la cancellazione definitiva resta disponibile da lì

**Rifornimenti**
- Registro rifornimenti con data, km, litri/kWh, costo, alimentazione usata (utile per veicoli bifuel benzina/GPL), pieno/parziale
- Calcolo automatico del consumo medio (km/l) tra pieni consecutivi, separato per alimentazione

**Manutenzioni**
- Registro interventi con categoria, descrizione, costo, officina, note
- Costo scomponibile in ricambi e manodopera separati (si somma automaticamente nel totale)
- Foto allegate (fattura, ricambio, ecc.), compresse automaticamente per non saturare lo spazio del browser
- Totale speso e numero interventi a colpo d'occhio

**Spese** (bollo, assicurazione, multe, documenti)
- Tenute separate dalla manutenzione, come nelle app di riferimento: i costi di officina sono più interessanti da monitorare a parte da bollo/assicurazione/multe
- Foto allegate anche qui (es. bolletta assicurazione, verbale multa)
- Totale per categoria a colpo d'occhio

**Scadenze**
- Catalogo di scadenze comuni (tagliando, gomme, filtri, bollo, revisione...) con intervalli suggeriti precompilati automaticamente in base a data/km attuali — oppure crea una scadenza personalizzata da zero
- Ripetizione automatica: al completamento, scadenze come bollo/assicurazione/revisione/tagliandi si rigenerano da sole con la nuova data o il nuovo chilometraggio
- Promemoria per data o per chilometraggio, stato colorato: OK, in arrivo, scaduta — con badge sulla card del veicolo

**Riepilogo costi**
- Totale carburante, manutenzione, spese, costo/km, filtrabile per periodo (sempre / anno corrente / anno scorso / anni precedenti)
- Grafico mensile carburante vs manutenzione vs spese

**Backup ed esportazione**
- Backup completo in JSON (tutti i veicoli e i dati) con promemoria se non lo fai da tempo
- Ripristino da file di backup
- Esportazione separata di rifornimenti e manutenzioni in CSV, per aprire in Excel/Fogli

**PWA**
- Installabile su telefono e desktop
- Funzionamento offline (service worker con cache degli asset)
- Dati salvati in locale nel browser (localStorage)

## Comandi
```
npm install
npm run dev      # sviluppo locale
npm run build    # build di produzione (cartella dist/)
```

## Pubblicazione su Cloudflare Pages

1. Crea su GitHub un repository pubblico chiamato **diario-auto** (senza inizializzarlo con README), poi da terminale, dentro questa cartella:
   ```
   git init
   git add .
   git commit -m "Diario Auto: rifornimenti, manutenzioni, scadenze, PWA"
   git branch -M main
   git remote add origin https://github.com/TUO-USERNAME/diario-auto.git
   git push -u origin main
   ```
2. Vai su [dash.cloudflare.com](https://dash.cloudflare.com) (account gratuito) → **Workers & Pages → Create → Pages → Connect to Git**
3. Seleziona il repository `diario-auto`. Nelle impostazioni di build:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Save and Deploy** — Cloudflare assegna un URL tipo `https://diario-auto.pages.dev` (variante se il nome è già occupato) e ripubblica automaticamente ad ogni push su `main`

L'app viene pubblicata **alla radice del dominio** (non sotto un sottopercorso come con GitHub Pages), quindi non serve modificare `base` in `vite.config.ts` qualunque nome tu scelga per il repository — resta sempre `/`.

Se in seguito aggiungi un dominio personalizzato: **Cloudflare Pages → il tuo progetto → Custom domains**.

## Possibili sviluppi futuri
- Registrazione automatica di km e livello carburante nei rifornimenti a partire dai dati Live
- Notifiche push per le scadenze (richiede backend, non implementabile con l'attuale architettura statica)
- Sincronizzazione cloud automatica tra dispositivi
- Grafico dedicato al consumo medio nel tempo

## Licenza

© 2026 micmax1000-afk. Tutti i diritti riservati. Il repository è pubblico per trasparenza (in particolare per permettere la verifica indipendente di [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)) e come portfolio, ma **non** è open source: uso, copia, modifica o ridistribuzione non sono consentiti senza permesso scritto. Dettagli completi in [LICENSE](./LICENSE).
