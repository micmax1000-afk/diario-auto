#!/usr/bin/env bash
# Esegue ./gradlew con i compiti indicati e, se fallisce per un errore di RETE
# (per esempio GitHub che risponde 504 sul download di una libreria), riprova.
# Un errore vero del codice non viene ripetuto: la build si ferma subito.
# Uso, da dentro la cartella android: bash ../.github/scripts/gradle-retry.sh assembleDebug
LOG="$(mktemp)"
for attempt in 1 2 3 4 5 6; do
  ./gradlew "$@" 2>&1 | tee "$LOG"
  status=${PIPESTATUS[0]}
  [ "$status" -eq 0 ] && exit 0
  if ! grep -qE "Received status code 5[0-9][0-9]|Gateway Time-out|Could not (download|GET|get resource)|Read timed out|Connection (reset|timed out)|Premature end of Content-Length" "$LOG"; then
    echo "Errore che non dipende dalla rete: non riprovo."
    exit "$status"
  fi
  echo "Errore di rete (tentativo $attempt di 6), riprovo tra 45 secondi"
  sleep "${GRADLE_RETRY_SLEEP:-45}"
done
exit 1
