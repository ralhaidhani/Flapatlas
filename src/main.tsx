import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { initOfflineRuntime, offlineManager } from './models/offlineManager';
import './index.css';

// Register offline-capable PWA service worker (registerType: 'prompt')
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      offlineManager.notifyNeedRefresh();
    },
    onOfflineReady() {
      offlineManager.notifySwOfflineReady();
    },
    onRegisteredSW(_swUrl, registration) {
      offlineManager.attachServiceWorkerController({
        updateSW,
        registration: registration ?? null,
      });
    },
  });
  offlineManager.attachServiceWorkerController({ updateSW });
}

// Request persistent storage, purge legacy caches, and cache bundled offline pack
if (typeof window !== 'undefined') {
  void initOfflineRuntime();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
