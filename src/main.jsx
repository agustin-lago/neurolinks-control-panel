import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

import { NotificationProvider } from './contexts/NotificationContext';
import { SmartRefreshProvider } from './contexts/SmartRefreshContext';

// Import CSS
import '../public/assets/css/styles.css';

import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <SmartRefreshProvider>
          <App />
        </SmartRefreshProvider>
      </NotificationProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('SW registration failed: ', err);
    });
  });
}

// Capture the install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  window.deferredPrompt = e;
  // Dispatch a custom event for React components to listen to
  window.dispatchEvent(new Event('pwa-install-available'));
});
