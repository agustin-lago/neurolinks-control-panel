import React, { useState, useEffect } from 'react';
import ChatsView from './chats/ChatsView';
import MetaOnboardingView from './meta_onboarding/MetaOnboardingView';
import WhatsappSessionsView from './whatsapp_sessions/WhatsappSessionsView';
import AdminsAccountView from './admins_account/AdminsAccountView';
import SettingsView from './settings/SettingsView';
import PlanesView from './planes/PlanesView';

export default function SupabaseView({ navigate }) {
  const [activeTab, setActiveTab] = useState('chats');

  // Recuperar tab activo si se quiere mantener (opcional)
  useEffect(() => {
    const saved = localStorage.getItem('supabaseActiveTab');
    if (saved) setActiveTab(saved);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('supabaseActiveTab', tab);
  };

  return (
    <div className="flex flex-col w-full h-[calc(100dvh-65px)] md:h-[100dvh] overflow-hidden bg-transparent fade-in">
      {/* Pestañas (Tabs) - Solo se renderiza este componente en Desktop */}
      <div className="hidden md:flex items-end justify-center md:justify-start overflow-x-auto whitespace-nowrap flex-nowrap tabs-header-glass px-4 pt-2 gap-2 shrink-0 mt-4 md:mt-0">
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'chats' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('chats')}
        >
          <i className="bi bi-chat-dots"></i> Chats
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'meta_onboarding' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('meta_onboarding')}
        >
          <i className="bi bi-meta"></i> Meta Onboarding
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'whatsapp_sessions' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('whatsapp_sessions')}
        >
          <i className="bi bi-whatsapp"></i> WhatsApp Sessions
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'admins_account' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('admins_account')}
        >
          <i className="bi bi-shield-lock"></i> Admins Account
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'settings' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('settings')}
        >
          <i className="bi bi-sliders"></i> Settings
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'planes' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('planes')}
        >
          <i className="bi bi-tags"></i> Planes
        </button>
      </div>
      
      {/* Contenido de la pestaña activa */}
      <div className="flex-1 overflow-hidden relative flex flex-col p-2 pt-0">
        {activeTab === 'chats' && <ChatsView isTab={true} navigate={navigate} />}
        {activeTab === 'meta_onboarding' && <MetaOnboardingView isTab={true} navigate={navigate} />}
        {activeTab === 'whatsapp_sessions' && <WhatsappSessionsView isTab={true} navigate={navigate} />}
        {activeTab === 'admins_account' && <AdminsAccountView isTab={true} navigate={navigate} />}
        {activeTab === 'settings' && <SettingsView isTab={true} navigate={navigate} />}
        {activeTab === 'planes' && <PlanesView isTab={true} navigate={navigate} />}
      </div>
    </div>
  );
}
