import React from 'react';

export default function ServiceCard({
  service,
  sIdx,
  domain,
  isRenaming,
  renamingServiceName,
  setRenamingServiceName,
  handleSaveRenameService,
  setRenamingServiceId,
  getStatusIcon,
  handleServiceUpdate,
  api,
  window,
  handleRedeploy
}) {
  return (
    <div className="service-card p-6 rounded anim-card-enter" style={{ '--si': sIdx }}>
      <div className="rw-svc-header px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="rw-svc-icon shrink-0 mt-1 hidden sm:flex">
            <i className="bi bi-cpu-fill"></i>
          </div>
          <div className="grow min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              {isRenaming ? (
                <div className="flex items-center gap-1 grow min-w-0">
                  <input
                    type="text"
                    className="form-control form-control-sm text-main"
                    style={{ maxWidth: '160px' }}
                    value={renamingServiceName}
                    onChange={(e) => setRenamingServiceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRenameService(service.id);
                      if (e.key === 'Escape') setRenamingServiceId(null);
                    }}
                  />
                  <button className="btn btn-success btn-sm px-2" onClick={() => handleSaveRenameService(service.id)}>
                    <i className="bi bi-check-lg"></i>
                  </button>
                  <button className="btn btn-outline-secondary btn-sm px-2" onClick={() => setRenamingServiceId(null)}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              ) : (
                <span className="font-bold service-name text-xs sm:text-sm md:text-base truncate">{service.name}</span>
              )}

              <div className="flex items-center gap-2 shrink-0">
                <span className="service-status-icon">
                  <i className={`bi ${getStatusIcon(service.status)}`}></i>
                </span>
                <button
                  className={`btn btn-sm btn-update-mini flex items-center gap-1 ${
                    service.isUpdatable 
                      ? 'btn-warning' 
                      : 'bg-black/10 dark:bg-white/10 text-[var(--text-dim)] border border-[var(--border-light)]'
                  }`}
                  onClick={() => service.isUpdatable && handleServiceUpdate(service.projectId, service.environmentId, service.id)}
                  style={!service.isUpdatable ? { cursor: 'default' } : undefined}
                >
                  <i className={`bi ${service.isUpdatable ? 'bi-info-circle-fill' : 'bi-check-circle-fill'}`}></i>
                  <span className="hidden md:inline">
                    {service.isUpdatable ? 'Actualización pendiente' : 'Más reciente'}
                  </span>
                </button>
              </div>
            </div>
            <div className="x-small text-dim rw-svc-domain">
              <i className="bi bi-globe2 mr-1"></i>
              <span>{domain}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rw-svc-meta px-6 py-2 flex items-center justify-between">
        <div className="x-small text-dim service-date">
          <i className="bi bi-clock mr-1"></i>
          Último deploy: {new Date(service.createdAt).toLocaleString()}
        </div>
      </div>

      {/* Action Tabs */}
      <div className="rw-svc-actions flex">
        <div
          className="service-menu-item btn-backoffice flex-1 text-center py-2 cursor-pointer"
          onClick={async () => {
            try {
              const domains = await api.getServiceDomains(service.projectId, service.environmentId, service.id, service.railwayWorkspaceKey);
              let dom = domains?.customDomains?.[0]?.domain || domains?.serviceDomains?.[0]?.domain;
              if (!dom) { window.showToast('Este servicio no tiene dominio público', 'warning'); return; }
              if (!dom.startsWith('http')) dom = 'https://' + dom;
              api.openDashboardWindow(dom);
            } catch {
              window.showToast('Error al obtener URL del servicio', 'danger');
            }
          }}
        >
          <i className="bi bi-box-arrow-up-right mr-1"></i> Backoffice
        </div>
        <div className="rw-sep"></div>
        <div
          className="service-menu-item btn-logs flex-1 text-center py-2 cursor-pointer"
          onClick={() => api.openDashboardWindow(`https://railway.com/project/${service.projectId}/logs?environmentId=${service.environmentId}&timeFrame=30d`)}
        >
          <i className="bi bi-terminal mr-1"></i> Logs
        </div>
        <div className="rw-sep"></div>
        <div className="service-menu-item btn-redeploy flex-1 text-center py-2 cursor-pointer" onClick={() => handleRedeploy(service.id, service.environmentId, service.railwayWorkspaceKey)}>
          <i className="bi bi-arrow-repeat mr-1"></i> Redeploy
        </div>
      </div>
    </div>
  );
}
