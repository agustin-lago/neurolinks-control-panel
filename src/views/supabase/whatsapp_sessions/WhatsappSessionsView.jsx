import React, { useState, useEffect } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';
import { useSmartRefresh } from '../../../contexts/SmartRefreshContext';

const WhatsappSessionsView = ({ isTab = false }) => {
  const [dataList, setDataList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('wsSelectedProjectId') || null);
  const [projectSearch, setProjectSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [dataModalItem, setDataModalItem] = useState(null); // Para el modal de JSON Data
  const [editingItem, setEditingItem] = useState(null); // Para editar los otros campos
  const [isSaving, setIsSaving] = useState(false);

  useSmartRefresh('stream_sessions', (data) => {
    try {
      if (data.type === 'INSERT' || data.type === 'UPDATE' || data.type === 'DELETE') {
        const payloadProject = data.record?.project_id || data.old_record?.project_id;
        if (payloadProject && selectedProject && String(payloadProject) === String(selectedProject.id)) {
          loadData(selectedProject.id);
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
      const allProjects = await api.getAssistants();
      const allSessions = await api.fetchWhatsappSessions();
      const activeProjectIds = new Set((allSessions || []).map(s => s.project_id));
      
      const filteredProjects = (allProjects || []).filter(p => activeProjectIds.has(p.id));
      setProjects(filteredProjects);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      sessionStorage.setItem('wsSelectedProjectId', selectedProjectId);
      loadWhatsappSessions(selectedProjectId);
    } else {
      sessionStorage.removeItem('wsSelectedProjectId');
      setDataList([]);
    }
  }, [selectedProjectId]);

  const loadWhatsappSessions = async (projectId) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.fetchWhatsappSessions(projectId);
      setDataList(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar los datos de whatsapp_sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveData = async (id, newData) => {
    setIsSaving(true);
    try {
      let parsedData = null;
      if (newData) {
        try {
          parsedData = JSON.parse(newData);
        } catch(e) {
          parsedData = newData;
        }
      }
      const updates = { data: parsedData };
      await api.updateWhatsappSession(id, updates);
      setDataModalItem(null);
      loadWhatsappSessions(selectedProjectId);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveItem = async (updates) => {
    setIsSaving(true);
    try {
      await api.updateWhatsappSession(updates.project_id, updates);
      setEditingItem(null);
      loadWhatsappSessions(selectedProjectId);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      if (window.showToast) window.showToast('Copiado al portapapeles', 'success');
    } catch (err) {
      console.error('Error al copiar: ', err);
    }
  };

  return (
    <div className={isTab ? 'flex flex-row w-full h-full pt-4 gap-4 pr-1 overflow-hidden' : 'flex flex-row w-full h-[calc(100vh-100px)] gap-4 overflow-hidden'} id="ws-grid-panel">
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
            onClick={() => setSelectedProjectId(p.id)}
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

      {/* RIGHT COLUMN: WS TABLE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl mb-4 shrink-0">
            <i className="bi bi-exclamation-triangle mr-2"></i>
            {error}
          </div>
        )}

        {!selectedProjectId ? (
          <div className="glass-card flex-1 flex items-center justify-center text-dim">
            Selecciona un proyecto a la izquierda para ver sus sesiones de WhatsApp.
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="overflow-y-auto w-full flex-1 custom-scrollbar pr-2 pb-4">
              {loading ? (
                <div className="flex flex-col gap-4">
                  <Skeleton variant="card" className="h-64 w-full" />
                </div>
              ) : dataList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-dim text-center">
                  <i className="bi bi-whatsapp text-4xl mb-3 opacity-50"></i>
                  <p>No se encontraron sesiones de WhatsApp para este proyecto.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {dataList.map(item => (
                    <div key={item.project_id} className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden">
                      <div className="flex justify-between items-start p-4 border-b border-[var(--border-soft)] bg-transparent">
                        <div>
                          <h3 className="font-bold text-main text-lg flex items-center gap-2">
                            <i className="bi bi-whatsapp text-green-500"></i> WhatsApp Session
                          </h3>
                          <div className="text-dim font-mono text-xs mt-1 flex items-center gap-2">
                            Project ID: {item.project_id}
                            <button 
                              className="text-dim hover:text-main transition-colors"
                              title="Copiar Project ID"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.project_id);
                              }}
                            >
                              <i className="bi bi-copy text-[10px]"></i>
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            className="bg-[var(--bg-glass)] hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] px-3 py-1 rounded transition-colors text-xs flex items-center gap-1"
                            onClick={() => setEditingItem(item)}
                          >
                            <i className="bi bi-pencil-fill"></i> Editar
                          </button>
                        </div>
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Identificadores de Sesión</span>
                              {(item.session_id || item.key_id) && (
                                <button 
                                  className="text-dim hover:text-main transition-colors"
                                  title="Copiar Session ID y Key ID"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const textToCopy = `SESSION_ID: ${item.session_id || ''}\nKEY_ID: ${item.key_id || ''}`;
                                    copyToClipboard(textToCopy);
                                  }}
                                >
                                  <i className="bi bi-copy text-[10px]"></i>
                                </button>
                              )}
                            </div>
                            <div className="text-main opacity-80 truncate" title={item.session_id}><span className="text-dim w-20 inline-block">Session ID:</span> {item.session_id || '-'}</div>
                            <div className="text-main opacity-80 truncate" title={item.key_id}><span className="text-dim w-20 inline-block">Key ID:</span> {item.key_id || '-'}</div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Información General</span>
                            <div className="text-main opacity-80"><span className="text-dim w-20 inline-block">Bot Name:</span> {item.bot_name || '-'}</div>
                            <div className="text-main opacity-80"><span className="text-dim w-20 inline-block">Creado:</span> {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</div>
                            <div className="text-main opacity-80"><span className="text-dim w-20 inline-block">Actualiz:</span> {item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 pt-0 mt-2 border-t border-[var(--border-soft)] flex gap-2">
                        <button 
                          className="btn btn-sm text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors mt-3"
                          onClick={() => setDataModalItem(item)}
                        >
                          <i className="bi bi-braces mr-2"></i>Ver Session Data (JSON)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* JSON DATA MODAL */}
      {dataModalItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center bg-transparent">
              <h3 className="font-bold text-main text-lg"><i className="bi bi-braces mr-2 text-accent"></i>Session Data (JSON)</h3>
              <button className="text-dim hover:text-main" onClick={() => setDataModalItem(null)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="form-group h-full flex flex-col">
                <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-2 block shrink-0">Contenido del campo "data"</label>
                <textarea 
                  className="form-control bg-transparent border-[var(--border-light)] text-main placeholder-gray-600 font-mono text-xs flex-1 w-full p-3 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                  id="edit-session-data"
                  defaultValue={typeof dataModalItem.data === 'object' ? JSON.stringify(dataModalItem.data, null, 2) : (dataModalItem.data || '')}
                  placeholder="Pegue aquí el JSON de la sesión..."
                  style={{ minHeight: '300px' }}
                ></textarea>
              </div>
            </div>
            <div className="p-4 border-t border-[var(--border-light)] flex justify-between items-center bg-transparent gap-3 shrink-0">
              <button 
                className="btn btn-sm bg-transparent hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] transition-colors"
                onClick={() => {
                  const tokenVal = document.getElementById('edit-session-data').value;
                  copyToClipboard(tokenVal);
                }}
              >
                <i className="bi bi-copy mr-2"></i>Copiar JSON
              </button>
              
              <div className="flex gap-2">
                <button className="btn btn-sm bg-transparent hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] transition-colors" onClick={() => setDataModalItem(null)}>
                  Cancelar
                </button>
                <button 
                  className="btn btn-sm btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20"
                  disabled={isSaving}
                  onClick={() => handleSaveData(dataModalItem.project_id, document.getElementById('edit-session-data').value)}
                >
                  {isSaving ? <><i className="bi bi-arrow-repeat animate-spin"></i> Guardando...</> : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center bg-transparent shrink-0">
              <h3 className="font-bold text-main text-lg"><i className="bi bi-pencil-square mr-2 text-accent"></i>Editar Sesión</h3>
              <button className="text-dim hover:text-main transition-colors" onClick={() => setEditingItem(null)}>
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group col-span-2">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Session ID</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.session_id || ''} id="edit-session-id" />
                </div>
                <div className="form-group col-span-2">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Key ID</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.key_id || ''} id="edit-key-id" />
                </div>
                <div className="form-group col-span-2">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Bot Name</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.bot_name || ''} id="edit-bot-name" />
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-[var(--border-light)] flex justify-end gap-3 bg-transparent shrink-0">
              <button className="btn btn-sm bg-transparent hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] transition-colors" onClick={() => setEditingItem(null)}>
                Cancelar
              </button>
              <button 
                className="btn btn-sm btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20" 
                disabled={isSaving} 
                onClick={() => {
                  const updates = {
                    project_id: editingItem.project_id,
                    session_id: document.getElementById('edit-session-id').value,
                    key_id: document.getElementById('edit-key-id').value,
                    bot_name: document.getElementById('edit-bot-name').value
                  };
                  handleSaveItem(updates);
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

export default WhatsappSessionsView;
