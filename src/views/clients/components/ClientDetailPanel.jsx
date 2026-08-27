import React from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../../../components/Skeleton';

export default function ClientDetailPanel({
  selectedClientId,
  clients,
  admins,
  getPlanBadgeClass,
  window,
  handleOpenEditClient,
  handleDeleteClient,
  isLoadingClientDetails,
  clientTickets,
  handleOpenChat
}) {
  const navigate = useNavigate();
  const selectedId = String(selectedClientId);
  const client = clients.find(c =>
    String(c.id) === selectedId ||
    (c.duplicate_client_ids || []).map(String).includes(selectedId)
  );

  if (!client) return null;
  const vencimiento = client.vencimiento ? new Date(client.vencimiento) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isExpired = vencimiento && vencimiento < today;
  const admin = admins.find(a => a.auth_user_id === client.vendedor_user_id);
  const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';
  const monthlyTotal = Number(client.abono) || 0;
  const formattedMonthlyTotal = monthlyTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const displayPlanLabel = client.plan || 'Sin plan';
  const subscriptionStatus = String(client.subscription_status || '').toLowerCase();
  const subscriptionStatusLabel = subscriptionStatus === 'active'
    ? 'Activa'
    : subscriptionStatus === 'manual'
      ? 'Manual'
      : subscriptionStatus === 'cancelled'
        ? 'Cancelada'
        : subscriptionStatus === 'paused'
          ? 'Pausada'
          : 'Pendiente';
  const subscriptionSource = client.subscription_source || (client.mp_preapproval_id ? 'mercadopago' : 'control');
  const subscriptionSourceLabel = subscriptionSource === 'mercadopago'
    ? 'Mercado Pago'
    : subscriptionSource === 'personalizado'
      ? 'Personalizado'
      : subscriptionSource === 'control'
        ? 'Control'
        : subscriptionSource || '-';
  const tenantId = client.tenant_id || client.auth_user_id || '-';
  const duplicateClientIds = Array.isArray(client.duplicate_client_ids) ? client.duplicate_client_ids : [];
  const pendingTickets = (clientTickets || []).filter(t => t.estado !== 'Cerrado');


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
          <button className="btn btn-outline-danger btn-sm flex items-center justify-center gap-2" onClick={() => handleDeleteClient(client.id)}>
            <i className="bi bi-trash"></i><span className="hidden md:inline">Eliminar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
        
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
          {isLoadingClientDetails ? (
            <Skeleton variant="card" className="h-[96px] w-full opacity-70" />
          ) : pendingTickets.length > 0 ? (
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

        {/* DETAIL COLUMN */}
        <div className="flex flex-col gap-4">
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h6 className="text-dim text-sm font-bold mb-0">DETALLE DEL CLIENTE</h6>
              <span className={`badge ${getPlanBadgeClass(client.plan)}`}>{displayPlanLabel}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Tenant ID</span>
                <span className="font-mono text-xs break-all">{tenantId}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">ID interno</span>
                <span className="font-mono text-xs break-all">{client.id}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Estado</span>
                <span className="font-bold text-sm">{subscriptionStatusLabel}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Origen</span>
                <span className="font-bold text-sm">{subscriptionSourceLabel}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Abono mensual</span>
                <span className="font-bold text-sm">${formattedMonthlyTotal}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Vencimiento</span>
                <span className="font-bold text-sm">
                  {vencimiento ? vencimiento.toLocaleDateString('es-AR') : '-'}
                  {isExpired && <span className="badge badge-status-danger ml-2 p-0 px-1 text-[9px]">VENCIDO</span>}
                </span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Empresa</span>
                <span className="font-bold text-sm break-words">{client.empresa || '-'}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Email</span>
                <span className="font-bold text-sm break-all">{client.email || '-'}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Telefono</span>
                <span className="font-bold text-sm">{client.telefono || '-'}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Adjudicado</span>
                <span className="font-bold text-sm break-words">{adjudicado}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Usuario admin</span>
                <span className="font-bold text-sm break-all">{client.admin_user || '-'}</span>
              </div>
              <div>
                <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">Password admin</span>
                <span className="font-mono text-xs break-all">{client.admin_pass || '-'}</span>
              </div>
              {duplicateClientIds.length > 1 && (
                <div className="md:col-span-2 xl:col-span-3">
                  <span className="text-dim text-[10px] font-bold uppercase tracking-wider block mb-1">IDs agrupados</span>
                  <span className="font-mono text-xs break-all">{duplicateClientIds.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
