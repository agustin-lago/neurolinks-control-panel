import React, { useState, useEffect } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';
import { useSmartRefresh } from '../../../contexts/SmartRefreshContext';

const ChatsView = ({ isTab = false }) => {
  const [chats, setChats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('chatsSelectedProjectId') || null);
  const [projectSearch, setProjectSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedChatId, setExpandedChatId] = useState(null);
  const [notesModalChat, setNotesModalChat] = useState(null);
  const [editingChat, setEditingChat] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState({ search: '', type: '', bot_enabled: '', unread: false });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const ITEMS_PER_PAGE = 50;

  useSmartRefresh('stream_chats', (data) => {
    try {
      if (data.type === 'INSERT' || data.type === 'UPDATE' || data.type === 'DELETE') {
        const payloadProject = data.record?.project_id || data.old_record?.project_id;
        if (payloadProject && selectedProjectId && String(payloadProject) === String(selectedProjectId)) {
          loadChats(selectedProjectId, page, {
            search: debouncedSearch,
            type: filters.type,
            bot_enabled: filters.bot_enabled,
            unread: filters.unread
          });
        }
        if (data.type === 'INSERT' || data.type === 'DELETE') {
          loadProjects();
        }
      }
    } catch (e) {
      console.error("SSE Update Error:", e);
    }
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await api.getAssistants();
      const projectIds = (data || []).map(p => p.id);
      const activeProjectIds = await api.fetchActiveChatProjects(projectIds);
      const activeSet = new Set(activeProjectIds || []);
      
      const filteredProjects = (data || []).filter(p => activeSet.has(p.id));
      setProjects(filteredProjects);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 500);
    return () => clearTimeout(handler);
  }, [filters.search]);

  // Reset page to 1 when filters change
  useEffect(() => {
    if (selectedProjectId) {
      setPage(1);
    }
  }, [debouncedSearch, filters.type, filters.bot_enabled, filters.unread]);

  useEffect(() => {
    if (selectedProjectId) {
      sessionStorage.setItem('chatsSelectedProjectId', selectedProjectId);
      loadChats(selectedProjectId, page, {
        search: debouncedSearch,
        type: filters.type,
        bot_enabled: filters.bot_enabled,
        unread: filters.unread
      });
    } else {
      sessionStorage.removeItem('chatsSelectedProjectId');
      setChats([]);
    }
  }, [selectedProjectId, page, debouncedSearch, filters.type, filters.bot_enabled, filters.unread]);

  const loadChats = async (projectId, pageNum, currentFilters = {}) => {
    setLoading(true);
    setError('');
    try {
      const offset = (pageNum - 1) * ITEMS_PER_PAGE;
      const data = await api.fetchSupabaseChats(projectId, ITEMS_PER_PAGE, offset, currentFilters);
      
      // La API ahora devuelve { chats, totalCount }
      if (data && data.chats) {
        setChats(data.chats);
        setTotalPages(Math.ceil((data.totalCount || 0) / ITEMS_PER_PAGE) || 1);
      } else {
        // Fallback porsia devuelve un array plano viejo
        setChats(Array.isArray(data) ? data : []);
        setTotalPages(1);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar los chats');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChat = async (updates) => {
    setIsSaving(true);
    try {
      await api.updateSupabaseChat(editingChat.id, updates);
      setEditingChat(null); // SSE se encarga de actualizar la lista en tiempo real
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const displayedChats = selectedProjectId ? chats.filter(c => c.project_id === selectedProjectId) : [];

  return (
    <div className={isTab ? 'flex flex-row w-full h-full pt-4 gap-4 pr-1 overflow-hidden' : 'flex flex-row w-full h-[calc(100vh-100px)] gap-4 overflow-hidden'} id="chats-grid-panel">
      {/* LEFT COLUMN: PROJECTS */}
      <div className="w-1/3 max-w-[300px] flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar shrink-0">
        <h6 className="text-dim text-sm font-bold mb-2 shrink-0">PROYECTOS</h6>
        
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

        {projects.length === 0 && (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton variant="card" className="h-16 w-full !p-3" />
            <Skeleton variant="card" className="h-16 w-full !p-3" />
            <Skeleton variant="card" className="h-16 w-full !p-3" />
          </div>
        )}
        {projects
          .filter(p => (p.name || '').toLowerCase().includes(projectSearch.toLowerCase()) || (p.id || '').toLowerCase().includes(projectSearch.toLowerCase()))
          .map(p => (
          <div 
            key={p.id}
            onClick={() => {
              if (selectedProjectId !== p.id) {
                setPage(1);
              }
              setSelectedProjectId(p.id);
            }}
            className={`glass-card p-3 rounded cursor-pointer transition-colors border ${selectedProjectId === p.id ? '' : 'border-[var(--border-light)] hover:bg-[var(--bg-glass)]'}`}
            style={selectedProjectId === p.id ? {
              borderColor: 'var(--color-accent, #0078D4)',
              backgroundColor: 'rgba(0, 120, 212, 0.2)',
              boxShadow: '0 0 15px rgba(0, 120, 212, 0.4)'
            } : {}}
          >
            <div className="font-bold text-sm text-[var(--text-main)] truncate" title={p.name}>{p.name}</div>
            <div className="text-xs text-dim font-mono mt-1 truncate" title={p.id}>{p.id}</div>
          </div>
        ))}
      </div>

      {/* RIGHT COLUMN: CHATS TABLE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl mb-4 shrink-0">
            <i className="bi bi-exclamation-triangle mr-2"></i>
            {error}
          </div>
        )}

        {!selectedProjectId ? (
          <div className="glass-card flex-1 flex items-center justify-center text-dim">
            Selecciona un proyecto a la izquierda para ver sus chats.
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* TOOLBAR DE FILTROS */}
            <div className="glass-card p-3 rounded-xl border border-[var(--border-light)] mb-4 flex flex-row flex-nowrap gap-2 items-center shrink-0 overflow-x-auto custom-scrollbar">
              
              {/* Buscador General */}
              <div className="input-group input-group-sm shrink-0 min-w-[200px] flex-1">
                <span className="input-group-text bg-transparent border-[var(--border-light)] text-dim">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control bg-transparent border-[var(--border-light)] text-main placeholder:text-dim text-sm"
                  placeholder="Buscar por teléfono..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>

            </div>

            <div className="overflow-y-auto w-full flex-1 custom-scrollbar pr-2 pb-4">
              {loading ? (
                <div className="flex flex-col gap-4">
                  <Skeleton variant="list-item" />
                  <Skeleton variant="list-item" />
                  <Skeleton variant="list-item" />
                  <Skeleton variant="list-item" />
                </div>
              ) : displayedChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-dim text-center">
                  <i className="bi bi-inbox text-4xl mb-3 opacity-50"></i>
                  <p>No se encontraron chats para este proyecto.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    {displayedChats.map(chat => {
                      const isExpanded = expandedChatId === chat.id;

                      return (
                        <div key={chat.id} className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col transition-all duration-200 overflow-hidden">
                          
                          {/* HEADER (ALWAYS VISIBLE - CLICK TO EXPAND) */}
                          <div 
                            className="flex flex-col sm:flex-row justify-between items-start gap-2 p-4 cursor-pointer hover:bg-[var(--bg-glass)]"
                            onClick={() => setExpandedChatId(isExpanded ? null : chat.id)}
                          >
                            <div className="min-w-0 w-full sm:w-auto flex items-center gap-3">
                              <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-dim`}></i>
                              <div>
                                <h3 className="font-bold text-main text-lg truncate" title={chat.name}>{chat.name || 'Sin Nombre'}</h3>
                                <div className="text-dim font-mono text-xs flex items-center gap-2 mt-1">
                                  <i className="bi bi-telephone text-dim"></i>
                                  <span className="truncate" title={chat.id}>{chat.id || 'Sin teléfono/usuario'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-start sm:justify-end gap-1 shrink-0 w-full sm:w-auto">
                              {chat.unread_count > 0 && (
                                <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                  {chat.unread_count} nuevos
                                </span>
                              )}
                              <span className={`border px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${chat.type === 'whatsapp' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                                {chat.type || 'web'}
                              </span>
                              <span className={`border px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${chat.bot_enabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                                <i className={`bi ${chat.bot_enabled ? 'bi-robot' : 'bi-person'} mr-1`}></i>
                                {chat.bot_enabled ? 'Bot' : 'Humano'}
                              </span>
                              {chat.is_lead && (
                                <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                  Lead
                                </span>
                              )}
                              
                              {/* Edit Button */}
                              <button 
                                className="ml-1 bg-transparent hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] px-2 py-0.5 rounded transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingChat(chat);
                                }}
                                title="Editar Chat"
                              >
                                <i className="bi bi-pencil-fill text-[10px]"></i>
                              </button>
                            </div>
                          </div>

                          {/* BODY - EXPANDABLE INFO */}
                          {isExpanded && (
                            <div className="p-4 pt-0 border-t border-[var(--border-soft)] mt-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-3">
                                
                                {/* COL 1: CONTACT & COMMERCIAL */}
                                <div className="space-y-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Contacto & Fiscal</span>
                                    <div className="text-main opacity-80 truncate" title={chat.email}><i className="bi bi-envelope w-4 inline-block text-dim"></i> {chat.email || '-'}</div>
                                    <div className="text-main opacity-80 truncate" title={chat.address}><i className="bi bi-geo-alt w-4 inline-block text-dim"></i> {chat.address || '-'}</div>
                                    <div className="text-main opacity-80 text-xs mt-1 bg-transparent px-2 py-1 rounded border border-[var(--border-soft)]">
                                      <span className="text-dim">ID Fiscal:</span> {chat.cuit_dni || '-'} | {chat.tax_status || '-'}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Comercial & CRM</span>
                                    <div className="text-main opacity-80 truncate"><span className="text-dim w-12 inline-block">Tipo:</span> {chat.tipo_cliente || '-'}</div>
                                    <div className="text-main opacity-80 truncate" title={chat.offered_product}><span className="text-dim w-12 inline-block">Prod:</span> {chat.offered_product || '-'}</div>
                                    <div className="text-main opacity-80 mt-1 flex items-center justify-between bg-transparent px-2 py-1 rounded border border-[var(--border-soft)]">
                                      <span className="truncate" title={chat.crm_status}><span className="text-dim">Status:</span> {chat.crm_status || '-'}</span>
                                      <span className="text-xs text-dim">{chat.crm_due_date ? new Date(chat.crm_due_date).toLocaleDateString() : '-'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* COL 2: ASSIGNMENT, SYSTEM & DATES */}
                                <div className="space-y-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Asignación</span>
                                    <div className="text-main opacity-80 truncate" title={chat.assigned_to}><span className="text-dim w-14 inline-block">Usuario:</span> {chat.assigned_to || '-'}</div>
                                    <div className="text-main opacity-80 truncate" title={chat.assigned_agent}><span className="text-dim w-14 inline-block">Agente:</span> {chat.assigned_agent || '-'} <span className="opacity-50 text-xs">({chat.agent_id || '-'})</span></div>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Actividad</span>
                                    <div className="flex justify-between items-center text-xs text-main opacity-80 bg-transparent px-2 py-1.5 rounded border border-[var(--border-soft)]">
                                      <span className="text-dim"><i className="bi bi-clock-history mr-1"></i>Último Msj</span> 
                                      <span>{chat.last_message_at ? new Date(chat.last_message_at).toLocaleString() : '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-main opacity-80 bg-transparent px-2 py-1.5 rounded border border-[var(--border-soft)] mt-1">
                                      <span className="text-dim"><i className="bi bi-person mr-1"></i>Humano</span> 
                                      <span>{chat.last_human_message_at ? new Date(chat.last_human_message_at).toLocaleString() : '-'}</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Sistema</span>
                                    <div className="text-xs text-dim grid grid-cols-2 gap-x-2 gap-y-1">
                                      <div className="truncate" title={chat.source}><span className="text-dim">Src:</span> {chat.source || '-'}</div>
                                      <div className="truncate" title={chat.incidencias_ids}><span className="text-dim">Inc:</span> {chat.incidencias_ids || '-'}</div>
                                      <div className="col-span-2 truncate" title={chat.last_db_result}><span className="text-dim">DB:</span> {chat.last_db_result || '-'}</div>
                                      <div className="col-span-2 truncate font-mono text-[9px] opacity-30 mt-1" title={chat.user_id}>User ID: {chat.user_id || '-'}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* FOOTER - BOTÓN DE NOTAS */}
                              {(chat.notes || chat.metadata) && (
                                <div className="mt-4 pt-3 border-t border-[var(--border-soft)] flex gap-2">
                                  {chat.notes && (
                                    <button 
                                      className="btn btn-sm text-xs bg-white/10 hover:bg-white/20 text-main border-0 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNotesModalChat(chat);
                                      }}
                                    >
                                      <i className="bi bi-card-text mr-2"></i>Ver Notas
                                    </button>
                                  )}
                                  {chat.metadata && (
                                    <div className="text-[10px] text-dim font-mono truncate flex items-center" title={JSON.stringify(chat.metadata)}>
                                      <i className="bi bi-code-square mr-1"></i> metadata disponible
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Paginación - FIJA ABAJO */}
            {displayedChats.length > 0 && !loading && (
              <div className="flex items-center justify-between p-4 glass-card border-[var(--border-light)] rounded-xl mt-3 shrink-0">
                <button
                  className="btn btn-sm btn-outline-secondary text-main opacity-80 px-4 py-2"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <i className="bi bi-chevron-left mr-2"></i> Anterior
                </button>
                
                <span className="text-sm font-bold text-dim">
                  Página {page} de {totalPages}
                </span>
                
                <button
                  className="btn btn-sm btn-outline-secondary text-main opacity-80 px-4 py-2"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Siguiente <i className="bi bi-chevron-right ml-2"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* NOTES MODAL */}
      {notesModalChat && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center bg-transparent">
              <h3 className="font-bold text-main text-lg"><i className="bi bi-journal-text mr-2 text-accent"></i>Notas: {notesModalChat.name || notesModalChat.id}</h3>
              <button className="text-dim hover:text-main" onClick={() => setNotesModalChat(null)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 whitespace-pre-wrap text-sm text-main opacity-80 min-h-[100px]">
              {notesModalChat.notes || <span className="text-dim italic">No hay notas registradas para este chat.</span>}
            </div>
            <div className="p-4 border-t border-[var(--border-light)] flex justify-end bg-transparent">
              <button className="btn btn-sm btn-primary" onClick={() => setNotesModalChat(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingChat && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center bg-transparent shrink-0">
              <h3 className="font-bold text-main text-lg"><i className="bi bi-pencil-square mr-2 text-accent"></i>Editar Chat</h3>
              <button className="text-dim hover:text-main transition-colors" onClick={() => setEditingChat(null)}>
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Teléfono / ID</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600" defaultValue={editingChat.id || ''} id="edit-id" placeholder="ID o Teléfono" />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Nombre / Contacto</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600" defaultValue={editingChat.name || ''} id="edit-name" placeholder="Nombre completo" />
                </div>
                
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Email</label>
                  <input type="email" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600" defaultValue={editingChat.email || ''} id="edit-email" placeholder="ejemplo@correo.com" />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Origen</label>
                  <select className="form-select form-select-sm bg-transparent border-[var(--border-light)] text-main cursor-pointer" defaultValue={editingChat.type || 'whatsapp'} id="edit-type">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="web">Web</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">ID Fiscal</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600" defaultValue={editingChat.cuit_dni || ''} id="edit-tax-id" placeholder="CUIT / DNI..." />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Condición Fiscal</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600" defaultValue={editingChat.tax_status || ''} id="edit-tax-condition" placeholder="ej. Consumidor Final" />
                </div>
                
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Status CRM</label>
                  <select className="form-select form-select-sm bg-transparent border-[var(--border-light)] text-main cursor-pointer" defaultValue={editingChat.crm_status || 'UNASSIGNED'} id="edit-crm-status">
                    <option value="UNASSIGNED">UNASSIGNED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Agente Asignado</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600" defaultValue={editingChat.assigned_agent || ''} id="edit-agent" placeholder="Nombre del agente" />
                </div>
                
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Tipo (CRM)</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600" defaultValue={editingChat.type_lead || ''} id="edit-type-lead" placeholder="ej. Inmobiliaria, Consulta..." />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Producto</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600" defaultValue={editingChat.product || ''} id="edit-product" placeholder="Producto de interés" />
                </div>
              </div>
              
              <div className="form-group mt-2">
                <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Notas del Chat</label>
                <textarea className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600 w-full min-h-[100px] custom-scrollbar" defaultValue={editingChat.notes || ''} id="edit-notes" placeholder="Escribe aquí notas adicionales del cliente..."></textarea>
              </div>

              <div className="form-group flex flex-col sm:flex-row gap-4 justify-start mt-2 bg-transparent p-4 rounded-lg border border-[var(--border-soft)]">
                <label className="flex items-center gap-3 text-sm text-main opacity-80 cursor-pointer hover:text-main transition-colors">
                  <input type="checkbox" className="form-checkbox h-4 w-4 bg-transparent border-white/20 rounded text-accent cursor-pointer" defaultChecked={editingChat.bot_enabled} id="edit-bot-enabled" />
                  <span>Habilitar Asistente Bot</span>
                </label>
                <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
                <label className="flex items-center gap-3 text-sm text-main opacity-80 cursor-pointer hover:text-main transition-colors">
                  <input type="checkbox" className="form-checkbox h-4 w-4 bg-transparent border-white/20 rounded text-purple-500 cursor-pointer" defaultChecked={editingChat.is_lead} id="edit-is-lead" />
                  <span>Marcar como LEAD</span>
                </label>
              </div>
            </div>
            
            <div className="p-4 border-t border-[var(--border-light)] flex justify-end gap-3 bg-transparent shrink-0">
              <button className="btn btn-sm bg-transparent hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] transition-colors" onClick={() => setEditingChat(null)}>
                Cancelar
              </button>
              <button 
                className="btn btn-sm btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20" 
                disabled={isSaving} 
                onClick={() => {
                  const updates = {
                    id: document.getElementById('edit-id').value,
                    name: document.getElementById('edit-name').value,
                    email: document.getElementById('edit-email').value,
                    cuit_dni: document.getElementById('edit-tax-id').value,
                    tax_status: document.getElementById('edit-tax-condition').value,
                    type: document.getElementById('edit-type').value,
                    crm_status: document.getElementById('edit-crm-status').value,
                    assigned_agent: document.getElementById('edit-agent').value,
                    type_lead: document.getElementById('edit-type-lead').value,
                    product: document.getElementById('edit-product').value,
                    notes: document.getElementById('edit-notes').value,
                    bot_enabled: document.getElementById('edit-bot-enabled').checked,
                    is_lead: document.getElementById('edit-is-lead').checked
                  };
                  handleSaveChat(updates);
                }}
              >
                {isSaving ? (
                  <><i className="bi bi-arrow-repeat animate-spin"></i> Guardando...</>
                ) : (
                  <><i className="bi bi-check2-circle"></i> Guardar Cambios</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatsView;
