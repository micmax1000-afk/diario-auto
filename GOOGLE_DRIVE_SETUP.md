# Backup su Google Drive — configurazione

Il codice è pronto e funzionante, ma per attivarlo davvero serve un passaggio
che solo tu puoi fare (serve il tuo account Google, gratuito).

## Cosa è già pronto nel codice

- `src/services/googleDrive/driveBackup.ts` — autenticazione OAuth, salvataggio, elenco e ripristino backup
- `src/components/BackupPanel.tsx` — due pulsanti "Salva su Drive" / "Ripristina da Drive", entrambi dietro Pro
- L'app vede **solo i file che crea lei stessa** (permesso `drive.file`), mai il resto del tuo Google Drive — il permesso meno invasivo possibile

Finché non completi i passaggi sotto, i pulsanti mostrano "Funzione non ancora attiva su questo dispositivo" invece di rompersi.

## Passaggi da fare tu (10 minuti, gratuito)

### 1. Crea un progetto Google Cloud (o riusa uno esistente)

Vai su [console.cloud.google.com](https://console.cloud.google.com) → crea un nuovo progetto (o riusa lo stesso eventualmente già usato per altri servizi Google).

### 2. Attiva la Google Drive API

`API e servizi → Libreria` → cerca "Google Drive API" → **Attiva**.

### 3. Configura la schermata di consenso OAuth

`API e servizi → Schermata consenso OAuth`:
- Tipo utente: **Esterno**
- Nome app: Diario Auto
- Email di supporto: la tua
- Ambito (scope): aggiungi `.../auth/drive.file`
- Finché l'app è in modalità "Test" o "In verifica", solo gli account email che aggiungi esplicitamente come "utenti di test" potranno autenticarsi — utile per provarlo prima di renderlo pubblico

### 4. Crea le credenziali OAuth

`API e servizi → Credenziali → Crea credenziali → ID client OAuth`:
- Tipo applicazione: **Applicazione web**
- **Origini JavaScript autorizzate**: aggiungi l'URL esatto dove giri l'app, es. `https://diario-auto.mic-max-1000.workers.dev` (senza slash finale). Se poi passi a un dominio personalizzato, dovrai aggiungere anche quello qui.
- Salva, copia il **Client ID** generato (finisce con `.apps.googleusercontent.com`)

### 5. Incolla il Client ID nel codice

Apri `src/services/googleDrive/config.ts` e sostituisci:
```ts
export const GOOGLE_DRIVE_CLIENT_ID = "SOSTITUISCI-CON-IL-TUO-CLIENT-ID.apps.googleusercontent.com";
```
con il tuo Client ID reale. Ricompila e pubblica.

## Nota sulla verifica dell'app Google

Finché l'app OAuth resta in modalità "Test", funziona solo per gli account email che aggiungi tu come tester (fino a 100). Per renderla disponibile a **tutti** gli utenti pubblici, Google richiede una verifica dell'app (può richiedere alcuni giorni, e per lo scope `drive.file` di solito non serve una revisione manuale approfondita essendo uno scope "non sensibile"). I dettagli esatti li vedi dentro la Console quando arrivi a quel punto — cambiano periodicamente da parte di Google.
