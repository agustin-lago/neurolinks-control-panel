require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const railwayService = require('./src/services/railwayService');
const supabaseService = require('./src/services/supabaseService');
const packageJson = require('./package.json');

const APP_BUILD_INFO = {
  version: packageJson.version,
  deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null,
  gitSha: process.env.RAILWAY_GIT_COMMIT_SHA || null,
  buildId: process.env.RAILWAY_DEPLOYMENT_ID || process.env.RAILWAY_GIT_COMMIT_SHA || `local-${Date.now()}`
};

const CONTROL_SETTINGS_PROJECT_ID = 'neurolinks-control';
const AUTO_UPDATE_ENABLED_KEY = 'AUTO_UPDATE_PROJECTS_ENABLED';
const AUTO_UPDATE_LAST_RUN_DATE_KEY = 'AUTO_UPDATE_PROJECTS_LAST_RUN_DATE';
const AUTO_UPDATE_TIMEZONE = 'America/Argentina/Buenos_Aires';
let projectsAutoUpdateRunning = false;

// --------------------------------------------------
// IN-MEMORY CACHE
// --------------------------------------------------

const _cache = new Map(); // key -> { data, expiresAt }

/**
 * Returns cached data if still valid, otherwise calls fn(), caches the result and returns it.
 * @param {string} key - Cache key
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @param {Function} fn - Async function that fetches fresh data
 * @param {boolean} [forceRefresh=false] - If true, bypass cache and fetch fresh
 */
async function withCache(key, ttlMs, fn, forceRefresh = false) {
  if (!forceRefresh) {
    const hit = _cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      return hit.data;
    }
  }
  const data = await fn();
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/** Invalidate one or more cache keys immediately */
function invalidateCache(...keys) {
  keys.forEach(k => _cache.delete(k));
}
function isTruthySetting(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function getBuenosAiresDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AUTO_UPDATE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

async function getControlSettingValue(key, fallback = '') {
  const settings = await supabaseService.getSettings(CONTROL_SETTINGS_PROJECT_ID);
  const item = (settings || []).find(s => s.key === key);
  return item?.value ?? fallback;
}

async function setControlSettingValue(key, value) {
  await supabaseService.updateSetting(CONTROL_SETTINGS_PROJECT_ID, key, String(value));
}

async function getProjectsAutoUpdateState() {
  const [enabled, lastRunDate] = await Promise.all([
    getControlSettingValue(AUTO_UPDATE_ENABLED_KEY, 'false'),
    getControlSettingValue(AUTO_UPDATE_LAST_RUN_DATE_KEY, '')
  ]);

  return {
    enabled: isTruthySetting(enabled),
    lastRunDate: lastRunDate || null,
    timezone: AUTO_UPDATE_TIMEZONE,
    scheduledHour: '00:00'
  };
}

async function updateAllAvailableServices(source = 'manual') {
  const assistants = await railwayService.getAssistants();
  const updatable = (assistants || []).flatMap(project =>
    (project.services || [])
      .filter(service => service.isUpdatable)
      .map(service => ({ ...service, projectName: project.name }))
  );

  if (updatable.length === 0) {
    return { total: 0, updated: 0, failed: 0, source };
  }

  const results = await Promise.allSettled(
    updatable.map(service => railwayService.deployServiceUpdate(service.projectId, service.environmentId, service.id, service.railwayWorkspaceKey))
  );
  const failed = results.filter(result => result.status === 'rejected').length;
  const updated = updatable.length - failed;

  await supabaseService.logAction(
    source === 'auto' ? 'Auto-Update Proyectos' : 'Actualizar Todo Proyectos',
    `${updated}/${updatable.length} servicios actualizados${failed ? `, ${failed} con error` : ''}`,
    'proyectos',
    source
  );

  invalidateCache('assistants');
  return { total: updatable.length, updated, failed, source };
}

async function runProjectsAutoUpdateIfDue() {
  if (projectsAutoUpdateRunning) return;

  try {
    const state = await getProjectsAutoUpdateState();
    if (!state.enabled) return;

    const now = getBuenosAiresDateParts();
    if (now.hour !== 0) return;
    if (state.lastRunDate === now.dateKey) return;

    projectsAutoUpdateRunning = true;
    console.log(`[Auto-Update] Iniciando actualizacion diaria de proyectos (${now.dateKey})`);
    const result = await updateAllAvailableServices('auto');
    await setControlSettingValue(AUTO_UPDATE_LAST_RUN_DATE_KEY, now.dateKey);
    console.log(`[Auto-Update] Finalizado: ${result.updated}/${result.total} servicios actualizados, ${result.failed} con error`);
  } catch (err) {
    console.error('[Auto-Update] Error:', err.message);
  } finally {
    projectsAutoUpdateRunning = false;
  }
}

function startProjectsAutoUpdateScheduler() {
  runProjectsAutoUpdateIfDue().catch(err => console.error('[Auto-Update] Error inicial:', err.message));
  setInterval(() => {
    runProjectsAutoUpdateIfDue().catch(err => console.error('[Auto-Update] Error en ciclo:', err.message));
  }, 60000);
}

// --------------------------------------------------
// INPUT SANITIZATION HELPERS
// --------------------------------------------------

function sanitizeStr(val, maxLen = 500) {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

function isValidDate(dateStr) {
  if (!dateStr) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

const FALLBACK_CLIENT_PLANS = [
  'Standar c/1 Linea',
  'Standar c/2 Lineas',
  'Standar c/3 Lineas',
  'Chatbot c/1 Linea',
  'Chatbot c/2 Lineas',
  'Chatbot c/3 Lineas',
  'Personalizado',
  'Standard',
  'Premium',
  'Enterprise',
  'Baja'
];
const VALID_TICKET_ESTADOS = ['Abierto', 'En progreso', 'Cerrado'];

async function normalizeClientPlan(planValue) {
  const requestedPlan = sanitizeStr(planValue, 100);

  try {
    const plans = await withCache('catalogo_planes', 60_000, () => supabaseService.getCatalogPlans());
    const planNames = (plans || []).map(p => p.nombre).filter(Boolean);

    if (requestedPlan && planNames.includes(requestedPlan)) return requestedPlan;
    if (requestedPlan && FALLBACK_CLIENT_PLANS.includes(requestedPlan)) return requestedPlan;
    if (planNames.includes('Personalizado')) return 'Personalizado';
    return planNames[0] || 'Personalizado';
  } catch (err) {
    console.warn('[Plans] Could not validate against catalogo_planes:', err.message);
    if (requestedPlan && FALLBACK_CLIENT_PLANS.includes(requestedPlan)) return requestedPlan;
    return 'Personalizado';
  }
}
async function normalizeProjectSubscription(body = {}) {
  const requestedPlan = sanitizeStr(body.plan, 100);
  const vencimiento = isValidDate(body.vencimiento) ? (body.vencimiento || null) : null;

  if (!requestedPlan) {
    return { plan: null, plan_tipo: null, lineas_cantidad: null, abono: 0, vencimiento };
  }

  const plans = await withCache('catalogo_planes', 60_000, () => supabaseService.getCatalogPlans());
  const catalogPlan = (plans || []).find(p => String(p.nombre || '').toLowerCase() === requestedPlan.toLowerCase());
  const rawAbono = body.abono !== undefined ? Number(body.abono) : Number(catalogPlan?.precio);

  return {
    plan: catalogPlan?.nombre || requestedPlan,
    plan_tipo: catalogPlan?.plan_tipo || null,
    lineas_cantidad: catalogPlan?.lineas_cantidad ?? null,
    abono: Number.isFinite(rawAbono) ? rawAbono : 0,
    vencimiento
  };
}

async function normalizeClientSubscription(body = {}) {
  const subscription = await normalizeProjectSubscription(body);
  const status = sanitizeStr(body.subscription_status, 40) || (subscription.plan ? 'manual' : 'pending');
  const source = sanitizeStr(body.subscription_source, 40) || (subscription.plan ? 'control' : null);
  const allowedStatuses = ['pending', 'active', 'manual', 'cancelled'];
  const allowedSources = ['mercadopago', 'control', 'personalizado'];

  if (String(subscription.plan || '').toLowerCase() === 'personalizado') {
    subscription.subscription_status = 'manual';
    subscription.subscription_source = 'personalizado';
  } else {
    subscription.subscription_status = allowedStatuses.includes(status) ? status : 'pending';
    subscription.subscription_source = allowedSources.includes(source) ? source : null;
  }

  return subscription;
}
const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'neurolinks-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' }
}));

// --------------------------------------------------
// AUTH
// --------------------------------------------------

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autorizado' });
  res.redirect('/login');
}

// --------------------------------------------------
// PUBLICO: assets y login
// --------------------------------------------------

app.use('/assets', express.static(path.join(__dirname, 'dist/assets')));

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/sw.js'));
});

app.get('/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'dist/login.html'));
});

app.post('/login', async (req, res) => {
  const username = sanitizeStr(req.body.username, 200);
  const password = sanitizeStr(req.body.password, 200);

  if (!password) {
    return res.status(400).json({ ok: false, error: 'Contraseña requerida' });
  }

  // 1. Intentar validar contra la tabla de base de datos
  let isValid = false;
  if (username) {
    isValid = await supabaseService.validateAdminLogin(username, password);
  }

  // 2. Fallback si no es válido (solo permitido en desarrollo local)
  const isLocalDev = process.env.NODE_ENV !== 'production';
  if (!isValid && isLocalDev && username === 'admin' && password === process.env.ADMIN_PASSWORD) {
    isValid = true;
  }

  if (isValid) {
    req.session.authenticated = true;
    req.session.username = username || 'admin';
    if (req.body.rememberMe) {
      req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year (effectively permanent)
    }
    return res.json({ ok: true });
  }

  res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// --------------------------------------------------
// PROTEGIDO: app y sus archivos JS
// --------------------------------------------------

// (La ruta catch-all se movió al final para no interferir con la API)

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

const router = express.Router();
router.use((req, res, next) => requireAuth(req, res, next));

// --------------------------------------------------
// SSE - TICKETS REALTIME
// --------------------------------------------------

// --------------------------------------------------
// SOCKET.IO (WebSockets) MULTIPLEXADO GLOBAL
// --------------------------------------------------

let io; // Will be initialized at the bottom

function _broadcastSSE(channel, payload) {
  if (io) {
    io.emit('stream_event', { channel, payload });
  }
}

// Retrocompatibility helpers so we don't have to change the triggers everywhere
function _broadcastTicketEvent(payload) { _broadcastSSE('tickets', payload); }
function _broadcastClientEvent(payload) { _broadcastSSE('clients', payload); }
function _broadcastProjectLinkEvent(payload) { _broadcastSSE('project_links', payload); }
function _broadcastLogEvent(payload) { _broadcastSSE('logs', payload); }
function _broadcastChatEvent(payload) { _broadcastSSE('chats', payload); }
function _broadcastMetaOnboardingEvent(payload) { _broadcastSSE('meta', payload); }
function _broadcastWhatsappSessionsEvent(payload) { _broadcastSSE('sessions', payload); }
function _broadcastAdminsAccountEvent(payload) { _broadcastSSE('admins', payload); }
function _broadcastSettingsEvent(payload) { _broadcastSSE('settings', payload); }
function _broadcastProjectOnboardingEvent(payload) { _broadcastSSE('project_onboarding', payload); }

// La ruta /api/stream ya no es necesaria con WebSockets
// router.get('/stream', ... ) ha sido eliminada.

router.get('/app-version', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json(APP_BUILD_INFO);
});

// Config
router.get('/config/supabase', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  });
});

router.get('/plans', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await withCache('catalogo_planes', 60_000, () => supabaseService.getCatalogPlans(), forceRefresh);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Assistants - cached 15s; pass ?refresh=true to force a fresh fetch
router.get('/assistants', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await withCache('assistants', 15_000, () => railwayService.getAssistants(), forceRefresh);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/projects/auto-update', async (req, res) => {
  try {
    res.json(await getProjectsAutoUpdateState());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/projects/auto-update', async (req, res) => {
  try {
    const enabled = req.body.enabled === true || req.body.enabled === 'true';
    await setControlSettingValue(AUTO_UPDATE_ENABLED_KEY, enabled ? 'true' : 'false');
    await supabaseService.logAction(
      'Configurar Auto-Update Proyectos',
      `Actualizaciones automaticas ${enabled ? 'activadas' : 'desactivadas'}`,
      'settings',
      CONTROL_SETTINGS_PROJECT_ID
    );
    res.json(await getProjectsAutoUpdateState());
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// Projects
router.patch('/projects/:id/name', async (req, res) => {
  const newName = sanitizeStr(req.body.newName, 100);
  const railwayWorkspaceKey = sanitizeStr(req.body.railwayWorkspaceKey, 20);
  if (!newName) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await railwayService.updateProjectName(req.params.id, newName, railwayWorkspaceKey);
    const projectRow = await supabaseService.updateProjectDisplayName(req.params.id, newName);
    invalidateCache('clients', 'assistants');
    _broadcastProjectLinkEvent({ type: 'UPDATE', project: projectRow, railwayProjectId: req.params.id, name: newName, action: 'rename' });
    res.json({ ...result, projectRow });
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/projects/:id/metrics', async (req, res) => {
  try {
    const { environmentId, serviceId, startDate, endDate, measurements, sampleRateSeconds, railwayWorkspaceKey } = req.query;
    let meas = measurements ? measurements.split(',') : ['CPU_USAGE', 'MEMORY_USAGE_GB', 'NETWORK_RX_GB', 'NETWORK_TX_GB'];
    const data = await railwayService.getProjectMetrics(req.params.id, environmentId, serviceId, startDate, endDate, meas, sampleRateSeconds ? parseInt(sampleRateSeconds, 10) : undefined, railwayWorkspaceKey);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/projects/:id/usage', async (req, res) => {
  try {
    const { startDate, endDate, railwayWorkspaceKey } = req.query;
    const data = await railwayService.getProjectUsage(req.params.id, startDate, endDate, railwayWorkspaceKey);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/projects/:id', async (req, res) => {
  try { 
    // 1. Solicitamos borrar el proyecto en Railway
    const result = await railwayService.deleteProject(req.params.id, sanitizeStr(req.body?.railwayWorkspaceKey || req.query.railwayWorkspaceKey, 20));
    
    // 2. Solo si Railway lo eliminó correctamente, hacemos teardown en Supabase
    if (result.success) {
      await supabaseService.deleteProjectData(req.params.id);
    }
    
    res.json(result);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/projects/:id/client', async (req, res) => {
  try { res.json(await supabaseService.getProjectClient(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/projects/ghost/:id', async (req, res) => {
  try { res.json(await supabaseService.deleteGhostProjectRecord(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/client-subscriptions/:id', async (req, res) => {
  try {
    const subscription = await normalizeClientSubscription(req.body);
    const result = await supabaseService.updateClient(req.params.id, subscription);
    await supabaseService.logAction('Actualizar Suscripcion Cliente', `Cliente ${req.params.id} actualizado a plan ${subscription.plan || 'Sin plan'}`, 'clientes', req.params.id);
    invalidateCache('clients');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/projects/:id/whatsapp', async (req, res) => {
  try { res.json(await supabaseService.getWhatsAppSessionStatus(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Templates
router.get('/templates', async (req, res) => {
  const q = sanitizeStr(req.query.q, 100);
  try { res.json(await railwayService.searchTemplates(q)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/templates/:id/deploy', async (req, res) => {
  const targetClientId = req.body.clientId ? sanitizeStr(req.body.clientId, 200) : null;
  try {
    const result = await railwayService.deployTemplate(req.params.id);

    if (!result.success || !result.projectId) {
      return res.json(result);
    }

    await supabaseService.logAction('Deploy Template', `Nuevo proyecto creado via template: ${req.params.id}`, 'proyectos', result.projectId);

    if (targetClientId) {
      await supabaseService.registerNewProjectForClient(result.projectId, targetClientId);
      await supabaseService.logAction('Vincular Proyecto a Cliente', `Proyecto ${result.projectId} desplegado y vinculado al cliente ${targetClientId}`, 'clientes', targetClientId);
      invalidateCache('clients');
      return res.json(result);
    }

    const genericEmail = `generico_${result.projectId.slice(0, 6).toLowerCase()}@generico.com`;
    const genericSubscription = await normalizeClientSubscription({ plan: 'Personalizado', abono: 0 });
    const clientData = {
      nombre: 'GENERICO',
      empresa: 'GENERICO',
      email: genericEmail,
      telefono: null,
      vendedor_user_id: null,
      admin_user: genericEmail,
      admin_pass: result.projectId.slice(0, 8),
      ...genericSubscription
    };
    const newClient = await supabaseService.createClient(clientData);
    if (newClient?.id) {
      await supabaseService.registerNewProjectForClient(result.projectId, newClient.id);
      await supabaseService.logAction('Crear Cliente Generico', `Cliente generado y vinculado al proyecto ${result.projectId}`, 'clientes', newClient.id);
      invalidateCache('clients');
    }
    return res.json(result);
  } catch (err) {
    console.error('[Deploy] failed:', err.message || err);
    res.status(500).json({ error: err.message });
  }
});

// Services
router.patch('/services/:id/name', async (req, res) => {
  const newName = sanitizeStr(req.body.newName, 200);
  const railwayWorkspaceKey = sanitizeStr(req.body.railwayWorkspaceKey, 20);
  if (!newName) return res.status(400).json({ error: 'newName requerido' });
  try {
    const result = await railwayService.updateServiceName(req.params.id, newName, railwayWorkspaceKey);
    await supabaseService.logAction('Renombrar Servicio', `Servicio ${req.params.id} renombrado a: ${newName}`, 'servicios', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/services/:id/redeploy', async (req, res) => {
  const environmentId = sanitizeStr(req.body.environmentId, 200);
  const railwayWorkspaceKey = sanitizeStr(req.body.railwayWorkspaceKey, 20);
  try {
    const result = await railwayService.redeployService(req.params.id, environmentId, railwayWorkspaceKey);
    await supabaseService.logAction('Reiniciar Servicio', `Reinicio de servicio ID: ${req.params.id}`, 'servicios', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/projects/:id/update', async (req, res) => {
  const { environmentId, serviceId, railwayWorkspaceKey } = req.body;
  try {
    const result = await railwayService.deployServiceUpdate(req.params.id, environmentId, serviceId, railwayWorkspaceKey);
    await supabaseService.logAction('Actualizar Proyecto', `Actualización de proyecto ID: ${req.params.id}`, 'proyectos', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// Variables
router.get('/variables', async (req, res) => {
  const { projectId, environmentId, serviceId, railwayWorkspaceKey } = req.query;
  try { res.json(await railwayService.getServiceVariables(projectId, environmentId, serviceId, railwayWorkspaceKey)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/variables', async (req, res) => {
  const projectId = sanitizeStr(req.body.projectId, 200);
  const environmentId = sanitizeStr(req.body.environmentId, 200);
  const serviceId = sanitizeStr(req.body.serviceId, 200);
  const railwayWorkspaceKey = sanitizeStr(req.body.railwayWorkspaceKey, 20);
  const name = sanitizeStr(req.body.name, 200);
  const value = sanitizeStr(req.body.value, 32768);
  if (!name) return res.status(400).json({ error: 'El nombre de la variable es requerido' });
  try {
    const result = await railwayService.upsertVariable(projectId, environmentId, serviceId, name, value, railwayWorkspaceKey);
    await supabaseService.logAction('Cambio Variable', `Se actualizó la variable ${name}`, 'variables', serviceId || projectId);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/variables/delete', async (req, res) => {
  const projectId = sanitizeStr(req.body.projectId, 200);
  const environmentId = sanitizeStr(req.body.environmentId, 200);
  const serviceId = sanitizeStr(req.body.serviceId, 200);
  const railwayWorkspaceKey = sanitizeStr(req.body.railwayWorkspaceKey, 20);
  const name = sanitizeStr(req.body.name, 200);
  if (!name) return res.status(400).json({ error: 'El nombre de la variable es requerido' });
  try { res.json(await railwayService.deleteVariable(projectId, environmentId, serviceId, name, railwayWorkspaceKey)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Settings (Supabase secundaria)
router.get('/settings/:projectId', async (req, res) => {
  try { res.json(await supabaseService.getSettings(req.params.projectId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/settings/:projectId', async (req, res) => {
  try {
    const { key, value, api_key } = req.body;
    const result = await supabaseService.createSetting(req.params.projectId, key, value, api_key);
    res.json(result);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/settings/:projectId', async (req, res) => {
  try {
    const key = req.body.key;
    const updates = {};

    if (req.body.value !== undefined) {
      updates.value = req.body.value;
    }

    if (req.body.api_key !== undefined) {
      updates.api_key = req.body.api_key;
    }

    const result = await supabaseService.updateSetting(req.params.projectId, key, updates);
    res.json(result);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/settings/:projectId/:key', async (req, res) => {
  try {
    const result = await supabaseService.deleteSetting(req.params.projectId, req.params.key);
    res.json(result);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Domains
router.get('/domains', async (req, res) => {
  const { projectId, environmentId, serviceId, railwayWorkspaceKey } = req.query;
  try { res.json(await railwayService.getServiceDomains(projectId, environmentId, serviceId, railwayWorkspaceKey)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/clients', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await withCache('clients', 5_000, () => supabaseService.getClients(), forceRefresh);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/clients', async (req, res) => {
  const nombre = sanitizeStr(req.body.nombre, 100);
  const email = sanitizeStr(req.body.email, 200) || null;
  const empresa = sanitizeStr(req.body.empresa, 100) || null;
  const telefono = sanitizeStr(req.body.telefono, 20) || null;
  const vendedor_user_id = req.body.vendedor_user_id !== undefined ? (req.body.vendedor_user_id || null) : null;
  const admin_user = email;
  const admin_pass = req.body.admin_pass !== undefined ? (sanitizeStr(req.body.admin_pass, 100) || null) : null;

  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  if (!email) return res.status(400).json({ error: 'El email es requerido para crear el acceso al portal' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email inválido' });

  const subscription = await normalizeClientSubscription({
    ...req.body,
    plan: req.body.plan || 'Personalizado',
    abono: req.body.abono ?? 0
  });
  const clientData = { nombre, email, empresa, telefono, vendedor_user_id, admin_user, admin_pass, ...subscription };
  try {
    const result = await supabaseService.createClient(clientData);
    await supabaseService.logAction('Crear Cliente', `Se creó el cliente ${nombre}`, 'clientes', result.id);
    invalidateCache('clients');
    res.json(result);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya esta registrado en otro cliente.' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/clients/:id', async (req, res) => {
  const clientData = {};
  if (req.body.nombre !== undefined) {
    clientData.nombre = sanitizeStr(req.body.nombre, 100);
    if (!clientData.nombre) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
  }
  if (req.body.email !== undefined) {
    clientData.email = sanitizeStr(req.body.email, 200) || null;
    if (!clientData.email) return res.status(400).json({ error: 'El email es requerido para mantener el acceso al portal' });
    if (!isValidEmail(clientData.email)) return res.status(400).json({ error: 'Email inválido' });
  }
  if (req.body.empresa !== undefined) clientData.empresa = sanitizeStr(req.body.empresa, 100) || null;
  if (req.body.telefono !== undefined) clientData.telefono = sanitizeStr(req.body.telefono, 20) || null;
  if (req.body.vendedor_user_id !== undefined) clientData.vendedor_user_id = req.body.vendedor_user_id || null;
  if (req.body.email !== undefined) clientData.admin_user = clientData.email;
  if (req.body.admin_pass !== undefined) clientData.admin_pass = sanitizeStr(req.body.admin_pass, 100) || null;
  if (req.body.plan !== undefined || req.body.abono !== undefined || req.body.vencimiento !== undefined || req.body.subscription_status !== undefined) {
    Object.assign(clientData, await normalizeClientSubscription(req.body));
  }

  try {
    const result = await supabaseService.updateClient(req.params.id, clientData);
    await supabaseService.logAction('Actualizar Cliente', `Se actualizaron datos de ${clientData.nombre || 'cliente'}`, 'clientes', req.params.id);
    invalidateCache('clients');
    res.json(result);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya esta registrado en otro cliente.' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    const result = await supabaseService.deleteClient(req.params.id);
    await supabaseService.logAction('Eliminar Cliente', `Se eliminó el cliente ID: ${req.params.id}`, 'clientes', req.params.id);
    invalidateCache('clients');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clients/:id/projects', async (req, res) => {
  try { res.json(await supabaseService.getClientProjects(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clients/:id/pending-tickets', async (req, res) => {
  try { res.json(await supabaseService.getClientPendingTickets(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Tickets
// /tickets/meta debe ir ANTES de /tickets/:id para evitar conflicto de rutas
router.get('/tickets/meta', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await withCache('tickets_meta', 5_000, () => supabaseService.getTicketsMeta(), forceRefresh);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tickets/:id', async (req, res) => {
  try { res.json(await supabaseService.getTicketById(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tickets', async (req, res) => {
  const filters = {
    estado:     sanitizeStr(req.query.estado, 50)      || undefined,
    cliente_id: sanitizeStr(req.query.cliente_id, 200) || undefined,
    page:       parseInt(req.query.page)  || 1,
    limit:      parseInt(req.query.limit) || 25,
  };
  Object.keys(filters).forEach(k => filters[k] === undefined && delete filters[k]);
  try { res.json(await supabaseService.getTickets(filters)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tickets', async (req, res) => {
  const titulo = sanitizeStr(req.body.titulo, 200);
  const cliente_id = sanitizeStr(req.body.cliente_id, 200);
  const project_id = sanitizeStr(req.body.project_id, 200) || null;
  if (!titulo) return res.status(400).json({ error: 'El título es requerido' });
  if (!cliente_id) return res.status(400).json({ error: 'El cliente es requerido' });

  const ticketData = {
    titulo,
    cliente_id,
    project_id,
    descripcion: sanitizeStr(req.body.descripcion, 5000) || null,
    estado: 'Abierto',
  };
  try {
    const result = await supabaseService.createTicket(ticketData);
    await supabaseService.logAction('Crear Ticket', `Nuevo ticket: ${titulo}`, 'tickets', result.id);
    invalidateCache('tickets_meta');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/tickets/:id', async (req, res) => {
  const ticketData = {};
  if (req.body.titulo !== undefined) {
    ticketData.titulo = sanitizeStr(req.body.titulo, 200);
    if (!ticketData.titulo) return res.status(400).json({ error: 'El título no puede estar vacío' });
  }
  if (req.body.descripcion !== undefined) ticketData.descripcion = sanitizeStr(req.body.descripcion, 5000) || null;
  if (req.body.cliente_id !== undefined) ticketData.cliente_id = sanitizeStr(req.body.cliente_id, 200);
  if (req.body.project_id !== undefined) ticketData.project_id = sanitizeStr(req.body.project_id, 200) || null;
  if (req.body.estado !== undefined && VALID_TICKET_ESTADOS.includes(req.body.estado)) ticketData.estado = req.body.estado;
  if (req.body.read_admin_count !== undefined) {
    const n = parseInt(req.body.read_admin_count);
    if (!isNaN(n) && n >= 0) ticketData.read_admin_count = n;
  }

  try {
    const result = await supabaseService.updateTicket(req.params.id, ticketData);
    // Solo loguear cambios de estado, no actualizaciones de read_admin_count
    if (ticketData.estado) {
      await supabaseService.logAction('Actualizar Ticket', `Ticket #${req.params.id} actualizado`, 'tickets', req.params.id);
    }
    invalidateCache('tickets_meta');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tickets/:id/chat', async (req, res) => {
  const mensaje = sanitizeStr(req.body.mensaje, 5000);
  const rol = req.body.rol === 'cliente' ? 'cliente' : 'admin';
  
  if (!mensaje) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  
  const chatMsg = {
      id: crypto.randomUUID(),
      rol,
      mensaje,
      fecha: new Date().toISOString()
  };

  try {
      const result = await supabaseService.addTicketMessage(req.params.id, chatMsg);
      res.json(result);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

router.delete('/tickets/:id', async (req, res) => {
  try {
    const result = await supabaseService.deleteTicket(req.params.id);
    invalidateCache('tickets_meta');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// SUPABASE ROUTES (CHATS)
// ==========================================

router.post('/supabase/active-chat-projects', async (req, res) => {
  try {
    const projectIds = req.body.projectIds || [];
    const activeIds = await supabaseService.filterActiveChatProjects(projectIds);
    res.json(activeIds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/supabase/chats', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const filters = {
      search: req.query.search,
      type: req.query.type,
      bot_enabled: req.query.bot_enabled,
      unread: req.query.unread === 'true'
    };
    res.json(await supabaseService.getChats(limit, req.query.projectId, offset, filters));
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.patch('/supabase/chats/:id', async (req, res) => {
  try {
    const bodyKeys = Object.keys(req.body);
    const protectedFields = ['id', 'tenant_id', 'project_id', 'service_id'];
    const hasProtected = protectedFields.some(field => bodyKeys.includes(field));
    
    if (hasProtected) {
      return res.status(400).json({ error: 'No se permite modificar campos protegidos (id, tenant_id, project_id, service_id)' });
    }

    const allowedFields = [
      'name', 'email', 'cuit_dni', 'tax_status', 'type', 
      'crm_status', 'assigned_agent', 'type_lead', 
      'product', 'notes', 'bot_enabled', 'is_lead'
    ];
    
    const updates = {};
    for (const key of bodyKeys) {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    const chat = await supabaseService.updateChat(req.params.id, updates);
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ONBOARDING (Checklist y Notas) ---
router.get('/supabase/project_onboarding', async (req, res) => {
  try {
    const data = await supabaseService.getAllProjectOnboardings();
    res.json(data);
  } catch (error) {
    console.error('Error fetching all project_onboardings:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/supabase/project_onboarding/:projectId', async (req, res) => {
  try {
    const data = await supabaseService.getProjectOnboarding(req.params.projectId);
    res.json(data);
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.json({ project_id: req.params.projectId, checklist_state: {}, notes: [] });
    }
    console.error('Error fetching project_onboarding:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/supabase/project_onboarding/:projectId', async (req, res) => {
  try {
    const { checklist_state, notes } = req.body;
    const updateData = { project_id: req.params.projectId, updated_at: new Date().toISOString() };
    if (checklist_state !== undefined) updateData.checklist_state = checklist_state;
    if (notes !== undefined) updateData.notes = notes;

    const data = await supabaseService.updateProjectOnboarding(updateData);
    res.json(data);
  } catch (error) {
    console.error('Error updating project_onboarding:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Supabase Meta Onboarding
router.get('/supabase/meta_onboarding', async (req, res) => {
  try {
    res.json(await supabaseService.getMetaOnboarding(req.query.projectId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/supabase/meta_onboarding/:projectId', async (req, res) => {
  try {
    const data = await supabaseService.updateMetaOnboarding(req.params.projectId, req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/railway/logs/:environmentId
router.get('/railway/logs/:environmentId', async (req, res) => {
  const { environmentId } = req.params;
  const { limit, filter, beforeDate, afterDate, anchorDate, beforeLimit, afterLimit } = req.query;
  
  try {
    const logs = await railwayService.getEnvironmentLogs(
      environmentId,
      limit ? parseInt(limit) : 20,
      filter || "",
      beforeDate || null,
      afterDate || null,
      anchorDate || null,
      beforeLimit ? parseInt(beforeLimit) : null,
      afterLimit ? parseInt(afterLimit) : null
    );
    res.json(logs);
  } catch (error) {
    console.error("Error en getEnvironmentLogs:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/variables
router.get('/variables', async (req, res) => {
  try {
    const { projectId, environmentId, serviceId, railwayWorkspaceKey } = req.query;
    if (!projectId || !environmentId) return res.status(400).json({ error: 'Missing projectId or environmentId' });
    const data = await railwayService.getServiceVariables(projectId, environmentId, serviceId, railwayWorkspaceKey);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/variables
router.post('/variables', async (req, res) => {
  try {
    const { projectId, environmentId, serviceId, name, value, railwayWorkspaceKey } = req.body;
    if (!projectId || !environmentId || !name) return res.status(400).json({ error: 'Missing parameters' });
    const result = await railwayService.upsertVariable(projectId, environmentId, serviceId, name, value, railwayWorkspaceKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/variables
router.delete('/variables', async (req, res) => {
  try {
    const { projectId, environmentId, serviceId, name, railwayWorkspaceKey } = req.query;
    if (!projectId || !environmentId || !name) return res.status(400).json({ error: 'Missing parameters' });
    const result = await railwayService.deleteVariable(projectId, environmentId, serviceId, name, railwayWorkspaceKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supabase WhatsApp Sessions
router.get('/supabase/whatsapp_sessions', async (req, res) => {
  try {
    res.json(await supabaseService.getWhatsappSessions(req.query.projectId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/supabase/whatsapp_sessions/:projectId', async (req, res) => {
  try {
    const data = await supabaseService.updateWhatsappSession(req.params.projectId, req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SUPABASE ROUTES (ADMINS ACCOUNT)
// ==========================================

router.get('/supabase/admins_account', async (req, res) => {
  try {
    res.json(await supabaseService.getAdminsAccount());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/supabase/admins_account', async (req, res) => {
  try {
    const data = await supabaseService.createAdminAccount(req.body);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/supabase/admins_account/:id', async (req, res) => {
  try {
    const data = await supabaseService.updateAdminAccount(req.params.id, req.body);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/supabase/admins_account/:id', async (req, res) => {
  try {
    const result = await supabaseService.deleteAdminAccount(req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Supabase Catalogo Planes
router.get('/supabase/catalogo_planes', async (req, res) => {
  try { res.json(await supabaseService.getCatalogPlans(true)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/supabase/catalogo_planes', async (req, res) => {
  try { res.json(await supabaseService.createCatalogPlan(req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/supabase/catalogo_planes/:id', async (req, res) => {
  try { res.json(await supabaseService.updateCatalogPlan(req.params.id, req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
// Audit
router.get('/audit', async (req, res) => {
  try { res.json(await supabaseService.getAuditLogs()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Logs
router.get('/logs', async (req, res) => {
  try { res.json(await supabaseService.getSystemLogs(100)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Admins
router.get('/admins', async (req, res) => {
  try { res.json(await supabaseService.getAdmins()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', (req, res) => {
  res.json({ username: req.session.username || 'admin' });
});

app.use('/api', router);

// SPA Catch-all: cualquier ruta GET no atrapada por la API se redirige al index.html
app.get('*', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// --------------------------------------------------
// BACKGROUND MONITORING (reemplaza el setInterval de main.js)
// --------------------------------------------------

let lastAssistantsState = new Map();

async function startBackgroundMonitoring() {
  // Supabase Realtime: push INSERT events on tickets to SSE clients
  try {
    const { createClient } = require('@supabase/supabase-js');
    const realtimeClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    realtimeClient
      .channel('tickets-inserts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
        const ticketData = payload.new || payload.old;
        // Solo transmitir tickets de Soporte - ignorar Nuevo Lead y otros tipos
        if (ticketData?.tipo !== 'Soporte') return;
        console.log(`[Realtime] Ticket Soporte: ${payload.eventType} | id: ${ticketData?.id}`);
        _broadcastTicketEvent({ type: payload.eventType, ticket: ticketData });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] tickets channel activo');
      });

    realtimeClient
      .channel('system_logs_inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, payload => {
        _broadcastLogEvent({ type: 'INSERT', log: payload.new });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] logs channel activo');
      });

    realtimeClient
      .channel('clientes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, async payload => {
        invalidateCache('clients');
        _broadcastClientEvent({ type: payload.eventType, client: payload.new || payload.old });

      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] clientes channel activo');
      });

    realtimeClient
      .channel('proyectos-railway-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos_railway' }, payload => {
        const project = payload.new || payload.old || null;
        const railwayProjectId = project?.railway_project_id || null;
        invalidateCache('clients');
        invalidateCache('assistants');
        _broadcastProjectLinkEvent({
          type: payload.eventType,
          project,
          link: project,
          railwayProjectId,
          projectRowId: project?.id || null,
          clienteId: project?.cliente_id || null,
          action: 'db_change'
        });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] proyectos_railway channel activo');
      });
    realtimeClient
      .channel('chats-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, payload => {
        _broadcastChatEvent({ type: payload.eventType, chat: payload.new || payload.old });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] chats channel activo');
      });

    realtimeClient
      .channel('meta-onboarding-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_onboarding' }, payload => {
        _broadcastMetaOnboardingEvent({ type: payload.eventType, item: payload.new || payload.old });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] meta_onboarding channel activo');
      });

    realtimeClient
      .channel('whatsapp-sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_sessions' }, payload => {
        _broadcastWhatsappSessionsEvent({ type: payload.eventType, item: payload.new || payload.old });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] whatsapp_sessions channel activo');
      });

    realtimeClient
      .channel('admins-account-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admins_account' }, payload => {
        _broadcastAdminsAccountEvent({ type: payload.eventType, item: payload.new || payload.old });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] admins_account channel activo');
      });

    realtimeClient
      .channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, payload => {
        _broadcastSettingsEvent({ type: payload.eventType, item: payload.new || payload.old });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] settings channel activo');
      });

    realtimeClient
      .channel('project-onboarding-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_onboarding' }, payload => {
        _broadcastProjectOnboardingEvent({ type: payload.eventType, item: payload.new || payload.old });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] project_onboarding channel activo');
      });

    // pagos-ingresos-changes subscription removed as billing system is eradicated
  } catch (e) {
    console.error('[Realtime] Error iniciando suscripcion:', e.message);
  }

  try {
    const assistants = await railwayService.getAssistants();
    assistants.forEach(a => {
      a.services.forEach(s => {
        lastAssistantsState.set(`${a.id}-${s.id}`, s.status);
      });
    });
  } catch (e) {
    console.error('[Monitor] Error inicializando:', e.message);
  }

  setInterval(async () => {
    try {
      const assistants = await railwayService.getAssistants();
      for (const a of assistants) {
        for (const s of a.services) {
          const key = `${a.id}-${s.id}`;
          const oldStatus = lastAssistantsState.get(key);
          const newStatus = s.status;

          if (newStatus === 'error') {
            if (oldStatus !== 'error') {
              console.log(`[Monitor] Error detectado en ${a.name} / ${s.name}`);
            }
            await tryAutoRedeploy(a, s);
          }

          lastAssistantsState.set(key, newStatus);
        }
      }
    } catch (err) {
      console.error('[Monitor] Error en ciclo:', err.message);
    }
  }, 60000);
}

async function tryAutoRedeploy(project, service) {
  try {
    const delay = Math.floor(Math.random() * 5000);
    await new Promise(resolve => setTimeout(resolve, delay));

    const attempts = await supabaseService.getRecentAutoRedeployCount(service.id);

    if (attempts < 2) {
      console.log(`[Auto-Recovery] ${service.name}. Intento #${attempts + 1}`);
      await supabaseService.logAction(
        'Auto-Redeploy',
        `Sistema automático detectó fallo. Iniciando intento #${attempts + 1} de recuperación.`,
        'servicios',
        service.id
      );
      await railwayService.redeployService(service.id, service.environmentId, service.railwayWorkspaceKey);
    }
  } catch (error) {
    console.error('[Auto-Recovery] Error:', error.message);
  }
}

// --------------------------------------------------
// START
// --------------------------------------------------

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);


io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Neurolinks Control corriendo en puerto ${PORT} (con Socket.IO)`);
  console.log(`Panel: http://localhost:${PORT}/`);
  startBackgroundMonitoring();
  startProjectsAutoUpdateScheduler();
});
