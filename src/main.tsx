import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Configura la PWA para recargar la página agresivamente cuando
// detecte una nueva versión descargada e instalada en segundo plano
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Nueva versión detectada. Recargando automáticamente...');
    window.location.reload();
  },
  onOfflineReady() {
    console.log('Aplicación cacheada y lista para uso offline.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
