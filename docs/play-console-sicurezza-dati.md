# Play Console — aggiornamento per la versione 1.0.77

Nuovi permessi da questa serie di versioni: **posizione** (distributori vicini) e **microfono** (rifornimento a voce).

## 1. Informativa privacy (da fare per prima)

L'app apre l'informativa a questo indirizzo: https://micmax-apps.netlify.app/privacy-diario-auto.html

Sostituisci quella pagina su Netlify con il file aggiornato `public/privacy.html` (aggiornato al 3 novembre 2026). Il file contiene già le parti nuove:
- distributori vicini (dati MIMIT);
- mappa OpenFreeMap;
- ricerca del comune;
- rifornimento a voce;
- permessi Posizione e Microfono.

## 2. Modulo "Sicurezza dei dati"

Percorso: Play Console → Diario Auto → Norme e programmi → Contenuti dell'app → Sicurezza dei dati → Gestisci.

Lascia com'è tutto quello che avevi già dichiarato (email per il backup su Google Drive, acquisti gestiti da Google Play). Cambia solo questo:

### Posizione → NON dichiararla come raccolta
- "Posizione approssimativa" e "Posizione precisa": **non selezionare**.
- Motivo: la posizione si usa solo sul telefono per trovare i distributori vicini e non viene mai inviata fuori dal dispositivo. Per Google è "raccolta" solo se lascia il dispositivo.

### Audio → "Registrazioni vocali o audio": SELEZIONARE (scelta prudente)
Il riconoscimento vocale di Android può elaborare la voce sui server di Google. Per non rischiare un rifiuto in revisione conviene dichiararla così:

| Domanda | Risposta |
|---|---|
| Questi dati vengono raccolti, condivisi o entrambe le cose? | **Raccolti** |
| Questi dati vengono elaborati in modo temporaneo? | **Sì** (la voce diventa testo e l'audio non viene salvato) |
| La raccolta di questi dati è obbligatoria o facoltativa? | **Facoltativa** (gli utenti possono scegliere) |
| Perché vengono raccolti? | **Funzionalità app** |

### Domande generali (restano come prima)
- I dati vengono criptati durante il trasferimento? **Sì** (tutte le connessioni sono HTTPS).
- Gli utenti possono richiedere l'eliminazione dei dati? **Sì**: i dati sono sul telefono e si cancellano dalle impostazioni di Android o disinstallando l'app. I backup su Drive si cancellano da Google Drive.

## 3. Altre cose da controllare al caricamento

- **Permesso posizione**: è in primo piano, non in background, quindi non serve il modulo speciale per la posizione in background.
- **Microfono**: non serve nessuna dichiarazione speciale, basta il modulo Sicurezza dei dati.
- **Note di rilascio** (proposta, max 500 caratteri):

  > Novità: rifornimento a voce (in italiano), distributori vicini con prezzi aggiornati dal Ministero e mappa, rimborso dei viaggi di lavoro con export PDF/CSV, immagini delle auto per tipo di carrozzeria, controlli sugli inserimenti e avviso consumi. Correzioni e miglioramenti.

Testo per la scheda dello Store, se ti serve una riga sulle nuove funzioni:

> Distributori vicini: prezzi dei carburanti di tutta Italia dai dati ufficiali del Ministero (MIMIT), con elenco e mappa.
