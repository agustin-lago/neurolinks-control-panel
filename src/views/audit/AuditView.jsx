import React, { useState, useEffect } from 'react';
import { api } from '../../core/api';
import AuditList from './components/AuditList';

export default function AuditView({ navigate, isTab = false }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  const fetchLogs = async () => {
    setLoading(true);
    setIsSuccess(false);
    try {
      const fetched = await api.getAuditLogs() || [];
      fetched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setLogs(fetched);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 1500);
    } catch (err) {
      console.error('[AuditView] Error loading logs:', err);
      window.showToast('Error al cargar auditoría', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log =>
    (log.accion && log.accion.toLowerCase().includes(search.toLowerCase())) ||
    (log.entidad_tipo && log.entidad_tipo.toLowerCase().includes(search.toLowerCase())) ||
    (log.detalles && log.detalles.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className={`flex flex-col w-full ${isTab ? 'h-full pt-4' : 'h-[calc(100dvh-65px)] md:h-[100dvh] p-2'} overflow-hidden fade-in bg-transparent`}>
      {/* Controles de Búsqueda y Paginación */}
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

        {/* Controles (ocultos en mobile salvo que se abra el acordeón) */}
        <div className={`${isFiltersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row items-stretch md:items-center gap-3 text-sm w-full`}>
          <div className="input-group input-group-sm search-input-group mb-0 grow min-w-[150px] w-full md:w-auto">
            <span className="input-group-text text-dim">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control text-main"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>


      </div>
      </div>

      <AuditList filteredLogs={filteredLogs} />
    </div>
  );
}
