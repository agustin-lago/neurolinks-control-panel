import React, { useState, useEffect } from 'react';
import AuditView from '../audit/AuditView';
import LogsView from '../logs/LogsView';

export default function ActivityView({ navigate }) {
  const [activeTab, setActiveTab] = useState('audit');

  // Recuperar tab activo si se quiere mantener (opcional)
  useEffect(() => {
    const saved = localStorage.getItem('activityActiveTab');
    if (saved) setActiveTab(saved);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('activityActiveTab', tab);
  };

  return (
    <div className="flex flex-col w-full h-[calc(100dvh-65px)] md:h-[100dvh] overflow-hidden bg-transparent fade-in">
      {/* Pestañas (Tabs) */}
      <div className="hidden md:flex items-end justify-center md:justify-start overflow-x-auto whitespace-nowrap flex-nowrap tabs-header-glass px-4 pt-2 gap-2 shrink-0 mt-4 md:mt-0">
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'audit' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('audit')}
        >
          <i className="bi bi-shield-check"></i> Auditoría
        </button>

        <span className="text-[var(--text-dim)] opacity-50 mb-3 font-light shrink-0">|</span>

        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'logs' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('logs')}
        >
          <i className="bi bi-terminal"></i> Logs del Sistema
        </button>
      </div>
      
      {/* Contenido de la pestaña activa */}
      <div className="flex-1 overflow-hidden relative flex flex-col p-2 pt-0">
        {activeTab === 'audit' && <AuditView isTab={true} navigate={navigate} />}
        {activeTab === 'logs' && <LogsView isTab={true} navigate={navigate} />}
      </div>
    </div>
  );
}
