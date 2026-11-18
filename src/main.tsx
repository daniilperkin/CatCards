import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { I18nProvider } from './lib/i18n';
import { ThemeProvider } from './lib/theme';
import './index.css';

registerSW({ immediate: true });

// Ask the browser not to evict our IndexedDB data (photos) under storage pressure.
navigator.storage?.persist?.().catch(() => {});

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
