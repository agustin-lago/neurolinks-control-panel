import React from 'react';
import Skeleton from '../../../components/Skeleton';

export default function ClientModals({
  isClientModalOpen,
  setIsClientModalOpen,
  clientModalTitle,
  handleClientSubmit,
  formName,
  setFormName,
  formCompany,
  setFormCompany,
  formEmail,
  setFormEmail,
  formPhone,
  setFormPhone,
  formVendedorUserId,
  setFormVendedorUserId,
  admins,
  formAdminUser,
  setFormAdminUser,
  formAdminPass,
  setFormAdminPass,
  planCatalog = [],
  loadingPlans = false,
  formPlan,
  setFormPlan,
  formAbono,
  setFormAbono,
  formVencimiento,
  setFormVencimiento,
  formSubscriptionStatus,
  setFormSubscriptionStatus,
  formSubscriptionSource,
  setFormSubscriptionSource,

  isLinkModalOpen,
  setIsLinkModalOpen,

  loadingTemplates,
  templates,
  deployingTemplate,
  handleConfirmDeployForClient,
  assistants,
  clientProjects
}) {
  const planOptions = Array.isArray(planCatalog) ? planCatalog.filter(plan => plan?.nombre) : [];
  const ensurePersonalizado = planOptions.some(plan => String(plan.nombre || '').toLowerCase() === 'personalizado')
    ? planOptions
    : [...planOptions, { id: 'custom-personalizado', nombre: 'Personalizado', precio: null }];

  const handlePlanChange = (planName) => {
    setFormPlan(planName);
    const selected = ensurePersonalizado.find(plan => String(plan.nombre || '') === String(planName || ''));
    if (!planName) {
      setFormAbono('');
      setFormSubscriptionStatus('pending');
      setFormSubscriptionSource('control');
      return;
    }
    if (selected?.precio !== null && selected?.precio !== undefined) setFormAbono(Number(selected.precio));
    const isCustom = String(planName || '').toLowerCase() === 'personalizado';
    setFormSubscriptionStatus(isCustom ? 'manual' : (formSubscriptionStatus || 'manual'));
    setFormSubscriptionSource(isCustom ? 'personalizado' : (formSubscriptionSource || 'control'));
  };

  return (
    <>
      {/* MODAL CLIENTE OVERLAY (Create/Edit) */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-4xl rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center  shrink-0">
              <h3 className="font-bold text-[var(--text-main)] text-lg md:text-xl"><i className="bi bi-person-badge mr-2 text-accent"></i>{clientModalTitle}</h3>
              <button type="button" className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors" onClick={() => setIsClientModalOpen(false)}>
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleClientSubmit} className="flex flex-col min-h-0">
              <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {/* Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">NOMBRE COMPLETO</label>
                    <input type="text" className="form-control form-control-sm  border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">EMPRESA</label>
                    <input type="text" className="form-control form-control-sm  border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" value={formCompany} onChange={(e) => setFormCompany(e.target.value)} />
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">ADJUDICADO A (ADMINISTRADOR)</label>
                    <select className="form-select form-select-sm bg-transparent border-[var(--border-light)] text-[var(--text-main)] cursor-pointer" value={formVendedorUserId} onChange={(e) => setFormVendedorUserId(e.target.value)}>
                      <option value="">Sin Asignar</option>
                      {admins.map(adm => (
                        <option key={adm.auth_user_id} value={adm.auth_user_id}>{adm.nombre || adm.email}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">EMAIL</label>
                    <input type="email" className="form-control form-control-sm  border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" value={formEmail} onChange={(e) => { setFormEmail(e.target.value); setFormAdminUser(e.target.value); }} required />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">TELEFONO</label>
                    <input type="text" className="form-control form-control-sm  border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
                  </div>
                </div>


                <div className="p-4 rounded-lg border border-[var(--border-light)]">
                  <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-3 block">SUSCRIPCION DEL CLIENTE</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">PLAN CONTRATADO</label>
                      <select
                        className="form-select form-select-sm bg-transparent border-[var(--border-light)] text-[var(--text-main)] cursor-pointer"
                        value={formPlan || ''}
                        disabled={loadingPlans}
                        onChange={(e) => handlePlanChange(e.target.value)}
                      >
                        <option value="">Sin plan</option>
                        {formPlan && !ensurePersonalizado.some(plan => plan.nombre === formPlan) && <option value={formPlan}>{formPlan}</option>}
                        {ensurePersonalizado.map(plan => (
                          <option key={plan.id || plan.nombre} value={plan.nombre}>{plan.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">ABONO MENSUAL ($)</label>
                      <input type="number" min="0" className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" value={formAbono} onChange={(e) => setFormAbono(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">PROX. VENCIMIENTO</label>
                      <input type="date" className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" value={formVencimiento || ''} onChange={(e) => setFormVencimiento(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">ESTADO</label>
                      <select className="form-select form-select-sm bg-transparent border-[var(--border-light)] text-[var(--text-main)] cursor-pointer" value={formSubscriptionStatus || 'pending'} onChange={(e) => setFormSubscriptionStatus(e.target.value)}>
                        <option value="pending">Pendiente</option>
                        <option value="active">Activo</option>
                        <option value="manual">Manual</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>
                  </div>
                </div>
                {/* Row 5 */}
                <div className="p-4 rounded-lg  border border-[var(--border-light)]">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider block">CREDENCIALES BACKOFFICE</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-info flex items-center gap-1 border-[var(--border-light)] hover:bg-white/10 text-xs py-1"
                      onClick={() => {
                        const randPass = Math.random().toString(36).slice(2, 12);
                        setFormAdminUser(formEmail);
                        setFormAdminPass(randPass);
                      }}
                    >
                      <i className="bi bi-magic"></i> Generar password
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">ADMIN_USER</label>
                      <input type="email" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" placeholder="Se toma del email del cliente" value={formEmail || formAdminUser || ''} readOnly />
                    </div>
                    <div className="form-group">
                      <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">ADMIN_PASS</label>
                      <input type="text" className="form-control form-control-sm bg-transparent border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600" placeholder="Contraseña admin" value={formAdminPass} onChange={(e) => setFormAdminPass(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-[var(--border-light)] flex justify-end gap-3  shrink-0">
                <button type="button" className="btn btn-sm  hover:bg-white/10 text-[var(--text-dim)] hover:text-[var(--text-main)] border border-[var(--border-light)] transition-colors" onClick={() => setIsClientModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-sm btn-success flex items-center gap-2 shadow-lg shadow-green-500/20"><i className="bi bi-check2-circle"></i> Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR PROYECTO OVERLAY */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-4xl rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center  shrink-0">
              <h3 className="font-bold text-[var(--text-main)] text-lg md:text-xl">
                <i className={`bi bi-rocket-takeoff mr-2 text-accent`}></i>
                Crear Proyecto para el Cliente
              </h3>
              <button type="button" className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors" onClick={() => setIsLinkModalOpen(false)}>
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 min-h-0">
                  {loadingTemplates ? (
                    <div className="flex flex-col gap-4 py-2">
                      <Skeleton variant="card" className="h-24 w-full" />
                      <Skeleton variant="card" className="h-24 w-full" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="text-gray-500 text-sm text-center py-12 italic">No se encontraron plantillas disponibles.</div>
                  ) : (
                    <div className="flex flex-col gap-4 py-2">
                      {templates.map(t => (
                        <div key={t.id} className="p-4 sm:p-6 rounded-xl border border-[var(--border-light)]  relative overflow-hidden transition-all hover:bg-white/10">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-xl bg-info/10 border border-info/20 text-info text-2xl">
                                <i className="bi bi-rocket-takeoff-fill"></i>
                              </div>
                              <div>
                                <h6 className="font-bold text-[var(--text-main)] text-lg mb-1">{t.name}</h6>
                                <p className="text-xs text-[var(--text-dim)] mb-0">Instancia dedicada con API oficial de META</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-success btn-sm px-4 py-2 font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-green-500/20"
                              disabled={deployingTemplate}
                              onClick={() => handleConfirmDeployForClient(t.id)}
                            >
                              {deployingTemplate ? (
                                <>
                                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                  Desplegando...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-cloud-upload"></i>Desplegar y Vincular
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
