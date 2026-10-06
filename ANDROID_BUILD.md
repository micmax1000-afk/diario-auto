# Build Android (Capacitor) — Diario Auto

Guida rapida al flusso di lavoro Capacitor + GitHub Actions impostato per questo progetto.

## Struttura

- `capacitor.config.ts` — configurazione Capacitor (app ID: `com.micmax.diarioauto`)
- `android/` — progetto Gradle nativo generato da Capacitor. **Va committato su Git**, non è generato al volo dalla CI (contiene le personalizzazioni: permessi Bluetooth, icone, firma).
- `.github/workflows/android-build.yml` — build automatica su ogni push a `main`

## Comandi locali (sul PC Ubuntu, con Android SDK installato)

```bash
npm run android:sync     # build web + copia i file in android/
npm run android:debug    # + genera un APK di test non firmato
npm run android:release  # + genera l'AAB (serve il keystore, vedi sotto)
```

L'APK di debug si trova in `android/app/build/outputs/apk/debug/app-debug.apk` — installabile direttamente su un telefono per test (`adb install app-debug.apk`).

## Aggiornare l'app dopo una modifica al codice React

Ogni volta che cambi qualcosa in `src/`, prima di ricompilare l'Android serve rigenerare `dist/` e ricopiarlo:

```bash
npm run android:sync
```

Poi build come sopra.

## Firma per l'AAB (richiesta solo per pubblicare su Play Store)

1. Genera il keystore una volta sola (conservalo per sempre, insieme alla password — se lo perdi non potrai più aggiornare l'app pubblicata):
   ```bash
   keytool -genkey -v -keystore diario-auto-release.keystore -alias diario-auto -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Per buildare in locale, esporta le variabili prima di lanciare `android:release`:
   ```bash
   export RELEASE_KEYSTORE_PATH=/percorso/assoluto/diario-auto-release.keystore
   export KEYSTORE_PASSWORD=...
   export KEY_ALIAS=diario-auto
   export KEY_PASSWORD=...
   npm run android:release
   ```

## GitHub Actions — build automatica

Il workflow builda sempre l'APK di debug. Per far buildare anche l'AAB firmato, aggiungi questi **secrets** nel repo (Settings → Secrets and variables → Actions):

| Secret | Valore |
|---|---|
| `KEYSTORE_BASE64` | `base64 -w0 diario-auto-release.keystore` (il keystore codificato) |
| `KEYSTORE_PASSWORD` | password del keystore |
| `KEY_ALIAS` | `diario-auto` (o l'alias scelto) |
| `KEY_PASSWORD` | password della chiave |

Senza questi secrets, il workflow builda comunque l'APK di debug e salta silenziosamente lo step dell'AAB (nessun errore).

Gli artifact compilati si scaricano dalla pagina della singola esecuzione, in fondo, sotto "Artifacts" — restano disponibili per 90 giorni.

## Prossimo passo: plugin Bluetooth nativo

I permessi Bluetooth sono già dichiarati in `android/app/src/main/AndroidManifest.xml`. Il plugin Kotlin vero e proprio (per superare i limiti di Web Bluetooth, incluso il supporto a Bluetooth Classic/RFCOMM) va in `android/app/src/main/java/com/micmax/diarioauto/` — non ancora scritto.
