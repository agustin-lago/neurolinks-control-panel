import React, { useState, useEffect } from 'react';
import { api } from '../../../core/api';
import { store, useStoreKey } from '../../../core/store';
import { useParams, useNavigate } from 'react-router-dom';
import { useSmartRefresh } from '../../../contexts/SmartRefreshContext';
import ProjectsGrid from './components/ProjectsGrid';
import ProjectDetailPanel from './components/ProjectDetailPanel';
import OnboardingModal from './components/OnboardingModal';
import { confirmAlert } from '../../../components/SweetAlert';
import Skeleton from '../../../components/Skeleton';

export default function ProjectsView({ navigate, isTab = false, basePath = '/proyectos' }) {
  // Shared data from global store - instant if already cached from another view
  const assistantsData = useStoreKey('assistants', () => store.fetchAssistants());
  const clientsData    = useStoreKey('clients',    () => store.fetchClients());

  const clients = clientsData || [];

  // Sort assistants by creation date (derived, no extra state)
  const assistants = assistantsData
    ? [...assistantsData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];

  // Show skeleton only on very first load
  const loading = assistantsData === null || clientsData === null;
  const [refreshing, setRefreshing] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [autoUpdateLoading, setAutoUpdateLoading] = useState(false);

  // Grid list controls
  const [isListView, setIsListView] = useState(() => window.innerWidth > 600);
  const [search, setSearch] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('');
  const [selectedWorkspaceFilter, setSelectedWorkspaceFilter] = useState('2');

  useEffect(() => {
    const handleResize = () => setIsListView(window.innerWidth > 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Map project ID to client object for quick lookup
  const projectClientMap = React.useMemo(() => {
    const map = {};
    clients.forEach(c => {
      const ids = Array.isArray(c.linked_projects)
        ? c.linked_projects.map(project => project.railway_project_id).filter(Boolean)
        : [];
      ids.forEach(pId => {
        if (pId) map[pId] = c;
      });
    });
    return map;
  }, [clients]);

  // Selected assistant detail state
  const { '*': currentPath } = useParams();
  const normalizedPath = currentPath === 'proyectos'
    ? null
    : (currentPath?.startsWith('proyectos/') ? currentPath.slice('proyectos/'.length) : currentPath);
  const selectedProjectId = normalizedPath ? normalizedPath.split('/')[0] : null;
  const navigateRouter = useNavigate();

  const setSelectedProjectId = (id) => {
    if (id) {
      navigateRouter(`${basePath}/${id}`);
    } else {
      navigateRouter(basePath);
    }
  };
  const [selectedProject, setSelectedProject] = useState(null);
  const [onboardingProjectId, setOnboardingProjectId] = useState(null);
  const [projectClient, setProjectClient] = useState(null);
  const [clientTicketsCount, setClientTicketsCount] = useState(0);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [domainsCache, setDomainsCache] = useState({}); // { serviceId: string }
  const [loadingHeaderData, setLoadingHeaderData] = useState(false);
  
  const [allOnboardings, setAllOnboardings] = useState({});

  useEffect(() => {
    const fetchOnboardings = async () => {
      try {
        const res = await api.fetchAllProjectOnboardings();
        if (Array.isArray(res)) {
          const map = {};
          res.forEach(item => {
            map[item.project_id] = item;
          });
          setAllOnboardings(map);
        }
      } catch (err) {
        console.error('Error fetching onboardings', err);
      }
    };
    fetchOnboardings();
  }, []);

  // Realtime updates for onboardings
  useSmartRefresh('stream_project_onboarding', (payload) => {
    const item = payload.item;
    if (item && item.project_id) {
      setAllOnboardings(prev => ({
        ...prev,
        [item.project_id]: item
      }));
    }


  });

  // Modals state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  
  useEffect(() => {
    let cancelled = false;
    const loadAutoUpdateState = async () => {
      try {
        const state = await api.getProjectsAutoUpdate();
        if (!cancelled) setAutoUpdateEnabled(!!state.enabled);
      } catch (err) {
        console.error('[ProjectsView] Error loading auto-update state:', err);
      }
    };
    loadAutoUpdateState();
    return () => { cancelled = true; };
  }, []);

  const handleAutoUpdateToggle = async (e) => {
    const checked = e.target.checked;
    setAutoUpdateEnabled(checked);
    setAutoUpdateLoading(true);
    try {
      const state = await api.updateProjectsAutoUpdate(checked);
      setAutoUpdateEnabled(!!state.enabled);
      window.showToast(`Actualizacion automatica ${state.enabled ? 'activada' : 'desactivada'}`, 'success');
    } catch (err) {
      setAutoUpdateEnabled(!checked);
      window.showToast('Error al actualizar la configuracion automatica', 'danger');
    } finally {
      setAutoUpdateLoading(false);
    }
  };

  // Manual refresh - forces a real Railway API call bypassing server cache
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        store.fetchAssistants(true),
        store.fetchClients(true),
      ]);
    } catch (err) {
      window.showToast('Error al cargar proyectos', 'danger');
    } finally {
      setRefreshing(false);
    }
  };

  // Background polling: every 15s re-fetch via store (uses server cache, nearly instant)
  useEffect(() => {
    const timer = setInterval(() => {
      store.fetchAssistants().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Update selected project object when assistants list or selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      const proj = assistants.find(p => p.id === selectedProjectId);
      setSelectedProject(proj || null);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, assistants]);

  // Load details header metadata (WhatsApp, Linked Client, Tickets, Settings)
  const fetchDetailMetadata = async () => {
    if (!selectedProjectId) return;
    setLoadingHeaderData(true);
    try {
      // 1. Linked client
      const linked = await api.getProjectClient(selectedProjectId);
      setProjectClient(linked?.clientes || null);

      if (linked?.clientes) {
        // 2. Pending tickets
        const tCount = await api.getClientPendingTickets(linked.clientes.id);
        setClientTicketsCount(tCount || 0);
      } else {
        setClientTicketsCount(0);
      }

      // 3. WhatsApp connectivity
      const ws = await api.getWhatsAppStatus(selectedProjectId);
      setWhatsappStatus(ws);
    } catch (err) {
      console.error('[ProjectsView] Error loading details metadata:', err);
    } finally {
      setLoadingHeaderData(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchDetailMetadata();
    }
  }, [selectedProjectId]);

  // Resolve service domains
  useEffect(() => {
    if (selectedProject && selectedProject.services) {
      selectedProject.services.forEach(svc => {
        if (!domainsCache[svc.id]) {
          api.getServiceDomains(svc.projectId, svc.environmentId, svc.id, svc.railwayWorkspaceKey)
            .then(domains => {
              const domain = domains?.customDomains?.[0]?.domain || domains?.serviceDomains?.[0]?.domain || 'Sin dominio público';
              setDomainsCache(prev => ({ ...prev, [svc.id]: domain }));
            })
            .catch(() => {
              setDomainsCache(prev => ({ ...prev, [svc.id]: '-' }));
            });
        }
      });
    }
  }, [selectedProject]);

  const getStatusIcon = (status) => {
    if (!status) return 'bi-circle';
    switch (status.toLowerCase()) {
      case 'online': return 'bi-check-circle-fill text-emerald-400';
      case 'error': return 'bi-exclamation-circle-fill text-red-400';
      default: return 'bi-arrow-repeat text-yellow-400';
    }
  };

  const getStatusColor = (status) => {
    if (!status) return 'secondary';
    switch (status.toLowerCase()) {
      case 'online': return 'success';
      case 'error': return 'danger';
      case 'checking': return 'warning';
      default: return 'secondary';
    }
  };

  const handleRedeploy = async (serviceId, environmentId) => {
    if (!(await confirmAlert('¿Deseas reiniciar este servicio?', 'Reiniciar Servicio'))) return;
    try {
      const service = selectedProject?.services?.find(s => s.id === serviceId);
      await api.redeployService(serviceId, environmentId, service?.railwayWorkspaceKey);
      window.showToast('Reinicio solicitado correctamente', 'success');
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al reiniciar el servicio', 'danger');
    }
  };

  // Inline rename service
  const [renamingServiceId, setRenamingServiceId] = useState(null);
  const [renamingServiceName, setRenamingServiceName] = useState('');

  const handleStartRenameService = (svc) => {
    setRenamingServiceId(svc.id);
    setRenamingServiceName(svc.name);
  };

  const handleSaveRenameService = async (svcId) => {
    const nextName = renamingServiceName.trim();
    if (!nextName) return;
    try {
      const service = selectedProject?.services?.find(s => s.id === svcId);
      await api.renameService(svcId, nextName, service?.railwayWorkspaceKey);
      store.updateLocal('assistants', list => (list || []).map(project => ({
        ...project,
        services: (project.services || []).map(service => service.id === svcId ? { ...service, name: nextName } : service)
      })));
      window.showToast('Servicio renombrado', 'success');
      setRenamingServiceId(null);
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al renombrar servicio', 'danger');
    }
  };
  const handleServiceUpdate = async (projectId, environmentId, serviceId) => {
    if (!(await confirmAlert('¿Actualizar este servicio a la última versión disponible?', 'Actualizar Servicio'))) return;
    try {
      const service = selectedProject?.services?.find(s => s.id === serviceId);
      await api.updateService(projectId, environmentId, serviceId, service?.railwayWorkspaceKey);
      window.showToast('Actualización iniciada correctamente', 'success');
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al aplicar la actualización', 'danger');
    }
  };

  // Update all services
  const handleUpdateAll = async () => {
    const updatable = assistants.flatMap(p => (p.services || []).filter(s => s.isUpdatable)) || [];
    if (updatable.length === 0) {
      window.showToast('No hay actualizaciones disponibles', 'info');
      return;
    }
    if (!(await confirmAlert(`¿Actualizar ${updatable.length} servicio(s) a la última versión?`, 'Actualizar Todo'))) return;

    try {
      const results = await Promise.allSettled(
        updatable.map(s => api.updateService(s.projectId, s.environmentId, s.id, s.railwayWorkspaceKey))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        window.showToast(`${updatable.length} servicio(s) actualizado(s) correctamente`, 'success');
      } else {
        window.showToast(`${updatable.length - failed} actualizados, ${failed} con error`, 'warning');
      }
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error en actualización global', 'danger');
    }
  };

  // Rename Project
  const handleOpenRenameProject = () => {
    if (!selectedProject) return;
    setRenameValue(selectedProject.name);
    setIsRenameModalOpen(true);
  };

  const handleSaveRenameProject = async (e) => {
    e.preventDefault();
    const nextName = renameValue.trim();
    if (!nextName || !selectedProjectId) return;
    try {
      await api.updateProjectName(selectedProjectId, nextName, selectedProject?.railwayWorkspaceKey);
      if (selectedProject && selectedProject.services && selectedProject.services.length > 0) {
        await Promise.allSettled(
          selectedProject.services.map(s => api.renameService(s.id, nextName, s.railwayWorkspaceKey))
        );
      }
      store.updateLocal('assistants', list => (list || []).map(project => {
        if (project.id !== selectedProjectId) return project;
        return {
          ...project,
          name: nextName,
          services: (project.services || []).map(service => ({ ...service, name: nextName }))
        };
      }));
      window.showToast('Proyecto renombrado', 'success');
      setIsRenameModalOpen(false);
      store.fetchAssistants(true).catch(() => {});
      store.fetchClients(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al renombrar el proyecto', 'danger');
    }
  };
  const handleDeleteProject = async () => {
    if (!selectedProjectId) return;
    const confirmDelete = await confirmAlert('¿Seguro que querés eliminar este proyecto?<br><br>Esta acción es irreversible.', 'Eliminar Proyecto', 'Eliminar Definitivamente', 'Cancelar');
    if (!confirmDelete) return;

    try {
      await api.deleteProject(selectedProjectId, selectedProject?.railwayWorkspaceKey);
      window.showToast('Proyecto eliminado', 'success');
      setSelectedProjectId(null);
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al eliminar el proyecto', 'danger');
    }
  };

  if (loading) {
    return (
      <div className={isTab ? 'flex flex-col w-full h-full pt-4 overflow-y-auto pr-1' : ''}>
        <div className="view-header">
          <div className="view-header-left">
            <Skeleton variant="title" className="w-48 mb-2" />
            <Skeleton variant="text" className="w-64" />
          </div>
          <div className="view-header-controls">
            <Skeleton variant="button" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  // Filter list
  const filteredAssistants = assistants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedWorkspaceFilter && p.railwayWorkspaceKey !== selectedWorkspaceFilter) return false;
    if (!selectedClientFilter) return true;
    const assignedClient = projectClientMap[p.id];
    return assignedClient && assignedClient.id === selectedClientFilter;
  });

  const anyUpdatable = assistants.some(p => (p.services || []).some(s => s.isUpdatable));

  return (
    <div className={isTab ? 'flex flex-col w-full h-full pt-4 overflow-y-auto pr-1' : ''}>
      <style>{`
        /* Glow effect for Client button in Dark Mode */
        [data-theme="dark"] .btn-client-glow:hover {
          box-shadow: 0 0 20px rgba(14, 165, 233, 0.6), 0 0 8px rgba(14, 165, 233, 0.9) !important;
          border: 1px solid rgba(14, 165, 233, 0.8) !important;
          background-color: rgba(14, 165, 233, 0.15) !important;
        }
        [data-theme="dark"] .btn-client-link-glow:hover {
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.6), 0 0 8px rgba(16, 185, 129, 0.9) !important;
          border: 1px solid rgba(16, 185, 129, 0.8) !important;
          background-color: rgba(16, 185, 129, 0.15) !important;
        }

        /* Glow effect for Client button in Light Mode */
        [data-theme="light"] .btn-client-glow:hover {
          box-shadow: 0 0 14px rgba(2, 132, 199, 0.45), 0 0 4px rgba(2, 132, 199, 0.6) !important;
          border: 1px solid rgba(2, 132, 199, 0.5) !important;
          background-color: rgba(14, 165, 233, 0.08) !important;
        }
        [data-theme="light"] .btn-client-link-glow:hover {
          box-shadow: 0 0 14px rgba(5, 150, 105, 0.45), 0 0 4px rgba(5, 150, 105, 0.6) !important;
          border: 1px solid rgba(5, 150, 105, 0.5) !important;
          background-color: rgba(16, 185, 129, 0.08) !important;
        }

        /* Custom styles for search dropdown container in modal */
        [data-theme="dark"] .client-search-container {
          background-color: rgba(0, 0, 0, 0.4);
          border-color: var(--border-soft, #333);
        }
        [data-theme="dark"] .client-search-item:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        [data-theme="light"] .client-search-container {
          background-color: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 0, 0, 0.15);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        [data-theme="light"] .client-search-item {
          color: var(--text-main, #222);
        }
        [data-theme="light"] .client-search-item:hover {
          background-color: rgba(0, 0, 0, 0.06);
        }

        /* Modal close button fix for Light Mode */
        [data-theme="light"] .modal-header .btn-close {
          filter: invert(1) grayscale(100%) brightness(0);
        }
      `}</style>
      {selectedProject ? (
        <ProjectDetailPanel
          selectedProject={selectedProject}
          setSelectedProjectId={setSelectedProjectId}
          fetchDetailMetadata={fetchDetailMetadata}
          handleOpenRenameProject={handleOpenRenameProject}
          api={api}
          handleDeleteProject={handleDeleteProject}
          projectClient={projectClient}
          window={window}
          navigate={navigate}
          clientTicketsCount={clientTicketsCount}
          whatsappStatus={whatsappStatus}
          domainsCache={domainsCache}
          renamingServiceId={renamingServiceId}
          renamingServiceName={renamingServiceName}
          setRenamingServiceName={setRenamingServiceName}
          handleSaveRenameService={handleSaveRenameService}
          setRenamingServiceId={setRenamingServiceId}
          getStatusIcon={getStatusIcon}
          handleServiceUpdate={handleServiceUpdate}
          handleRedeploy={handleRedeploy}
        />
      ) : (
        <ProjectsGrid
          search={search}
          setSearch={setSearch}
          selectedClientFilter={selectedClientFilter}
          setSelectedClientFilter={setSelectedClientFilter}
          selectedWorkspaceFilter={selectedWorkspaceFilter}
          setSelectedWorkspaceFilter={setSelectedWorkspaceFilter}
          clients={clients}
          anyUpdatable={anyUpdatable}
          handleUpdateAll={handleUpdateAll}
          autoUpdateEnabled={autoUpdateEnabled}
          autoUpdateLoading={autoUpdateLoading}
          handleAutoUpdateToggle={handleAutoUpdateToggle}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          isListView={isListView}
          filteredAssistants={filteredAssistants}
          getStatusColor={getStatusColor}
          projectClientMap={projectClientMap}
          setSelectedProjectId={setSelectedProjectId}
          setOnboardingProjectId={setOnboardingProjectId}
          allOnboardings={allOnboardings}
        />
      )}

      {/* ONBOARDING MODAL OVERLAY */}
      {onboardingProjectId && (
        <OnboardingModal 
          projectId={onboardingProjectId}
          projectName={assistants.find(p => p.id === onboardingProjectId)?.name || 'Proyecto'}
          onClose={() => setOnboardingProjectId(null)}
          api={api}
        />
      )}

      {/* RENAME PROJECT MODAL OVERLAY */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center  shrink-0">
              <h3 className="font-bold text-[var(--text-main)] text-lg"><i className="bi bi-pencil-square mr-2 text-accent"></i>Renombrar proyecto</h3>
              <button type="button" className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors" onClick={() => setIsRenameModalOpen(false)}>
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleSaveRenameProject} className="flex flex-col min-h-0">
              <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">Nuevo nombre</label>
                  <input type="text" className="form-control form-control-sm  border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} required />
                </div>
              </div>
              <div className="p-4 border-t border-[var(--border-light)] flex justify-end gap-3  shrink-0">
                <button type="button" className="btn btn-sm  hover:bg-white/10 text-[var(--text-dim)] hover:text-[var(--text-main)] border border-[var(--border-light)] transition-colors" onClick={() => setIsRenameModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-sm btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20"><i className="bi bi-check2-circle"></i> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
