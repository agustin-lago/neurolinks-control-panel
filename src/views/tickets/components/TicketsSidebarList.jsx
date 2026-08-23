import React from 'react';
import Skeleton from '../../../components/Skeleton';

export default function TicketsSidebarList({
  totalUnreadInView,
  fetchTicketsList,
  loadingList,
  search,
  setSearch,
  setCurrentPage,
  tickets,
  filteredList,
  currentPage,
  ITEMS_PER_PAGE,
  selectedTicketId,
  handleSelectTicket,
  handleDeleteTicket
}) {
  return (
    <>
      <div className="p-3 border-b border-[var(--border-soft)]">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-dark/50 rounded-lg px-3 py-1.5 border border-[var(--border-soft)] flex-1 min-w-0">
            <i className="bi bi-search text-dim mr-2"></i>
            <input
              type="text"
              className="form-control text-main bg-transparent border-0 shadow-none py-1 min-w-0"
              placeholder="Buscar chat..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingList && tickets.length === 0 ? (
          <div className="flex flex-col">
            <Skeleton variant="list-item" className="opacity-80" />
            <Skeleton variant="list-item" className="opacity-60" />
            <Skeleton variant="list-item" className="opacity-40" />
            <Skeleton variant="list-item" className="opacity-20" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-8 text-dim">No hay tickets</div>
        ) : (
          filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(t => {
            const clientName = t.clientes?.nombre || t.chat_id || 'Sin Cliente';
            const isActive = selectedTicketId === t.id;
            const isAbierto = t.estado === 'Abierto';
            const dateStr = new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

            // Colores sutiles: Amarillo (Abierto), Verde (Cerrado)
            const bgColor = isActive
              ? (isAbierto ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)')
              : (isAbierto ? 'rgba(234, 179, 8, 0.03)' : 'rgba(34, 197, 94, 0.03)');

            const borderColor = isAbierto ? '#eab308' : '#22c55e';

            return (
              <div
                key={t.id}
                className="chat-card p-3 flex flex-col gap-1 anim-card-enter"
                style={{
                  '--si': 0,
                  backgroundColor: bgColor,
                  borderLeft: `3px solid ${borderColor}`
                }}
                onClick={() => handleSelectTicket(t.id)}
              >
                <div className="text-[9px] text-dim opacity-60 font-mono uppercase tracking-wider mb-[-2px]">#{t.id.substring(0, 6)}</div>
                <div className="flex justify-between items-center min-w-0">
                  <div className="font-bold text-sm truncate pr-2 flex-1">{clientName}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.unreadCount > 0 && (
                      <span style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px', minWidth: '18px', height: '18px', padding: '0 4px' }}>
                        {t.unreadCount}
                      </span>
                    )}
                    <div className="text-xs text-dim">{dateStr}</div>
                  </div>
                </div>
                <div className="flex justify-between items-end gap-2 min-w-0">
                  <div className="text-xs text-dim truncate flex-1">{t.titulo}</div>
                  {isAbierto ? (
                    <span className="badge shrink-0" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.5)' }}>Abierto</span>
                  ) : (
                    <div className="flex gap-2 items-center shrink-0">
                      <span className="badge shrink-0" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.5)' }}>Cerrado</span>
                      <button
                        className="btn btn-outline-danger btn-sm shrink-0"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTicket(t.id); }}
                        title="Eliminar Ticket"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINACIÓN */}
      {Math.ceil(filteredList.length / ITEMS_PER_PAGE) > 1 && (
        <div className="p-2 border-t border-[var(--border-soft)] justify-between items-center bg-dark/20 shrink-0 hidden md:flex">
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <span className="text-xs text-dim font-bold">Pág {currentPage} de {Math.ceil(filteredList.length / ITEMS_PER_PAGE)}</span>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredList.length / ITEMS_PER_PAGE)))}
            disabled={currentPage === Math.ceil(filteredList.length / ITEMS_PER_PAGE)}
            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      )}
    </>
  );
}
