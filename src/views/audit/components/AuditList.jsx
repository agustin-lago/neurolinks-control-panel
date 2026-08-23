import React from 'react';

export default function AuditList({ filteredLogs }) {
  const getActionBadgeClass = (action) => {
    if (!action) return 'badge-status-secondary';
    const a = action.toLowerCase();
    const map = [
      ['delete', 'badge-status-danger'],
      ['create', 'badge-status-success'],
      ['update', 'badge-status-warning'],
      ['deploy', 'badge-status-info']
    ];
    return map.find(([k]) => a.includes(k))?.[1] ?? 'badge-status-secondary';
  };

  return (
    <div className="mt-4 flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Desktop: tabla */}
      <div className="glass-card p-0 flex-1 overflow-y-auto pr-1 sm:pr-2 hidden md:block rounded">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalles</th>
                <th className="text-center">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-dim">
                    Sin registros
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const date = new Date(log.created_at);
                  return (
                    <tr key={log.id}>
                      <td>
                        <div className="font-bold">{date.toLocaleDateString()}</div>
                        <div className="text-sm text-dim">{date.toLocaleTimeString()}</div>
                      </td>
                      <td>
                        <span className={`badge ${getActionBadgeClass(log.accion)}`}>{log.accion}</span>
                      </td>
                      <td>
                        <div>{log.entidad_tipo || '-'}</div>
                        <div className="text-sm text-dim">{log.entidad_id || ''}</div>
                      </td>
                      <td className="text-sm" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{log.detalles || ''}</td>
                      <td className="text-center text-sm">{log.usuario || 'Sistema'}</td>
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
          <div className="text-dim text-center py-12">Sin registros</div>
        ) : (
          filteredLogs.map(log => {
            const date = new Date(log.created_at);
            return (
              <div key={log.id} className="glass-card p-4 rounded">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={`badge ${getActionBadgeClass(log.accion)}`}>{log.accion}</span>
                  <span className="text-sm text-dim">{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
                </div>
                {log.entidad_tipo && (
                  <div className="text-sm mb-1">
                    <span className="text-dim">Entidad:</span> {log.entidad_tipo}
                    {log.entidad_id && <span className="text-dim ml-1">({log.entidad_id})</span>}
                  </div>
                )}
                {log.detalles && (
                  <div className="text-sm text-dim mb-1" style={{ wordBreak: 'break-word' }}>
                    {log.detalles}
                  </div>
                )}
                <div className="text-sm text-dim mt-1">
                  <i className="bi bi-person mr-1">{log.usuario || 'Sistema'}</i>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
