# Backup su Google Drive — guida (app Android nativa)

> Questa guida sostituisce quella precedente, pensata per l'accesso Google dal
> browser (Client ID web e "origini JavaScript autorizzate"). Nell'app Android
> l'accesso passa da un **plugin nativo** e la configurazione è diversa.

## Cosa c'è già nel codice

- `android/app/src/main/java/com/micmax/diarioauto/GoogleDriveAuthPlugin.kt` — accesso con Google Sign-In (libreria `play-services-auth`) e richiesta del permesso `drive.file`
- `src/services/googleDrive/nativeGoogleDriveAuth.ts` — ponte verso il plugin
- `src/services/googleDrive/driveBackup.ts` — salva, elenca e ripristina i backup con le API REST di Drive
- `src/components/BackupPanel.tsx` — pulsanti **Salva su Drive** / **Ripristina da Drive** (dietro Pro)

Il permesso `drive.file` è il più limitato possibile: l'app vede **solo i file che crea lei stessa** (nome `diario-auto-backup-…`), mai il resto del Drive dell'utente.

**Sull'Android non devi scrivere nessun Client ID nel codice.** Google riconosce l'app dal **nome del pacchetto** (`com.micmax.diarioauto`) e dall'**impronta SHA-1** della firma. Il Client ID in `src/services/googleDrive/config.ts` serve solo alla versione nel browser e si può ignorare.

## Cosa devi fare tu

### 1. Progetto Google Cloud
<https://console.cloud.google.com> → crea un progetto (es. "Diario Auto").

### 2. Attiva la Google Drive API
**API e servizi → Libreria → Google Drive API → Abilita.**

### 3. Schermata di consenso OAuth
**API e servizi → Schermata consenso OAuth** (o "Google Auth Platform"):
- Tipo utente: **Esterno**
- Nome app: Diario Auto; email di supporto e contatto: `mic.max.1000@gmail.com`
- Link all'informativa sulla privacy: l'indirizzo pubblico dove pubblichi `public/privacy.html`
- **Ambiti**: aggiungi `.../auth/drive.file`
- Stato di pubblicazione: finché è **"In test"** possono accedere solo gli utenti che aggiungi come *utenti di test* (max 100) e l'accesso scade dopo 7 giorni. Per il pubblico passa a **"In produzione"**. `drive.file` è un ambito non sensibile, quindi di norma non richiede la verifica approfondita di Google, ma controlla i requisiti attuali nella Console.

### 4. Impronte SHA-1 dell'app
Servono due impronte, perché l'app ha due firme diverse:

**a) Build di debug (il tuo APK di prova):**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

**b) App pubblicata da Google Play (firma di Play App Signing):**
Play Console → la tua app → **Configurazione → Integrità dell'app → Firma dell'app** → copia l'**SHA-1 del certificato della chiave di firma dell'app**.
(Anche l'SHA-1 della *chiave di caricamento* può servire se testi AAB firmati da te fuori da Play: aggiungila come terzo client se vedi errori.)

### 5. Crea i client OAuth di tipo Android
**API e servizi → Credenziali → Crea credenziali → ID client OAuth → Tipo di applicazione: Android**, una volta per ogni impronta:

| Nome | Nome pacchetto | SHA-1 |
|---|---|---|
| Diario Auto debug | `com.micmax.diarioauto` | impronta (a) |
| Diario Auto Play | `com.micmax.diarioauto` | impronta (b) |

Non c'è nulla da copiare nel codice: basta che esistano.

### 6. Prova
1. Installa l'app (debug: `adb install -r …app-debug.apk`; oppure dal link di test interno).
2. Impostazioni → **Backup e sincronizzazione** → **Salva su Drive** → scegli l'account Google e consenti l'accesso a Drive.
3. Controlla su <https://drive.google.com> che compaia il file `diario-auto-backup-…`.
4. **Ripristina da Drive** deve elencare quel file.

## Errori comuni

| Sintomo | Causa probabile |
|---|---|
| Errore di accesso subito, "DEVELOPER_ERROR" / codice 10 | Nome pacchetto o SHA-1 non corrispondono a un client Android: controlla di aver creato il client per la firma che stai usando (debug o Play) |
| "Accesso bloccato / app non verificata" | La schermata di consenso è "In test" e il tuo account non è tra gli utenti di test |
| Funziona da debug ma non da Play | Manca il client con l'SHA-1 di Play App Signing (punto 4b) |
| Dopo 7 giorni non accede più | Consenso ancora "In test": passa a "In produzione" |
| Si apre la schermata Premium | Il backup su Drive è una funzione Pro: serve lo sblocco |

## Privacy

L'informativa (`public/privacy.html`) spiega già che il backup su Drive è facoltativo, avviene solo su richiesta dell'utente e usa solo il permesso `drive.file`. Dichiara lo stesso nella scheda **Sicurezza dei dati** di Play Console e nella schermata di consenso OAuth.
