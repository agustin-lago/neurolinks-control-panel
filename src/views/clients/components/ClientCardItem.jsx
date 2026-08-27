import React from 'react';

function ticketBelongsToClient(ticket, client) {
  const clientIds = (client.duplicate_client_ids || [client.id]).map(String);
  return clientIds.includes(String(ticket.cliente_id));
}

export default function ClientCardItem({
  client,
  index,
  admins,
  ticketsMeta,
  getPlanBadgeClass,
  setSelectedClientId
}) {
  const admin = admins.find(a => a.auth_user_id === client.vendedor_user_id);
  const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';

  const displayPlan = client.plan || 'Sin plan';
  const displayAbono = Number(client.abono_total ?? client.abono ?? 0);
  const ticketCount = new Set(ticketsMeta.filter(t => ticketBelongsToClient(t, client)).map(t => t.id)).size;
  const hasCreds = Boolean(client.admin_user || client.admin_pass);
  const authUserId = client.auth_user_id || 'Sin auth_user_id';

  return (
    <div
      className="glass-card p-4 hover-lift clickable flex flex-col justify-between anim-card-enter"
      style={{ '--si': index }}
      onClick={() => {
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
              <span className={ticketCount > 0 ? 'text-red-400 font-semibold' : 'text-dim'} id={"ticket-count-" + client.id}>
                <i className="bi bi-ticket-perforated-fill mr-1"></i>
                <span className="tc-val">{ticketCount}</span>
              </span>
              <span className={hasCreds ? 'text-green-500 font-bold' : 'text-dim font-bold'} title={hasCreds ? 'Con credenciales' : 'Sin credenciales'}>
                <i className="bi bi-key mr-1"></i><i className={`bi ${hasCreds ? 'bi-check-lg' : 'bi-x-lg'}`}></i>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs text-dim pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <span className="truncate max-w-[200px]" title={adjudicado}>Adjudicado: {adjudicado}</span>
      </div>
    </div>
  );
}
