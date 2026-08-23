import React from 'react';
import NotificationSettings from './components/NotificationSettings';
import PWASettings from './components/PWASettings';
import ThemeSettings from './components/ThemeSettings';

export default function SettingsView({ navigate, theme, toggleTheme }) {
  return (
    <div className="anim-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Configuración</h2>
          <div className="text-dim">Preferencias del sistema y perfil de usuario</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Columna Izquierda */}
        <div className="flex flex-col gap-6">
          <ThemeSettings theme={theme} toggleTheme={toggleTheme} />
          <PWASettings />
        </div>
        {/* Columna Derecha */}
        <div className="flex flex-col gap-6">
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}
