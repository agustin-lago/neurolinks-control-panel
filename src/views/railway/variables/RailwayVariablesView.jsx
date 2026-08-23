import React, { useState, useEffect } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';
import { confirmAlert } from '../../../components/SweetAlert';
import Swal from 'sweetalert2';

const RailwayVariablesView = ({ isTab = false }) => {
  const [projects, setProjects] = useState([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // En Railway variables are grouped by project > service
  // Let's store selected Project AND selected Service
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('rlVarProjectId') || null);
  const [selectedServiceId, setSelectedServiceId] = useState(() => sessionStorage.getItem('rlVarServiceId') || null);
  
  const [variables, setVariables] = useState({});
  const [isLoadingVariables, setIsLoadingVariables] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [formData, setFormData] = useState({ key: '', value: '' });
  const [isSaving, setIsSaving] = useState(false);

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
      sessionStorage.setItem('rlVarProjectId', selectedProjectId);
      // Wait for projects to be loaded before trying to fetch variables (because it needs environmentId)
      if (selectedServiceId && projects.length > 0) {
        sessionStorage.setItem('rlVarServiceId', selectedServiceId);
        loadVariables(selectedProjectId, selectedServiceId);
      } else if (!selectedServiceId) {
        sessionStorage.removeItem('rlVarServiceId');
        setVariables({});
      }
    } else {
      sessionStorage.removeItem('rlVarProjectId');
      sessionStorage.removeItem('rlVarServiceId');
      setVariables({});
    }
  }, [selectedProjectId, selectedServiceId, projects]);

  const loadVariables = async (projectId, serviceId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const environmentId = project.services?.[0]?.environmentId;
    if (!environmentId) return;

    setIsLoadingVariables(true);
    try {
      // In railwayService, variables are returned as an object { KEY: "VALUE" }
      const data = await api.getServiceVariables(projectId, environmentId, serviceId === 'env' ? null : serviceId, project.railwayWorkspaceKey);
      setVariables(data || {});
    } catch (err) {
      console.error('Error loading variables:', err);
    } finally {
      setIsLoadingVariables(false);
    }
  };

  const getEnvironmentId = () => {
    const project = projects.find(p => p.id === selectedProjectId);
    return project?.services?.[0]?.environmentId;
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setFormData({ key: '', value: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (key, value) => {
    setModalMode('edit');
    setFormData({ key, value: String(value) });
    setIsModalOpen(true);
  };

  const handleDelete = async (key) => {
    const confirmed = await confirmAlert(
      'Esta acción no se puede deshacer y puede romper el servicio.',
      '¿Eliminar variable?',
      'Sí, eliminar',
      'Cancelar',
      'btn btn-danger'
    );

    if (confirmed) {
      try {
        const envId = getEnvironmentId();
        await api.deleteVariable(selectedProjectId, envId, selectedServiceId === 'env' ? null : selectedServiceId, key, selectedProject?.railwayWorkspaceKey);
        Swal.fire({ title: '¡Eliminado!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        loadVariables(selectedProjectId, selectedServiceId);
      } catch (err) {
        Swal.fire('Error', 'No se pudo eliminar la variable.', 'error');
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
      const envId = getEnvironmentId();
      await api.upsertVariable(selectedProjectId, envId, selectedServiceId === 'env' ? null : selectedServiceId, formData.key, formData.value, selectedProject?.railwayWorkspaceKey);
      Swal.fire({ title: '¡Guardado!', text: 'Variable actualizada (Railway hará un re-deploy)', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      setIsModalOpen(false);
      loadVariables(selectedProjectId, selectedServiceId);
    } catch (err) {
      console.error('Error guardando:', err);
      Swal.fire('Error', 'No se pudo guardar la variable.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const variablesEntries = Object.entries(variables);

  return (
    <>
      <div className={isTab ? 'flex flex-row w-full h-full pt-4 gap-4 pr-1 overflow-hidden' : 'flex flex-row w-full h-[calc(100vh-100px)] gap-4 overflow-hidden'}>
        
        {/* LEFT COLUMN: PROJECTS & SERVICES */}
        <div className="w-1/3 max-w-[300px] flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar shrink-0">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <h6 className="text-dim text-sm font-bold m-0">PROYECTOS & SERVICIOS</h6>
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
              <div key={p.id} className="flex flex-col gap-1 mb-2">
                {/* Project Header */}
                <div 
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    setSelectedServiceId('env');
                  }}
                  className={`glass-card p-3 rounded cursor-pointer transition-colors border flex flex-col ${selectedProjectId === p.id && selectedServiceId === 'env' ? '' : 'border-[var(--border-light)] hover:bg-[var(--bg-glass)]'}`}
                  style={selectedProjectId === p.id && selectedServiceId === 'env' ? {
                    borderColor: 'var(--color-accent, #0078D4)',
                    backgroundColor: 'rgba(0, 120, 212, 0.2)',
                    boxShadow: '0 0 15px rgba(0, 120, 212, 0.4)'
                  } : {}}
                >
                  <div className="font-bold text-sm text-[var(--text-main)] truncate w-full flex items-center gap-2">
                    <i className="bi bi-train-front text-[var(--accent)]"></i>
                    {p.name}
                  </div>
                  <div className="text-[10px] text-dim ml-6">Entorno Compartido</div>
                </div>

                {/* Services */}
                {selectedProjectId === p.id && p.services?.map(s => {
                  return (
                    <div 
                      key={s.id}
                      onClick={() => setSelectedServiceId(s.id)}
                      className={`ml-4 p-2 rounded cursor-pointer transition-colors border flex items-center ${selectedServiceId === s.id ? 'bg-[var(--accent)]/20 border-[var(--accent)]' : 'border-transparent hover:bg-white/5 text-dim'}`}
                    >
                      <i className="bi bi-box-seam mr-2 text-[10px]"></i>
                      <span className="text-xs truncate">{s.name}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: VARIABLES */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedProjectId || !selectedServiceId ? (
            <div className="glass-card flex-1 flex items-center justify-center text-dim text-center">
              <div>
                <i className="bi bi-sliders text-4xl mb-3 opacity-50 block"></i>
                Selecciona un entorno o servicio a la izquierda para configurar variables.
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* HEADER */}
              <div className="flex justify-between items-center mb-4 shrink-0 px-2">
                <div className="flex flex-col">
                  <h3 className="font-bold text-main text-xl m-0 flex items-center gap-2 truncate">
                    <i className="bi bi-sliders text-[var(--accent)]"></i> 
                    Variables de Entorno
                  </h3>
                  <div className="text-xs text-dim mt-1 truncate">
                    {selectedProject?.name} {selectedServiceId !== 'env' && `> Servicio`}
                  </div>
                </div>
                <button 
                  onClick={handleOpenCreateModal}
                  className="bg-[var(--accent)] text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-opacity-80 transition-all flex items-center gap-2 shrink-0 shadow-lg"
                >
                  <i className="bi bi-plus-lg"></i> Nueva Variable
                </button>
              </div>

              {/* GRID */}
              <div className="overflow-y-auto w-full flex-1 custom-scrollbar pr-2 pb-4">
                {isLoadingVariables ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                    <Skeleton variant="card" className="h-24 w-full" />
                    <Skeleton variant="card" className="h-24 w-full" />
                    <Skeleton variant="card" className="h-24 w-full" />
                    <Skeleton variant="card" className="h-24 w-full" />
                  </div>
                ) : variablesEntries.length === 0 ? (
                  <div className="glass-card p-8 text-center text-dim rounded-xl border border-[var(--border-light)]">
                    No hay variables configuradas para este entorno.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {variablesEntries.map(([key, value]) => (
                      <div key={key} className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden transition-all hover:border-white/20">
                        <div className="flex justify-between items-center p-3 border-b border-[var(--border-soft)] bg-black/10">
                          <div className="font-bold text-main font-mono text-sm truncate pr-2">
                            {key}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              className="bg-black/30 hover:bg-white/10 text-main border border-[var(--border-light)] px-2 py-1 rounded transition-colors text-xs"
                              onClick={() => handleOpenEditModal(key, value)}
                              title="Editar valor"
                            >
                              <i className="bi bi-pencil-fill"></i>
                            </button>
                            <button 
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded transition-colors text-xs"
                              onClick={() => handleDelete(key)}
                              title="Eliminar variable"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                        <div className="p-4 flex flex-col gap-2">
                          <div className="text-dim text-[10px] uppercase font-bold tracking-wider">Valor</div>
                          <div className="text-main bg-black/20 p-2 rounded border border-white/5 font-mono text-xs break-all whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
                            {value !== null && value !== undefined ? String(value) : '-'}
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

      {/* MODAL (Create/Edit) */}
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
                    placeholder="Ej: NODE_ENV"
                    disabled={modalMode === 'edit'} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">VALOR</label>
                  <textarea 
                    className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600 font-mono custom-scrollbar" 
                    rows={4}
                    value={formData.value} 
                    onChange={(e) => setFormData({...formData, value: e.target.value})} 
                    placeholder="Contenido del valor..."
                    required
                  ></textarea>
                </div>
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
    </>
  );
};

export default RailwayVariablesView;
