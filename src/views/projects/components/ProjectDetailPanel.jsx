import React from 'react';
import { useNavigate } from 'react-router-dom';
import ServiceCard from './ServiceCard';

export default function ProjectDetailPanel({
  selectedProject,
  setSelectedProjectId,
  fetchDetailMetadata,
  handleOpenRenameProject,
  api,
  handleDeleteProject,
  projectClient,
  window,
  navigate,
  clientTicketsCount,
  whatsappStatus,
  domainsCache,
  renamingServiceId,
  renamingServiceName,
  setRenamingServiceName,
  handleSaveRenameService,
  setRenamingServiceId,
  getStatusIcon,
  handleServiceUpdate,
  handleRedeploy
}) {
  const navigateRouter = useNavigate();

  return (
    <div className="anim-slide-right">
      {/* HEADER / TOPBAR */}
      <div className="view-header flex items-center justify-between gap-3 w-full mb-6" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <div className="flex items-center gap-3 overflow-hidden">
          <button className="btn btn-outline-light btn-sm flex items-center justify-center shrink-0 gap-2" onClick={() => setSelectedProjectId(null)} title="Volver a Proyectos">
            <i className="bi bi-arrow-left"></i> <span className="hidden sm:inline">Todos los proyectos</span>
          </button>
          <h2 className="view-header-title mb-0 text-base sm:text-lg lg:text-xl truncate hidden sm:block">{selectedProject.name}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">

          <div className="dropdown">
            <button className="btn btn-outline-light btn-sm dropdown-toggle flex items-center justify-center" data-bs-toggle="dropdown" aria-expanded="false">
              <i className="bi bi-three-dots-vertical"></i>
            </button>
            <ul className="dropdown-menu dropdown-menu-end dropdown-menu-dark">
              <li>
                <button className="dropdown-item" onClick={handleOpenRenameProject}>
                  <i className="bi bi-pencil mr-2"></i>Cambiar nombre
                </button>
              </li>
              <li>
                <button className="dropdown-item" onClick={() => api.openExternal(selectedProject.railwayUrl)}>
                  <i className="bi bi-box-arrow-up-right mr-2"></i>Abrir Railway
                </button>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item text-danger" onClick={handleDeleteProject}>
                  <i className="bi bi-trash mr-2"></i>Eliminar proyecto
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* MOBILE PROJECT TITLE (visible only on mobile screens < 640px) */}
      <div className="block sm:hidden text-center mb-6 px-2">
        <h3 className="view-header-title font-bold text-lg mb-0 truncate w-full">{selectedProject.name}</h3>
      </div>

      {/* Counters and Badges row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-6">
        {/* TILE 1: SERVICIOS */}
        <div className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner transition-all hover:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <i className="bi bi-hdd-network text-sky-400 fs-5"></i>
            <span className="text-xs text-dim font-bold tracking-wider">SERVICIOS</span>
          </div>
          <div className="flex gap-2 text-xs font-semibold items-center">
            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20" title="Servicios Online">
              <i className="bi bi-check-circle-fill"></i>
              {(selectedProject.services || []).filter(s => s.status === 'online').length}
            </span>
            <span className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20" title="Servicios con Error">
              <i className="bi bi-x-circle-fill"></i>
              {(selectedProject.services || []).filter(s => s.status === 'error').length}
            </span>
            <span className="flex items-center gap-1 text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20" title="Servicios Verificando">
              <i className="bi bi-arrow-repeat"></i>
              {(selectedProject.services || []).filter(s => s.status === 'checking').length}
            </span>
          </div>
        </div>

        {/* TILE 2: CLIENTE */}
        {projectClient ? (
          <button
            className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner btn-client-glow transition-all text-left group border border-transparent w-full cursor-pointer"
            onClick={() => {
              navigateRouter(`/clientes/${projectClient.id}`);
            }}
            title="Ver detalle del cliente"
          >
            <div className="flex items-center gap-2">
              <i className="bi bi-person-badge text-sky-400 fs-5"></i>
              <span className="text-xs text-dim font-bold tracking-wider">CLIENTE</span>
            </div>
            <span className="text-xs font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 truncate max-w-[150px]">
              <i className="bi bi-person-fill text-sky-400"></i>
              {projectClient.nombre}
            </span>
          </button>
        ) : (
          <div className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner transition-all w-full">
            <div className="flex items-center gap-2">
              <i className="bi bi-person-badge text-gray-400 fs-5"></i>
              <span className="text-xs text-dim font-bold tracking-wider">CLIENTE</span>
            </div>
            <span className="text-xs font-bold text-gray-400 bg-gray-500/15 border border-gray-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 truncate max-w-[150px]">
              Sin cliente
            </span>
          </div>
        )}

        {/* TILE 3: SOPORTE / TICKETS */}
        <div className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner transition-all hover:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <i className="bi bi-ticket-perforated text-sky-400 fs-5"></i>
            <span className="text-xs text-dim font-bold tracking-wider">SOPORTE</span>
          </div>
          {projectClient ? (
            clientTicketsCount > 0 ? (
              <span className="text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                <i className="bi bi-exclamation-circle-fill text-red-400"></i>
                {clientTicketsCount} {clientTicketsCount === 1 ? 'Ticket' : 'Tickets'}
              </span>
            ) : (
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                <i className="bi bi-check-circle-fill text-emerald-400"></i>
                Sin pendientes
              </span>
            )
          ) : (
            <span className="text-xs text-dim italic">Sin cliente</span>
          )}
        </div>

        {/* TILE 4: WHATSAPP */}
        <div className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner transition-all hover:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <i className="bi bi-whatsapp text-emerald-400 fs-5"></i>
            <span className="text-xs text-dim font-bold tracking-wider">WHATSAPP</span>
          </div>
          {whatsappStatus?.connected ? (
            <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1"></span>
              Conectado
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
              <i className="bi bi-x-circle-fill text-amber-400"></i>
              Desconectado
            </span>
          )}
        </div>
      </div>

      {/* SERVICES LIST */}
      <div className="grid gap-4 mt-6">
        {(selectedProject.services || []).length === 0 ? (
          <div className="glass-card p-6 text-center text-dim text-sm">Este proyecto no tiene servicios registrados</div>
        ) : (
          selectedProject.services.map((service, sIdx) => {
            const domain = domainsCache[service.id] || '—';
            const isRenaming = renamingServiceId === service.id;

            return (
              <ServiceCard
                key={service.id}
                service={service}
                sIdx={sIdx}
                domain={domain}
                isRenaming={isRenaming}
                renamingServiceName={renamingServiceName}
                setRenamingServiceName={setRenamingServiceName}
                handleSaveRenameService={handleSaveRenameService}
                setRenamingServiceId={setRenamingServiceId}
                getStatusIcon={getStatusIcon}
                handleServiceUpdate={handleServiceUpdate}
                api={api}
                window={window}
                handleRedeploy={handleRedeploy}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
