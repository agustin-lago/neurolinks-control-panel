import React, { useState, useEffect } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';
import { useSmartRefresh } from '../../../contexts/SmartRefreshContext';
import { confirmAlert } from '../../../components/SweetAlert';
import Swal from 'sweetalert2';

const AdminsAccountView = ({ isTab = false }) => {
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState(() => sessionStorage.getItem('aaSelectedAdminId') || null);
  const [adminSearch, setAdminSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Form State for Modals/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Derive selected admin object
  const selectedAdmin = admins.find(a => a.id === selectedAdminId) || null;

  useSmartRefresh('stream_admins', (data) => {
    try {
      if (data.type === 'INSERT') {
        setAdmins(prev => [data.item, ...prev]);
      } else if (data.type === 'UPDATE') {
        setAdmins(prev => prev.map(a => a.id === data.item.id ? data.item : a));
      } else if (data.type === 'DELETE') {
        setAdmins(prev => prev.filter(a => a.id !== data.item.id));
        if (selectedAdminId === data.item.id) {
          setSelectedAdminId(null);
        }
      }
    } catch (e) {
      console.error("SSE Update Error:", e);
    }
  });

  useEffect(() => {
    loadAdmins();
  }, []);

  useEffect(() => {
    if (selectedAdminId) {
      sessionStorage.setItem('aaSelectedAdminId', selectedAdminId);
    } else {
      sessionStorage.removeItem('aaSelectedAdminId');
    }
  }, [selectedAdminId]);

  const loadAdmins = async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchAdminsAccount();
      setAdmins(data || []);
    } catch (err) {
      console.error('Error cargando admins:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAdmin = (admin) => {
    setSelectedAdminId(admin.id);
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setFormData({ username: '', password: '' });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (admin) => {
    setModalMode('edit');
    // Si queremos editar el seleccionado actual o uno en particular
    const targetAdmin = admin || selectedAdmin;
    if (targetAdmin) {
      setFormData({ username: targetAdmin.username || '', password: targetAdmin.password || '' });
      setShowPassword(false);
      setIsModalOpen(true);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmAlert(
      'Esta acción no se puede deshacer.',
      '¿Eliminar administrador?',
      'Sí, eliminar',
      'Cancelar',
      'btn btn-danger'
    );

    if (confirmed) {
      try {
        await api.deleteAdminAccount(id);
        if (selectedAdminId === id) setSelectedAdminId(null);
      } catch (err) {
        Swal.fire('Error', 'No se pudo eliminar el administrador.', 'error');
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      Swal.fire({ title: 'Error', text: 'Usuario y contraseña son requeridos', icon: 'warning', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      return;
    }

    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        await api.createAdminAccount(formData);
        Swal.fire({ title: '¡Creado!', text: 'El administrador fue creado', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        setIsModalOpen(false);
      } else {
        await api.updateAdminAccount(selectedAdminId, formData);
        Swal.fire({ title: '¡Guardado!', text: 'El administrador fue actualizado', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Error guardando:', err);
      Swal.fire('Error', 'No se pudo guardar la información.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      if (window.showToast) window.showToast('Copiado al portapapeles', 'success');
    } catch (err) {
      console.error('Error al copiar: ', err);
    }
  };

  return (
    <>
      <div className={isTab ? 'flex flex-row w-full h-full pt-4 gap-4 pr-1 overflow-hidden' : 'flex flex-row w-full h-[calc(100vh-100px)] gap-4 overflow-hidden'}>
        
        {/* LEFT COLUMN: ADMINS */}
        <div className="w-1/3 max-w-[300px] flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar shrink-0">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <h6 className="text-dim text-sm font-bold m-0">ADMINISTRADORES</h6>
            <button 
              onClick={handleOpenCreateModal}
              className="bg-[var(--accent)] text-white px-2 py-1 rounded text-xs font-medium hover:bg-opacity-80 transition-all flex items-center gap-1"
            >
              <i className="bi bi-plus-lg"></i> Nuevo
            </button>
          </div>
          
          <div className="input-group input-group-sm search-input-group mb-2 shrink-0">
            <span className="input-group-text text-dim">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control text-main"
              placeholder="Buscar administrador..."
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton variant="card" className="h-12 w-full" />
              <Skeleton variant="card" className="h-12 w-full" />
              <Skeleton variant="card" className="h-12 w-full" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-dim text-sm p-2">No hay administradores cargados.</div>
          ) : (
            admins
              .filter(a => (a.username || '').toLowerCase().includes(adminSearch.toLowerCase()) || (a.id || '').toLowerCase().includes(adminSearch.toLowerCase()))
              .map(admin => (
              <div 
                key={admin.id}
                onClick={() => handleSelectAdmin(admin)}
                className={`glass-card p-3 rounded cursor-pointer transition-colors border flex items-center ${selectedAdminId === admin.id ? '' : 'border-[var(--border-light)] hover:bg-[var(--bg-glass)]'}`}
                style={selectedAdminId === admin.id ? {
                  borderColor: 'var(--color-accent, #0078D4)',
                  backgroundColor: 'rgba(0, 120, 212, 0.2)',
                  boxShadow: '0 0 15px rgba(0, 120, 212, 0.4)'
                } : {}}
              >
                <div className="font-bold text-sm text-[var(--text-main)] truncate w-full" title={admin.username}>
                  <i className="bi bi-person-badge mr-2 text-[var(--accent)]"></i>
                  {admin.username}
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: ADMIN DETAILS */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedAdminId ? (
            <div className="glass-card flex-1 flex items-center justify-center text-dim text-center">
              <div>
                <i className="bi bi-shield-lock text-4xl mb-3 opacity-50 block"></i>
                Selecciona un administrador a la izquierda para ver su información.
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="overflow-y-auto w-full flex-1 custom-scrollbar pr-2 pb-4">
                <div className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden">
                  
                  {/* HEADER */}
                  <div className="flex justify-between items-start p-4 border-b border-[var(--border-soft)] bg-transparent">
                    <div>
                      <h3 className="font-bold text-main text-lg flex items-center gap-2">
                        <i className="bi bi-person-badge text-[var(--accent)]"></i> {selectedAdmin?.username}
                      </h3>
                      <div className="text-dim font-mono text-xs mt-1 flex items-center gap-2">
                        Admin ID: {selectedAdmin?.id}
                        <button 
                          className="text-dim hover:text-main transition-colors"
                          title="Copiar Admin ID"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(selectedAdmin?.id);
                          }}
                        >
                          <i className="bi bi-copy text-[10px]"></i>
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="bg-[var(--bg-glass)] hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] px-3 py-1 rounded transition-colors text-xs flex items-center gap-1"
                        onClick={() => handleOpenEditModal(selectedAdmin)}
                      >
                        <i className="bi bi-pencil-fill"></i> Editar
                      </button>
                      <button 
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded transition-colors text-xs flex items-center gap-1"
                        onClick={() => handleDelete(selectedAdmin?.id)}
                      >
                        <i className="bi bi-trash"></i> Eliminar
                      </button>
                    </div>
                  </div>

                  {/* BODY (Read-only Details) */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Credenciales</span>
                        <div className="text-main opacity-80"><span className="text-dim w-24 inline-block">Usuario:</span> {selectedAdmin?.username || '-'}</div>
                        <div className="text-main opacity-80 flex items-center gap-2">
                          <span className="text-dim w-24 inline-block">Contraseña:</span> 
                          <span>••••••••••••</span>
                          <span className="text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded ml-2">Oculta</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">Metadata</span>
                        <div className="text-main opacity-80"><span className="text-dim w-24 inline-block">Creado el:</span> {selectedAdmin?.created_at ? new Date(selectedAdmin.created_at).toLocaleString() : '-'}</div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center shrink-0">
              <h3 className="font-bold text-[var(--text-main)] text-lg flex items-center gap-2 m-0">
                <i className="bi bi-shield-lock text-[var(--accent)]"></i> 
                {modalMode === 'create' ? 'Nuevo Administrador' : 'Editar Administrador'}
              </h3>
              <button 
                type="button" 
                className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors" 
                onClick={() => setIsModalOpen(false)}
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col min-h-0">
              <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                
                {modalMode === 'edit' && (
                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">ID (Solo lectura)</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-dim)] bg-black/20 cursor-not-allowed" 
                      value={selectedAdminId || ''} 
                      readOnly 
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">USUARIO</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" 
                    value={formData.username} 
                    onChange={(e) => setFormData({...formData, username: e.target.value})} 
                    placeholder="Ej: admin_agustin"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">CONTRASEÑA</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600 pr-10" 
                      value={formData.password} 
                      onChange={(e) => setFormData({...formData, password: e.target.value})} 
                      placeholder="Ingresa una contraseña segura"
                      required 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors focus:outline-none"
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-[var(--border-light)] flex justify-end gap-3 shrink-0 bg-white/5">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm flex items-center gap-2" disabled={isSaving}>
                  {isSaving ? (
                    <><i className="bi bi-hourglass-split animate-spin"></i> Guardando...</>
                  ) : (
                    <><i className="bi bi-check2"></i> Guardar</>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  );
};

export default AdminsAccountView;
