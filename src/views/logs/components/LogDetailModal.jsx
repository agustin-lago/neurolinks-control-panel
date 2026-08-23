import React from 'react';

export default function LogDetailModal({ selectedDetails, onClose, formatJsonDetails }) {
  if (selectedDetails === null) return null;
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-3xl rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center  shrink-0">
          <h3 className="font-bold text-[var(--text-main)] text-lg"><i className="bi bi-bug mr-2 text-accent"></i>Detalles del Error</h3>
          <button type="button" className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors" onClick={onClose}>
            <i className="bi bi-x-lg text-lg"></i>
          </button>
        </div>
        <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          <pre
            id="log-detail-json"
            className="custom-scrollbar"
            style={{
              background: '#111827',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#9cdcfe',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              wordWrap: 'break-word',
            }}
          >
            {formatJsonDetails(selectedDetails)}
          </pre>
        </div>
        <div className="p-4 border-t border-[var(--border-light)] flex justify-end gap-3  shrink-0">
          <button type="button" className="btn btn-sm btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20" onClick={onClose}><i className="bi bi-check2-circle"></i> Cerrar</button>
        </div>
      </div>
    </div>
  );
}
