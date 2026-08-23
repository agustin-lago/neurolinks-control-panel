import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../core/api';
import Skeleton from '../../../components/Skeleton';

const emptyForm = {
  nombre: '',
  plan_tipo: '',
  lineas_cantidad: 1,
  precio: 0,
  activo: true
};

const formatPrice = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `$${number.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-AR');
};

const normalizePlanPayload = (formData) => ({
  nombre: String(formData.nombre || '').trim(),
  plan_tipo: String(formData.plan_tipo || '').trim(),
  lineas_cantidad: Number(formData.lineas_cantidad) || 1,
  precio: Number(formData.precio) || 0,
  activo: Boolean(formData.activo)
});

const PlanesView = ({ isTab = false }) => {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(() => sessionStorage.getItem('planesSelectedId') || null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [formData, setFormData] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (selectedPlanId) sessionStorage.setItem('planesSelectedId', selectedPlanId);
    else sessionStorage.removeItem('planesSelectedId');
  }, [selectedPlanId]);

  const loadPlans = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.fetchCatalogPlans();
      const rows = data || [];
      setPlans(rows);
      if (!selectedPlanId && rows.length) setSelectedPlanId(String(rows[0].id));
    } catch (err) {
      setError(err.message || 'Error al cargar catalogo_planes');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter(plan => [
      plan.id,
      plan.nombre,
      plan.plan_tipo,
      plan.lineas_cantidad,
      plan.precio,
      plan.activo ? 'activo' : 'inactivo'
    ].some(value => String(value ?? '').toLowerCase().includes(term)));
  }, [plans, search]);

  const selectedPlan = plans.find(plan => String(plan.id) === String(selectedPlanId)) || null;

  const openCreateModal = () => {
    setModalMode('create');
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedPlan) return;
    setModalMode('edit');
    setFormData({
      nombre: selectedPlan.nombre || '',
      plan_tipo: selectedPlan.plan_tipo || '',
      lineas_cantidad: selectedPlan.lineas_cantidad ?? 1,
      precio: selectedPlan.precio ?? 0,
      activo: selectedPlan.activo !== false
    });
    setIsModalOpen(true);
  };

  const handleSavePlan = async (event) => {
    event.preventDefault();
    const payload = normalizePlanPayload(formData);
    if (!payload.nombre || !payload.plan_tipo) {
      window.showToast?.('Nombre y tipo de plan son requeridos', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const saved = modalMode === 'create'
        ? await api.createCatalogPlan(payload)
        : await api.updateCatalogPlan(selectedPlanId, payload);

      setPlans(prev => {
        if (modalMode === 'create') return [saved, ...prev];
        return prev.map(plan => String(plan.id) === String(saved.id) ? saved : plan);
      });
      setSelectedPlanId(String(saved.id));
      setIsModalOpen(false);
      window.showToast?.(modalMode === 'create' ? 'Plan creado' : 'Plan actualizado', 'success');
    } catch (err) {
      window.showToast?.(err.message || 'No se pudo guardar el plan', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className={isTab ? 'flex flex-row w-full h-full pt-4 gap-4 pr-1 overflow-hidden' : 'flex flex-row w-full h-[calc(100vh-100px)] gap-4 overflow-hidden'}>
        <div className="w-1/3 max-w-[320px] flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar shrink-0">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <h6 className="text-dim text-sm font-bold m-0">PLANES</h6>
            <button
              onClick={openCreateModal}
              className="bg-[var(--accent)] text-white w-8 h-8 rounded text-sm font-bold hover:bg-opacity-80 transition-all flex items-center justify-center shadow-sm"
              title="Crear plan"
            >
              <i className="bi bi-plus-lg"></i>
            </button>
          </div>

          <div className="input-group input-group-sm search-input-group mb-2 shrink-0">
            <span className="input-group-text text-dim">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control text-main"
              placeholder="Buscar plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton variant="card" className="h-16 w-full !p-3" />
              <Skeleton variant="card" className="h-16 w-full !p-3" />
              <Skeleton variant="card" className="h-16 w-full !p-3" />
            </div>
          ) : error ? (
            <div className="text-danger text-sm p-2">{error}</div>
          ) : filteredPlans.length === 0 ? (
            <div className="text-dim text-sm p-2">No hay planes para mostrar.</div>
          ) : (
            filteredPlans.map(plan => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlanId(String(plan.id))}
                className={`glass-card p-3 rounded cursor-pointer transition-colors border ${String(selectedPlanId) === String(plan.id) ? '' : 'border-[var(--border-light)] hover:bg-[var(--bg-glass)]'}`}
                style={String(selectedPlanId) === String(plan.id) ? {
                  borderColor: 'var(--color-accent, #0078D4)',
                  backgroundColor: 'rgba(0, 120, 212, 0.2)',
                  boxShadow: '0 0 15px rgba(0, 120, 212, 0.4)'
                } : {}}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[var(--text-main)] truncate" title={plan.nombre}>
                      <i className="bi bi-tags mr-2 text-[var(--accent)]"></i>
                      {plan.nombre || 'Sin nombre'}
                    </div>
                    <div className="text-xs text-dim mt-1 truncate">
                      {plan.plan_tipo || '-'} - {plan.lineas_cantidad ?? '-'} linea{Number(plan.lineas_cantidad) === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${plan.activo ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-dim border-[var(--border-light)] bg-[var(--bg-glass)]'}`}>
                    {plan.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="text-sm font-bold text-[var(--text-main)] mt-2">
                  {formatPrice(plan.precio)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedPlan ? (
            <div className="glass-card flex-1 flex items-center justify-center text-dim text-center">
              <div>
                <i className="bi bi-tags text-4xl mb-3 opacity-50 block"></i>
                Selecciona un plan a la izquierda para ver sus datos.
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-4 shrink-0 px-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-main text-xl m-0 flex items-center gap-2 truncate">
                    <i className="bi bi-tags text-[var(--accent)]"></i> {selectedPlan.nombre || 'Plan'}
                  </h3>
                  <div className="text-xs text-dim font-mono bg-black/20 px-2 py-1 rounded inline-flex mt-2">
                    ID: {selectedPlan.id}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={openEditModal}
                    className="bg-[var(--bg-glass)] hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] px-3 py-1.5 rounded transition-colors text-xs flex items-center gap-2"
                  >
                    <i className="bi bi-pencil-fill"></i> Editar
                  </button>
                  <button
                    onClick={loadPlans}
                    className="bg-[var(--bg-glass)] hover:bg-white/10 text-main opacity-80 border border-[var(--border-light)] px-3 py-1.5 rounded transition-colors text-xs flex items-center gap-2"
                  >
                    <i className="bi bi-arrow-clockwise"></i> Actualizar
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto w-full flex-1 custom-scrollbar pr-2 pb-4">
                <div className="glass-card rounded-xl border border-[var(--border-light)] flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b border-[var(--border-soft)] bg-transparent">
                    <div>
                      <div className="text-[10px] uppercase text-dim font-bold tracking-wider mb-1">catalogo_planes</div>
                      <div className="font-bold text-main text-lg">{selectedPlan.nombre || '-'}</div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded border ${selectedPlan.activo ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-dim border-[var(--border-light)] bg-[var(--bg-glass)]'}`}>
                      {selectedPlan.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Plan tipo</span>
                      <span className="text-main font-semibold">{selectedPlan.plan_tipo || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Lineas cantidad</span>
                      <span className="text-main font-semibold">{selectedPlan.lineas_cantidad ?? '-'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Precio</span>
                      <span className="text-main font-semibold">{formatPrice(selectedPlan.precio)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Activo</span>
                      <span className="text-main font-semibold">{selectedPlan.activo ? 'Si' : 'No'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">Creado</span>
                      <span className="text-main font-semibold">{formatDate(selectedPlan.created_at)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-dim font-bold tracking-wider">ID</span>
                      <span className="text-main font-mono text-xs break-all">{selectedPlan.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center shrink-0">
              <h3 className="font-bold text-[var(--text-main)] text-lg flex items-center gap-2 m-0">
                <i className="bi bi-tags text-[var(--accent)]"></i>
                {modalMode === 'create' ? 'Nuevo Plan' : 'Editar Plan'}
              </h3>
              <button
                type="button"
                className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="flex flex-col min-h-0">
              <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {modalMode === 'edit' && (
                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">ID (solo lectura)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-dim)] bg-black/20 cursor-not-allowed font-mono"
                      value={selectedPlanId || ''}
                      readOnly
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">Nombre</label>
                  <input
                    type="text"
                    className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Standar c/1 Linea"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">Plan tipo</label>
                    <input
                      type="text"
                      className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600 font-mono"
                      value={formData.plan_tipo}
                      onChange={(e) => setFormData({ ...formData, plan_tipo: e.target.value })}
                      placeholder="standar"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">Lineas</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600"
                      value={formData.lineas_cantidad}
                      onChange={(e) => setFormData({ ...formData, lineas_cantidad: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block required">Precio</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] placeholder-gray-600"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    placeholder="63000"
                    required
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  />
                  Plan activo
                </label>
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

export default PlanesView;
