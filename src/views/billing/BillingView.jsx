import React, { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { store, useStoreKey } from '../../core/store';
import Skeleton from '../../components/Skeleton';

export default function BillingView({ isTab = false }) {
  const clientsData = useStoreKey('clients', () => store.fetchClients());
  const [admins, setAdmins] = useState([]);

  // Guardamos el porcentaje de descuento por ID de cliente. Ej: { "123": 4.5 }
  const [percentages, setPercentages] = useState({});
  const [savingAssigned, setSavingAssigned] = useState({});


  useEffect(() => {
    api.getAdmins().then(d => setAdmins(d || [])).catch(() => { });
  }, []);

  const clients = clientsData || [];
  const loading = clientsData === null;

  const handlePercentageChange = (clientId, value) => {
    // Permitir vacio o numeros válidos
    if (value === '' || !isNaN(value)) {
      setPercentages(prev => ({ ...prev, [clientId]: value }));
    }
  };

  const getAdminName = (vendedor_user_id) => {
    if (!vendedor_user_id) return 'Sin Asignar';
    const admin = admins.find(a => String(a.auth_user_id) === String(vendedor_user_id));
    return admin ? (admin.nombre || admin.email) : 'Sin Asignar';
  };

  const getProjectPlanDetails = (client) => {
    const projectCount = Number(client.project_count) || (Array.isArray(client.linked_projects) ? client.linked_projects.length : 0);
    const slotLimit = Number(client.lineas_cantidad);
    const usage = Number.isFinite(slotLimit) && slotLimit > 0 ? `${projectCount}/${slotLimit}` : String(projectCount);
    return [{
      label: client.plan || 'Sin plan',
      amount: Number(client.abono) || 0,
      usage
    }];
  };

  const getPlanExportLabel = (client) => (
    getProjectPlanDetails(client)
      .map(p => p.amount > 0 ? `${p.label} (${p.amount.toLocaleString('es-AR')})` : p.label)
      .join(' / ')
  );
  const handleAssignedChange = async (client, vendedorUserId) => {
    const nextValue = vendedorUserId || null;
    if (String(client.vendedor_user_id || '') === String(nextValue || '')) return;

    setSavingAssigned(prev => ({ ...prev, [client.id]: true }));
    try {
      await api.updateClient(client.id, { vendedor_user_id: nextValue });
      store.invalidate('clients');
      store.fetchClients(true).catch(() => {});
      window.showToast?.('Adjudicado actualizado', 'success');
    } catch (err) {
      window.showToast?.(err?.message || 'Error al actualizar adjudicado', 'danger');
    } finally {
      setSavingAssigned(prev => ({ ...prev, [client.id]: false }));
    }
  };

  const calculateFinalPrice = (budget, percentageStr) => {
    const p = parseFloat(percentageStr);
    const b = parseFloat(budget) || 0;
    if (isNaN(p) || p <= 0) return b;
    return b - (b * p / 100);
  };

  const handleExportCSV = () => {
    if (clients.length === 0) {
      window.showToast?.('No hay datos para exportar', 'warning');
      return;
    }

    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;

    // Preparar filas de detalles
    const detailsHeaders = ['Cliente', 'Plan', 'Presupuesto Bruto', 'Adjudicado A', 'Porcentaje (%)', 'Precio Final'];

    let totalGross = 0;
    let totalNet = 0;
    const totalsByAdmin = {}; // { "Nombre Admin": { gross: 0, net: 0 } }

    const rows = clients.map(c => {
      const budget = parseFloat(c.abono_total ?? c.abono) || 0;
      const planLabel = getPlanExportLabel(c);
      const percentage = percentages[c.id] || '';
      const finalPrice = calculateFinalPrice(budget, percentage);
      const adminName = getAdminName(c.vendedor_user_id);

      // Sumatorias
      totalGross += budget;
      totalNet += finalPrice;

      if (!totalsByAdmin[adminName]) totalsByAdmin[adminName] = { gross: 0, net: 0 };
      totalsByAdmin[adminName].gross += budget;
      totalsByAdmin[adminName].net += finalPrice;

      return [
        escapeCSV(c.nombre),
        escapeCSV(planLabel),
        budget,
        escapeCSV(adminName),
        percentage,
        finalPrice
      ];
    });

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';

    // 1. Tabla principal de clientes
    csvContent += detailsHeaders.join(',') + '\n';
    csvContent += rows.map(r => r.join(',')).join('\n') + '\n\n';

    // 2. Resumen por administrador
    csvContent += escapeCSV('--- RESUMEN POR ADMINISTRADOR ---') + '\n';
    csvContent += 'Administrador,Total Cobrado (Bruto),Total Cobrado (Neto)\n';
    for (const [admin, totals] of Object.entries(totalsByAdmin)) {
      csvContent += `${escapeCSV(admin)},${totals.gross},${totals.net}\n`;
    }
    csvContent += '\n';

    // 3. Totales Globales
    csvContent += escapeCSV('--- TOTALES GLOBALES ---') + '\n';
    csvContent += `VALOR FINAL BRUTO,${totalGross}\n`;
    csvContent += `VALOR FINAL NETO,${totalNet}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'reporte_facturacion.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast?.('Reporte de facturación generado', 'success');
  };

  if (loading) {
    return (
      <div className={`flex flex-col w-full ${isTab ? 'h-full pt-4' : 'h-[calc(100dvh-65px)] md:h-[100dvh] p-2'} overflow-hidden fade-in bg-transparent`}>
        <div className="flex flex-col sm:flex-row justify-between items-center my-3 gap-3">
          <Skeleton variant="text" className="w-32 h-6" />
          <Skeleton variant="button" className="w-32" />
        </div>
        <div className="glass-card flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="table-responsive flex-1 overflow-y-auto pr-1 sm:pr-2">
            <table className="table table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th><Skeleton variant="text" className="w-20" /></th>
                  <th><Skeleton variant="text" className="w-20" /></th>
                  <th><Skeleton variant="text" className="w-24" /></th>
                  <th><Skeleton variant="text" className="w-24" /></th>
                  <th><Skeleton variant="text" className="w-20" /></th>
                  <th><Skeleton variant="text" className="w-20" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan="6"><Skeleton variant="card" className="h-10 w-full" /></td></tr>
                <tr><td colSpan="6"><Skeleton variant="card" className="h-10 w-full opacity-80" /></td></tr>
                <tr><td colSpan="6"><Skeleton variant="card" className="h-10 w-full opacity-60" /></td></tr>
                <tr><td colSpan="6"><Skeleton variant="card" className="h-10 w-full opacity-40" /></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full ${isTab ? 'h-full pt-4' : 'h-[calc(100dvh-65px)] md:h-[100dvh] p-2'} overflow-hidden fade-in bg-transparent`}>

      {/* Controles de Paginación */}
      {clients.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center my-3 gap-3 text-sm shrink-0">
          <div className="text-dim">
            Mostrando {clients.length} clientes
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-outline-success btn-sm flex items-center gap-2" onClick={handleExportCSV}>
              <i className="bi bi-file-earmark-excel"></i> Exportar CSV
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="glass-card flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="table-responsive flex-1 overflow-y-auto pr-1 sm:pr-2">
          <table className="table table-hover mb-0 align-middle [&_th]:border-x [&_td]:border-x [&_th]:border-[var(--border-light)] [&_td]:border-[var(--border-light)]">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-center">Plan</th>
                <th className="text-right">Presupuesto Bruto</th>
                <th className="text-center">Adjudicado A</th>
                <th className="text-center" style={{ width: '120px' }}>Porcentaje (%)</th>
                <th className="text-right">Precio Final</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-dim py-12">
                    No hay clientes registrados
                  </td>
                </tr>
              ) : (
                clients.map(c => {
                  const budget = parseFloat(c.abono_total ?? c.abono) || 0;
                  const planDetails = getProjectPlanDetails(c);
                  const percentage = percentages[c.id] || '';
                  const finalPrice = calculateFinalPrice(budget, percentage);

                  return (
                    <tr key={c.id}>
                      <td className="font-bold text-sm text-[var(--text-main)] max-w-[150px] sm:max-w-[200px] xl:max-w-[300px]">
                        <div className="truncate" title={c.nombre}>
                          {c.nombre}
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          {planDetails.map((plan, index) => (
                            <span
                              key={`${c.id}-${plan.label}-${index}`}
                              className={`status-badge status-${(plan.label || 'sin-plan').toLowerCase().replace(/\s+/g, '-')}`}
                              title={plan.amount > 0 ? `$${plan.amount.toLocaleString('es-AR')}` : undefined}
                            >
                              {plan.label}
                              {plan.usage && (
                                <span className="ml-1 opacity-70">
                                  {plan.usage} inst.
                                </span>
                              )}
                              {plan.amount > 0 && (
                                <span className="ml-1 opacity-70">
                                  ${plan.amount.toLocaleString('es-AR')}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-right font-semibold text-dim">
                        ${budget.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-center text-sm text-dim">
                        <select
                          className="form-select form-select-sm bg-transparent border-[var(--border-light)] text-[var(--text-main)] cursor-pointer min-w-[150px]"
                          value={c.vendedor_user_id || ''}
                          disabled={Boolean(savingAssigned[c.id])}
                          onChange={(e) => handleAssignedChange(c, e.target.value)}
                          title={getAdminName(c.vendedor_user_id)}
                        >
                          <option value="">Sin Asignar</option>
                          {admins.map(adm => (
                            <option key={adm.auth_user_id} value={adm.auth_user_id}>
                              {adm.nombre || adm.email}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-center">
                        <input
                          type="number"
                          className="form-control form-control-sm text-center"
                          style={{ background: 'var(--surface-mixed)', border: '1px solid var(--border-soft)', color: 'var(--text-main)' }}
                          placeholder="0"
                          value={percentage}
                          onChange={(e) => handlePercentageChange(c.id, e.target.value)}
                          step="0.1"
                          min="0"
                          max="100"
                        />
                      </td>
                      <td className="text-right font-bold" style={{ color: 'var(--text-main)' }}>
                        ${finalPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
