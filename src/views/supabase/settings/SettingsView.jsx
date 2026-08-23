import React, { useState, useEffect } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';
import { useSmartRefresh } from '../../../contexts/SmartRefreshContext';
import { confirmAlert } from '../../../components/SweetAlert';
import Swal from 'sweetalert2';

const SettingsView = ({ isTab = false }) => {
  const [projects, setProjects] = useState([]);
  const [settingsList, setSettingsList] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('stSettingsProjectId') || null);
  const [projectSearch, setProjectSearch] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Modal states for Create/Edit key-value
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [formData, setFormData] = useState({ key: '', value: '', api_key: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Modal state for API Key
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [selectedApiKeySetting, setSelectedApiKeySetting] = useState(null);
  const [apiKeyFormValue, setApiKeyFormValue] = useState('');

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  useSmartRefresh('stream_settings', (data) => {
    try {
      if (data.type === 'INSERT' || data.type === 'UPDATE' || data.type === 'DELETE') {
        const payloadProject = data.item?.project_id;
        if (payloadProject && selectedProjectId && String(payloadProject) === String(selectedProjectId)) {
          loadSettings(selectedProjectId);
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
      sessionStorage.setItem('stSettingsProjectId', selectedProjectId);
      loadSettings(selectedProjectId);
    } else {
      sessionStorage.removeItem('stSettingsProjectId');
      setSettingsList([]);
    }
  }, [selectedProjectId]);

  const loadSettings = async (projectId) => {
    setIsLoadingSettings(true);
    try {
      const data = await api.getSettings(projectId);
      setSettingsList(data || []);
    } catch (err) {
      console.error('Error al cargar los settings', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setFormData({ key: '', value: '', api_key: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (setting) => {
    setModalMode('edit');
    setFormData({ key: setting.key, value: setting.value || '', api_key: setting.api_key || '' });
    setIsModalOpen(true);
  };

  const handleOpenApiKeyModal = (setting) => {
    setSelectedApiKeySetting(setting);
    setApiKeyFormValue(setting.api_key || '');
    setIsApiKeyModalOpen(true);
  };

  const handleDelete = async (key) => {
    const confirmed = await confirmAlert(
      'Esta acción no se puede deshacer.',
      '¿Eliminar setting?',
      'Sí, eliminar',
      'Cancelar',
      'btn btn-danger'
    );

    if (confirmed) {
      try {
        await api.deleteSetting(selectedProjectId, key);
        loadSettings(selectedProjectId); // Refresh explicitly just in case SSE fails
      } catch (err) {
        Swal.fire('Error', 'No se pudo eliminar el setting.', 'error');
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.key) {
      Swal.fire({ title: 'Error', text: 'El Key es requerido', icon: 'warning', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      return;
    }

    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        await api.createSetting(selectedProjectId, formData.key, formData.value, formData.api_key || null);
        Swal.fire({ title: '¡Creado!', text: 'Configuración guardada', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } else {
        await api.updateSetting(selectedProjectId, formData.key, { value: formData.value });
        Swal.fire({ title: '¡Guardado!', text: 'Configuración actualizada', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      }
      setIsModalOpen(false);
      loadSettings(selectedProjectId);
    } catch (err) {
      console.error('Error guardando:', err);
      Swal.fire('Error', 'No se pudo guardar la información.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!selectedApiKeySetting) return;

    setIsSaving(true);
    try {
      await api.updateSetting(selectedProjectId, selectedApiKeySetting.key, { api_key: apiKeyFormValue || null });
      Swal.fire({ title: '¡API Key guardada!', text: 'Se ha actualizado la credencial', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      setIsApiKeyModalOpen(false);
      loadSettings(selectedProjectId);
    } catch (err) {
      console.error('Error guardando API Key:', err);
      Swal.fire('Error', 'No se pudo actualizar la API Key.', 'error');
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
    <>
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
            <div className="flex flex-col gap-2 p-2">
              <Skeleton variant="card" className="h-16 w-full !p-3" />
              <Skeleton variant="card" className="h-16 w-full !p-3" />
              <Skeleton variant="card" className="h-16 w-full !p-3" />
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
                  <i className="bi bi-cpu-fill mr-2 text-[var(--accent)]"></i>
                  {p.name}
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: SETTINGS */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedProjectId ? (
            <div className="glass-card flex-1 flex items-center justify-center text-dim text-center">
              <div>
                <i className="bi bi-sliders text-4xl mb-3 opacity-50 block"></i>
                Selecciona un proyecto a la izquierda para configurar sus variables.
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* HEADER */}
              <div className="flex justify-between items-center mb-4 shrink-0 px-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-main text-xl m-0 flex items-center gap-2 truncate">
                    <i className="bi bi-sliders text-[var(--accent)]"></i> {selectedProject?.name || 'Configuración'}
                  </h3>
                  <div className="text-xs text-dim font-mono bg-black/20 px-2 py-1 rounded">
                    ID: {selectedProjectId}
                  </div>
                </div>
                <button 
                  onClick={handleOpenCreateModal}
                  className="bg-[var(--accent)] text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-opacity-80 transition-all flex items-center gap-2 shrink-0 shadow-lg"
                >
                  <i className="bi bi-plus-lg"></i> Nuevo Setting
                </button>
              </div>

              {/* GRID */}
              <div className="overflow-y-auto w-full flex-1 custom-scrollbar pr-2 pb-4">
                {isLoadingSettings ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Skeleton variant="card" className="h-32 w-full" />
                    <Skeleton variant="card" className="h-32 w-full" />
                    <Skeleton variant="card" className="h-32 w-full" />
                    <Skeleton variant="card" className="h-32 w-full" />
                  </div>
                ) : settingsList.length === 0 ? (
                  <div className="glass-card p-8 text-center text-dim rounded-xl border border-[var(--border-light)]">
                    No hay variables de configuración para este proyecto.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {settingsList.map(setting => (
                      <div key={setting.key} className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden transition-all hover:border-white/20">
                        <div className="flex justify-between items-center p-3 border-b border-[var(--border-soft)] bg-black/10">
                          <div className="font-bold text-main font-mono text-sm truncate pr-2">
                            {setting.key}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* 
                            <button 
                              className="bg-black/30 hover:bg-white/10 text-[var(--accent)] border border-[var(--border-light)] px-2 py-1 rounded transition-colors text-xs flex items-center gap-1"
                              onClick={() => handleOpenApiKeyModal(setting)}
                            >
                              <i className="bi bi-key-fill"></i> API Key
                            </button>
                            */}
                            <button 
                              className="bg-black/30 hover:bg-white/10 text-main border border-[var(--border-light)] px-2 py-1 rounded transition-colors text-xs"
                              onClick={() => handleOpenEditModal(setting)}
                              title="Editar valor"
                            >
                              <i className="bi bi-pencil-fill"></i>
                            </button>
                            <button 
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded transition-colors text-xs"
                              onClick={() => handleDelete(setting.key)}
                              title="Eliminar setting"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                        <div className="p-4 flex flex-col gap-2">
                          <div className="text-dim text-[10px] uppercase font-bold tracking-wider">Valor</div>
                          <div className="text-main bg-black/20 p-2 rounded border border-white/5 font-mono text-xs break-all whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
                            {setting.value !== null && setting.value !== undefined ? String(setting.value) : '-'}
                          </div>
                          <div className="text-dim text-[10px] mt-2 text-right">
                            Actualizado: {setting.updated_at ? new Date(setting.updated_at).toLocaleString() : '-'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL MAIN (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center shrink-0">
              <h3 className="font-bold text-[var(--text-main)] text-lg flex items-center gap-2 m-0">
                <i className="bi bi-sliders text-[var(--accent)]"></i> 
                {modalMode === 'create' ? 'Nueva Variable' : 'Editar Variable'}
              </h3>
              <button 
                type="button" 
                className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors" 
                onClick={() => setIsModalOpen(false)}
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col min-h-0">
              <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                
                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">KEY (CLAVE)</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600 font-mono" 
                    value={formData.key} 
                    onChange={(e) => setFormData({...formData, key: e.target.value.toUpperCase()})} 
                    placeholder="Ej: ADMIN_USER"
                    disabled={modalMode === 'edit'} // No se puede editar la clave una vez creada
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">VALOR</label>
                  <textarea 
                    className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600 font-mono custom-scrollbar" 
                    rows={4}
                    value={formData.value} 
                    onChange={(e) => setFormData({...formData, value: e.target.value})} 
                    placeholder="Contenido del valor..."
                  ></textarea>
                </div>
                
                {/* modalMode === 'create' && (
                  <div className="form-group mt-2">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">API KEY (Opcional)</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600 font-mono" 
                      value={formData.api_key} 
                      onChange={(e) => setFormData({...formData, api_key: e.target.value})} 
                      placeholder="sk-..."
                    />
                  </div>
                ) */}
              </div>
              
              <div className="p-4 border-t border-[var(--border-light)] flex justify-end gap-3 shrink-0 bg-white/5">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm flex items-center gap-2" disabled={isSaving}>
                  {isSaving ? (
                    <><i className="bi bi-hourglass-split animate-spin"></i> Guardando...</>
                  ) : (
                    <><i className="bi bi-check2"></i> Guardar cambios</>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL API KEY */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--color-accent)] shadow-[0_0_30px_rgba(0,120,212,0.3)] flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-[var(--text-main)] text-lg flex items-center gap-2 m-0">
                  <i className="bi bi-key-fill text-[var(--accent)]"></i> API Key
                </h3>
                <div className="text-xs text-dim font-mono mt-1">{selectedApiKeySetting?.key}</div>
              </div>
              <button 
                type="button" 
                className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors" 
                onClick={() => setIsApiKeyModalOpen(false)}
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSaveApiKey} className="flex flex-col min-h-0">
              <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-2 block">VALOR SECRETO DE API KEY</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="form-control border-white/20 text-[var(--text-main)] font-mono bg-black/40 pr-10" 
                      value={apiKeyFormValue} 
                      onChange={(e) => setApiKeyFormValue(e.target.value)} 
                      placeholder="Ingresar o modificar API Key..."
                    />
                  </div>
                  <div className="text-xs text-dim mt-2">
                    <i className="bi bi-shield-check text-green-400 mr-1"></i>
                    Esta credencial se guarda de forma segura en la tabla settings.
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-white/10 flex justify-between gap-3 shrink-0 bg-black/20">
                <button 
                  type="button" 
                  className="btn btn-outline-light btn-sm flex items-center gap-2" 
                  onClick={() => copyToClipboard(apiKeyFormValue)}
                  disabled={!apiKeyFormValue}
                >
                  <i className="bi bi-copy"></i> Copiar
                </button>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setIsApiKeyModalOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm flex items-center gap-2" disabled={isSaving}>
                    {isSaving ? (
                      <><i className="bi bi-hourglass-split animate-spin"></i> Guardando...</>
                    ) : (
                      <><i className="bi bi-check2"></i> Guardar cambios</>
                    )}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  );
};

export default SettingsView;
