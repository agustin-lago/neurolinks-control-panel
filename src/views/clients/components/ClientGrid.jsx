import React from 'react';
import ClientCardItem from './ClientCardItem';

export default function ClientGrid({
  search,
  setSearch,
  adminFilter,
  setAdminFilter,
  admins,
  showPendingTicketsOnly,
  setShowPendingTicketsOnly,
  handleExportCSV,
  handleExportCredentialsZip,
  handleImportCSV,
  handleOpenNewClientModal,
  filteredClients,
  assistants,
  ticketsMeta,
  getPlanBadgeClass,
  setSelectedClientId,
  window
}) {
  return (
    <div id="clients-grid-panel">
      {/* HEADER */}
      <div className="view-header">
        <div className="view-header-left clients-header-left">
          <div className="input-group input-group-sm search-input-group mb-0">
            <span className="input-group-text text-dim">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control text-main"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select form-select-sm bg-dark border-secondary text-main"
            value={adminFilter}
            onChange={e => setAdminFilter(e.target.value)}
          >
            <option value="" className="bg-dark text-white">Clientes adjudicados</option>
            <option value="unassigned" className="bg-dark text-white">Sin Asignar</option>
            {admins.map(a => (
              <option key={a.auth_user_id} value={a.auth_user_id} className="bg-dark text-white">
                {a.nombre || a.email}
              </option>
            ))}
          </select>
          
          <div className="flex items-center justify-center w-full md:w-auto md:ml-2 mt-3 md:mt-0 gap-6 max-[374px]:gap-2">
            <div className="flex items-center gap-2 max-[374px]:gap-1">
              <span className="text-[11px] max-[374px]:text-[9px] text-dim font-bold uppercase tracking-wider whitespace-nowrap">Tickets</span>
              <label className="sysconfig-toggle" htmlFor="ShowTicketsToggle">
                <input 
                  type="checkbox" 
                  id="ShowTicketsToggle" 
                  className="btn-ca-sysconfig" 
                  checked={showPendingTicketsOnly}
                  onChange={(e) => setShowPendingTicketsOnly(e.target.checked)}
                />
                <span className="sysconfig-thumb">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-off"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-on"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                </span>
              </label>
            </div>
          </div>
        </div>
        <div className="view-header-controls">
          <div className="flex gap-2 clients-toolbar-btns">
            <div className="dropdown">
              <button className="btn btn-outline-light btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                <i className="bi bi-download"></i>
                <span className="btn-clients-label ml-1">Exportar</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end dropdown-menu-dark">
                <li>
                  <button className="dropdown-item" onClick={handleExportCSV}>
                    <i className="bi bi-file-earmark-excel mr-2"></i>Exportar Clientes (CSV)
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={handleExportCredentialsZip}>
                    <i className="bi bi-file-earmark-zip mr-2"></i>Exportar Credenciales (ZIP)
                  </button>
                </li>
              </ul>
            </div>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => document.getElementById('csv-import-input').click()}
            >
              <i className="bi bi-upload"></i>
              <span className="btn-clients-label ml-1">Importar</span>
            </button>
            <input
              type="file"
              id="csv-import-input"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleImportCSV}
            />
            <button className="btn btn-outline-light btn-sm" onClick={handleOpenNewClientModal}>
              <i className="bi bi-person-plus"></i>
              <span className="btn-clients-label ml-1">Nuevo</span>
            </button>
          </div>
        </div>
      </div>

      {/* GRID OF CARDS */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-full text-center text-white/50 py-12">
            No hay clientes registrados.
          </div>
        ) : (
          filteredClients.map((client, idx) => (
            <ClientCardItem
              key={client.id}
              client={client}
              index={idx}
              admins={admins}
              assistants={assistants}
              ticketsMeta={ticketsMeta}
              getPlanBadgeClass={getPlanBadgeClass}
              setSelectedClientId={setSelectedClientId}
              window={window}
            />
          ))
        )}
      </div>
    </div>
  );
}
