import React, { useState } from 'react';
import { createPortal } from 'react-dom';

function getClientProjectIds(client) {
  const ids = [];
  if (Array.isArray(client.railway_project_ids)) ids.push(...client.railway_project_ids);
  if (Array.isArray(client.linked_projects)) {
    ids.push(...client.linked_projects.map(p => p.railway_project_id || p.proyecto_slug || p.id));
  }
  return [...new Set(ids.filter(Boolean).map(String))];
}

function ticketBelongsToClient(ticket, client) {
  const clientIds = (client.duplicate_client_ids || [client.id]).map(String);
  const projectIds = getClientProjectIds(client);
  return clientIds.includes(String(ticket.cliente_id)) || projectIds.includes(String(ticket.project_id));
}

export default function ClientCardItem({
  client,
  index,
  admins,
  assistants,
  ticketsMeta,
  getPlanBadgeClass,
  setSelectedClientId,
  window
}) {
  const initials = client.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const admin = admins.find(a => a.auth_user_id === client.vendedor_user_id);
  const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';

  const linkedProjects = Array.isArray(client.linked_projects) ? client.linked_projects : [];
  const astCount = linkedProjects.length;
  const displayPlan = client.plan || 'Sin plan';
  const displayAbono = Number(client.abono_total ?? client.abono ?? 0);
  const slotLimit = Number(client.lineas_cantidad);
  const usageLabel = Number.isFinite(slotLimit) && slotLimit > 0 ? `${astCount}/${slotLimit}` : String(astCount);
  const ticketCount = new Set(ticketsMeta.filter(t => ticketBelongsToClient(t, client)).map(t => t.id)).size;
  const hasCreds = Boolean(client.admin_user || client.admin_pass);
  const authUserId = client.auth_user_id || 'Sin auth_user_id';
  const [showProjectsModal, setShowProjectsModal] = useState(false);

  return (
    <div
      className="glass-card p-4 hover-lift clickable flex flex-col justify-between anim-card-enter"
      style={{ '--si': index }}
      onClick={() => {
        window.localStorage.removeItem('clientBackToAssistants');
        window.dispatchEvent(new CustomEvent('local-storage-sync', { detail: { key: 'clientBackToAssistants', newValue: null } }));
        window.localStorage.removeItem('clientBackToProjects');
        window.dispatchEvent(new CustomEvent('local-storage-sync', { detail: { key: 'clientBackToProjects', newValue: null } }));
        setSelectedClientId(client.id);
      }}
    >
      <div>
        <div className="flex items-center gap-4 mb-3">
          <div className="grow min-w-0 overflow-hidden">
            <h6 className="font-bold mb-0.5 truncate">{client.nombre}</h6>
            <div className="text-sm text-dim truncate mb-2">Abono: ${displayAbono.toLocaleString('es-AR')}/mes</div>
            <div className="flex items-center mb-2">
              <span className={`badge ${getPlanBadgeClass(client.plan)}`}>{displayPlan}</span>
            </div>
            <div className="text-[11px] text-dim truncate mb-2" title={authUserId}>Auth: {authUserId}</div>
            <div className="flex items-center gap-3 flex-wrap text-sm pt-2" style={{ borderTop: '1px solid var(--border-soft)' }}>
              <span className="text-dim" id={"ast-count-" + client.id}>
                <i className="bi bi-robot mr-1"></i>{usageLabel}
              </span>
              <span className={ticketCount > 0 ? 'text-red-400 font-semibold' : 'text-dim'} id={"ticket-count-" + client.id}>
                <i className="bi bi-ticket-perforated-fill mr-1"></i>
                <span className="tc-val">{ticketCount}</span>
              </span>
              <span className={hasCreds ? 'text-green-500 font-bold' : 'text-dim font-bold'} title={hasCreds ? 'Con credenciales' : 'Sin credenciales'}>
                <i className="bi bi-key mr-1"></i><i className={`bi ${hasCreds ? 'bi-check-lg' : 'bi-x-lg'}`}></i>
              </span>
              <div className="flex items-center gap-2 ml-auto pl-2" style={{ borderLeft: '1px solid var(--border-soft)' }}>
                <i 
                  className="bi bi-info-circle cursor-pointer text-dim opacity-60 hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setShowProjectsModal(true); }}
                  title="Ver Project IDs vinculados"
                ></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs text-dim pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <span className="truncate max-w-[200px]" title={adjudicado}>Adjudicado: {adjudicado}</span>
      </div>

      {showProjectsModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowProjectsModal(false); }}
        >
          <div 
            className="modal-glass modal-content p-5 max-w-sm w-full rounded-2xl relative shadow-2xl anim-card-enter"
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'default' }}
          >
            <button 
              className="absolute top-4 right-4 text-dim hover:text-[var(--text-main)] transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowProjectsModal(false); }}
            >
              <i className="bi bi-x-lg fs-5"></i>
            </button>
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <i className="bi bi-boxes text-dim"></i>
              Project IDs Vinculados
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {linkedProjects.length > 0 ? (
                linkedProjects.map((p, i) => {
                  const idStr = p.railway_project_id || p.proyecto_slug || p.id;
                  return (
                    <div 
                      key={i} 
                      className="text-xs font-mono p-2 bg-[var(--surface-mixed)] rounded border border-[var(--border-soft)] break-all flex justify-between items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (idStr) {
                          navigator.clipboard.writeText(idStr);
                          if (window.showToast) window.showToast('ID copiado', 'success');
                        }
                      }}
                      title="Click para copiar"
                    >
                      <span className="truncate">{idStr || 'Desconocido'}</span>
                      <i className="bi bi-copy text-dim"></i>
                    </div>
                  );
                })
              ) : (
                <p className="text-dim text-sm italic">No hay proyectos asociados.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
