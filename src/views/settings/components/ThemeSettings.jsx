import React from 'react';

export default function ThemeSettings({ theme, toggleTheme }) {
  return (
    <div className="glass-card p-0 rounded overflow-hidden h-fit">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-soft)] bg-black/10 flex items-center gap-3">
        <i className="bi bi-palette text-xl text-[var(--primary)]"></i>
        <h4 className="font-bold m-0 text-lg">Apariencia</h4>
      </div>
      
      <div className="p-2">
        <div className="text-xs font-bold uppercase tracking-wider text-dim px-4 py-3">Tema</div>
        
        {/* Item 1 */}
        <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-card)] transition-colors rounded">
          <div>
            <div className="font-medium text-[0.95rem] mb-0.5 text-main">Modo {theme === 'light' ? 'Claro' : 'Oscuro'}</div>
            <div className="text-sm text-dim">
              Alternar entre el modo claro y oscuro para la interfaz.
            </div>
          </div>
          <label className="sysconfig-toggle">
            <input
              type="checkbox"
              className="btn-ca-sysconfig"
              checked={theme === 'dark'}
              onChange={toggleTheme}
            />
            <span className="sysconfig-thumb">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-off"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-on"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
