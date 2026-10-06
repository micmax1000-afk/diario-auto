import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTheme, getInitialTheme } from './utils/theme'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { initI18n } from './i18n'

applyTheme(getInitialTheme())

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
