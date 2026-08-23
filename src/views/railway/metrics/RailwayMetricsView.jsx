import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function RailwayMetricsView({ isTab = false }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('rlMetricsProjectId') || null);
  const [projectSearch, setProjectSearch] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const [metricsData, setMetricsData] = useState([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('ALL');
  const [timeRange, setTimeRange] = useState('1h');

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
  const refreshIntervalRef = useRef(null);

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
      sessionStorage.setItem('rlMetricsProjectId', selectedProjectId);
      setSelectedServiceId('ALL');
      loadMetrics(selectedProjectId, 'ALL', timeRange);
    } else {
      sessionStorage.removeItem('rlMetricsProjectId');
      setMetricsData([]);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      loadMetrics(selectedProjectId, selectedServiceId, timeRange);
    }
  }, [selectedServiceId, timeRange]);

  // Sincronización en tiempo real
  useEffect(() => {
    if (selectedProjectId) {
      refreshIntervalRef.current = setInterval(() => {
        loadMetrics(selectedProjectId, selectedServiceId, timeRange, true);
      }, 30000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [selectedProjectId, selectedServiceId, timeRange]);

  const loadMetrics = async (projectId, serviceId, range, isBackground = false) => {
    if (!isBackground) setIsLoadingMetrics(true);
    try {
      let startDate = new Date();
      let sampleRateSeconds = 60; // 1 min por defecto
      
      if (range === '1h') {
        startDate.setHours(startDate.getHours() - 1);
        sampleRateSeconds = 60; // 60 puntos
      }
      if (range === '24h') {
        startDate.setHours(startDate.getHours() - 24);
        sampleRateSeconds = 600; // 10 min (144 puntos)
      }
      if (range === '7d') {
        startDate.setDate(startDate.getDate() - 7);
        sampleRateSeconds = 3600; // 1 hr (168 puntos)
      }

      const targetService = serviceId === 'ALL' ? null : serviceId;
      const project = projects.find(p => p.id === projectId);
      const rawMetrics = await api.getProjectMetrics(
        projectId, 
        null, 
        targetService, 
        startDate.toISOString(), 
        null, 
        ['CPU_USAGE', 'MEMORY_USAGE_GB', 'NETWORK_RX_GB', 'NETWORK_TX_GB'],
        sampleRateSeconds,
        project?.railwayWorkspaceKey
      );

      const combined = {};
      
      (rawMetrics || []).forEach(m => {
        const key = m.measurement;
        (m.values || []).forEach(val => {
          if (!combined[val.ts]) {
            let labelOptions = range === '7d' 
              ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
              : { hour: '2-digit', minute: '2-digit' };
            combined[val.ts] = { ts: val.ts, timeLabel: new Date(val.ts * 1000).toLocaleDateString(undefined, labelOptions).replace(',', '') };
          }
          combined[val.ts][key] = val.value;
        });
      });

      const sortedData = Object.values(combined).sort((a, b) => a.ts - b.ts);
      setMetricsData(sortedData);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 rounded-lg border border-[var(--border-light)] text-sm shadow-xl">
          <p className="font-bold text-main mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-dim">{entry.name}:</span>
              <span className="font-mono text-main font-bold">
                {entry.value !== undefined && entry.value !== null ? Number(entry.value).toFixed(4) : '0.0000'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
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

      {/* RIGHT COLUMN: METRICS */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedProjectId ? (
          <div className="glass-card flex-1 flex items-center justify-center text-dim text-center">
            <div>
              <i className="bi bi-graph-up text-4xl mb-3 opacity-50 block"></i>
              Selecciona un proyecto a la izquierda para ver sus métricas.
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 shrink-0 px-2 gap-2">
              <div className="flex flex-col">
                <h3 className="font-bold text-main text-xl m-0 flex items-center gap-2 truncate">
                  <i className="bi bi-graph-up text-[var(--accent)]"></i> 
                  Métricas de Rendimiento
                </h3>
                <div className="text-xs text-dim mt-1 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Actualizando en tiempo real
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select 
                  className="form-select form-select-sm text-main border-[var(--border-light)] bg-transparent w-auto cursor-pointer focus:border-[var(--accent)]"
                  value={selectedServiceId}
                  onChange={e => setSelectedServiceId(e.target.value)}
                >
                  <option value="ALL">Proyecto (Global)</option>
                  {selectedProject?.services?.edges?.map(s => (
                    <option key={s.node.id} value={s.node.id}>{s.node.name}</option>
                  ))}
                  {/* Fallback if services format is not edges */}
                  {selectedProject?.services && !selectedProject.services.edges && selectedProject.services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <select 
                  className="form-select form-select-sm text-main border-[var(--border-light)] bg-transparent w-auto cursor-pointer focus:border-[var(--accent)]"
                  value={timeRange}
                  onChange={e => setTimeRange(e.target.value)}
                >
                  <option value="1h">Última hora</option>
                  <option value="24h">Últimas 24 horas</option>
                  <option value="7d">Últimos 7 días</option>
                </select>
              </div>
            </div>

            {/* CONTENT */}
            <div className="overflow-y-auto w-full flex-1 custom-scrollbar pr-2 pb-4">
              {isLoadingMetrics && metricsData.length === 0 ? (
                <div className="flex flex-col gap-4 pt-4">
                  <Skeleton variant="card" className="h-[400px] w-full" />
                </div>
              ) : metricsData.length === 0 ? (
                <div className="glass-card p-8 text-center text-dim rounded-xl border border-[var(--border-light)]">
                  No hay datos de métricas para este período.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  
                  {/* CPU Chart */}
                  <div className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden">
                    <div className="flex items-center p-3 border-b border-[var(--border-soft)] bg-black/10">
                      <div className="font-bold text-main text-sm flex items-center gap-2">
                        <i className="bi bi-cpu text-[#3b82f6]"></i> Uso de CPU (vCores)
                      </div>
                    </div>
                    <div className="h-[250px] w-full p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricsData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                          <XAxis dataKey="timeLabel" stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={val => val.toFixed(2)} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="CPU_USAGE" name="CPU" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#3b82f6', stroke: 'var(--bg-main)', strokeWidth: 2 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* RAM Chart */}
                  <div className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden">
                    <div className="flex items-center p-3 border-b border-[var(--border-soft)] bg-black/10">
                      <div className="font-bold text-main text-sm flex items-center gap-2">
                        <i className="bi bi-memory text-[#a855f7]"></i> Uso de Memoria (GB)
                      </div>
                    </div>
                    <div className="h-[250px] w-full p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricsData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                          <XAxis dataKey="timeLabel" stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={val => val.toFixed(2)} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="MEMORY_USAGE_GB" name="Memoria" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#a855f7', stroke: 'var(--bg-main)', strokeWidth: 2 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Network Chart */}
                  <div className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden">
                    <div className="flex items-center p-3 border-b border-[var(--border-soft)] bg-black/10">
                      <div className="font-bold text-main text-sm flex items-center gap-2">
                        <i className="bi bi-hdd-network text-[#10b981]"></i> Tráfico de Red (GB)
                      </div>
                    </div>
                    <div className="h-[250px] w-full p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricsData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                          <XAxis dataKey="timeLabel" stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={val => val.toFixed(3)} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: 'var(--text-main)' }} />
                          <Line type="monotone" dataKey="NETWORK_RX_GB" name="Entrada (RX)" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                          <Line type="monotone" dataKey="NETWORK_TX_GB" name="Salida (TX)" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
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
