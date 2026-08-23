const { createClient } = require('@supabase/supabase-js');
const nodeCrypto = require('crypto');
const railwayService = require('./railwayService');
const dnsService = require('./dnsService');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured in .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');
const supabaseAdmin = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    : null;

const PROJECT_CREDENTIAL_KEYS = ['ADMIN_USER', 'ADMIN_PASS'];
const DEFAULT_SERVICE_ID = 'default_service';
const GLOBAL_SETTINGS_PROJECT_IDS = new Set([
    'default_project',
    'neurolinks-control',
    'defaul'
]);
const PROJECT_SERVICE_IDS_CACHE_TTL = 60 * 1000;
const projectServiceIdsCache = new Map();
let assistantsForCredentialsCache = { data: null, timestamp: 0 };

function generateClientPassword() {
    return 'nl_' + nodeCrypto.randomBytes(8).toString('base64url');
}

async function findAuthUserByEmail(email) {
    if (!supabaseAdmin) throw new Error('Supabase admin credentials not configured');
    if (!email) return null;

    const normalizedEmail = String(email).trim().toLowerCase();
    const perPage = 1000;
    for (let page = 1; page <= 20; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const users = data?.users || [];
        const match = users.find(user => String(user.email || '').trim().toLowerCase() === normalizedEmail);
        if (match) return match;
        if (users.length < perPage) break;
    }

    return null;
}

function encodeCredentialValue(value) {
    if (!value) return null;
    const stringValue = String(value);
    return stringValue.startsWith('b64:')
        ? stringValue
        : 'b64:' + Buffer.from(stringValue).toString('base64');
}

function decodeCredentialValue(value) {
    if (!value) return value;
    if (!String(value).startsWith('b64:')) return value;
    try {
        return Buffer.from(String(value).slice(4), 'base64').toString('utf-8');
    } catch {
        return value;
    }
}

function getSettingPriority(setting) {
    if (setting?.service_id && setting.service_id !== DEFAULT_SERVICE_ID) return 3;
    if (setting?.service_id === DEFAULT_SERVICE_ID) return 2;
    return 1;
}

function pickSettingValue(settings = [], key) {
    return [...settings]
        .filter(row => row.key === key)
        .sort((a, b) => {
            const dateDiff = new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
            if (dateDiff !== 0) return dateDiff;
            return getSettingPriority(b) - getSettingPriority(a);
        })[0]?.value;
}

function normalizeServiceId(serviceId) {
    const value = serviceId ? String(serviceId).trim() : '';
    if (!value || value === 'default' || value === 'null') return DEFAULT_SERVICE_ID;
    return value;
}

async function upsertDefaultSetting(projectId, key, value) {
    if (!projectId || !key || value === undefined || value === null || value === '') return false;

    const tenantId = await supabaseService.resolveSettingsScopeTenant(projectId);

    const { error } = await supabase
        .from('settings')
        .upsert({
            tenant_id: tenantId,
            project_id: projectId,
            service_id: DEFAULT_SERVICE_ID,
            key,
            value,
            updated_at: new Date().toISOString()
        }, { onConflict: 'project_id,service_id,key' });
    if (error) throw error;
    return true;
}

async function fetchSettingsByKeys(keys) {
    const rows = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from('settings')
            .select('project_id, key, value, service_id, updated_at')
            .in('key', keys)
            .range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
    }

    return rows;
}

async function getProjectCredentialServiceIds(railwayProjectId) {
    if (!railwayProjectId) return [DEFAULT_SERVICE_ID];

    const cacheKey = String(railwayProjectId);
    const cached = projectServiceIdsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < PROJECT_SERVICE_IDS_CACHE_TTL) {
        return cached.serviceIds;
    }

    const serviceIds = new Set([DEFAULT_SERVICE_ID]);
    try {
        if (!assistantsForCredentialsCache.data || (Date.now() - assistantsForCredentialsCache.timestamp) >= PROJECT_SERVICE_IDS_CACHE_TTL) {
            assistantsForCredentialsCache = {
                data: await railwayService.getAssistants(),
                timestamp: Date.now()
            };
        }
        const assistants = assistantsForCredentialsCache.data;
        const project = (assistants || []).find(item => String(item.id) === String(railwayProjectId));
        for (const service of project?.services || []) {
            const serviceId = normalizeServiceId(service?.id);
            if (serviceId !== DEFAULT_SERVICE_ID) serviceIds.add(serviceId);
        }
    } catch (err) {
        console.warn(`[Creds-Sync] No se pudieron resolver services de Railway para ${railwayProjectId}:`, err.message);
    }

    const resolved = [...serviceIds];
    projectServiceIdsCache.set(cacheKey, { serviceIds: resolved, timestamp: Date.now() });
    return resolved;
}


async function getClientProjectIds(clientId) {
    if (!clientId) return [];
    const { data, error } = await supabase
        .from('proyectos_railway')
        .select('railway_project_id')
        .eq('cliente_id', clientId);
    if (error) throw error;
    return [...new Set((data || []).map(p => p.railway_project_id).filter(Boolean).map(String))];
}

function buildClientTicketFilter(clientId, projectIds = []) {
    const terms = [];
    if (clientId) terms.push(`cliente_id.eq.${clientId}`);
    if (projectIds.length > 0) terms.push(`project_id.in.(${projectIds.join(',')})`);
    return terms.join(',');
}

async function recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad) {
    console.log(`[recalculatePlanSubscriptionsLocal] Running fallback database-only count...`);
    const { count, error: countErr } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("vendedor_id", vendedorId)
        .eq("plan_tipo", planTipo)
        .eq("lineas_cantidad", lineasCantidad)
        .in("subscription_status", ["active", "manual"])
        .eq("is_deleted", false);

    if (!countErr && count !== null) {
        await supabase
            .from("mp_planes")
            .update({ suscripciones_activas: count })
            .eq("vendedor_id", vendedorId)
            .eq("plan_tipo", planTipo)
            .eq("lineas_cantidad", lineasCantidad);
        console.log(`[recalculatePlanSubscriptionsLocal] Updated mp_planes with local count: ${count}`);
    }
}

async function recalculatePlanSubscriptions(vendedorId, planTipo, lineasCantidad) {
    try {
        console.log(`[recalculatePlanSubscriptions] Recalculating active subs for seller: ${vendedorId}, planTipo: ${planTipo}, lineasCantidad: ${lineasCantidad}`);
        const { data: planData, error: planErr } = await supabase
            .from("mp_planes")
            .select("mp_plan_id, mp_vendedores(access_token)")
            .eq("vendedor_id", vendedorId)
            .eq("plan_tipo", planTipo)
            .eq("lineas_cantidad", lineasCantidad)
            .single();

        if (planErr || !planData) {
            console.warn(`[recalculatePlanSubscriptions] Could not fetch mp_plan_id from DB:`, planErr?.message || "Plan not found.");
            return await recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad);
        }

        const mpPlanId = planData.mp_plan_id;
        const accessToken = planData.mp_vendedores?.access_token;

        if (!mpPlanId || !accessToken) {
            console.warn(`[recalculatePlanSubscriptions] Missing mpPlanId or seller access_token. Falling back to local count.`);
            return await recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad);
        }

        console.log(`[recalculatePlanSubscriptions] Querying Mercado Pago API for plan ID ${mpPlanId}...`);
        const mpRes = await fetch(`https://api.mercadopago.com/preapproval/search?preapproval_plan_id=${mpPlanId}&status=authorized`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        if (mpRes.ok) {
            const mpJson = await mpRes.json();
            const activeCount = mpJson.paging?.total ?? 0;
            console.log(`[recalculatePlanSubscriptions] Mercado Pago API reported ${activeCount} active subscriptions.`);

            const { error: updateErr } = await supabase
                .from("mp_planes")
                .update({ suscripciones_activas: activeCount })
                .eq("vendedor_id", vendedorId)
                .eq("plan_tipo", planTipo)
                .eq("lineas_cantidad", lineasCantidad);

            if (updateErr) throw updateErr;
            console.log(`[recalculatePlanSubscriptions] Successfully updated mp_planes via API.`);
        } else {
            const errText = await mpRes.text();
            console.warn(`[recalculatePlanSubscriptions] Mercado Pago API returned status ${mpRes.status}: ${errText}. Falling back to local count.`);
            return await recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad);
        }
    } catch (err) {
        console.error(`[recalculatePlanSubscriptions] Error in recalculatePlanSubscriptions:`, err.message);
        await recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad).catch(console.error);
    }
}

const supabaseService = {
    async validateAdminLogin(username, password) {
        try {
            const { data, error } = await supabase
                .from('admins_account')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .maybeSingle();

            if (error) {
                console.warn("[Login] Table admins_account might not exist yet:", error.message);
                return false;
            }
            return !!data;
        } catch (err) {
            console.error("validateAdminLogin error:", err.message);
            return false;
        }
    },

    async getProjectClient(railwayProjectId) {
        const { data, error } = await supabase
            .from('proyectos_railway')
            .select('*, clientes(*)')
            .eq('railway_project_id', railwayProjectId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async getClientProjects(clientId) {
        const { data, error } = await supabase
            .from('proyectos_railway')
            .select('railway_project_id')
            .eq('cliente_id', clientId)
            .or('is_deleted.is.null,is_deleted.eq.false');
        if (error) throw error;
        return [...new Set(data.map(item => item.railway_project_id).filter(Boolean))];
    },

    async deleteGhostProjectRecord(rowId) {
        if (!rowId) throw new Error('rowId es requerido');
        const { error } = await supabase
            .from('proyectos_railway')
            .delete()
            .eq('id', rowId);
        if (error) throw error;
        return { success: true };
    },

    /**
     * Resuelve el tenant_id (auth_user_id) de un cliente a partir de su ID
     */
    async resolveClientTenantId(clientId) {
        if (!clientId) throw new Error('clientId es requerido para resolver el tenant');
        const { data, error } = await supabase
            .from('clientes')
            .select('id, auth_user_id')
            .eq('id', clientId)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(`Cliente no encontrado: ${clientId}`);
        if (!data.auth_user_id) throw new Error(`El cliente ${clientId} no tiene auth_user_id (tenant_id)`);
        return data.auth_user_id;
    },

    /**
     * Resuelve el tenant_id a partir de un project_id de settings (Railway, client_<uuid>, o global)
     */
    async resolveSettingsScopeTenant(projectId) {
        if (!projectId) throw new Error('projectId es requerido para resolver el tenant');
        if (GLOBAL_SETTINGS_PROJECT_IDS.has(projectId)) return null;

        if (projectId.startsWith('client_')) {
            const clientId = projectId.replace('client_', '');
            return await this.resolveClientTenantId(clientId);
        }

        // Es un proyecto Railway
        const { data, error } = await supabase
            .from('proyectos_railway')
            .select('cliente_id')
            .eq('railway_project_id', projectId)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(`Proyecto Railway no encontrado: ${projectId}`);
        if (!data.cliente_id) throw new Error(`El proyecto Railway ${projectId} no tiene cliente adjudicado`);

        return await this.resolveClientTenantId(data.cliente_id);
    },

    /**
     * Ejemplo de prueba: Obtener configuración desde una tabla 'config'
     */
    async testConnection() {
        try {
            const { data, error } = await supabase
                .from('config')
                .select('*')
                .eq('clave', 'test_connection')
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error connecting to Supabase:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Gestión de Clientes (CRM)
     */
    async getClients() {
        const { data, error } = await supabase
            .from('clientes')
            .select(`
                *,
                proyectos_railway(
                    id,
                    railway_project_id,
                    nombre_personalizado,
                    proyecto_slug,
                    deployment_url,
                    railway_public_url,
                    backoffice_activado,
                    deploy_in_progress,
                    activated_at,
                    observaciones,
                    is_deleted,
                    created_at,
                    updated_at,
                    source
                )
            `)
            .order('created_at', { ascending: false });
        if (error) throw error;

        // Cargar todas las credenciales de la tabla settings en una sola consulta eficiente
        const settingsData = await fetchSettingsByKeys(['ADMIN_USER', 'ADMIN_PASS']);

        const credsMap = {};
        const credsPriority = {};
        if (settingsData) {
            settingsData.forEach(s => {
                if (!credsMap[s.project_id]) credsMap[s.project_id] = {};
                if (!credsPriority[s.project_id]) credsPriority[s.project_id] = {};
                const priority = getSettingPriority(s);
                if (credsMap[s.project_id][s.key] === undefined || priority >= (credsPriority[s.project_id][s.key] || 0)) {
                    credsMap[s.project_id][s.key] = decodeCredentialValue(s.value);
                    credsPriority[s.project_id][s.key] = priority;
                }
            });
        }

        const applyProjectAggregate = (client) => {
            const projects = Array.isArray(client.linked_projects) ? client.linked_projects : [];
            const projectIds = projects.map(p => p.railway_project_id).filter(Boolean);
            client.railway_project_ids = [...new Set(projectIds)];
            client.project_count = projects.length;

            const slotLimit = Number(client.lineas_cantidad);
            client.available_slots = Number.isFinite(slotLimit) && slotLimit > 0
                ? Math.max(slotLimit - client.project_count, 0)
                : null;
            client.abono_total = Number(client.abono) || 0;
            client.subscription_status = client.subscription_status || (client.mp_preapproval_id ? 'active' : null);
            client.subscription_source = client.subscription_source || null;
            client.backoffice_activado = projects.some(project => project.backoffice_activado) || Boolean(client.backoffice_activado);
            client.deploy_in_progress = projects.some(project => project.deploy_in_progress) || Boolean(client.deploy_in_progress);

            return client;
        };

        const clients = data.map(c => {
            c.linked_projects = (c.proyectos_railway || []).filter(p => !p.is_deleted);
            delete c.proyectos_railway;
            applyProjectAggregate(c);
            c.vendedor_user_id = c.vendedor_id;

            const clientCreds = credsMap[`client_${c.id}`];
            if (clientCreds) {
                if (!c.admin_user && clientCreds['ADMIN_USER']) c.admin_user = clientCreds['ADMIN_USER'];
                if (!c.admin_pass && clientCreds['ADMIN_PASS']) c.admin_pass = clientCreds['ADMIN_PASS'];
            }

            if (c.railway_project_ids && c.railway_project_ids.length > 0) {
                const firstProjectId = c.railway_project_ids[0];
                const projCreds = credsMap[firstProjectId];
                if (projCreds) {
                    if (!c.admin_user && projCreds['ADMIN_USER']) c.admin_user = projCreds['ADMIN_USER'];
                    if (!c.admin_pass && projCreds['ADMIN_PASS']) c.admin_pass = projCreds['ADMIN_PASS'];
                }
            }

            if (c.email) c.admin_user = c.email;

            return c;
        });

        const grouped = new Map();
        for (const client of clients) {
            const key = client.email ? 'email:' + client.email.trim().toLowerCase() : 'id:' + client.id;
            const existing = grouped.get(key);
            if (!existing) {
                grouped.set(key, {
                    ...client,
                    duplicate_client_ids: [client.id],
                    railway_project_ids: [...new Set(client.railway_project_ids || [])],
                    linked_projects: [...(client.linked_projects || [])]
                });
                continue;
            }

            existing.duplicate_client_ids = [...new Set([...(existing.duplicate_client_ids || []), client.id])];
            const linkedById = new Map();
            [...(existing.linked_projects || []), ...(client.linked_projects || [])].forEach(project => {
                const key = project.railway_project_id || project.id;
                if (key) linkedById.set(String(key), project);
            });
            existing.linked_projects = Array.from(linkedById.values());
            applyProjectAggregate(existing);

            if (!existing.admin_user && client.admin_user) existing.admin_user = client.admin_user;
            if (!existing.admin_pass && client.admin_pass) existing.admin_pass = client.admin_pass;
        }

        return Array.from(grouped.values());
    },

    async ensureClientAuthUser(clientId, preferredPassword = null) {
        if (!clientId) return { authUserId: null, passwordChanged: false };

        const { data: client, error: clientError } = await supabase
            .from('clientes')
            .select('id, nombre, empresa, email, telefono, auth_user_id')
            .eq('id', clientId)
            .maybeSingle();
        if (clientError) throw clientError;
        if (!client?.email) return { authUserId: client?.auth_user_id || null, passwordChanged: false };

        let authPassword = preferredPassword || null;
        let generatedPassword = false;
        if (!authPassword) {
            const creds = await this.getClientCredentials(clientId);
            authPassword = creds.adminPass || null;
        }
        if (!authPassword) {
            authPassword = generateClientPassword();
            generatedPassword = true;
        }

        if (client.auth_user_id) {
            if ((preferredPassword || generatedPassword) && supabaseAdmin) {
                const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(client.auth_user_id, {
                    password: authPassword
                });
                if (authUpdateError) throw authUpdateError;
            }
            if (generatedPassword) {
                await upsertDefaultSetting(`client_${clientId}`, 'ADMIN_PASS', encodeCredentialValue(authPassword));
            }
            return { authUserId: client.auth_user_id, passwordChanged: Boolean(preferredPassword || generatedPassword), adminPass: generatedPassword ? authPassword : null };
        }

        const existingUser = await findAuthUserByEmail(client.email);
        if (existingUser?.id) {
            if (preferredPassword || generatedPassword) {
                const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                    password: authPassword,
                    email_confirm: true
                });
                if (authUpdateError) throw authUpdateError;
            }

            const { error: updateError } = await supabase
                .from('clientes')
                .update({ auth_user_id: existingUser.id, updated_at: new Date().toISOString() })
                .eq('id', clientId);
            if (updateError) throw updateError;
            if (generatedPassword) {
                await upsertDefaultSetting(`client_${clientId}`, 'ADMIN_PASS', encodeCredentialValue(authPassword));
            }
            return { authUserId: existingUser.id, passwordChanged: Boolean(preferredPassword || generatedPassword), adminPass: generatedPassword ? authPassword : null };
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: client.email,
            password: authPassword,
            email_confirm: true,
            user_metadata: {
                nombre: client.nombre || null,
                empresa: client.empresa || null,
                telefono: client.telefono || null,
                source: 'neurolinks-control'
            }
        });
        if (authError) throw authError;

        const authUserId = authData?.user?.id;
        if (!authUserId) throw new Error('Supabase Auth did not return user id');

        const { error: updateError } = await supabase
            .from('clientes')
            .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
            .eq('id', clientId);
        if (updateError) throw updateError;

        if (generatedPassword) {
            await upsertDefaultSetting(`client_${clientId}`, 'ADMIN_PASS', encodeCredentialValue(authPassword));
        }

        return { authUserId, passwordChanged: generatedPassword, adminPass: generatedPassword ? authPassword : null };
    },

    async createClientWithCredentials(clientData) {
        const adminUser = clientData.email || null;
        const adminPass = clientData.admin_pass || null;
        delete clientData.admin_user;
        delete clientData.admin_pass;

        if (clientData.vendedor_user_id !== undefined) {
            clientData.vendedor_id = clientData.vendedor_user_id || null;
            delete clientData.vendedor_user_id;
        }

        if (clientData.email) {
            const { data: existingClient, error: existingError } = await supabase
                .from('clientes')
                .select('id')
                .eq('email', clientData.email)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .limit(1)
                .maybeSingle();
            if (existingError) throw existingError;
            if (existingClient?.id) {
                const duplicateError = new Error('El email ya esta registrado en otro cliente.');
                duplicateError.code = '23505';
                throw duplicateError;
            }
        }

        if (clientData.email && !supabaseAdmin) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY es requerido para crear el acceso al portal.');
        }

        const { data, error } = await supabase
            .from('clientes')
            .insert([clientData])
            .select()
            .single();
        if (error) throw error;

        if (data?.id) {
            const authResult = await this.ensureClientAuthUser(data.id, adminPass);
            if (authResult.authUserId) data.auth_user_id = authResult.authUserId;

            if (adminUser) await upsertDefaultSetting(`client_${data.id}`, 'ADMIN_USER', encodeCredentialValue(adminUser));
            if (adminPass) await upsertDefaultSetting(`client_${data.id}`, 'ADMIN_PASS', encodeCredentialValue(adminPass));

            data.admin_user = adminUser || data.email || null;
            data.admin_pass = adminPass || authResult.adminPass || null;
        }

        return data;
    },

    async createClient(clientData) {
        return this.createClientWithCredentials(clientData);
    },

    async getClientCredentials(clientId) {
        const { data: client, error: clientError } = await supabase
            .from('clientes')
            .select('id, email, auth_user_id')
            .eq('id', clientId)
            .maybeSingle();
        if (clientError) throw clientError;
        if (!client) return { adminUser: null, adminPass: null };

        const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('key, value, service_id, updated_at')
            .eq('project_id', `client_${clientId}`)
            .in('key', PROJECT_CREDENTIAL_KEYS);
        if (settingsError) throw settingsError;

        const adminPassSetting = pickSettingValue(settings, 'ADMIN_PASS');
        const adminUserSetting = pickSettingValue(settings, 'ADMIN_USER');

        let adminPass = decodeCredentialValue(adminPassSetting) || null;
        let adminUser = decodeCredentialValue(adminUserSetting) || client.email || null;

        if (!adminPass) {
            const { data: proys, error: proysError } = await supabase
                .from('proyectos_railway')
                .select('railway_project_id')
                .eq('cliente_id', clientId)
                .or('is_deleted.is.null,is_deleted.eq.false');
            if (proysError) throw proysError;

            if (proys && proys.length > 0) {
                const projectIds = proys.map(p => p.railway_project_id).filter(Boolean);
                if (projectIds.length > 0) {
                    const { data: projSettings, error: projSettingsError } = await supabase
                        .from('settings')
                        .select('key, value, service_id, updated_at')
                        .in('project_id', projectIds)
                        .in('key', PROJECT_CREDENTIAL_KEYS);
                    if (projSettingsError) throw projSettingsError;

                    if (projSettings && projSettings.length > 0) {
                        const projAdminPass = pickSettingValue(projSettings, 'ADMIN_PASS');
                        const projAdminUser = pickSettingValue(projSettings, 'ADMIN_USER');

                        if (projAdminPass) {
                            adminPass = decodeCredentialValue(projAdminPass) || null;
                            if (adminPass) {
                                await upsertDefaultSetting(`client_${clientId}`, 'ADMIN_PASS', encodeCredentialValue(adminPass));
                            }
                        }

                        if (projAdminUser && !adminUserSetting) {
                            adminUser = decodeCredentialValue(projAdminUser) || null;
                            if (adminUser) {
                                await upsertDefaultSetting(`client_${clientId}`, 'ADMIN_USER', encodeCredentialValue(adminUser));
                            }
                        }
                    }
                }
            }
        }

        return {
            adminUser: adminUser,
            adminPass: adminPass
        };
    },


    async clearProjectCredentials(railwayProjectId) {
        if (!railwayProjectId) return true;
        const { error } = await supabase
            .from('settings')
            .delete()
            .eq('project_id', railwayProjectId)
            .in('key', PROJECT_CREDENTIAL_KEYS);
        if (error) throw error;
        return true;
    },

    async upsertProjectCredential(railwayProjectId, key, value, serviceId = DEFAULT_SERVICE_ID) {
        if (!railwayProjectId || !key || !value) return false;

        const tenantId = await this.resolveSettingsScopeTenant(railwayProjectId);

        const { error } = await supabase
            .from('settings')
            .upsert({
                tenant_id: tenantId,
                project_id: railwayProjectId,
                service_id: normalizeServiceId(serviceId),
                key,
                value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'project_id,service_id,key' });
        if (error) throw error;
        return true;
    },

    async syncProjectCredentials(railwayProjectId, clientId) {
        if (!railwayProjectId || !clientId) return false;
        const { adminUser, adminPass } = await this.getClientCredentials(clientId);
        const serviceIds = await getProjectCredentialServiceIds(railwayProjectId);

        await this.clearProjectCredentials(railwayProjectId);
        for (const serviceId of serviceIds) {
            if (adminUser) await this.upsertProjectCredential(railwayProjectId, 'ADMIN_USER', encodeCredentialValue(adminUser), serviceId);
            if (adminPass) await this.upsertProjectCredential(railwayProjectId, 'ADMIN_PASS', encodeCredentialValue(adminPass), serviceId);
        }
        return true;
    },

    async updateClient(id, clientData) {
        const adminUser = clientData.email !== undefined ? (clientData.email || null) : undefined;
        const adminPass = clientData.admin_pass;
        delete clientData.admin_user;
        delete clientData.admin_pass;

        if (clientData.vendedor_user_id !== undefined) {
            clientData.vendedor_id = clientData.vendedor_user_id || null;
            delete clientData.vendedor_user_id;
        }

        let currentClient = null;
        let updateClientIds = [id];
        let groupAuthUserIds = [];

        if (clientData.email !== undefined) {
            clientData.email = clientData.email ? String(clientData.email).trim() : null;

            const { data: current, error: currentError } = await supabase
                .from('clientes')
                .select('id, email, auth_user_id')
                .eq('id', id)
                .maybeSingle();
            if (currentError) throw currentError;
            currentClient = current;

            if (currentClient?.email) {
                const { data: groupClients, error: groupError } = await supabase
                    .from('clientes')
                    .select('id, email, auth_user_id')
                    .ilike('email', currentClient.email)
                    .or('is_deleted.is.null,is_deleted.eq.false');
                if (groupError) throw groupError;
                if (groupClients?.length) {
                    updateClientIds = [...new Set(groupClients.map(client => client.id).filter(Boolean))];
                    groupAuthUserIds = [...new Set(groupClients.map(client => client.auth_user_id).filter(Boolean).map(String))];
                }
            }

            if (clientData.email) {
                const { data: existingClients, error: existingError } = await supabase
                    .from('clientes')
                    .select('id')
                    .ilike('email', clientData.email)
                    .or('is_deleted.is.null,is_deleted.eq.false');
                if (existingError) throw existingError;

                const duplicateOutsideGroup = (existingClients || []).find(client => !updateClientIds.map(String).includes(String(client.id)));
                if (duplicateOutsideGroup?.id) {
                    const duplicateError = new Error('El email ya esta registrado en otro cliente.');
                    duplicateError.code = '23505';
                    throw duplicateError;
                }

                if (!supabaseAdmin) {
                    throw new Error('SUPABASE_SERVICE_ROLE_KEY es requerido para sincronizar Supabase Auth.');
                }

                const emailChanged = String(currentClient?.email || '').trim().toLowerCase() !== String(clientData.email).trim().toLowerCase();
                if (emailChanged) {
                    const existingAuthUser = await findAuthUserByEmail(clientData.email);
                    if (existingAuthUser?.id && !groupAuthUserIds.includes(String(existingAuthUser.id))) {
                        const duplicateError = new Error('El email ya existe en Supabase Auth.');
                        duplicateError.code = '23505';
                        throw duplicateError;
                    }

                    for (const authUserId of groupAuthUserIds) {
                        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
                            email: clientData.email,
                            email_confirm: true
                        });
                        if (authUpdateError) throw authUpdateError;
                    }
                }
            }
        }

        const { data: updatedRows, error } = await supabase
            .from('clientes')
            .update(clientData)
            .in('id', updateClientIds)
            .select();
        if (error) throw error;

        const data = (updatedRows || []).find(row => String(row.id) === String(id)) || updatedRows?.[0];
        let shouldSyncProjects = adminUser !== undefined || adminPass !== undefined;

        for (const clientIdToEnsure of updateClientIds) {
            const updatedClient = (updatedRows || []).find(row => String(row.id) === String(clientIdToEnsure));
            if (updatedClient && updatedClient.email && (!updatedClient.auth_user_id || adminPass !== undefined)) {
                const authResult = await this.ensureClientAuthUser(clientIdToEnsure, adminPass);
                if (String(clientIdToEnsure) === String(id) && authResult.authUserId) data.auth_user_id = authResult.authUserId;
                if (authResult.passwordChanged) shouldSyncProjects = true;
            }
        }

        // Sync admin credentials with the client base settings and linked projects
        if (adminUser !== undefined || adminPass !== undefined) {
            for (const clientIdToSync of updateClientIds) {
                try {
                    if (adminUser) await upsertDefaultSetting(`client_${clientIdToSync}`, 'ADMIN_USER', encodeCredentialValue(adminUser));
                    if (adminPass) await upsertDefaultSetting(`client_${clientIdToSync}`, 'ADMIN_PASS', encodeCredentialValue(adminPass));
                } catch (syncErr) {
                    console.error('[Creds-Sync] Error syncing base credentials on client update:', syncErr.message);
                }
            }
        }

        if (shouldSyncProjects) {
            try {
                const { data: links } = await supabase
                    .from('proyectos_railway')
                    .select('railway_project_id, cliente_id')
                    .in('cliente_id', updateClientIds);
                if (links && links.length > 0) {
                    for (const link of links) {
                        if (link.railway_project_id && link.cliente_id) {
                            await this.syncProjectCredentials(link.railway_project_id, link.cliente_id);
                        }
                    }
                }
            } catch (syncErr) {
                console.error('[Creds-Sync] Error syncing project credentials on client update:', syncErr.message);
            }
        }

        return data;
    },

    async deleteClient(clientId) {

        try {
            // 0. Consultar cliente para obtener datos de recursos externos (Teardown)
            const { data: cliente, error: fetchErr } = await supabase
                .from("clientes")
                .select("id, auth_user_id, mp_preapproval_id, plan_tipo, vendedor_id, lineas_cantidad")
                .eq("id", clientId)
                .single();

            if (!fetchErr && cliente) {
                console.log(`[Teardown] Iniciando teardown de recursos para cliente ${clientId}...`);

                // 0.1 Cancelar suscripción en Mercado Pago
                if (cliente.mp_preapproval_id) {
                    console.log(`[Teardown] Cancelando preapproval en Mercado Pago: ${cliente.mp_preapproval_id}`);
                    let sellerToken = null;
                    if (cliente.vendedor_id) {
                        const { data: seller } = await supabase
                            .from("mp_vendedores")
                            .select("access_token")
                            .eq("id", cliente.vendedor_id)
                            .single();
                        if (seller) sellerToken = seller.access_token;
                    }
                    if (!sellerToken && cliente.auth_user_id) {
                        const { data: seller } = await supabase
                            .from("mp_vendedores")
                            .select("access_token")
                            .eq("user_id", cliente.auth_user_id)
                            .maybeSingle();
                        if (seller) sellerToken = seller.access_token;
                    }

                    const mainToken = process.env.MP_ACCESS_TOKEN;
                    const mpTokens = [];
                    if (sellerToken) mpTokens.push({ name: "Seller Token", value: sellerToken });
                    if (mainToken) mpTokens.push({ name: "Main Token", value: mainToken });

                    const url = `https://api.mercadopago.com/preapproval/${cliente.mp_preapproval_id}`;
                    let mpCancelled = false;

                    for (const token of mpTokens) {
                        try {
                            console.log(`[Teardown] Probando cancelación con ${token.name}...`);
                            const mpRes = await fetch(url, {
                                method: "PUT",
                                headers: {
                                    "Authorization": `Bearer ${token.value}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ status: "cancelled" })
                            });
                            if (mpRes.ok) {
                                console.log(`[Teardown] OK Preapproval ${cliente.mp_preapproval_id} cancelado exitosamente con ${token.name}.`);
                                mpCancelled = true;
                                break;
                            } else {
                                const errTxt = await mpRes.text();
                                console.warn(`[Teardown] WARN MP API fallo para ${token.name}:`, errTxt);
                            }
                        } catch (err) {
                            console.error(`[Teardown] ERROR Error con ${token.name}:`, err.message);
                        }
                    }
                }

                const { data: proys, error: proysError } = await supabase
                    .from('proyectos_railway')
                    .select('railway_project_id, proyecto_slug')
                    .eq('cliente_id', clientId);
                if (proysError) throw proysError;

                // 0.2 Eliminar proyectos de Railway desde proyectos_railway, fuente real de instancias.
                const projectIds = new Set();
                if (proys && proys.length) {
                    proys.forEach(p => {
                        if (p.railway_project_id) projectIds.add(p.railway_project_id);
                    });
                }

                const railwayFailures = [];
                for (const projectId of projectIds) {
                    try {
                        const result = await railwayService.deleteProject(projectId);
                        if (!result?.success) {
                            railwayFailures.push({ projectId, error: result?.error || 'Error desconocido' });
                        }
                    } catch (err) {
                        railwayFailures.push({ projectId, error: err.message });
                    }
                }

                if (railwayFailures.length > 0) {
                    const details = railwayFailures.map(f => `${f.projectId}: ${f.error}`).join(' | ');
                    throw new Error(`No se pudo eliminar uno o más proyectos de Railway. Se cancela el teardown de Supabase. ${details}`);
                }

                // 0.3 Eliminar registros DNS en Hostinger desde slugs de proyectos_railway.
                const slugs = new Set();
                if (proys && proys.length) {
                    proys.forEach(p => {
                        if (p.proyecto_slug) slugs.add(p.proyecto_slug);
                    });
                }

                const dnsFilters = Array.from(slugs).flatMap(slug => [
                    { name: slug, type: "CNAME" },
                    { name: `_railway-verify.${slug}`, type: "TXT" }
                ]);

                if (dnsFilters.length > 0) {
                    try {
                        await dnsService.deleteDnsRecords(dnsFilters);
                    } catch (err) {
                        console.error(`[Teardown] Error eliminando registros DNS:`, err.message);
                    }
                }

                // 0.4 Eliminar datos operativos en Supabase asociados a los projectIds y al tenant
                if (cliente.auth_user_id) {
                    const tenantId = cliente.auth_user_id;
                    console.log(`[Teardown] Limpiando datos operativos en BD para el tenant_id: ${tenantId}`);
                    const safeDelete = async (table, column, val) => {
                        try {
                            const query = supabase.from(table).delete();
                            const { error } = await (Array.isArray(val) ? query.in(column, val) : query.eq(column, val));
                            if (error) console.warn(`[Teardown] Warning purgando ${table}:`, error.message);
                        } catch (err) {
                            console.warn(`[Teardown] Timeout/Error purgando ${table}:`, err.message);
                        }
                    };

                    await safeDelete("blacklist", "tenant_id", tenantId);
                    await safeDelete("settings", "tenant_id", tenantId);
                    await safeDelete("messages", "tenant_id", tenantId);
                    await safeDelete("chats", "tenant_id", tenantId);
                    await safeDelete("tickets", "tenant_id", tenantId);

                    await safeDelete("users", "tenant_id", tenantId);
                }

                if (projectIds.size > 0) {
                    const pids = Array.from(projectIds);
                    console.log(`[Teardown] Limpiando datos operativos (fallback) en BD para los proyectos:`, pids);
                    
                    const safeDeleteFallback = async (table, column, val) => {
                        try {
                            const query = supabase.from(table).delete();
                            const { error } = await (Array.isArray(val) ? query.in(column, val) : query.eq(column, val));
                            if (error) console.warn(`[Teardown] Warning purgando ${table} (fallback):`, error.message);
                        } catch (err) {
                            console.warn(`[Teardown] Timeout/Error purgando ${table} (fallback):`, err.message);
                        }
                    };

                    await safeDeleteFallback("blacklist", "project_id", pids);
                    await safeDeleteFallback("settings", "project_id", pids);
                    await safeDeleteFallback("whatsapp_sessions", "project_id", pids);
                    await safeDeleteFallback("routing_table", "project_id", pids);
                    await safeDeleteFallback("meta_onboarding", "project_id", pids);
                    await safeDeleteFallback("chat_tags", "project_id", pids);
                    await safeDeleteFallback("tags", "project_id", pids);
                    await safeDeleteFallback("messages", "project_id", pids);
                    await safeDeleteFallback("chats", "project_id", pids);
                }

                // 0.5 Limpiar credenciales y settings a nivel del cliente
                console.log(`[Teardown] Limpiando settings base del cliente ${clientId}`);
                await supabase.from("settings").delete().eq("project_id", `client_${clientId}`).throwOnError();
            }

            // 1. eliminar vínculos de proyectos
            const { error: relError } = await supabase
                .from('proyectos_railway')
                .delete()
                .eq('cliente_id', clientId);

            if (relError) throw relError;

            // 2. eliminar tickets
            const { error: ticketError } = await supabase
                .from('tickets')
                .delete()
                .eq('cliente_id', clientId);

            if (ticketError) throw ticketError;

            // 3. eliminar pagos
            const { error: paymentError } = await supabase
                .from('pagos')
                .delete()
                .eq('cliente_id', clientId);

            if (paymentError) throw paymentError;

            // 4. eliminar cliente
            const { error } = await supabase
                .from('clientes')
                .delete()
                .eq('id', clientId);

            if (error) throw error;

            // 4.5. Eliminar usuario de Auth al final (para no romper foreign keys antes de tiempo)
            if (cliente && cliente.auth_user_id && supabaseAdmin) {
                console.log(`[Teardown] Eliminando usuario de Auth: ${cliente.auth_user_id}`);
                const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(cliente.auth_user_id);
                if (authDeleteError) console.warn('[Teardown] No se pudo eliminar Auth user ' + cliente.auth_user_id + ':', authDeleteError.message);
            }

            // 5. Recalcular suscripciones del vendedor
            if (cliente && cliente.vendedor_id && cliente.plan_tipo) {
                await recalculatePlanSubscriptions(cliente.vendedor_id, cliente.plan_tipo, cliente.lineas_cantidad);
            }

            return { success: true };

        } catch (err) {
            console.error("deleteClient error:", err);
            throw err;
        }

    },

    /**
     * Purga absoluta de datos operativos y vínculos de un proyecto individual.
     */
    async deleteProjectData(railwayProjectId) {
        if (!railwayProjectId) return;
        try {
            console.log(`[Teardown] Purga absoluta de datos operativos para el proyecto: ${railwayProjectId}`);

            // 1. Eliminar datos operativos
            const pids = [railwayProjectId];
            await supabase.from("blacklist").delete().in("project_id", pids).throwOnError();
            await supabase.from("settings").delete().in("project_id", pids).throwOnError();
            await supabase.from("whatsapp_sessions").delete().in("project_id", pids).throwOnError();
            await supabase.from("routing_table").delete().in("project_id", pids).throwOnError();
            await supabase.from("meta_onboarding").delete().in("project_id", pids).throwOnError();
            await supabase.from("chat_tags").delete().in("project_id", pids).throwOnError();
            await supabase.from("tags").delete().in("project_id", pids).throwOnError();
            await supabase.from("messages").delete().in("project_id", pids).throwOnError();
            await supabase.from("chats").delete().in("project_id", pids).throwOnError();
            await supabase.from("tickets").delete().in("project_id", pids).throwOnError();
            await supabase.from("users").delete().in("project_id", pids).throwOnError();

            // 2. Eliminar el vínculo de proyectos_railway (usamos delete para no dejar huérfanos)
            await supabase.from("proyectos_railway").delete().eq("railway_project_id", railwayProjectId).throwOnError();

            return { success: true };
        } catch (err) {
            console.error(`[Teardown] Error purgando el proyecto ${railwayProjectId}:`, err.message);
            throw err;
        }
    },

    /**
     * Vinculación de Proyectos
     */
    async updateProjectDisplayName(railwayProjectId, displayName) {
        if (!railwayProjectId) throw new Error('railwayProjectId es requerido');
        const cleanName = String(displayName || '').trim();
        if (!cleanName) throw new Error('El nombre es requerido');

        const payload = {
            nombre_personalizado: cleanName,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('proyectos_railway')
            .update(payload)
            .eq('railway_project_id', railwayProjectId)
            .select('id, railway_project_id, nombre_personalizado')
            .maybeSingle();

        if (error) throw error;
        if (data) return data;

        const { data: inserted, error: insertError } = await supabase
            .from('proyectos_railway')
            .insert({
                railway_project_id: railwayProjectId,
                nombre_personalizado: cleanName,
                source: 'control',
                updated_at: new Date().toISOString()
            })
            .select('id, railway_project_id, nombre_personalizado')
            .single();

        if (insertError) throw insertError;
        return inserted;
    },
    async ensureClientProjectCapacity(clientId, currentRailwayProjectId = null) {
        if (!clientId) throw new Error('Cliente requerido');

        const { data: client, error: clientError } = await supabase
            .from('clientes')
            .select('id, plan, plan_tipo, lineas_cantidad, subscription_status')
            .eq('id', clientId)
            .maybeSingle();
        if (clientError) throw clientError;
        if (!client) throw new Error('Cliente no encontrado');

        const limit = Number(client.lineas_cantidad);
        const isCustomOrManual = String(client.plan || '').toLowerCase() === 'personalizado'
            || String(client.plan_tipo || '').toLowerCase() === 'personalizado';
        if (!Number.isFinite(limit) || limit <= 0 || isCustomOrManual) return true;

        let query = supabase
            .from('proyectos_railway')
            .select('id', { count: 'exact', head: true })
            .eq('cliente_id', clientId)
            .or('is_deleted.is.null,is_deleted.eq.false');

        if (currentRailwayProjectId) {
            query = query.neq('railway_project_id', currentRailwayProjectId);
        }

        const { count, error } = await query;
        if (error) throw error;
        if ((count || 0) >= limit) {
            throw new Error(`El cliente ya usa ${count || 0}/${limit} instancias disponibles para su plan.`);
        }

        return true;
    },
    async registerNewProjectForClient(railwayProjectId, clientId) {
        if (!railwayProjectId || !clientId) {
            throw new Error('railwayProjectId y clientId son requeridos');
        }

        const normalizedProjectId = String(railwayProjectId).trim();
        const normalizedClientId = String(clientId).trim();

        if (!normalizedProjectId || !normalizedClientId) {
            throw new Error('railwayProjectId y clientId son requeridos');
        }

        // 1. El proyecto NO puede ser reclamado posteriormente.
        const { data: existing, error: existingError } = await supabase
            .from('proyectos_railway')
            .select('id, railway_project_id, cliente_id, source, is_deleted')
            .eq('railway_project_id', normalizedProjectId)
            .maybeSingle();

        if (existingError) {
            throw existingError;
        }

        if (existing) {
            // Único caso permitido: retry idempotente para EXACTAMENTE el mismo owner.
            if (existing.cliente_id && String(existing.cliente_id) === normalizedClientId) {
                await this.ensureClientAuthUser(normalizedClientId);
                await this.resolveClientTenantId(normalizedClientId);
                await this.syncProjectCredentials(normalizedProjectId, normalizedClientId);
                return existing;
            }

            const ownershipError = new Error(
                `El proyecto ${normalizedProjectId} ya existe en proyectos_railway y su ownership no puede modificarse.`
            );
            ownershipError.code = 'PROJECT_OWNERSHIP_IMMUTABLE';
            throw ownershipError;
        }

        // 2. Validar cliente y capacidad ANTES del INSERT.
        await this.ensureClientProjectCapacity(normalizedClientId);
        await this.ensureClientAuthUser(normalizedClientId);
        await this.resolveClientTenantId(normalizedClientId);

        // 3. INSERT ÚNICO.
        const payload = {
            railway_project_id: normalizedProjectId,
            cliente_id: normalizedClientId,
            is_deleted: false,
            source: 'control',
            updated_at: new Date().toISOString(),
            backoffice_activado: true,
            deploy_in_progress: false
        };

        const { data, error } = await supabase
            .from('proyectos_railway')
            .insert(payload)
            .select()
            .single();

        if (error) {
            // Defensa extra ante carrera.
            const { data: racedExisting, error: racedError } = await supabase
                .from('proyectos_railway')
                .select('id, railway_project_id, cliente_id, source, is_deleted')
                .eq('railway_project_id', normalizedProjectId)
                .maybeSingle();

            if (!racedError && racedExisting?.cliente_id && String(racedExisting.cliente_id) === normalizedClientId) {
                await this.syncProjectCredentials(normalizedProjectId, normalizedClientId);
                return racedExisting;
            }

            throw error;
        }

        // 4. Credenciales del proyecto.
        await this.syncProjectCredentials(normalizedProjectId, normalizedClientId);

        return data;
    },

    /**
     * Gestión de Tickets
     */

    // Lista ligera para SmartRefresh y vistas de listado: SIN chats_adjuntos
    async getTickets(filters = {}) {
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 25;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const clientProjectIds = filters.cliente_id ? await getClientProjectIds(filters.cliente_id) : [];

        let query = supabase
            .from('tickets')
            .select('id, cliente_id, project_id, titulo, descripcion, estado, tipo, created_at, updated_at, read_admin_count, chat_id, chats_adjuntos, clientes!cliente_id(nombre)', { count: 'exact' })
            .eq('tipo', 'Soporte');

        if (filters.estado) query = query.eq('estado', filters.estado);
        if (filters.cliente_id) {
            const clientFilter = buildClientTicketFilter(filters.cliente_id, clientProjectIds);
            if (clientFilter) query = query.or(clientFilter);
        }

        const { data, error, count } = await query
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        if (data) {
            data.forEach(t => {
                let chats = [];
                if (t.chats_adjuntos) {
                    try { chats = typeof t.chats_adjuntos === 'string' ? JSON.parse(t.chats_adjuntos) : t.chats_adjuntos; } catch (e) { }
                }
                const total = (t.descripcion ? 1 : 0) + chats.length;
                t.unreadCount = Math.max(0, total - (t.read_admin_count || 0));
                delete t.chats_adjuntos; // Remove payload to save bandwidth
            });
        }

        return { data, total: count, page, limit };
    },

    // Solo metadatos: para SmartRefresh (sin chats, sin descripcion pesada)
    async getTicketsMeta() {
        const { data, error } = await supabase
            .from('tickets')
            .select('id, cliente_id, project_id, chat_id, titulo, estado, tipo, updated_at, read_admin_count, chats_adjuntos, descripcion, clientes!cliente_id(nombre)')
            .eq('tipo', 'Soporte')
            .neq('estado', 'Cerrado')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // Ticket completo con chats_adjuntos: solo se llama al abrir el chat
    async getTicketById(id) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, clientes!cliente_id(nombre)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },


    async createTicket(ticketData) {
        if (!ticketData.cliente_id) throw new Error("cliente_id es requerido para crear un ticket");

        const tenantId = await this.resolveClientTenantId(ticketData.cliente_id);
        ticketData.tenant_id = tenantId;

        if (ticketData.project_id) {
            const { data: projLink, error: projErr } = await supabase
                .from('proyectos_railway')
                .select('cliente_id')
                .eq('railway_project_id', ticketData.project_id)
                .maybeSingle();

            if (projErr) throw projErr;
            if (!projLink || String(projLink.cliente_id) !== String(ticketData.cliente_id)) {
                throw new Error("El project_id no pertenece al cliente_id especificado");
            }
        }

        const estadoMap = { "abierto": "Abierto", "cerrado": "Cerrado" };
        if (ticketData.estado) {
            ticketData.estado = estadoMap[ticketData.estado.toLowerCase().trim()] || "Abierto";
        } else {
            ticketData.estado = "Abierto";
        }
        ticketData.tipo = "Soporte";
        delete ticketData.prioridad;
        delete ticketData.chat_id;

        const { data, error } = await supabase
            .from('tickets')
            .insert([ticketData])
            .select()
            .single();

        if (error) {
            console.error("Error creating ticket:", error);
            throw error;
        }

        return data;
    },

    async updateTicket(id, ticketData) {
        if (ticketData.cliente_id || ticketData.project_id) {
            const { data: currentTicket, error: fetchErr } = await supabase
                .from('tickets')
                .select('cliente_id, project_id')
                .eq('id', id)
                .single();
            if (fetchErr) throw fetchErr;

            const finalClienteId = ticketData.cliente_id || currentTicket.cliente_id;
            const finalProjectId = ticketData.project_id !== undefined ? ticketData.project_id : currentTicket.project_id;

            if (finalProjectId) {
                const { data: projLink, error: projErr } = await supabase
                    .from('proyectos_railway')
                    .select('cliente_id')
                    .eq('railway_project_id', finalProjectId)
                    .maybeSingle();

                if (projErr) throw projErr;
                if (!projLink || String(projLink.cliente_id) !== String(finalClienteId)) {
                    throw new Error("El project_id resultante no pertenece al cliente resultante");
                }
            }

            const tenantId = await this.resolveClientTenantId(finalClienteId);
            ticketData.tenant_id = tenantId;
        }

        const { data, error } = await supabase
            .from('tickets')
            .update(ticketData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async addTicketMessage(id, messageObj) {
        const { data: ticket, error: errFetch } = await supabase
            .from('tickets')
            .select('chats_adjuntos')
            .eq('id', id)
            .single();
        if (errFetch) throw errFetch;

        let chats = [];
        if (ticket.chats_adjuntos) {
            if (typeof ticket.chats_adjuntos === 'string') {
                try { chats = JSON.parse(ticket.chats_adjuntos); } catch (e) { }
            } else if (Array.isArray(ticket.chats_adjuntos)) {
                chats = ticket.chats_adjuntos;
            }
        }

        chats.push(messageObj);

        const { data, error } = await supabase
            .from('tickets')
            .update({ chats_adjuntos: chats })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        return data;
    },

    async deleteTicket(id) {
        const { error } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    async getWhatsAppSessionStatus(railwayProjectId) {
        try {
            const { data, error } = await supabase
                .from('whatsapp_sessions')
                .select('updated_at, data')
                .eq('project_id', railwayProjectId)
                .eq('key_id', 'full_backup') // Always target the unified backup
                .order('updated_at', { ascending: false }) // Take the latest one
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            if (!data) return { connected: false, message: 'No session found' };

            // Verificamos el contenido de data (puede venir como objeto o string)
            let sessionData = data.data;
            if (typeof sessionData === 'string') {
                try {
                    sessionData = JSON.parse(sessionData);
                } catch (e) {
                    console.error('Error parsing session data string:', e);
                }
            }

            const hasCreds = sessionData && sessionData['creds.json'];

            // Consideramos "desconectado" si no tiene creds o si el backup es muy viejo (> 24h)
            const lastUpdate = new Date(data.updated_at);
            const diffMs = Date.now() - lastUpdate.getTime();
            const isFresh = diffMs < 24 * 60 * 60 * 1000;

            return {
                connected: !!hasCreds && isFresh,
                lastUpdate: data.updated_at,
                message: !hasCreds ? 'Faltan credenciales' : (!isFresh ? 'Sesión expirada' : 'OK')
            };
        } catch (error) {
            console.error('Error getting WhatsApp status:', error.message);
            return { connected: false, error: error.message };
        }
    },

    async deleteTicket(id) {
        const { error } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    async getPendingTicketsCount() {
        const { count, error } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'Abierto')
            .eq('tipo', 'Soporte');
        if (error) throw error;
        return count;
    },

    async getClientPendingTickets(clientId) {
        const projectIds = await getClientProjectIds(clientId);

        let query = supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .in('estado', ['Abierto', 'En progreso'])
            .eq('tipo', 'Soporte');

        const clientFilter = buildClientTicketFilter(clientId, projectIds);
        if (clientFilter) query = query.or(clientFilter);

        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
    },

    /**
     * Auditoría
     */
    async logAction(action, details, entityType, entityId, _attempt = 0) {
        try {
            const { error } = await supabase
                .from('auditoria_acciones')
                .insert([{
                    accion: action,
                    detalles: details,
                    entidad_tipo: entityType,
                    entidad_id: entityId
                }]);
            if (error) {
                const errStr = JSON.stringify(error);
                if (_attempt < 2 && (errStr.includes('UND_ERR_SOCKET') || errStr.includes('other side closed') || errStr.includes('fetch failed'))) {
                    await new Promise(r => setTimeout(r, 400 * (_attempt + 1)));
                    return this.logAction(action, details, entityType, entityId, _attempt + 1);
                }
                console.error('Error logging action:', error);
            }
        } catch (err) {
            if (_attempt < 2 && (err.message?.includes('fetch failed') || err.message?.includes('other side closed'))) {
                await new Promise(r => setTimeout(r, 400 * (_attempt + 1)));
                return this.logAction(action, details, entityType, entityId, _attempt + 1);
            }
            console.error('Error logging action:', { message: err.message, details: err.stack });
        }
    },

    async getRecentAutoRedeployCount(serviceId) {
        try {
            // Buscamos intentos en los últimos 30 minutos para no saturar
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000).toISOString();
            const { count, error } = await supabase
                .from('auditoria_acciones')
                .select('*', { count: 'exact', head: true })
                .eq('entidad_id', serviceId)
                .eq('accion', 'Auto-Redeploy')
                .gte('created_at', thirtyMinutesAgo);

            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Error checking recent redeploys:', error.message);
            return 99; // Por seguridad, si falla la base de datos, no reintentamos
        }
    },

    async getAuditLogs() {
        const { data, error } = await supabase
            .from('auditoria_acciones')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        return data;
    },

    async getAdmins() {
        const { data, error } = await supabase
            .from('admins_account')
            .select('id, username')
            .order('id', { ascending: true });
        if (error) throw error;
        return data.map(admin => ({
            auth_user_id: String(admin.id),
            nombre: admin.username,
            email: ''
        }));
    },

    async getSettings(projectId) {
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('project_id', projectId);
        if (error) throw error;
        return data;
    },

    async createSetting(projectId, key, value, api_key = null) {
        const tenantId = await this.resolveSettingsScopeTenant(projectId);
        const payload = { tenant_id: tenantId, project_id: projectId, service_id: 'default_service', key, value };
        if (api_key !== null) payload.api_key = api_key;
        const { data, error } = await supabase
            .from('settings')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateSetting(projectId, key, updates) {
        const tenantId = await this.resolveSettingsScopeTenant(projectId);

        // If updates is just a value (backward compatibility)
        if (typeof updates === 'string' || typeof updates === 'boolean' || typeof updates === 'number') {
            updates = { value: updates };
        }

        updates.tenant_id = tenantId;

        const { data: updated, error: updateError } = await supabase
            .from('settings')
            .update(updates)
            .eq('project_id', projectId)
            .eq('key', key)
            .select();
        if (updateError) throw updateError;

        if (!updated || updated.length === 0) {
            // Backward compatibility insert
            const insertPayload = { tenant_id: tenantId, project_id: projectId, service_id: 'default_service', key, ...updates };
            const { error: insertError } = await supabase
                .from('settings')
                .insert(insertPayload);
            if (insertError) throw insertError;
        }
        return true;
    },

    async deleteSetting(projectId, key) {
        const { data, error } = await supabase
            .from('settings')
            .delete()
            .eq('project_id', projectId)
            .eq('key', key)
            .select();
        if (error) throw error;
        return data;
    },

    /**
     * System Logs
     */
    async getSystemLogs(limit = 100) {
        const { data, error } = await supabase
            .from('system_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    },

    /**
     * Supabase Chats
     */
    async getChats(limit = null, projectId = null, offset = 0, filters = {}) {
        let query = supabase
            .from('chats')
            .select('*', { count: 'exact' })
            .order('last_message_at', { ascending: false });

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        if (filters.search) {
            // Supabase OR syntax for text search
            query = query.or(`name.ilike.%${filters.search}%,id.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
        }
        if (filters.type) {
            query = query.eq('type', filters.type);
        }
        if (filters.bot_enabled !== undefined && filters.bot_enabled !== '') {
            query = query.eq('bot_enabled', filters.bot_enabled === 'true' || filters.bot_enabled === true);
        }
        if (filters.unread) {
            query = query.gt('unread_count', 0);
        }

        if (limit) {
            query = query.range(offset, offset + limit - 1);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return { chats: data, totalCount: count };
    },

    async filterActiveChatProjects(projectIds) {
        if (!projectIds || !projectIds.length) return [];

        const activeIds = [];
        // Concurrency max ~50-100 is fine for this dashboard
        await Promise.all(projectIds.map(async (id) => {
            try {
                const { data } = await supabase
                    .from('chats')
                    .select('project_id')
                    .eq('project_id', id)
                    .limit(1);
                if (data && data.length > 0) {
                    activeIds.push(id);
                }
            } catch (e) {
                // ignore
            }
        }));
        return activeIds;
    },

    async updateChat(chatId, updates) {
        const { data, error } = await supabase
            .from('chats')
            .update(updates)
            .eq('id', chatId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getMetaOnboarding(projectId = null) {
        let query = supabase
            .from('meta_onboarding')
            .select('*')
            .order('created_at', { ascending: false });

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async updateMetaOnboarding(projectId, updates) {
        const { data, error } = await supabase
            .from('meta_onboarding')
            .update(updates)
            .eq('project_id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getWhatsappSessions(projectId = null) {
        let query = supabase
            .from('whatsapp_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async updateWhatsappSession(projectId, updates) {
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .update(updates)
            .eq('project_id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ==========================================
    // PLAN CATALOG
    // ==========================================
    async getCatalogPlans(includeInactive = false) {
        let query = supabase
            .from('catalogo_planes')
            .select('id, plan_tipo, lineas_cantidad, nombre, precio, activo, created_at')
            .order('precio', { ascending: true })
            .order('nombre', { ascending: true });

        if (!includeInactive) {
            query = query.eq('activo', true);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async createCatalogPlan(planData) {
        const { data, error } = await supabase
            .from('catalogo_planes')
            .insert([planData])
            .select('id, plan_tipo, lineas_cantidad, nombre, precio, activo, created_at')
            .single();

        if (error) throw error;
        return data;
    },

    async updateCatalogPlan(id, updates) {
        const { data, error } = await supabase
            .from('catalogo_planes')
            .update(updates)
            .eq('id', id)
            .select('id, plan_tipo, lineas_cantidad, nombre, precio, activo, created_at')
            .single();

        if (error) throw error;
        return data;
    },

    // ==========================================
    // ADMINS ACCOUNT
    // ==========================================
    async getAdminsAccount() {
        const { data, error } = await supabase
            .from('admins_account')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async createAdminAccount(adminData) {
        const { data, error } = await supabase
            .from('admins_account')
            .insert([adminData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateAdminAccount(id, updates) {
        const { data, error } = await supabase
            .from('admins_account')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteAdminAccount(id) {
        const { data, error } = await supabase
            .from('admins_account')
            .delete()
            .eq('id', id)
            .select();

        if (error) throw error;
        return data;
    },

    // ==========================================
    // ONBOARDING (Checklist y Notas)
    // ==========================================
    async getProjectOnboarding(projectId) {
        const { data, error } = await supabase
            .from('project_onboarding')
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (error) throw error;
        return data;
    },

    async getAllProjectOnboardings() {
        const { data, error } = await supabase
            .from('project_onboarding')
            .select('project_id, checklist_state, notes');

        if (error) throw error;
        return data;
    },

    async updateProjectOnboarding(updateData) {
        const { data, error } = await supabase
            .from('project_onboarding')
            .upsert(updateData)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};

module.exports = supabaseService;
