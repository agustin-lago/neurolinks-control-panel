import React, { useState, useEffect } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';
import { useSmartRefresh } from '../../../contexts/SmartRefreshContext';

const MetaOnboardingView = ({ isTab = false }) => {
  const [dataList, setDataList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('metaSelectedProjectId') || null);
  const [projectSearch, setProjectSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [tokenModalItem, setTokenModalItem] = useState(null); // Para el modal del access token
  const [editingItem, setEditingItem] = useState(null); // Para editar los otros campos
  const [isSaving, setIsSaving] = useState(false);

  useSmartRefresh('stream_meta', (data) => {
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
      const allMeta = await api.fetchMetaOnboarding();
      const activeProjectIds = new Set((allMeta || []).map(m => m.project_id));
      
      const filteredProjects = (allProjects || []).filter(p => activeProjectIds.has(p.id));
      setProjects(filteredProjects);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      sessionStorage.setItem('metaSelectedProjectId', selectedProjectId);
      loadMetaOnboarding(selectedProjectId);
    } else {
      sessionStorage.removeItem('metaSelectedProjectId');
      setDataList([]);
    }
  }, [selectedProjectId]);

  const loadMetaOnboarding = async (projectId) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.fetchMetaOnboarding(projectId);
      setDataList(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar los datos de meta_onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToken = async (id, newToken) => {
    setIsSaving(true);
    try {
      const updates = { access_token: newToken };
      await api.updateMetaOnboarding(id, updates); // id here is project_id
      setTokenModalItem(null);
      loadMetaOnboarding(selectedProjectId);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveItem = async (updates) => {
    setIsSaving(true);
    try {
      await api.updateMetaOnboarding(updates.project_id, updates);
      setEditingItem(null);
      loadMetaOnboarding(selectedProjectId);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      if (window.showToast) window.showToast('Token copiado al portapapeles', 'success');
    } catch (err) {
      console.error('Error al copiar: ', err);
    }
  };

  return (
    <div className={isTab ? 'flex flex-row w-full h-full pt-4 gap-4 pr-1 overflow-hidden' : 'flex flex-row w-full h-[calc(100vh-100px)] gap-4 overflow-hidden'} id="meta-grid-panel">
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

      {/* RIGHT COLUMN: META TABLE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl mb-4 shrink-0">
            <i className="bi bi-exclamation-triangle mr-2"></i>
            {error}
          </div>
        )}

        {!selectedProjectId ? (
          <div className="glass-card flex-1 flex items-center justify-center text-dim">
            Selecciona un proyecto a la izquierda para ver su meta_onboarding.
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
                  <i className="bi bi-meta text-4xl mb-3 opacity-50"></i>
                  <p>No se encontraron datos de onboarding para este proyecto.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {dataList.map(item => (
                    <div key={item.project_id} className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden">
                      <div className="flex justify-between items-start p-4 border-b border-[var(--border-soft)] bg-transparent">
                        <div>
                          <h3 className="font-bold text-main text-lg flex items-center gap-2">
                            <i className="bi bi-meta text-blue-500"></i> Meta Onboarding
                          </h3>
                          <div className="text-dim font-mono text-xs mt-1">Project ID: {item.project_id}</div>
                        </div>
                        <div className="flex gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.status === 'APPROVED' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-orange-500/10 border border-orange-500/20 text-orange-400'}`}>
                            {item.status || 'PENDING'}
                          </span>
                          <button 
                            className="bg-[var(--bg-glass)] hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] px-2 py-1 rounded transition-colors text-xs flex items-center gap-1"
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
                              <span className="text-[10px] uppercase text-dim font-bold tracking-wider">WhatsApp Business</span>
                              {(item.waba_id || item.phone_number_id) && (
                                <button 
                                  className="text-dim hover:text-main transition-colors"
                                  title="Copiar WABA ID y Phone ID"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const textToCopy = `WABA_ID: ${item.waba_id || ''}\nPHONE_NUMBER_ID: ${item.phone_number_id || ''}`;
                                    copyToClipboard(textToCopy);
                                  }}
                                >
                                  <i className="bi bi-copy text-[10px]"></i>
                                </button>
                              )}
                            </div>
                            <div className="text-main opacity-80"><span className="text-dim w-20 inline-block">WABA ID:</span> {item.waba_id || '-'}</div>
                            <div className="text-main opacity-80"><span className="text-dim w-20 inline-block">Phone ID:</span> {item.phone_number_id || '-'}</div>
                          </div>
                          <div className="flex flex-col gap-1 mt-2">
                            <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Redes Sociales</span>
                            <div className="text-main opacity-80"><span className="text-dim w-20 inline-block">FB Page:</span> {item.facebook_page_id || '-'}</div>
                            <div className="text-main opacity-80"><span className="text-dim w-20 inline-block">IG Biz:</span> {item.instagram_business_id || '-'}</div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Administración</span>
                            <div className="text-main opacity-80"><span className="text-dim w-16 inline-block">Owner:</span> {item.owner_id || '-'}</div>
                            <div className="text-main opacity-80"><span className="text-dim w-16 inline-block">Creado:</span> {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</div>
                            <div className="text-main opacity-80"><span className="text-dim w-16 inline-block">Actualiz:</span> {item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 pt-0 mt-2 border-t border-[var(--border-soft)] flex gap-2">
                        <button 
                          className="btn btn-sm text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors mt-3"
                          onClick={() => setTokenModalItem(item)}
                        >
                          <i className="bi bi-key-fill mr-2"></i>Access Token
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

      {/* TOKEN MODAL */}
      {tokenModalItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center bg-transparent">
              <h3 className="font-bold text-main text-lg"><i className="bi bi-key-fill mr-2 text-accent"></i>Access Token</h3>
              <button className="text-dim hover:text-main" onClick={() => setTokenModalItem(null)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="form-group">
                <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-2 block">Valor del Token</label>
                <textarea 
                  className="form-control bg-transparent border-[var(--border-light)] text-main placeholder-gray-600 font-mono text-xs min-h-[150px] w-full"
                  id="edit-access-token"
                  defaultValue={tokenModalItem.access_token || ''}
                  placeholder="Pegue aquí el token..."
                ></textarea>
              </div>
            </div>
            <div className="p-4 border-t border-[var(--border-light)] flex justify-between items-center bg-transparent gap-3">
              <button 
                className="btn btn-sm bg-transparent hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] transition-colors"
                onClick={() => {
                  const tokenVal = document.getElementById('edit-access-token').value;
                  copyToClipboard(tokenVal);
                }}
              >
                <i className="bi bi-copy mr-2"></i>Copiar
              </button>
              
              <div className="flex gap-2">
                <button className="btn btn-sm bg-transparent hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] transition-colors" onClick={() => setTokenModalItem(null)}>
                  Cancelar
                </button>
                <button 
                  className="btn btn-sm btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20"
                  disabled={isSaving}
                  onClick={() => handleSaveToken(tokenModalItem.project_id, document.getElementById('edit-access-token').value)}
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
              <h3 className="font-bold text-main text-lg"><i className="bi bi-pencil-square mr-2 text-accent"></i>Editar Datos</h3>
              <button className="text-dim hover:text-main transition-colors" onClick={() => setEditingItem(null)}>
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">WABA ID</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.waba_id || ''} id="edit-waba-id" />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Phone Number ID</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.phone_number_id || ''} id="edit-phone-id" />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Status</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.status || ''} id="edit-status" />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Owner ID</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.owner_id || ''} id="edit-owner-id" />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Facebook Page ID</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.facebook_page_id || ''} id="edit-fb-page-id" />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Instagram Business ID</label>
                  <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main" defaultValue={editingItem.instagram_business_id || ''} id="edit-ig-biz-id" />
                </div>
              </div>
              <div className="form-group mt-2">
                <label className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1 block">Onboarding Data (JSON)</label>
                <textarea 
                  className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-main placeholder-gray-600 font-mono text-xs min-h-[100px]"
                  id="edit-onboarding-data"
                  defaultValue={typeof editingItem.onboarding_data === 'object' ? JSON.stringify(editingItem.onboarding_data, null, 2) : (editingItem.onboarding_data || '')}
                ></textarea>
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
                  let onboardingData = null;
                  const rawData = document.getElementById('edit-onboarding-data').value;
                  if (rawData) {
                    try {
                      onboardingData = JSON.parse(rawData);
                    } catch(e) {
                      onboardingData = rawData;
                    }
                  }

                  const updates = {
                    project_id: editingItem.project_id,
                    waba_id: document.getElementById('edit-waba-id').value,
                    phone_number_id: document.getElementById('edit-phone-id').value,
                    status: document.getElementById('edit-status').value,
                    owner_id: document.getElementById('edit-owner-id').value,
                    facebook_page_id: document.getElementById('edit-fb-page-id').value,
                    instagram_business_id: document.getElementById('edit-ig-biz-id').value,
                    onboarding_data: onboardingData
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

export default MetaOnboardingView;
