import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProjectsView from './projects/ProjectsView';
import RailwayLogsView from './logs/RailwayLogsView';
import RailwayVariablesView from './variables/RailwayVariablesView';
import RailwayMetricsView from './metrics/RailwayMetricsView';
import RailwayUsageView from './usage/RailwayUsageView';

export default function RailwayView({ navigate }) {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const routeTab = location.pathname.startsWith('/railway/proyectos') ? 'projects' : null;
  const [activeTab, setActiveTab] = useState(routeTab || 'variables');

  useEffect(() => {
    if (routeTab) {
      setActiveTab(routeTab);
      return;
    }
    const saved = localStorage.getItem('railwayActiveTab');
    if (saved) setActiveTab(saved);
  }, [routeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('railwayActiveTab', tab);
    routerNavigate(tab === 'projects' ? '/railway/proyectos' : '/railway');
  };

  return (
    <div className="flex flex-col w-full h-[calc(100dvh-65px)] md:h-[100dvh] overflow-hidden bg-transparent fade-in">
      {/* Pestañas (Tabs) - Solo se renderiza este componente en Desktop */}
      <div className="hidden md:flex items-end justify-center md:justify-start overflow-x-auto whitespace-nowrap flex-nowrap tabs-header-glass px-4 pt-2 gap-2 shrink-0 mt-4 md:mt-0">
        <button
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'projects' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('projects')}
        >
          <i className="bi bi-cpu"></i> Proyectos
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'variables' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('variables')}
        >
          <i className="bi bi-sliders"></i> Variables
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'logs' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('logs')}
        >
          <i className="bi bi-terminal"></i> Logs
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'metrics' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('metrics')}
        >
          <i className="bi bi-graph-up"></i> Métricas
        </button>
        <button 
          className={`py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${activeTab === 'usage' ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'}`}
          onClick={() => handleTabChange('usage')}
        >
          <i className="bi bi-lightning-charge"></i> Uso
        </button>
      </div>
      
      {/* Contenido de la pestaña activa */}
      <div className="flex-1 overflow-hidden relative flex flex-col p-2 pt-0">
        {activeTab === 'projects' && <ProjectsView isTab={true} navigate={navigate} basePath="/railway/proyectos" />}
        {activeTab === 'variables' && <RailwayVariablesView isTab={true} navigate={navigate} />}
        {activeTab === 'logs' && <RailwayLogsView isTab={true} navigate={navigate} />}
        {activeTab === 'metrics' && <RailwayMetricsView isTab={true} />}
        {activeTab === 'usage' && <RailwayUsageView isTab={true} />}
      </div>
    </div>
  );
}
