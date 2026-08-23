import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';

export default function RailwayUsageView({ isTab = false }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('rlUsageProjectId') || null);
  const [projectSearch, setProjectSearch] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const [usageData, setUsageData] = useState(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const refreshIntervalRef = useRef(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const allProjects = await api.getAssistants();
      setProjects(allProjects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      sessionStorage.setItem('rlUsageProjectId', selectedProjectId);
      loadUsage(selectedProjectId);
    } else {
      sessionStorage.removeItem('rlUsageProjectId');
      setUsageData(null);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      refreshIntervalRef.current = setInterval(() => {
        loadUsage(selectedProjectId, true);
      }, 30000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [selectedProjectId]);

  const loadUsage = async (projectId, isBackground = false) => {
    if (!isBackground) setIsLoadingUsage(true);
    try {
      const startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const project = projects.find(p => p.id === projectId);
      const rawUsage = await api.getProjectUsage(projectId, startDate.toISOString(), new Date().toISOString(), project?.railwayWorkspaceKey);
      
      const usageMap = {};
      (rawUsage || []).forEach(item => {
        usageMap[item.measurement] = item.value;
      });

      setUsageData(usageMap);
    } catch (err) {
      console.error('Error fetching usage:', err);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const formatVal = (val, suffix = '') => {
    if (val === undefined || val === null) return '0.00' + suffix;
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
  };

  return (
    <div className={isTab ? 'flex flex-row w-full h-full pt-4 gap-4 pr-1 overflow-hidden' : 'flex flex-row w-full h-[calc(100vh-100px)] gap-4 overflow-hidden'}>
      
      {/* LEFT COLUMN: PROJECTS */}
      <div className="w-1/3 max-w-[300px] flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar shrink-0 hidden md:flex">
        <div className="flex justify-between items-center mb-2 shrink-0">
          <h6 className="text-dim text-sm font-bold m-0">PROYECTOS</h6>
        </div>
        
        <div className="input-group input-group-sm search-input-group mb-2 shrink-0">
          <span className="input-group-text text-dim">
            <i className="bi bi-search"></i>
          </span>
          <input
            type="text"
            className="form-control text-main"
            placeholder="Buscar proyecto..."
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
          />
        </div>

        {isLoadingProjects ? (
          <div className="flex flex-col gap-2 p-2 w-full">
            <Skeleton variant="card" className="h-14 w-full" />
            <Skeleton variant="card" className="h-14 w-full" />
            <Skeleton variant="card" className="h-14 w-full" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-dim text-sm p-2">No hay proyectos.</div>
        ) : (
          projects
            .filter(p => (p.name || '').toLowerCase().includes(projectSearch.toLowerCase()) || (p.id || '').toLowerCase().includes(projectSearch.toLowerCase()))
            .map(p => (
            <div 
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={`glass-card p-3 rounded cursor-pointer transition-colors border flex flex-col mb-2 ${selectedProjectId === p.id ? '' : 'border-[var(--border-light)] hover:bg-[var(--bg-glass)]'}`}
              style={selectedProjectId === p.id ? {
                borderColor: 'var(--color-accent, #0078D4)',
                backgroundColor: 'rgba(0, 120, 212, 0.2)',
                boxShadow: '0 0 15px rgba(0, 120, 212, 0.4)'
              } : {}}
            >
              <div className={`font-bold text-sm w-full flex items-center gap-2 truncate ${selectedProjectId === p.id ? 'text-[var(--accent)]' : 'text-main'}`}>
                <i className="bi bi-train-front text-[var(--accent)]"></i>
                {p.name}
              </div>
            </div>
          ))
        )}
      </div>

      {/* RIGHT COLUMN: USAGE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedProjectId ? (
          <div className="glass-card flex-1 flex items-center justify-center text-dim text-center">
            <div>
              <i className="bi bi-lightning-charge text-4xl mb-3 opacity-50 block"></i>
              Selecciona un proyecto a la izquierda para ver su consumo.
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* HEADER */}
            <div className="flex flex-col mb-4 shrink-0 px-2 gap-1">
              <h3 className="font-bold text-main text-xl m-0 flex items-center gap-2 truncate">
                <i className="bi bi-lightning-charge text-[var(--accent)]"></i> 
                Consumo del Proyecto
              </h3>
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-dim flex items-center gap-2 truncate">
                  {selectedProject?.name}
                  <span className="bg-black/20 text-xs px-2 py-0.5 rounded border border-[var(--border-light)]">Mes Actual</span>
                </div>
                <div className="text-xs text-dim flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Actualizando en tiempo real
                </div>
              </div>
            </div>

            {/* CONTENT */}
            <div className="overflow-y-auto w-full flex-1 custom-scrollbar pr-2 pb-4">
              {isLoadingUsage && !usageData ? (
                <div className="flex justify-center py-8">
                  <div className="spinner-border text-accent spinner-border-sm" role="status"></div>
                </div>
              ) : !usageData || Object.keys(usageData).length === 0 ? (
                <div className="glass-card p-8 text-center text-dim rounded-xl border border-[var(--border-light)]">
                  No hay datos de consumo para este mes.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                  
                  {/* CPU Usage */}
                  <div className="glass-card rounded-xl border border-[var(--border-light)] p-5 flex items-center gap-4 transition-all hover:border-white/20 hover:bg-white/5">
                    <div className="w-14 h-14 rounded-full bg-blue-500/10 text-[#3b82f6] flex items-center justify-center text-3xl shrink-0">
                      <i className="bi bi-cpu"></i>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">CPU (vCPU Mins)</span>
                      <span className="text-2xl font-bold text-main font-mono">
                        {formatVal(usageData['CPU_USAGE'] || usageData['CPU_USAGE_2'])}
                      </span>
                    </div>
                  </div>

                  {/* RAM Usage */}
                  <div className="glass-card rounded-xl border border-[var(--border-light)] p-5 flex items-center gap-4 transition-all hover:border-white/20 hover:bg-white/5">
                    <div className="w-14 h-14 rounded-full bg-purple-500/10 text-[#a855f7] flex items-center justify-center text-3xl shrink-0">
                      <i className="bi bi-memory"></i>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Memoria (GB Mins)</span>
                      <span className="text-2xl font-bold text-main font-mono">
                        {formatVal(usageData['MEMORY_USAGE_GB'])}
                      </span>
                    </div>
                  </div>

                  {/* Network Out */}
                  <div className="glass-card rounded-xl border border-[var(--border-light)] p-5 flex items-center gap-4 transition-all hover:border-white/20 hover:bg-white/5">
                    <div className="w-14 h-14 rounded-full bg-amber-500/10 text-[#f59e0b] flex items-center justify-center text-3xl shrink-0">
                      <i className="bi bi-cloud-arrow-up"></i>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Tráfico de Salida (TX)</span>
                      <span className="text-2xl font-bold text-main font-mono">
                        {formatVal(usageData['NETWORK_TX_GB'], ' GB')}
                      </span>
                    </div>
                  </div>

                  {/* Network In */}
                  <div className="glass-card rounded-xl border border-[var(--border-light)] p-5 flex items-center gap-4 transition-all hover:border-white/20 hover:bg-white/5">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-[#10b981] flex items-center justify-center text-3xl shrink-0">
                      <i className="bi bi-cloud-arrow-down"></i>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Tráfico de Entrada (RX)</span>
                      <span className="text-2xl font-bold text-main font-mono">
                        {formatVal(usageData['NETWORK_RX_GB'], ' GB')}
                      </span>
                    </div>
                  </div>

                </div>
              )}
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
