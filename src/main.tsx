import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Carattere incluso nell'app (niente richieste a Google Fonts), così funziona offline.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import './index.css'
import './modern.css'
import { applyStoredAppearance } from './utils/theme'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { initI18n } from './i18n'

applyStoredAppearance()

async function bootstrap() {
  // Carica in parallelo la lingua che serve davvero e il codice dell'app,
  // invece di includere tutte le traduzioni di tutte le lingue nel bundle
  // iniziale e di aspettare in sequenza.
  const [, { default: App }] = await Promise.all([initI18n(), import('./App.tsx')])

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </StrictMode>,
  )
}

bootstrap()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // registrazione fallita: l'app funziona comunque online
    })
  })
}
