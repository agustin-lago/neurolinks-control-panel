import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../core/api';
import { useSmartRefresh } from '../../contexts/SmartRefreshContext';
import LogsList from './components/LogsList';
import LogDetailModal from './components/LogDetailModal';

export default function LogsView({ navigate, isTab = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [service, setService] = useState('');
  const [level, setLevel] = useState('');
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const formatJsonDetails = (details) => {
    if (!details) return '';
    let obj = details;
    if (typeof details === 'string') {
      try {
        obj = JSON.parse(details);
      } catch (e) {
        return details;
      }
    }
    return JSON.stringify(obj, null, 2);
  };

  const fetchLogs = async () => {
    setLoading(true);
    setRefreshSuccess(false);
    try {
      const data = await api.getLogs() || [];
      setLogs(data);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 1500);
    } catch (err) {
      console.error('[LogsView] Error loading logs:', err);
      window.showToast('Error al cargar logs del sistema', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useSmartRefresh('log_update', fetchLogs);

  const filteredLogs = logs.filter(log => {
    // Silence benign OpenAI 401 error
    if (log.message && log.message.includes('Error [401]: OpenAI no pudo generar una respues')) {
      return false;
    }

    // Text search
    if (search) {
      const q = search.toLowerCase();
      const msg = log.message ? log.message.toLowerCase() : '';
      const pId = log.project_id ? log.project_id.toLowerCase() : '';
      const cId = log.client_id ? log.client_id.toLowerCase() : '';
      if (!msg.includes(q) && !pId.includes(q) && !cId.includes(q)) return false;
    }

    // Service filter
    if (service && log.service !== service) return false;

    // Level filter
    if (level && log.level !== level) return false;

    // Date range
    if (dateFrom || dateTo) {
      const logTime = new Date(log.created_at).getTime();
      if (dateFrom && logTime < new Date(dateFrom).getTime()) return false;
      if (dateTo && logTime > new Date(dateTo).getTime()) return false;
    }

    return true;
  });

  return (
    <div className={`flex flex-col w-full ${isTab ? 'h-full pt-4' : 'h-[calc(100dvh-65px)] md:h-[100dvh] p-2'} overflow-hidden fade-in bg-transparent`}>


      <div className="flex flex-col gap-3 mb-3 w-full shrink-0">
        
        {/* Acordeón para Mobile */}
        <div className="md:hidden flex justify-between items-center w-full glass-card p-2 rounded">
          <span className="text-sm font-semibold text-main ml-2"><i className="bi bi-sliders mr-2"></i>Filtros y Búsqueda</span>
          <button 
            className="btn btn-sm btn-outline-light flex items-center justify-center w-8 h-8"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          >
            <i className={`bi bi-chevron-${isFiltersOpen ? 'up' : 'down'}`}></i>
          </button>
        </div>

        {/* Filtros Elegantes (ocultos en mobile salvo que se abra el acordeón) */}
        <div className={`${isFiltersOpen ? 'flex' : 'hidden'} md:flex glass-card p-4 rounded gap-4 flex-col md:flex-row flex-wrap items-stretch md:items-end`}>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Desde</label>
            <input
              type="datetime-local"
              className="form-control form-control-sm text-main bg-transparent"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Hasta</label>
            <input
              type="datetime-local"
              className="form-control form-control-sm text-main bg-transparent"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Servicio</label>
            <select
              className="form-select form-select-sm text-main bg-transparent border-secondary"
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="OPENAI">OpenAI</option>
              <option value="META">Meta</option>
              <option value="SUPABASE">Supabase</option>
              <option value="RAILWAY">Railway</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Nivel</label>
            <select
              className="form-select form-select-sm text-main bg-transparent border-secondary"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="ERROR">Error</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px] grow-[2]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Búsqueda</label>
            <div className="input-group input-group-sm search-input-group">
              <span className="input-group-text text-dim">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-main"
                placeholder="Buscar mensaje o proyecto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      <LogsList 
        filteredLogs={filteredLogs} 
        loading={loading} 
        onViewDetails={setSelectedDetails} 
      />

      <LogDetailModal 
        selectedDetails={selectedDetails} 
        onClose={() => setSelectedDetails(null)} 
        formatJsonDetails={formatJsonDetails} 
      />
    </div>
  );
}
