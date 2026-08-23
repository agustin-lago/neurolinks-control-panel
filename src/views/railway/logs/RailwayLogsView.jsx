import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';

const RailwayLogsView = ({ isTab = false }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('rlLogsProjectId') || null);
  const [projectSearch, setProjectSearch] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Ref for the console to auto-scroll
  const consoleEndRef = useRef(null);
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const [anchorContext, setAnchorContext] = useState(null); // Para saber si estamos en "modo contexto"

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
      sessionStorage.setItem('rlLogsProjectId', selectedProjectId);
      setLogs([]);
      setAnchorContext(null);
      loadLogs(selectedProjectId);
    } else {
      sessionStorage.removeItem('rlLogsProjectId');
      setLogs([]);
      setAnchorContext(null);
    }
  }, [selectedProjectId]);

  const loadLogs = async (projectId, anchorDate = null, filter = searchQuery) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const environmentId = project.services?.[0]?.environmentId;
    if (!environmentId) return;

    setIsLoadingLogs(true);
    try {
      const params = { limit: 100 };
      if (filter) params.filter = filter;
      if (anchorDate) {
        params.anchorDate = anchorDate;
        params.beforeLimit = 50;
        params.afterLimit = 50;
      }
      
      const data = await api.getRailwayLogs(environmentId, params);
      
      // Data returns from newest to oldest in some cases? Railway returns newest first by default.
      // We will sort them by timestamp strictly to avoid issues, oldest first (so newest at bottom)
      const sortedLogs = (data || []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      setLogs(sortedLogs);
      if (anchorDate) {
        setAnchorContext(anchorDate);
      } else {
        setAnchorContext(null);
      }
      
      // Auto-scroll to bottom if not in context mode
      if (!anchorDate) {
        setTimeout(() => {
          consoleEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 100);
      }
    } catch (err) {
      console.error('Error al cargar logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const loadMoreLogs = async () => {
    if (!selectedProjectId || logs.length === 0 || isLoadingLogs || isFetchingMore || anchorContext) return;
    
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    
    const environmentId = project.services?.[0]?.environmentId;
    if (!environmentId) return;

    setIsFetchingMore(true);
    try {
      const params = { limit: logs.length + 100 };
      if (searchQuery) params.filter = searchQuery;

      const data = await api.getRailwayLogs(environmentId, params);
      
      if (data && data.length > 0) {
        // Record current scroll height to adjust position after prepend
        const container = containerRef.current;
        const oldScrollHeight = container ? container.scrollHeight : 0;

        const newLogsSorted = data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        setLogs(prev => {
          // Merge avoiding duplicates just in case
          const existingIds = new Set(prev.map(l => l.timestamp + l.message));
          const uniqueNew = newLogsSorted.filter(l => !existingIds.has(l.timestamp + l.message));
          
          if (uniqueNew.length === 0) {
            if (window.showToast) window.showToast('No hay logs más antiguos', 'info');
            return prev;
          }
          
          return [...uniqueNew, ...prev];
        });

        // Adjust scroll position to stay exactly where we were
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 0);
      } else {
        if (window.showToast) window.showToast('No hay logs más antiguos', 'info');
      }
    } catch (err) {
      console.error('Error al cargar más logs:', err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // IntersectionObserver is removed based on user feedback.

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedProjectId) {
      loadLogs(selectedProjectId, null, searchQuery);
    }
  };
  
  const handleViewInContext = (anchorDate) => {
    if (selectedProjectId) {
      loadLogs(selectedProjectId, anchorDate);
    }
  };

  const getSeverityClasses = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'error': return { border: 'border-l-4 border-l-red-500', bg: 'bg-red-500/10 hover:bg-red-500/20' };
      case 'warn': return { border: 'border-l-4 border-l-orange-500', bg: 'bg-orange-500/10 hover:bg-orange-500/20' };
      case 'info': return { border: 'border-l-4 border-l-blue-500', bg: '' };
      case 'debug': return { border: 'border-l-4 border-l-gray-400', bg: '' };
      default: return { border: 'border-l-4 border-l-gray-500', bg: '' };
    }
  };

  return (
    <div className={isTab ? 'flex flex-row w-full h-full pt-4 gap-4 pr-1 overflow-hidden' : 'flex flex-row w-full h-[calc(100vh-100px)] gap-4 overflow-hidden'}>
      
      {/* LEFT COLUMN: PROJECTS */}
      <div className="w-1/3 max-w-[300px] flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar shrink-0">
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
              className={`glass-card p-3 rounded cursor-pointer transition-colors border flex items-center ${selectedProjectId === p.id ? '' : 'border-[var(--border-light)] hover:bg-[var(--bg-glass)]'}`}
              style={selectedProjectId === p.id ? {
                borderColor: 'var(--color-accent, #0078D4)',
                backgroundColor: 'rgba(0, 120, 212, 0.2)',
                boxShadow: '0 0 15px rgba(0, 120, 212, 0.4)'
              } : {}}
            >
              <div className="font-bold text-sm text-[var(--text-main)] truncate w-full" title={p.name}>
                <i className="bi bi-train-front mr-2 text-[var(--accent)]"></i>
                {p.name}
              </div>
            </div>
          ))
        )}
      </div>

      {/* RIGHT COLUMN: LOGS VIEWER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedProjectId ? (
          <div className="glass-card flex-1 flex items-center justify-center text-dim text-center">
            <div>
              <i className="bi bi-terminal text-4xl mb-3 opacity-50 block"></i>
              Selecciona un proyecto a la izquierda para ver sus logs.
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-transparent">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-4 shrink-0 px-2">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-main text-xl m-0 flex items-center gap-2 truncate">
                  <i className="bi bi-list-nested text-[var(--accent)]"></i> {selectedProject?.name || 'Log Explorer'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {anchorContext && (
                  <button 
                    type="button" 
                    onClick={() => loadLogs(selectedProjectId)}
                    className="btn btn-sm btn-warning flex items-center gap-2"
                  >
                    <i className="bi bi-x-circle-fill"></i> Limpiar Contexto
                  </button>
                )}
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                  <div className="input-group input-group-sm search-input-group m-0" style={{ width: '200px' }}>
                    <span className="input-group-text text-dim">
                      <i className="bi bi-search"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control text-main"
                      placeholder="Filtrar logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-sm btn-primary">
                    Buscar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => loadLogs(selectedProjectId, anchorContext)}
                    className="btn btn-sm btn-outline-secondary ml-1"
                    title="Refrescar"
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                  </button>
                </form>
              </div>
            </div>

            {/* LOGS LIST */}
            <div className="glass-card p-0 flex-1 overflow-hidden flex flex-col min-h-0 rounded border border-[var(--border-light)] relative">
              {isLoadingLogs ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 rounded">
                  <div className="spinner-border text-accent spinner-border-sm" role="status"></div>
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto custom-scrollbar" ref={containerRef}>
                <div className="table-responsive m-0">
                  <table className="table table-hover mb-0 align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: '200px' }}>Fecha/Hora</th>
                        <th>Mensaje / Datos</th>
                        <th className="text-right pr-4" style={{ width: '100px' }}>Contexto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 && !isLoadingLogs ? (
                        <tr>
                          <td colSpan="3" className="text-center py-12 text-dim italic">
                            No hay logs para mostrar.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {/* Botón explícito para cargar más antiguos en el tope de la tabla */}
                          {!anchorContext && logs.length >= 100 && (
                            <tr>
                              <td colSpan="3" className="text-center py-4">
                                <button 
                                  onClick={loadMoreLogs}
                                  disabled={isFetchingMore}
                                  className="btn btn-sm btn-outline-primary rounded-pill px-4"
                                >
                                  {isFetchingMore ? (
                                    <>
                                      <Skeleton variant="text" className="w-16 h-4 mb-0 inline-block mr-2" /> Cargando...
                                    </>
                                  ) : (
                                    <><i className="bi bi-clock-history mr-2"></i>Cargar más antiguos</>
                                  )}
                                </button>
                              </td>
                            </tr>
                          )}
                          
                          {logs.map((log, i) => {
                            const date = new Date(log.timestamp);
                            const timeString = date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const ms = String(date.getMilliseconds()).padStart(3, '0');
                            const dateString = date.toLocaleDateString();
                            const isContextTarget = anchorContext === log.timestamp;
                            const { border, bg } = getSeverityClasses(log.severity);
                            
                            return (
                              <tr key={i} className={`group ${bg} ${isContextTarget ? 'bg-yellow-500/10' : ''}`}>
                                <td className={`${border}`}>
                                  <div className="font-bold text-xs">{dateString}</div>
                                  <div className="text-[11px] text-dim font-mono">{timeString}.{ms}</div>
                                </td>
                                <td className="text-[12px] font-mono leading-relaxed" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '800px' }}>
                                  {log.message}
                                </td>
                                <td className="text-right pr-4">
                                  {!isContextTarget && (
                                    <button 
                                      onClick={() => handleViewInContext(log.timestamp)}
                                      className="btn btn-sm btn-outline-light opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-full"
                                      title="Ver logs alrededor de este momento"
                                    >
                                      <i className="bi bi-eye"></i>
                                    </button>
                                  )}
                                  {isContextTarget && (
                                    <span className="text-yellow-400 text-xs font-bold"><i className="bi bi-geo-alt-fill mr-1"></i>AQUÍ</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          <tr ref={consoleEndRef}>
                            <td colSpan="3" className="p-0 border-0 h-0"></td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RailwayLogsView;
