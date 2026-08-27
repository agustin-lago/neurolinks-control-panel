async function _fetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
    throw new Error(err.error || 'Error del servidor');
  }
  return res.json();
}

function _post(path, body) {
  return _fetch(path, { method: 'POST', body: JSON.stringify(body) });
}

export const api = {
  // --------------------------------------------------
  // EXTERNAL
  // --------------------------------------------------
  openExternal: (url) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(); },
  openDashboardWindow: (url) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(); },

  // --------------------------------------------------
  // CONFIG
  // --------------------------------------------------
  getConfigSupabase: () => _fetch('/api/config/supabase'),
  getClientPlans: (forceRefresh = false) => _fetch(`/api/plans${forceRefresh ? '?refresh=true' : ''}`),

  updateClientSubscription: (clientId, payload) =>
    _fetch(`/api/client-subscriptions/${clientId}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // --------------------------------------------------
  // PROJECTS
  // --------------------------------------------------
  getAssistants: (forceRefresh = false) => _fetch(`/api/assistants${forceRefresh ? '?refresh=true' : ''}`),

  getProjectsAutoUpdate: () => _fetch('/api/projects/auto-update'),
  updateProjectsAutoUpdate: (enabled) =>
    _fetch('/api/projects/auto-update', { method: 'PATCH', body: JSON.stringify({ enabled }) }),

  updateProjectName: (projectId, newName, railwayWorkspaceKey = null) =>
    _fetch(`/api/projects/${projectId}/name`, { method: 'PATCH', body: JSON.stringify({ newName, railwayWorkspaceKey }) }),

  deleteProject: (projectId, railwayWorkspaceKey = null) =>
    _fetch(`/api/projects/${projectId}`, { method: 'DELETE', body: JSON.stringify({ railwayWorkspaceKey }) }),

  getWhatsAppStatus: (projectId) =>
    _fetch(`/api/projects/${projectId}/whatsapp`),

  getProjectMetrics: (projectId, environmentId, serviceId, startDate, endDate, measurements, sampleRateSeconds, railwayWorkspaceKey = null) => {
    let url = `/api/projects/${projectId}/metrics?startDate=${encodeURIComponent(startDate)}`;
    if (environmentId) url += `&environmentId=${encodeURIComponent(environmentId)}`;
    if (serviceId) url += `&serviceId=${encodeURIComponent(serviceId)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    if (measurements && measurements.length > 0) url += `&measurements=${encodeURIComponent(measurements.join(','))}`;
    if (sampleRateSeconds) url += `&sampleRateSeconds=${sampleRateSeconds}`;
    if (railwayWorkspaceKey) url += `&railwayWorkspaceKey=${encodeURIComponent(railwayWorkspaceKey)}`;
    return _fetch(url);
  },

  getProjectUsage: (projectId, startDate, endDate, railwayWorkspaceKey = null) => {
    let url = `/api/projects/${projectId}/usage?startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    if (railwayWorkspaceKey) url += `&railwayWorkspaceKey=${encodeURIComponent(railwayWorkspaceKey)}`;
    return _fetch(url);
  },

  // --------------------------------------------------
  // ONBOARDING (Checklist y Notas)
  // --------------------------------------------------
  fetchAllProjectOnboardings: () => _fetch('/api/supabase/project_onboarding'),
  fetchProjectOnboarding: (projectId) => _fetch(`/api/supabase/project_onboarding/${projectId}`),
  updateProjectOnboarding: (projectId, updates) => _post(`/api/supabase/project_onboarding/${projectId}`, updates),

  // --------------------------------------------------
  // TEMPLATES
  // --------------------------------------------------
  searchTemplates: (query) =>
    _fetch(`/api/templates?q=${encodeURIComponent(query || '')}`),

  // --------------------------------------------------
  // SERVICES
  // --------------------------------------------------
  renameService: (serviceId, newName, railwayWorkspaceKey = null) =>
    _fetch(`/api/services/${serviceId}/name`, { method: 'PATCH', body: JSON.stringify({ newName, railwayWorkspaceKey }) }),

  redeployService: (serviceId, environmentId, railwayWorkspaceKey = null) =>
    _post(`/api/services/${serviceId}/redeploy`, { environmentId, railwayWorkspaceKey }),

  updateService: (projectId, environmentId, serviceId, railwayWorkspaceKey = null) =>
    _post(`/api/projects/${projectId}/update`, { environmentId, serviceId, railwayWorkspaceKey }),

  // --------------------------------------------------
  // SETTINGS (Supabase)
  // --------------------------------------------------
  getSettings: (projectId) => _fetch(`/api/settings/${projectId}`),
  createSetting: (projectId, key, value, api_key = null) => _fetch(`/api/settings/${projectId}`, { method: 'POST', body: JSON.stringify({ key, value, api_key }) }),
  updateSetting: (projectId, key, updates) => {
    const payload = updates && typeof updates === 'object' && !Array.isArray(updates)
      ? updates
      : { value: updates };
    return _fetch(`/api/settings/${projectId}`, { method: 'PATCH', body: JSON.stringify({ key, ...payload }) });
  },
  deleteSetting: (projectId, key) => _fetch(`/api/settings/${projectId}/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  // --------------------------------------------------
  // RAILWAY LOGS
  // --------------------------------------------------
  getRailwayLogs: (environmentId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return _fetch(`/api/railway/logs/${environmentId}${query ? `?${query}` : ''}`);
  },

  // --------------------------------------------------
  // VARIABLES
  // --------------------------------------------------
  getServiceVariables: (projectId, environmentId, serviceId, railwayWorkspaceKey = null) =>
    _fetch(`/api/variables?projectId=${projectId}&environmentId=${environmentId}&serviceId=${serviceId}${railwayWorkspaceKey ? `&railwayWorkspaceKey=${encodeURIComponent(railwayWorkspaceKey)}` : ''}`),

  upsertVariable: (projectId, environmentId, serviceId, name, value, railwayWorkspaceKey = null) =>
    _post('/api/variables', { projectId, environmentId, serviceId, name, value, railwayWorkspaceKey }),

  deleteVariable: (projectId, environmentId, serviceId, name, railwayWorkspaceKey = null) =>
    _post('/api/variables/delete', { projectId, environmentId, serviceId, name, railwayWorkspaceKey }),

  // --------------------------------------------------
  // DOMAINS
  // --------------------------------------------------
  getServiceDomains: (projectId, environmentId, serviceId, railwayWorkspaceKey = null) =>
    _fetch(`/api/domains?projectId=${projectId}&environmentId=${environmentId}&serviceId=${serviceId}${railwayWorkspaceKey ? `&railwayWorkspaceKey=${encodeURIComponent(railwayWorkspaceKey)}` : ''}`),

  // --------------------------------------------------
  // VERSION
  // --------------------------------------------------
  getAppVersion: () => _fetch('/api/app-version'),

  // --------------------------------------------------
  // CLIENTS
  // --------------------------------------------------
  getClients: (forceRefresh = false) => _fetch(`/api/clients${forceRefresh ? '?refresh=true' : ''}`),

  createClient: (clientData) => _post('/api/clients', clientData),

  updateClient: (id, clientData) =>
    _fetch(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(clientData) }),

  deleteClient: (id) =>
    _fetch(`/api/clients/${id}`, { method: 'DELETE' }),

  getProjectClient: (railwayProjectId) =>
    _fetch(`/api/projects/${railwayProjectId}/client`),

  deleteGhostProjectRecord: (id) =>
    _fetch(`/api/projects/ghost/${id}`, { method: 'DELETE' }),

  getClientProjects: (clientId) =>
    _fetch(`/api/clients/${clientId}/projects`),

  // --------------------------------------------------
  // TICKETS
  // --------------------------------------------------
  getTickets: async (filters) => {
    const params = new URLSearchParams(filters || {});
    params.append('_t', Date.now());
    const res = await _fetch(`/api/tickets?${params.toString()}`);
    if (res && Array.isArray(res.data)) {
      // The backend already filters by 'Soporte', no need to do it here
      // which caused issues if 'tipo' was not selected.
    }
    return res;
  },

  getTicketsMeta: async (forceRefresh = false) => {
    const res = await _fetch(`/api/tickets/meta?_t=${Date.now()}${forceRefresh ? '&refresh=true' : ''}`);
    if (Array.isArray(res)) {
      // The backend already filters by 'Soporte', no need to do it here.
      // This caused an issue because 'tipo' wasn't selected in the meta query.
      return res;
    }
    return res;
  },

  getTicketById: (id) => _fetch(`/api/tickets/${id}?_t=${Date.now()}`),

  createTicket: (ticketData) => _post('/api/tickets', ticketData),

  updateTicket: (id, ticketData) =>
    _fetch(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(ticketData) }),

  addTicketMessage: (id, messageData) =>
    _post(`/api/tickets/${id}/chat`, messageData),

  deleteTicket: (id) =>
    _fetch(`/api/tickets/${id}`, { method: 'DELETE' }),

  getClientPendingTickets: (clientId) =>
    _fetch(`/api/clients/${clientId}/pending-tickets`),

  // --------------------------------------------------
  // AUDIT
  // --------------------------------------------------
  getAuditLogs: () => _fetch('/api/audit'),
  getLogs: () => _fetch('/api/logs'),


  // --------------------------------------------------
  // ADMINS & USER info
  // --------------------------------------------------
  getAdmins: () => _fetch('/api/admins'),
  getCurrentUser: () => _fetch('/api/me'),

  // --------------------------------------------------
  // SUPABASE DATA
  // --------------------------------------------------
  fetchActiveChatProjects: (projectIds) => _post('/api/supabase/active-chat-projects', { projectIds }),

  fetchSupabaseChats: (projectId, limit = null, offset = 0, filters = {}) => {
    let url = `/api/supabase/chats?offset=${offset}`;
    if (projectId) url += `&projectId=${projectId}`;
    if (limit) url += `&limit=${limit}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.type) url += `&type=${encodeURIComponent(filters.type)}`;
    if (filters.bot_enabled !== undefined && filters.bot_enabled !== '') url += `&bot_enabled=${filters.bot_enabled}`;
    if (filters.unread) url += `&unread=true`;
    return _fetch(url);
  },
  
  updateSupabaseChat: (chatId, updates) => {
    return _fetch(`/api/supabase/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  fetchMetaOnboarding: (projectId) => {
    let url = `/api/supabase/meta_onboarding`;
    if (projectId) url += `?projectId=${projectId}`;
    return _fetch(url);
  },

  updateMetaOnboarding: (projectId, updates) => {
    return _fetch(`/api/supabase/meta_onboarding/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  fetchWhatsappSessions: (projectId) => {
    let url = `/api/supabase/whatsapp_sessions`;
    if (projectId) url += `?projectId=${projectId}`;
    return _fetch(url);
  },

  updateWhatsappSession: (projectId, updates) => {
    return _fetch(`/api/supabase/whatsapp_sessions/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  // --------------------------------------------------
  // ADMINS ACCOUNT (Supabase)
  // --------------------------------------------------
  fetchAdminsAccount: () => _fetch('/api/supabase/admins_account'),
  createAdminAccount: (data) => _post('/api/supabase/admins_account', data),
  updateAdminAccount: (id, updates) => _fetch(`/api/supabase/admins_account/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }),
  deleteAdminAccount: (id) => _fetch(`/api/supabase/admins_account/${id}`, {
    method: 'DELETE'
  }),

  // --------------------------------------------------
  // CATALOGO PLANES (Supabase)
  // --------------------------------------------------
  fetchCatalogPlans: () => _fetch('/api/supabase/catalogo_planes'),
  createCatalogPlan: (data) => _post('/api/supabase/catalogo_planes', data),
  updateCatalogPlan: (id, updates) => _fetch(`/api/supabase/catalogo_planes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }),
};

// Expose globally to maintain backward compatibility in some custom places
window.api = api;
