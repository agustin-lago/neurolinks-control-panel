import React, { useState, useEffect } from 'react';

export default function PWASettings() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if the event is already stashed
    if (window.deferredPrompt) {
      setCanInstall(true);
    }

    const handleInstallAvailable = () => {
      setCanInstall(true);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = window.deferredPrompt;
    if (!promptEvent) {
      return;
    }
    // Show the install prompt
    promptEvent.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice;
    // Optionally, send analytics event with outcome of user choice
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    window.deferredPrompt = null;
    // Hide the install button
    setCanInstall(false);
  };

  return (
    <div className="glass-card p-6 rounded h-full">
      <h4 className="font-bold mb-4 flex items-center gap-2">
        <i className="bi bi-display text-[var(--primary)]"></i> Aplicación de Escritorio (PWA)
      </h4>
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 p-4 bg-[var(--bg-card)] rounded border border-[var(--border-soft)]">
        <div>
          <div className="font-bold mb-1">Instalar aplicación</div>
          <div className="text-sm text-dim">Instalá Neurolinks en tu dispositivo para acceder más rápido y usarla como una aplicación nativa.</div>
        </div>
        <div>
          <button 
            className="btn btn-outline-light text-nowrap flex items-center gap-2" 
            onClick={handleInstallClick}
            disabled={!canInstall}
          >
            <i className="bi bi-download"></i>
            {canInstall ? 'Instalar ahora' : 'No disponible'}
          </button>
        </div>
      </div>
    </div>
  );
}
