import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../../../components/Skeleton';

export default function ClientDetailPanel({
  selectedClientId,
  setSelectedClientId,
  clients,
  admins,
  assistants,
  ticketsMeta,
  planCatalog = [],
  getPlanBadgeClass,
  getStatusIcon,
  getStatusColor,
  window,
  handleOpenEditClient,
  handleDeleteClient,
  clientProjects,
  isLoadingClientDetails,
  handleOpenNewInstanceModal,
  handleDeleteGhostRecord,
  handleRedeploy,
  loadingPlans = false,
  api,
  clientTickets,
  handleOpenChat,
  handleDeleteTicket
}) {
  const navigate = useNavigate();
  const selectedId = String(selectedClientId);
  const client = clients.find(c =>
    String(c.id) === selectedId ||
    (c.duplicate_client_ids || []).map(String).includes(selectedId)
  );

  if (!client) return null;
  const initials = client.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const vencimiento = client.vencimiento ? new Date(client.vencimiento) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isExpired = vencimiento && vencimiento < today;
  const admin = admins.find(a => a.auth_user_id === client.vendedor_user_id);
  const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';
  const monthlyTotal = Number(client.abono) || 0;
  const formattedMonthlyTotal = monthlyTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const linkedProjectsCount = Array.isArray(client.linked_projects) ? client.linked_projects.length : 0;
  const displayPlanLabel = client.plan || 'Sin plan';
  const slotLimit = Number(client.lineas_cantidad);
  const hasSlotLimit = Number.isFinite(slotLimit) && slotLimit > 0;
  const usageLabel = hasSlotLimit ? `${linkedProjectsCount}/${slotLimit} instancias` : `${linkedProjectsCount} instancia${linkedProjectsCount === 1 ? '' : 's'}`;


  const renderProjectSkeletons = () => (
    <div className="grid grid-cols-1 gap-4">
      <Skeleton variant="card" className="h-[218px] w-full opacity-90" />
      <Skeleton variant="card" className="h-[218px] w-full opacity-60" />
    </div>
  );

  const renderClientAssistants = () => {
    const projectRows = Array.isArray(client.linked_projects) ? client.linked_projects : [];
    const projectIds = [...new Set((clientProjects || []).filter(Boolean).map(String))];
    const rowsByRailwayId = new Map(projectRows.filter(row => row.railway_project_id).map(row => [String(row.railway_project_id), row]));
    const assistantsById = new Map(assistants.map(project => [String(project.id), project]));

    const getProjectStatusMeta = (project, hasRailwayProject = false) => {
      const subscriptionStatus = String(client.subscription_status || '').toLowerCase();
      const hasClientAccess = ['active', 'manual'].includes(subscriptionStatus) || String(client.plan || '').toLowerCase() === 'personalizado';
      if (project.deploy_in_progress) return { label: 'Desplegando', className: 'text-info', icon: 'bi-arrow-repeat' };
      if (hasRailwayProject) return { label: 'Activo', className: 'text-emerald-400', icon: 'bi-check-circle-fill' };
      if (project.railway_project_id && !hasRailwayProject) return { label: 'No aparece en Railway', className: 'text-warning', icon: 'bi-exclamation-triangle' };
      if (project.source === 'portal' && !hasClientAccess) return { label: 'Pendiente de pago', className: 'text-warning', icon: 'bi-clock-history' };
      return { label: 'Pendiente de deploy', className: 'text-warning', icon: 'bi-clock' };
    };

    const renderProjectStatusBadge = (project, hasRailwayProject = false) => {
      const status = getProjectStatusMeta(project, hasRailwayProject);
      return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${status.className}`} style={{ background: 'var(--surface-mixed)', border: '1px solid var(--border-soft)' }}>
          <i className={`bi ${status.icon}`}></i>
          <span>{status.label}</span>
        </span>
      );
    };

    const renderProjectSummary = (project, hasRailwayProject = false) => {
      const status = String(client.subscription_status || '').toLowerCase();
      const sourceLabel = status === 'manual' ? 'Manual' : status === 'active' ? 'Suscripcion activa' : 'Pendiente';
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-dim">Plan del cliente</label>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="badge badge-status-info">{displayPlanLabel}</span>
              <span className="text-dim">{sourceLabel}</span>
            </div>
          </div>
          <div className="text-xs text-dim flex items-center gap-1">
            <i className="bi bi-calendar2-week"></i>
            <span>Vencimiento: {vencimiento ? vencimiento.toLocaleDateString('es-AR') : (status === 'manual' ? 'Personalizado' : 'Pendiente')}</span>
          </div>
        </div>
      );
    };

    const renderProjectRowCard = (project, deleteRecord = false) => (
      <div key={project.id || project.railway_project_id || project.proyecto_slug} className="service-card p-4 rounded min-h-[235px] flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="font-bold truncate text-[var(--text-main)]">{project.nombre_personalizado || project.proyecto_slug || 'Proyecto vinculado'}</div>
              {project.proyecto_slug && <div className="text-xs text-dim break-all mt-1">{project.proyecto_slug}</div>}
              {project.railway_project_id && <div className="text-[11px] text-dim break-all mt-1">{project.railway_project_id}</div>}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {renderProjectStatusBadge(project, false)}
              {getProjectStatusMeta(project, false).label === 'No aparece en Railway' && project.id && handleDeleteGhostRecord && (
                <button
                  className="btn btn-sm btn-outline-danger px-2 py-1 text-[10px] uppercase font-bold flex items-center gap-1 border-danger/30 hover:border-danger hover:bg-danger/10"
                  onClick={() => handleDeleteGhostRecord(project.id)}
                  title="Eliminar registro huérfano"
                >
                  <i className="bi bi-trash"></i> Eliminar
                </button>
              )}
            </div>
          </div>
          {renderProjectSummary(project, false)}
        </div>


      </div>
    );

    const cards = [];
    const renderedRailwayIds = new Set();

    projectRows.forEach(projectRow => {
      const railwayId = projectRow.railway_project_id ? String(projectRow.railway_project_id) : null;
      const railwayProject = railwayId ? assistantsById.get(railwayId) : null;

      if (!railwayId || !railwayProject) {
        cards.push(renderProjectRowCard(projectRow, Boolean(railwayId)));
        return;
      }

      renderedRailwayIds.add(railwayId);
      const services = railwayProject.services?.length ? railwayProject.services : [null];
      services.forEach((svc, sIdx) => {
        if (!svc) {
          cards.push(
            <div key={railwayProject.id + '-null-' + sIdx} className="service-card p-4 rounded min-h-[235px] flex flex-col gap-3">
              <div className="flex justify-between items-start gap-3">
                <div className="font-bold truncate text-[var(--text-main)]">{projectRow.nombre_personalizado || railwayProject.name}</div>
                {renderProjectStatusBadge(projectRow, true)}
              </div>
              {renderProjectSummary(projectRow, true)}
              <div className="text-sm text-dim mt-auto">Sin servicios</div>
            </div>
          );
          return;
        }
        cards.push(
          <div key={svc.id} className="service-card p-4 rounded min-h-[285px] flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="font-bold truncate text-[var(--text-main)]">{svc.name || projectRow.nombre_personalizado || railwayProject.name}</div>
                  <div className="x-small text-dim mt-1">
                    Ultimo deploy: {new Date(svc.createdAt).toLocaleString()}
                  </div>
                </div>
                {renderProjectStatusBadge(projectRow, true)}
              </div>
              {renderProjectSummary(projectRow, true)}
            </div>

            <div>
              <button
                className="btn btn-outline-light btn-sm w-full py-2 flex items-center justify-center gap-2 transition-colors hover:bg-white/10"
                onClick={() => navigate('/proyectos/' + railwayProject.id)}
              >
                <span>Ir al proyecto</span>
                <i className="bi bi-arrow-right"></i>
              </button>
            </div>


          </div>
        );
      });
    });

    projectIds
      .filter(projectId => !renderedRailwayIds.has(projectId) && !rowsByRailwayId.has(projectId))
      .forEach(projectId => {
        const railwayProject = assistantsById.get(projectId);
        if (railwayProject) {
          cards.push(renderProjectRowCard({ railway_project_id: projectId, nombre_personalizado: railwayProject.name, plan: client.plan, abono: client.abono }, false));
        } else {
          cards.push(renderProjectRowCard({ railway_project_id: projectId, nombre_personalizado: 'Proyecto vinculado' }, true));
        }
      });

    return cards.length > 0 ? cards : null;
  };
  const pendingTickets = clientTickets.filter(t => t.estado !== 'Cerrado');


  return (
    <div className="anim-slide-right">
      {/* HEADER / TOPBAR */}
      <div className="view-header flex items-center justify-between gap-3 w-full mb-6" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <div className="flex items-center gap-3 overflow-hidden">
          <button className="btn btn-outline-light btn-sm flex items-center justify-center shrink-0 gap-2" onClick={() => {
            navigate(-1);
          }} title="Volver a Clientes">
            <i className="bi bi-arrow-left"></i><span className="hidden sm:inline">Todos los Clientes</span>
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="btn btn-success btn-sm flex items-center gap-1 px-3 py-1.5 shadow-sm"
            onClick={() => handleOpenNewInstanceModal()}
            title="Nueva Instancia"
          >
            <i className="bi bi-plus-lg"></i>
            <span className="hidden md:inline">Nueva Instancia</span>
          </button>
          <button className="btn btn-outline-danger btn-sm flex items-center justify-center gap-2" onClick={() => handleDeleteClient(client.id)}>
            <i className="bi bi-trash"></i><span className="hidden md:inline">Eliminar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          <div className="glass-card p-4 rounded-xl flex flex-col gap-3">
            <div className="pb-2 border-b border-white/5">
              <div className="flex items-center justify-between gap-3 bg-white/5 p-2 rounded-lg -mx-2">
                <h3 className="text-base font-bold m-0 leading-tight truncate flex-1 min-w-0" title={client.nombre}>{client.nombre}</h3>
                <button 
                  className="btn btn-link text-dim hover:text-white p-0 m-0 flex items-center justify-center shrink-0" 
                  onClick={() => handleOpenEditClient(client)}
                  title="Editar cliente"
                >
                  <i className="bi bi-pencil fs-6"></i>
                </button>
              </div>
              <span className="text-dim text-[11px] block mt-1">{client.empresa || '-'}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-0.5">Abono</span>
                <span className="font-bold block leading-tight text-xs">${formattedMonthlyTotal}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-0.5">Vencimiento</span>
                <span className="font-bold block leading-tight text-xs">
                  {vencimiento ? vencimiento.toLocaleDateString() : '-'}
                  {isExpired && <span className="badge badge-status-danger ml-1 p-0 px-1 text-[9px]">VENCIDO</span>}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-0.5">Email</span>
                <span className="font-bold block break-words leading-tight text-xs">{client.email || '-'}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-0.5">Telefono</span>
                <span className="font-bold block leading-tight text-xs">{client.telefono || '-'}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-0.5">Adjudicado</span>
                <span className="font-bold block truncate leading-tight text-xs">{adjudicado}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-0.5">Plan</span>
                <span className="font-bold block leading-tight text-xs">{displayPlanLabel}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-0.5">Instancias</span>
                <span className="font-bold block leading-tight text-xs">{usageLabel}</span>
              </div>
            </div>

            {/* CREDENCIALES BLOCK */}
            <div className="mt-2 pt-3 border-t border-[var(--border-light)]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-dim font-bold text-[10px]">CREDENCIALES</span>
                <button
                  className="btn btn-link text-dim hover:text-white p-0 m-0 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                  onClick={() => {
                    const textToCopy = `usuario: ${client.admin_user || '-'}\ncontraseña:  ${client.admin_pass || '-'}`;
                    navigator.clipboard.writeText(textToCopy).then(() => {
                      if (window.showToast) window.showToast('Credenciales copiadas al portapapeles', 'success');
                    }).catch(err => {
                      console.error('Failed to copy: ', err);
                    });
                  }}
                  title="Copiar credenciales"
                >
                  <i className="bi bi-copy fs-6"></i>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between items-center w-full">
                  <label className="text-dim text-[10px] font-bold m-0">USUARIO</label>
                  <span className="font-bold text-xs truncate max-w-[150px]">{client.admin_user || '-'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <label className="text-dim text-[10px] font-bold m-0">CONTRASEÑA</label>
                  <span className="font-bold font-mono text-xs truncate max-w-[150px]">{client.admin_pass || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TICKETS SECTION */}
          {pendingTickets.length > 0 ? (
            <div className="glass-card p-4 rounded flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
                  <i className="bi bi-ticket-detailed fs-5"></i>
                </div>
                <div>
                  <div className="font-bold text-orange-400">Tickets Pendientes</div>
                  <div className="text-sm text-dim">Hay {pendingTickets.length} ticket{pendingTickets.length !== 1 ? 's' : ''} en curso.</div>
                </div>
              </div>
              <button className="btn btn-outline-info btn-sm flex items-center gap-2" onClick={() => handleOpenChat(pendingTickets[0].id)}>
                <i className="bi bi-eye"></i> <span className="hidden sm:inline">Ver ticket{pendingTickets.length !== 1 ? 's' : ''}</span>
              </button>
            </div>
          ) : (
            <div className="glass-card p-4 rounded flex items-center justify-between opacity-70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-dim">
                  <i className="bi bi-check2-circle fs-5"></i>
                </div>
                <div>
                  <div className="font-bold text-dim">Sin tickets pendientes</div>
                  <div className="text-sm text-dim">No hay tickets en curso.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4 sticky top-6 lg:max-h-[calc(100vh-120px)]">
          <div className="flex items-center justify-between gap-3 shrink-0">
            <h6 className="text-dim text-sm font-bold mb-0">PROYECTOS VINCULADOS</h6>
          </div>
          <div className="overflow-y-auto pr-2 pb-12 grid grid-cols-1 md:grid-cols-2 min-[1281px]:grid-cols-3 gap-4">
            {isLoadingClientDetails && !client.linked_projects?.length && !clientProjects?.length
              ? renderProjectSkeletons()
              : renderClientAssistants()}
          </div>
        </div>

      </div>
    </div>
  );
}
