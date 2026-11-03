# Informativa sulla privacy — Diario Auto

**Ultimo aggiornamento**: 3 novembre 2026

## Il principio di fondo

Diario Auto è un'app **locale**: tutti i dati che inserisci (veicoli, rifornimenti, manutenzioni, spese, scadenze, sessioni diagnostiche) restano **sul tuo dispositivo**, nella memoria interna riservata all'app. Non esiste un account dello sviluppatore e non esiste un server dello sviluppatore che riceve o conserva i tuoi dati.

## Dati che NON raccogliamo

- Non creiamo un account utente nostro e non chiediamo email, nome o dati anagrafici per usare l'app
- Non tracciamo il tuo utilizzo dell'app (nessun analytics, nessun pixel di tracciamento)
- Non mostriamo pubblicità e non condividiamo dati con inserzionisti
- Non trasmettiamo a nessun server nostro i dati che inserisci su veicoli, rifornimenti, manutenzioni, spese o scadenze

## Dati che restano solo sul tuo dispositivo

- Veicoli, rifornimenti, ricariche elettriche, manutenzioni, spese, scadenze, sessioni di diagnostica OBD2, impostazioni e scenari del tragitto
- Foto allegate ai veicoli, alle manutenzioni e alle spese
- Preferenze (lingua, valuta, unità di misura, tema chiaro/scuro, notifiche, backup automatico)

Puoi cancellare tutto in qualsiasi momento cancellando i dati dell'app dalle impostazioni del tuo dispositivo, oppure disinstallando l'app.

## Backup

L'app include un backup manuale: il file che generi lo salvi dove vuoi e resta sotto il tuo controllo, non viene inviato a noi. Puoi anche salvare una copia sul tuo Google Drive (vedi sotto).

**Backup automatico settimanale**: dopo che hai fatto almeno un backup manuale su Google Drive, l'app carica da sola una nuova copia sul tuo Drive circa una volta a settimana, quando la apri e sei connesso. Usa lo stesso accesso Google che hai già autorizzato, senza chiederti nulla. Aggiunge un file su Drive e non modifica mai i dati sul telefono. Se i dati sul telefono risultano molto meno dell'ultimo backup (per esempio dopo una cancellazione accidentale), il backup automatico si ferma per non sostituire i backup buoni. Puoi disattivarlo in qualsiasi momento dalla sezione Backup dell'app.

## Servizi esterni contattati durante l'uso

Alcune funzionalità dell'app contattano servizi di terze parti. Questi servizi ricevono solo le informazioni strettamente necessarie alla funzione richiesta, non il resto dei tuoi dati:

| Funzione                                                                          | Servizio contattato                        | Cosa viene inviato                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
|-----------------------------------------------------------------------------------|--------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Ricerca indirizzi (tragitto casa-lavoro)                                          | Nominatim (nominatim.openstreetmap.org)    | Testo dell'indirizzo cercato                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Calcolo percorso tragitto casa-lavoro                                             | OSRM (router.project-osrm.org)             | Coordinate di partenza e destinazione                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Distributori vicini (prezzi dei carburanti, solo in Italia) | Ministero delle Imprese e del Made in Italy — MIMIT (www.mimit.gov.it) | Nessun dato personale: l'app scarica l'elenco pubblico dei distributori e dei prezzi (dati aperti, licenza IODL 2.0). La tua posizione **non viene inviata**: la ricerca dei distributori vicini avviene sul telefono. |
| Ricerca del comune per i distributori (se non usi il GPS) | Nominatim (nominatim.openstreetmap.org) | Testo del comune cercato |
| Mappa dei distributori | OpenFreeMap (tiles.openfreemap.org), dati OpenStreetMap | Le richieste delle porzioni di mappa della zona che stai guardando, come per qualsiasi mappa online |
| Rifornimento a voce (solo con l'app in italiano) | Servizio di riconoscimento vocale di Android (di solito Google) | La tua voce, solo mentre il microfono è attivo: il servizio vocale del telefono la trasforma in testo e può elaborarla sui server di Google secondo la [Privacy Policy di Google](https://policies.google.com/privacy). Diario Auto riceve solo il testo, non registra e non salva l'audio. |
| Backup su Google Drive, manuale o automatico (funzione opzionale, da attivare tu) | Google (accesso Google + Google Drive API) | Il tuo indirizzo email Google, usato solo per identificare l'accesso, e il contenuto del backup. L'app può vedere e gestire **solo i file che crea lei stessa** su Drive (permesso "drive.file"), mai il resto del tuo Drive. Dopo ogni salvataggio l'app tiene gli ultimi 5 backup (manuali e automatici insieme) e sposta i più vecchi nel cestino di Drive, da cui puoi recuperarli per 30 giorni. I dati vanno direttamente dal tuo dispositivo a Google: lo sviluppatore non li riceve. Gestito secondo la [Privacy Policy di Google](https://policies.google.com/privacy). |

Le funzioni base dell'app (registro rifornimenti, manutenzioni, scadenze, spese) funzionano anche senza connessione.

L'uso e il trasferimento delle informazioni ricevute dalle API di Google rispetta la [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), inclusi i requisiti di Limited Use. I dati ricevuti da Google servono solo a salvare e ripristinare il tuo backup: non vengono usati per pubblicità né condivisi con terzi.

## Permessi del dispositivo richiesti

- **Internet**: per i servizi esterni elencati sopra.
- **Posizione**: solo quando apri "Distributori vicini" e solo mentre la pagina è aperta, per trovare i distributori intorno a te. La posizione non viene inviata a nessuno: l'ultima usata resta solo sul telefono per non riscaricare i dati a ogni apertura. Puoi rifiutare e scrivere il comune a mano.
- **Microfono**: solo quando tocchi il pulsante del rifornimento a voce, per dettare importo, prezzo e chilometri. Puoi rifiutare e inserire i dati a mano.
- **Bluetooth**: solo se usi la diagnostica OBD2, per collegarti al tuo adattatore Bluetooth. I dati letti dall'auto restano sul dispositivo.
- **Notifiche**: per gli avvisi delle scadenze (30 giorni prima, 7 giorni prima e il giorno stesso). Quando hai delle scadenze l'app chiede il permesso ad Android; puoi rifiutare, oppure disattivarle quando vuoi dalle impostazioni dell'app o di Android. Gli avvisi sono generati e mostrati interamente sul tuo dispositivo.
- **Foto**: solo se alleghi una foto a un veicolo, a una manutenzione o a una spesa — l'immagine resta salvata localmente (compressa), non viene caricata da nessuna parte.
- **Accesso Google**: richiesto solo se scegli di attivare il backup su Google Drive. Puoi revocare l'accesso in qualsiasi momento dalla pagina [Accesso Google di terze parti](https://myaccount.google.com/permissions) del tuo account Google; da quel momento anche il backup automatico si ferma.

## Cancellazione dei dati

- **Dati sul dispositivo**: cancella i dati dell'app dalle impostazioni di Android, oppure disinstalla l'app.
- **Backup su Google Drive**: sono file tuoi; puoi eliminarli in qualsiasi momento da Google Drive. Disinstallare l'app non li cancella.

## Minori

Diario Auto non è rivolta specificamente ai minori e non raccoglie consapevolmente dati di minori di 16 anni. L'unico dato personale che l'app può arrivare a trattare (l'email Google) viene richiesto solo se l'utente sceglie volontariamente di attivare il backup su Drive.

## Modifiche a questa informativa

Se in futuro Diario Auto introdurrà funzionalità che richiedono un account o una sincronizzazione cloud, questa informativa sarà aggiornata **prima** dell'attivazione di quelle funzionalità, con indicazione chiara di cosa cambia.

## Contatti

Per domande su questa informativa: <mic.max.1000@gmail.com>

---

# Privacy Policy — Diario Auto

**Last updated**: November 3, 2026

## The basic principle

Diario Auto is a **local** app: all the data you enter (vehicles, refuels, maintenance, expenses, deadlines, diagnostic sessions) stays **on your device**, in the app's private internal storage. There is no developer account and no developer server that receives or stores your data.

## Data we do NOT collect

- We do not create a user account and do not ask for your email, name or personal details to use the app
- We do not track how you use the app (no analytics, no tracking pixels)
- We do not show ads and do not share data with advertisers
- We do not send the data you enter about vehicles, refuels, maintenance, expenses or deadlines to any server of ours

## Data that stays only on your device

- Vehicles, refuels, electric charges, maintenance, expenses, deadlines, OBD2 diagnostic sessions, commute settings and scenarios
- Photos attached to vehicles, maintenance and expenses
- Preferences (language, currency, units, light/dark theme, notifications, automatic backup)

You can delete everything at any time by clearing the app's data in your device settings, or by uninstalling the app.

## Backup

The app includes a manual backup: you save the file wherever you want and it stays under your control; it is never sent to us. You can also save a copy to your Google Drive (see below).

**Weekly automatic backup**: after you have made at least one manual backup to Google Drive, the app uploads a new copy to your Drive by itself about once a week, when you open it and are online. It uses the Google access you have already authorized, without asking you anything. It adds a file on Drive and never changes the data on your phone. If the data on your phone is much less than in the last backup (for example after an accidental deletion), the automatic backup stops so that it does not replace your good backups. You can turn it off at any time in the app's Backup section.

## External services contacted during use

Some features of the app contact third-party services. These services only receive the information strictly needed for the requested feature, not the rest of your data:

| Feature                                                                     | Service contacted                          | What is sent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|-----------------------------------------------------------------------------|--------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Address search (home-to-work commute)                                       | Nominatim (nominatim.openstreetmap.org)    | The text of the address you search for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Commute route calculation                                                   | OSRM (router.project-osrm.org)             | Start and destination coordinates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Nearby fuel stations (fuel prices, Italy only) | Italian Ministry of Enterprises and Made in Italy — MIMIT (www.mimit.gov.it) | No personal data: the app downloads the public list of stations and prices (open data, IODL 2.0 licence). Your location is **not sent**: nearby stations are worked out on the phone. |
| Town search for fuel stations (if you don't use GPS) | Nominatim (nominatim.openstreetmap.org) | The text of the town you search for |
| Fuel station map | OpenFreeMap (tiles.openfreemap.org), OpenStreetMap data | Requests for the map tiles of the area you are viewing, as with any online map |
| Voice refuel entry (only with the app in Italian) | Android speech recognition service (usually Google) | Your voice, only while the microphone is on: the phone's speech service turns it into text and may process it on Google's servers according to [Google's Privacy Policy](https://policies.google.com/privacy). Diario Auto only receives the text; it does not record or store the audio. |
| Google Drive backup, manual or automatic (optional feature, you turn it on) | Google (Google sign-in + Google Drive API) | Your Google email address, used only to identify the sign-in, and the content of the backup. The app can see and manage **only the files it creates itself** on Drive ("drive.file" permission), never the rest of your Drive. After each save the app keeps the last 5 backups (manual and automatic together) and moves older ones to the Drive trash, where you can recover them for 30 days. Data goes directly from your device to Google: the developer does not receive it. Handled according to [Google's Privacy Policy](https://policies.google.com/privacy). |

The app's basic features (refuel log, maintenance, deadlines, expenses) also work offline.

The use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Data received from Google is used only to save and restore your backup: it is not used for advertising and not shared with third parties.

## Device permissions requested

- **Internet**: for the external services listed above.
- **Location**: only when you open "Nearby fuel stations" and only while that page is open, to find the stations around you. Your location is not sent to anyone: the last one used stays only on the phone so the data is not downloaded again every time. You can refuse and type the town instead.
- **Microphone**: only when you tap the voice refuel button, to dictate amount, price and kilometres. You can refuse and enter the data by hand.
- **Bluetooth**: only if you use OBD2 diagnostics, to connect to your Bluetooth adapter. Data read from the car stays on the device.
- **Notifications**: for deadline reminders (30 days before, 7 days before and on the day). When you have deadlines the app asks Android for permission; you can refuse, or turn them off at any time in the app or Android settings. Reminders are created and shown entirely on your device.
- **Photos**: only if you attach a photo to a vehicle, maintenance or expense — the image is stored locally (compressed) and is not uploaded anywhere.
- **Google sign-in**: required only if you choose to turn on Google Drive backup. You can revoke access at any time from the [Third-party access](https://myaccount.google.com/permissions) page of your Google account; from then on the automatic backup stops too.

## Deleting your data

- **Data on the device**: clear the app's data in Android settings, or uninstall the app.
- **Backups on Google Drive**: they are your files; you can delete them at any time from Google Drive. Uninstalling the app does not delete them.

## Children

Diario Auto is not specifically aimed at children and does not knowingly collect data from children under 16. The only personal data the app may handle (your Google email) is requested only if the user voluntarily chooses to turn on Drive backup.

## Changes to this policy

If Diario Auto introduces features that require an account or cloud sync in the future, this policy will be updated **before** those features are turned on, clearly stating what changes.

## Contact

For questions about this policy: <mic.max.1000@gmail.com>
