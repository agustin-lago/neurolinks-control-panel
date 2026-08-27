import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { api } from '../../core/api';
import { store, useStoreKey } from '../../core/store';
import { useParams, useNavigate } from 'react-router-dom';
import ClientGrid from './components/ClientGrid';
import ClientDetailPanel from './components/ClientDetailPanel';
import ClientModals from './components/ClientModals';
import { confirmAlert } from '../../components/SweetAlert';
import Skeleton from '../../components/Skeleton';

const EMPTY_ARRAY = [];

function ticketBelongsToClient(ticket, client) {
  const clientIds = (client.duplicate_client_ids || [client.id]).map(String);
  return clientIds.includes(String(ticket.cliente_id));
}

export default function ClientsView({ navigate, isTab = false }) {
  // Shared data from global store — updates silently in background (no flicker)
  const clientsData = useStoreKey('clients', () => store.fetchClients());
  const ticketsMetaData = useStoreKey('ticketsMeta', () => store.fetchTicketsMeta());

  const loading = clientsData === null || ticketsMetaData === null;

  const clients = clientsData || EMPTY_ARRAY;
  const ticketsMeta = ticketsMetaData || EMPTY_ARRAY;

  // Admins (not in shared store, local to this view)
  const [admins, setAdmins] = useState([]);
  const [planCatalog, setPlanCatalog] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Layout and Search
  const [search, setSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [showPendingTicketsOnly, setShowPendingTicketsOnly] = useState(false);

  // Selected Client details
  const { '*': currentPath } = useParams();
  const selectedClientId = currentPath ? currentPath.split('/')[0] : null;
  const navigateRouter = useNavigate();

  const setSelectedClientId = (id) => {
    if (id) {
      navigateRouter(`/clientes/${id}`);
    } else {
      navigateRouter(`/clientes`);
    }
  };
  const [clientTickets, setClientTickets] = useState([]);
  const [isLoadingClientDetails, setIsLoadingClientDetails] = useState(false);

  // Client Modal (Create / Edit)
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientModalTitle, setClientModalTitle] = useState('Nuevo Cliente');
  const [formClientId, setFormClientId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formVendedorUserId, setFormVendedorUserId] = useState('');
  const [formAdminUser, setFormAdminUser] = useState('');
  const [formAdminPass, setFormAdminPass] = useState('');
  const [formPlan, setFormPlan] = useState('');
  const [formAbono, setFormAbono] = useState('');
  const [formVencimiento, setFormVencimiento] = useState('');
  const [formSubscriptionStatus, setFormSubscriptionStatus] = useState('manual');
  const [formSubscriptionSource, setFormSubscriptionSource] = useState('control');

  // Load admins once on mount
  useEffect(() => {
    api.getAdmins().then(d => setAdmins(d || [])).catch(() => { });
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoadingPlans(true);
    api.getClientPlans(true)
      .then(data => {
        if (isMounted) setPlanCatalog(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error('[ClientsView] Error loading plan catalog:', err);
        if (window.showToast) window.showToast('No se pudo cargar el catalogo de planes', 'warning');
      })
      .finally(() => {
        if (isMounted) setLoadingPlans(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);




  const detailsRequestRef = useRef(0);
  const detailsClientIdRef = useRef(null);

  // Fetch client details when selectedClientId changes
  const fetchClientDetails = async (clientId) => {
    const requestId = ++detailsRequestRef.current;

    if (!clientId) {
      detailsClientIdRef.current = null;
      setClientTickets([]);
      setIsLoadingClientDetails(false);
      return;
    }

    const clientChanged = String(detailsClientIdRef.current) !== String(clientId);
    detailsClientIdRef.current = clientId;

    if (clientChanged) {
      setIsLoadingClientDetails(true);
      setClientTickets([]);
    }

    try {
      const ticketsRes = await api.getTickets({ cliente_id: clientId, limit: 500 }) || {};
      if (requestId !== detailsRequestRef.current) return;


      const allTickets = ticketsRes?.data || [];
      const supportTickets = allTickets.filter(t => t.tipo === 'Soporte');
      setClientTickets(supportTickets);


      if (requestId !== detailsRequestRef.current) return;
      setIsLoadingClientDetails(false);
    } catch (err) {
      if (requestId === detailsRequestRef.current) {
        console.error('[ClientsView] Error loading client details:', err);
        setIsLoadingClientDetails(false);
      }
    }
  };

  useEffect(() => {
    fetchClientDetails(selectedClientId);
  }, [selectedClientId, ticketsMetaData]);

  // Layout View Switcher removed

  const getPlanBadgeClass = (plan) => {
    if (!plan) return 'badge-status-secondary';
    const normalized = String(plan).toLowerCase();
    if (normalized.includes('standard') || normalized.includes('standar')) return 'badge-status-info';
    if (normalized.includes('chatbot')) return 'badge-status-warning';
    if (normalized.includes('personalizado')) return 'badge-status-secondary';
    if (normalized.includes('premium')) return 'badge-status-error';
    if (normalized.includes('enterprise')) return 'badge-status-warning';
    if (normalized.includes('baja')) return 'badge-status-secondary';
    return 'badge-status-secondary';
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const filtered = getFilteredClients();
    if (filtered.length === 0) {
      window.showToast('No hay datos para exportar', 'warning');
      return;
    }

    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const headers = ['ID', 'Nombre', 'Empresa', 'Abono', 'Email', 'Telefono', 'Plan', 'Vencimiento', 'Adjudicado A'];
    const rows = filtered.map(c => {
      const admin = admins.find(a => a.auth_user_id === c.vendedor_user_id);
      const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';
      return [
        escapeCSV(c.id),
        escapeCSV(c.nombre),
        escapeCSV(c.empresa || '-'),
        c.abono ?? 0,
        escapeCSV(c.email || '-'),
        escapeCSV(c.telefono || '-'),
        escapeCSV(c.plan || 'Personalizado'),
        escapeCSV(c.vencimiento || '-'),
        escapeCSV(adjudicado)
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
      + headers.join(',') + '\n'
      + rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'reporte_clientes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast('Reporte de clientes generado', 'success');
  };

  const handleExportCredentialsZip = async () => {
    const filtered = getFilteredClients();
    if (filtered.length === 0) {
      window.showToast('No hay datos para exportar', 'warning');
      return;
    }

    window.showToast(`Generando ZIP para ${filtered.length} clientes...`, 'loading', 999999, 'export-zip-toast', 'Procesando');

    try {
      const zip = new JSZip();

      filtered.forEach((client) => {
        const content = `CREDENCIALES DE ACCESO:\n- Usuario: ${client.admin_user || ''}\n- Contrasena: ${client.admin_pass || ''}\n`;
        const safeName = (client.nombre || 'Cliente').replace(/[^a-zA-Z0-9_\-]/g, '_');
        zip.file(`Credenciales_${safeName}.txt`, content);
      });

      const contentBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(contentBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'credenciales_clientes.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      window.showToast('Archivo ZIP descargado exitosamente', 'success', 5000, 'export-zip-toast', 'Éxito');
    } catch (err) {
      console.error('[ClientsView] Error generating ZIP:', err);
      window.showToast(`Error al generar el ZIP: ${err.message}`, 'danger', 5000, 'export-zip-toast', 'Error');
    }
  };

  // CSV Importer
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const clean = text.replace(/^\uFEFF/, '');
      const lines = clean.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        window.showToast('El archivo CSV está vacío o no tiene datos', 'warning');
        return;
      }

      const parseRow = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(cur); cur = '';
          } else {
            cur += ch;
          }
        }
        result.push(cur);
        return result;
      };

      const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());
      const idxId = headers.indexOf('id');
      const idxNom = headers.indexOf('nombre');
      const idxEmp = headers.indexOf('empresa');
      const idxEmail = headers.indexOf('email');
      const idxTel = headers.indexOf('telefono');
      const idxPlan = headers.indexOf('plan');
      const idxVenc = headers.indexOf('vencimiento');

      if (idxNom === -1) {
        window.showToast('El CSV no tiene columna "Nombre"', 'danger');
        return;
      }

      const existingIds = new Set(clients.map(c => c.id));
      const VALID_PLANS = ['Standar c/1 Linea', 'Standar c/2 Lineas', 'Standar c/3 Lineas', 'Chatbot c/1 Linea', 'Chatbot c/2 Lineas', 'Chatbot c/3 Lineas', 'Personalizado', 'Standard', 'Premium', 'Enterprise', 'Baja'];
      let created = 0, updated = 0, errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i]);
        const get = (idx) => idx !== -1 ? (cols[idx] || '').trim() : '';

        const nombre = get(idxNom);
        if (!nombre || nombre === '-') continue;

        const id = get(idxId);
        const empresa = get(idxEmp) === '-' ? '' : get(idxEmp);
        const email = get(idxEmail) === '-' ? '' : get(idxEmail);
        const telefono = get(idxTel) === '-' ? '' : get(idxTel);
        const venc = get(idxVenc) === '-' ? '' : get(idxVenc);
        const plan = VALID_PLANS.includes(get(idxPlan)) ? get(idxPlan) : 'Personalizado';

        const payload = { nombre, empresa: empresa || null, email: email || null, telefono: telefono || null, plan, vencimiento: venc || null };

        try {
          if (id && existingIds.has(id)) {
            await api.updateClient(id, payload);
            updated++;
          } else {
            await api.createClient(payload);
            created++;
          }
        } catch (err) {
          console.error(`[Import] Error en fila ${i + 1}:`, err);
          errors++;
        }
      }

      store.invalidate('clients');

      const parts = [];
      if (created) parts.push(`${created} creado${created > 1 ? 's' : ''}`);
      if (updated) parts.push(`${updated} actualizado${updated > 1 ? 's' : ''}`);
      if (errors) parts.push(`${errors} con error`);
      window.showToast(`Importación completada: ${parts.join(', ')}`, errors ? 'warning' : 'success');
    } catch (err) {
      window.showToast('Error al importar CSV', 'danger');
    }
  };

  // Client Modal controls
  const handleOpenNewClientModal = () => {
    setFormClientId('');
    setClientModalTitle('Nuevo Cliente');
    setFormName('');
    setFormCompany('');
    setFormEmail('');
    setFormPhone('');
    setFormVendedorUserId('');
    setFormAdminUser('');
    setFormAdminPass('');
    setFormPlan('Personalizado');
    setFormAbono('0');
    setFormVencimiento('');
    setFormSubscriptionStatus('manual');
    setFormSubscriptionSource('personalizado');
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = (c) => {
    setFormClientId(c.id);
    setClientModalTitle('Editar Cliente');
    setFormName(c.nombre);
    setFormCompany(c.empresa || '');
    setFormEmail(c.email || '');
    setFormPhone(c.telefono || '');
    setFormVendedorUserId(c.vendedor_user_id || '');
    setFormAdminUser(c.email || c.admin_user || '');
    setFormAdminPass(c.admin_pass || '');
    setFormPlan(c.plan || '');
    setFormAbono(c.abono ?? '');
    setFormVencimiento(c.vencimiento || '');
    setFormSubscriptionStatus(c.subscription_status || (c.mp_preapproval_id ? 'active' : 'manual'));
    setFormSubscriptionSource(c.subscription_source || (c.mp_preapproval_id ? 'mercadopago' : 'control'));
    setIsClientModalOpen(true);
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    const clientData = {
      nombre: formName,
      empresa: formCompany || null,
      email: formEmail || null,
      telefono: formPhone || null,
      vendedor_user_id: formVendedorUserId || null,
      admin_user: formEmail || null,
      admin_pass: formAdminPass || null,
      plan: formPlan || null,
      abono: formAbono === '' ? 0 : Number(formAbono),
      vencimiento: formVencimiento || null,
      subscription_status: formSubscriptionStatus || 'pending',
      subscription_source: formSubscriptionSource || null
    };

    try {
      if (formClientId) {
        await api.updateClient(formClientId, clientData);
        window.showToast('Cliente actualizado', 'success');
      } else {
        await api.createClient(clientData);
        window.showToast('Cliente creado con éxito', 'success');
      }
      setIsClientModalOpen(false);
      store.invalidate('clients');
      if (formClientId && selectedClientId === formClientId) {
        // Refetch detailed client info
        fetchClientDetails(formClientId);
      }
    } catch (err) {
      window.showToast(err?.message || 'Error al guardar cliente', 'danger');
    }
  };


  const handleDeleteClient = async (id) => {
    if (!(await confirmAlert('Deseas eliminar este cliente?<br><br>Se perderan sus datos asociados.', 'Eliminar Cliente', 'Eliminar Definitivamente', 'Cancelar'))) return;
    try {
      await api.deleteClient(id);
      window.showToast('Cliente eliminado', 'warning');
      if (selectedClientId === id) {
        setSelectedClientId(null);
      }
      store.invalidate('clients');
      store.fetchClients(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al eliminar cliente', 'danger');
    }
  };

  // Billing modal and functions removed as billing system is eradicated


  const handleOpenChat = (ticketId) => {
    window.localStorage.setItem('currentChatTicketId', ticketId);
    window.dispatchEvent(new CustomEvent('local-storage-sync', { detail: { key: 'currentChatTicketId', newValue: ticketId } }));
    
    window.localStorage.setItem('currentChatTicketBackView', 'clients');
    window.dispatchEvent(new CustomEvent('local-storage-sync', { detail: { key: 'currentChatTicketBackView', newValue: 'clients' } }));
    
    navigate('tickets');
  };

  const getFilteredClients = () => {
    return clients.filter(c => {
      if (search && !(
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (c.empresa && c.empresa.toLowerCase().includes(search.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
      )) return false;

      if (adminFilter) {
        if (adminFilter === 'unassigned' && c.vendedor_user_id !== null) return false;
        if (adminFilter !== 'unassigned' && String(c.vendedor_user_id) !== String(adminFilter)) return false;
      }

      if (showPendingTicketsOnly) {
        const ticketCount = new Set(ticketsMeta.filter(t => ticketBelongsToClient(t, c)).map(t => t.id)).size;
        if (ticketCount === 0) return false;
      }

      return true;
    });
  };

  const filteredClients = getFilteredClients();

  if (loading) {
    return (
      <div className={isTab ? 'flex flex-col w-full h-full pt-4 overflow-y-auto pr-1' : ''}>
        <div className="view-header">
          <div className="view-header-left">
            <Skeleton variant="title" className="w-48 mb-2" />
            <Skeleton variant="text" className="w-64" />
          </div>
          <div className="view-header-controls">
            <Skeleton variant="button" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }


  return (
    <div className={isTab ? 'flex flex-col w-full h-full pt-4 overflow-y-auto pr-1' : ''}>
      {selectedClientId ? (
        <ClientDetailPanel
          selectedClientId={selectedClientId}
          clients={clients}
          admins={admins}
          getPlanBadgeClass={getPlanBadgeClass}
          window={window}
          handleOpenEditClient={handleOpenEditClient}
          handleDeleteClient={handleDeleteClient}
          isLoadingClientDetails={isLoadingClientDetails}
          clientTickets={clientTickets}
          handleOpenChat={handleOpenChat}
        />
      ) : (
        <ClientGrid
          search={search}
          setSearch={setSearch}
          adminFilter={adminFilter}
          setAdminFilter={setAdminFilter}
          admins={admins}
          showPendingTicketsOnly={showPendingTicketsOnly}
          setShowPendingTicketsOnly={setShowPendingTicketsOnly}
          handleExportCSV={handleExportCSV}
          handleExportCredentialsZip={handleExportCredentialsZip}
          handleImportCSV={handleImportCSV}
          handleOpenNewClientModal={handleOpenNewClientModal}
          filteredClients={filteredClients}
          ticketsMeta={ticketsMeta}
          getPlanBadgeClass={getPlanBadgeClass}
          setSelectedClientId={setSelectedClientId}
        />
      )}

      <ClientModals
        isClientModalOpen={isClientModalOpen}
        setIsClientModalOpen={setIsClientModalOpen}
        clientModalTitle={clientModalTitle}
        handleClientSubmit={handleClientSubmit}
        formName={formName}
        setFormName={setFormName}
        formCompany={formCompany}
        setFormCompany={setFormCompany}
        formEmail={formEmail}
        setFormEmail={setFormEmail}
        formPhone={formPhone}
        setFormPhone={setFormPhone}
        planCatalog={planCatalog}
        loadingPlans={loadingPlans}
        formVendedorUserId={formVendedorUserId}
        setFormVendedorUserId={setFormVendedorUserId}
        admins={admins}
        formAdminUser={formAdminUser}
        setFormAdminUser={setFormAdminUser}
        formAdminPass={formAdminPass}
        setFormAdminPass={setFormAdminPass}
        formPlan={formPlan}
        setFormPlan={setFormPlan}
        formAbono={formAbono}
        setFormAbono={setFormAbono}
        formVencimiento={formVencimiento}
        setFormVencimiento={setFormVencimiento}
        formSubscriptionStatus={formSubscriptionStatus}
        setFormSubscriptionStatus={setFormSubscriptionStatus}
        formSubscriptionSource={formSubscriptionSource}
        setFormSubscriptionSource={setFormSubscriptionSource}
      />
    </div>
  );
}
