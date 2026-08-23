import React from 'react';

export default function LogsList({ filteredLogs, loading, onViewDetails }) {
  return (
    <div className="mt-4 flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Desktop: tabla */}
      <div className="glass-card p-0 flex-1 overflow-y-auto pr-1 sm:pr-2 hidden md:block rounded">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Nivel</th>
                <th>Origen</th>
                <th>Detalles</th>
                <th className="text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-dim">
                    {loading ? 'Cargando logs...' : 'Sin resultados para la búsqueda'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const date = new Date(log.created_at);
                  const lvlClass =
                    log.level === 'ERROR'
                      ? 'badge-status-danger'
                      : log.level === 'WARN'
                        ? 'badge-status-warning'
                        : 'badge-status-info';
                  return (
                    <tr key={log.id}>
                      <td>
                        <div className="font-bold">{date.toLocaleDateString()}</div>
                        <div className="text-sm text-dim">{date.toLocaleTimeString()}</div>
                      </td>
                      <td>
                        <span className={`badge ${lvlClass}`}>{log.level}</span>
                      </td>
                      <td>
                        <div className="font-bold">{log.service}</div>
                        <div className="text-sm text-dim">{log.project_id || 'Sistema'}</div>
                      </td>
                      <td className="text-sm">
                        {log.client_id && (
                          <div className="text-dim mb-1">
                            <i className="bi bi-person mr-1"></i>
                            {log.client_id}
                          </div>
                        )}
                        <div
                          style={{
                            maxWidth: '350px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={log.message}
                        >
                          {log.message}
                        </div>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-outline-light"
                          onClick={() => onViewDetails(log.details || {})}
                        >
                          <i className="bi bi-code-slash mr-1"></i>JSON
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden flex flex-col gap-2 flex-1 overflow-y-auto pr-1 pb-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-dim">
            {loading ? 'Cargando logs...' : 'Sin resultados para la búsqueda'}
          </div>
        ) : (
          filteredLogs.map(log => {
            const date = new Date(log.created_at);
            const lvlClass =
              log.level === 'ERROR'
                ? 'badge-status-danger'
                : log.level === 'WARN'
                  ? 'badge-status-warning'
                  : 'badge-status-info';
            return (
              <div key={log.id} className="glass-card p-4 rounded">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={`badge ${lvlClass}`}>{log.level}</span>
                  <span className="text-sm text-dim">
                    {date.toLocaleDateString()} {date.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm mb-2">
                  <span className="text-dim">Origen:</span> <span className="font-bold">{log.service}</span>
                  {log.project_id && <span className="text-dim ml-1">({log.project_id})</span>}
                </div>
                {log.client_id && (
                  <div className="text-sm mb-1 text-dim">
                    <i className="bi bi-person mr-1"></i>
                    {log.client_id}
                  </div>
                )}
                <div className="text-sm text-main mb-3" style={{ wordBreak: 'break-word' }}>
                  {log.message}
                </div>
                <button
                  className="btn btn-sm btn-outline-light w-full"
                  onClick={() => onViewDetails(log.details || {})}
                >
                  <i className="bi bi-code-slash mr-1"></i>Ver JSON
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
