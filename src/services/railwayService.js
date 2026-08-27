const RAILWAY_TOKEN_TEMPLATE_2 = process.env.RAILWAY_TOKEN_TEMPLATE_2;
const RAILWAY_TOKEN = RAILWAY_TOKEN_TEMPLATE_2;
const RAILWAY_TOKEN_TEMPLATE = RAILWAY_TOKEN_TEMPLATE_2;
const RAILWAY_TEMPLATE_WORKSPACE_ID_2 = process.env.RAILWAY_TEMPLATE_WORKSPACE_ID_2;
const RAILWAY_TEMPLATE_WORKSPACE_MAX_PROJECTS = Number(process.env.RAILWAY_TEMPLATE_WORKSPACE_MAX_PROJECTS || 100);
const RAILWAY_API = process.env.RAILWAY_API || "https://backboard.railway.app/graphql/v2";

function getTemplateWorkspaces() {
  const candidates = [
    {
      key: '2',
      name: 'Workspace secundario',
      workspaceId: RAILWAY_TEMPLATE_WORKSPACE_ID_2,
      token: RAILWAY_TOKEN_TEMPLATE_2,
      projectToken: RAILWAY_TOKEN_TEMPLATE_2,
      maxProjects: RAILWAY_TEMPLATE_WORKSPACE_MAX_PROJECTS
    }
  ];

  const seen = new Set();
  return candidates.filter(workspace => {
    if (!workspace.workspaceId || !workspace.token || !workspace.projectToken || seen.has(workspace.workspaceId)) return false;
    seen.add(workspace.workspaceId);
    return true;
  });
}

function getWorkspaceByKey(workspaceKey) {
  if (!workspaceKey) return null;
  return getTemplateWorkspaces().find(workspace => workspace.key === String(workspaceKey)) || null;
}

async function resolveProjectToken(projectId, workspaceKey = null) {
  const workspace = getWorkspaceByKey(workspaceKey);
  if (workspace?.projectToken) return workspace.projectToken;
  if (!projectId) return null;

  const query = `
    query {
      projects(first: 250) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  for (const candidate of getTemplateWorkspaces()) {
    try {
      const result = await railwayQuery(query, {}, candidate.projectToken);
      const hasProject = (result.data?.projects?.edges || []).some(edge => edge.node?.id === projectId);
      if (hasProject) return candidate.projectToken;
    } catch (err) {
      console.warn(`[railwayService] No se pudo validar proyecto en ${candidate.name}:`, err.message);
    }
  }

  return null;
}

function resolveWorkspaceToken(workspaceKey = null) {
  return getWorkspaceByKey(workspaceKey)?.projectToken || null;
}

/**
 * Detecta si un error es causado por una conexión keep-alive vencida (UND_ERR_SOCKET)
 */
function isSocketResetError(err) {
  if (!err) return false;
  const msg = (err.message || '') + (err.cause?.message || '') + (err.cause?.code || '');
  return msg.includes('UND_ERR_SOCKET') || msg.includes('other side closed') || msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED');
}

/**
 * Función genérica para realizar peticiones a la API de Railway
 * Incluye retry automático ante errores de socket/keep-alive
 */
async function railwayQuery(query, variables = {}, customToken = null, _attempt = 0) {
  try {
    const token = customToken || RAILWAY_TOKEN;
    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Connection": "close"
      },
      body: JSON.stringify({ query, variables })
    });
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (parseError) {
      throw new Error(`La API de Railway devolvió una respuesta no válida (HTTP ${response.status}): ${text.slice(0, 150)}...`);
    }
  } catch (error) {
    if (isSocketResetError(error) && _attempt < 2) {
      // Espera breve antes de reintentar
      await new Promise(r => setTimeout(r, 300 * (_attempt + 1)));
      return railwayQuery(query, variables, customToken, _attempt + 1);
    }
    console.error("Error en railwayQuery:", error.message || error, error.cause ? `(Causa: ${error.cause.message || error.cause})` : '');
    throw error;
  }
}

async function getVisibleProjectCounts() {
  const workspaces = getTemplateWorkspaces();
  const query = `
    query {
      projects(first: 250) {
        edges {
          node {
            id
            workspaceId
            workspace {
              id
              name
            }
          }
        }
      }
    }
  `;

  const byWorkspaceId = new Map();
  const byAccountKey = new Map();
  let total = 0;

  for (const workspace of workspaces) {
    const result = await railwayQuery(query, {}, workspace.projectToken);
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    const edges = result.data?.projects?.edges || [];
    total += edges.length;
    byAccountKey.set(workspace.key, edges.length);

    for (const edge of edges) {
      const workspaceId = edge.node?.workspaceId || edge.node?.workspace?.id || workspace.workspaceId;
      byWorkspaceId.set(workspaceId, (byWorkspaceId.get(workspaceId) || 0) + 1);
    }
  }

  return {
    total,
    byWorkspaceId,
    byAccountKey
  };
}

async function getAvailableTemplateWorkspace() {
  const workspaces = getTemplateWorkspaces();
  if (workspaces.length === 0) {
    throw new Error("No hay workspaces de templates configurados en .env");
  }

  const visibleCounts = await getVisibleProjectCounts();
  const checked = [];
  for (const workspace of workspaces) {
    const projectCount = visibleCounts.byAccountKey.get(workspace.key) || 0;
    checked.push({ ...workspace, projectCount });

    if (projectCount < workspace.maxProjects) {
      return { ...workspace, projectCount };
    }
  }

  const summary = checked.map(w => `${w.name}: ${w.projectCount}/${w.maxProjects}`).join(', ');
  throw new Error(`No hay capacidad disponible para desplegar nuevos proyectos (${summary})`);
}



const railwayService = {
  async getProjectMetrics(projectId, environmentId, serviceId, startDate, endDate, measurements, sampleRateSeconds, workspaceKey = null) {
    const query = `
      query($projectId: String!, $environmentId: String, $serviceId: String, $startDate: DateTime!, $endDate: DateTime, $measurements: [MetricMeasurement!]!, $sampleRateSeconds: Int) {
        metrics(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId, startDate: $startDate, endDate: $endDate, measurements: $measurements, sampleRateSeconds: $sampleRateSeconds) {
          measurement
          values {
            ts
            value
          }
        }
      }
    `;
    const variables = { projectId, startDate, measurements };
    if (environmentId) variables.environmentId = environmentId;
    if (serviceId) variables.serviceId = serviceId;
    if (endDate) variables.endDate = endDate;
    if (sampleRateSeconds) variables.sampleRateSeconds = sampleRateSeconds;
    
    const result = await railwayQuery(query, variables, await resolveProjectToken(projectId, workspaceKey));
    return result.data?.metrics || [];
  },

  async getProjectUsage(projectId, startDate, endDate, workspaceKey = null) {
    const query = `
      query($projectId: String!, $startDate: DateTime, $endDate: DateTime) {
        usage(projectId: $projectId, startDate: $startDate, endDate: $endDate, measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_RX_GB, NETWORK_TX_GB, EPHEMERAL_DISK_USAGE_GB]) {
          measurement
          value
        }
      }
    `;
    const result = await railwayQuery(query, { projectId, startDate, endDate }, await resolveProjectToken(projectId, workspaceKey));
    return result.data?.usage || [];
  },

  async getAssistants() {
    const query = `
      query {
        projects(first: 250) {
          edges {
            node {
              id
              name
              workspaceId
              workspace {
                id
                name
              }
              createdAt
              environments {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
              services {
                edges {
                  node {
                    id
                    name
                    deployments(first: 1) {
                      edges {
                        node {
                          id
                          status
                          createdAt
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const workspaces = getTemplateWorkspaces();
    const targets = workspaces.length > 0
      ? workspaces
      : [{ key: '2', name: 'Workspace secundario', workspaceId: RAILWAY_TEMPLATE_WORKSPACE_ID_2 || null, projectToken: RAILWAY_TOKEN_TEMPLATE_2 }];
    const projects = [];
    const seenProjectIds = new Set();

    for (const workspace of targets) {
      const result = await railwayQuery(query, {}, workspace.projectToken);

      if (!result.data?.projects) {
        console.error(`Respuesta inválida de Railway (${workspace.name}):`, result);
        continue;
      }

      for (const edge of result.data.projects.edges || []) {
        if (!edge.node?.id || seenProjectIds.has(edge.node.id)) continue;
        seenProjectIds.add(edge.node.id);
        const projectWorkspaceId = edge.node?.workspaceId || edge.node?.workspace?.id || workspace.workspaceId || null;
        projects.push({
          ...edge.node,
          railwayWorkspaceId: projectWorkspaceId,
          railwayWorkspaceKey: workspace.key,
          railwayWorkspaceName: edge.node?.workspace?.name || workspace.name
        });
      }
    }

    // Fetch isUpdatable separately so a failure doesn't break the main load
    let updatableMap = {};
    try {
      updatableMap = await this._getUpdatableMap();
    } catch (e) {
      console.warn("No se pudo obtener isUpdatable:", e.message);
    }

    return projects.map(project => {
      const services = (project.services?.edges || []).map(serviceEdge => {
        const service = serviceEdge.node;
        const deployment = service.deployments?.edges[0]?.node;
        const deployStatus = deployment?.status || "UNKNOWN";
        const createdAt = deployment?.createdAt || null;
        const defaultEnvironmentIdx = project.environments?.edges.findIndex(e => e.node.name === "production") || 0;
        const defaultEnvironment = project.environments?.edges[defaultEnvironmentIdx > -1 ? defaultEnvironmentIdx : 0]?.node?.id || null;

        const isUpdatable = updatableMap[`${service.id}:${defaultEnvironment}`] || false;

        let status = "offline";
        if (deployStatus === "SUCCESS") status = "online";
        else if (deployStatus === "FAILED" || deployStatus === "CRASHED") status = "error";
        else if (deployStatus === "BUILDING" || deployStatus === "DEPLOYING") status = "checking";

        return {
          id: service.id,
          name: service.name,
          railwayStatus: deployStatus,
          status,
          createdAt,
          deploymentId: deployment?.id || null,
          projectId: project.id,
          environmentId: defaultEnvironment,
          railwayWorkspaceId: project.railwayWorkspaceId || null,
          railwayWorkspaceKey: project.railwayWorkspaceKey || null,
          railwayWorkspaceName: project.railwayWorkspaceName || null,
          isUpdatable
        };
      });

      const hasError = services.some(s => s.status === "error");
      const hasBuilding = services.some(s => s.status === "checking");
      const hasOnline = services.some(s => s.status === "online");

      let projectStatus = "offline";
      if (hasError) projectStatus = "error";
      else if (hasBuilding) projectStatus = "checking";
      else if (hasOnline) projectStatus = "online";

      return {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        services: services || [],
        railwayUrl: `https://railway.com/project/${project.id}`,
        railwayWorkspaceId: project.railwayWorkspaceId || null,
        railwayWorkspaceKey: project.railwayWorkspaceKey || null,
        railwayWorkspaceName: project.railwayWorkspaceName || null,
        status: projectStatus,
        isUpdatable: services.some(s => s.isUpdatable)
      };
    });
  },

  async _getUpdatableMap() {
    const query = `
      query {
        projects(first: 250) {
          edges {
            node {
              services {
                edges {
                  node {
                    id
                    serviceInstances {
                      edges {
                        node {
                          environmentId
                          isUpdatable
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const workspaces = getTemplateWorkspaces();
    const targets = workspaces.length > 0
      ? workspaces
      : [{ projectToken: RAILWAY_TOKEN_TEMPLATE_2 }];
    const map = {};

    for (const workspace of targets) {
      const result = await railwayQuery(query, {}, workspace.projectToken);
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      if (!result.data?.projects) continue;

      for (const projEdge of result.data.projects.edges || []) {
        for (const svcEdge of projEdge.node.services?.edges || []) {
          const svc = svcEdge.node;
          for (const instEdge of svc.serviceInstances?.edges || []) {
            const inst = instEdge.node;
            map[`${svc.id}:${inst.environmentId}`] = inst.isUpdatable || false;
          }
        }
      }
    }
    return map;
  },

  async redeployService(serviceId, environmentId, workspaceKey = null) {
    const query = `
      mutation serviceInstanceRedeploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `;
    return await railwayQuery(query, { serviceId, environmentId }, resolveWorkspaceToken(workspaceKey));
  },

  async deployServiceUpdate(projectId, environmentId, serviceId, workspaceKey = null) {
    const query = `
      mutation githubRepoUpdate($input: GitHubRepoUpdateInput!) {
        githubRepoUpdate(input: $input)
      }
    `;
    const res = await railwayQuery(query, { input: { projectId, environmentId, serviceId } }, await resolveProjectToken(projectId, workspaceKey));
    if (res.errors) {
      console.error("githubRepoUpdate error:", res.errors);
      throw new Error(res.errors[0].message);
    }
    return res.data;
  },

  async deleteService(serviceId) {
    const query = `
      mutation serviceDelete($id: String!) {
        serviceDelete(id: $id)
      }
    `;
    return await railwayQuery(query, { id: serviceId });
  },

  async updateProjectName(projectId, newName, workspaceKey = null) {
    const query = `
      mutation projectUpdate($id: String!, $input: ProjectUpdateInput!) {
        projectUpdate(id: $id, input: $input) {
          id
          name
        }
      }
    `;
    return await railwayQuery(query, { id: projectId, input: { name: newName } }, await resolveProjectToken(projectId, workspaceKey));
  },

  async updateServiceName(serviceId, newName, workspaceKey = null) {
    const query = `
      mutation serviceUpdate($id: String!, $input: ServiceUpdateInput!) {
        serviceUpdate(id: $id, input: $input) {
          id
          name
        }
      }
    `;
    return await railwayQuery(query, { id: serviceId, input: { name: newName } }, resolveWorkspaceToken(workspaceKey));
  },

  async deleteProject(projectId, workspaceKey = null) {
    const query = `
      mutation projectDelete($id: String!) {
        projectDelete(id: $id)
      }
    `;
    return await railwayQuery(query, { id: projectId }, await resolveProjectToken(projectId, workspaceKey));
  },

  async fetchDeploymentLogs(deploymentId) {
    const query = `
      query deploymentLogs($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
          timestamp
          message
          severity
        }
      }
    `;
    const result = await railwayQuery(query, { deploymentId, limit: 1000 });
    return result.data?.deploymentLogs || [];
  },

  async getEnvironmentLogs(environmentId, limit = 20, filter = "", beforeDate = null, afterDate = null, anchorDate = null, beforeLimit = null, afterLimit = null) {
    const query = `
      query environmentLogs($environmentId: String!, $filter: String, $beforeLimit: Int, $afterLimit: Int, $anchorDate: String, $beforeDate: String, $afterDate: String) {
        environmentLogs(environmentId: $environmentId, filter: $filter, beforeLimit: $beforeLimit, afterLimit: $afterLimit, anchorDate: $anchorDate, beforeDate: $beforeDate, afterDate: $afterDate) {
          timestamp
          message
          severity
          attributes {
            key
            value
          }
        }
      }
    `;
    const variables = { environmentId };
    
    if (filter) variables.filter = filter;
    if (beforeDate) variables.beforeDate = beforeDate;
    if (afterDate) variables.afterDate = afterDate;
    
    if (anchorDate) {
      variables.anchorDate = anchorDate;
      if (beforeLimit !== null) variables.beforeLimit = beforeLimit;
      if (afterLimit !== null) variables.afterLimit = afterLimit;
    } else {
      variables.beforeLimit = limit;
    }
    
    const result = await railwayQuery(query, variables);
    return result.data?.environmentLogs || [];
  },

  async getServiceVariables(projectId, environmentId, serviceId, workspaceKey = null) {
    const query = `
      query variables($projectId: String!, $environmentId: String!, $serviceId: String) {
        variables(
          projectId: $projectId
          environmentId: $environmentId
          serviceId: $serviceId
        )
      }
    `;
    const result = await railwayQuery(query, { projectId, environmentId, serviceId }, await resolveProjectToken(projectId, workspaceKey));
    return result.data?.variables || {};
  },

  async upsertVariable(projectId, environmentId, serviceId, name, value, workspaceKey = null) {
    const query = `
      mutation variableUpsert($input: VariableUpsertInput!) {
        variableUpsert(input: $input)
      }
    `;
    return await railwayQuery(query, {
      input: {
        projectId,
        environmentId,
        serviceId,
        name,
        value,
        skipDeploys: true
      }
    }, await resolveProjectToken(projectId, workspaceKey));
  },

  async deleteVariable(projectId, environmentId, serviceId, name, workspaceKey = null) {
    const query = `
    mutation variableDelete($input: VariableDeleteInput!) {
      variableDelete(input: $input)
    }
  `;

    const result = await railwayQuery(query, {
      input: {
        projectId,
        environmentId,
        serviceId,
        name
      }
    }, await resolveProjectToken(projectId, workspaceKey));

    // IMPORTANTE: manejar errores
    if (result.errors) {
      console.error("Error eliminando variable:", result.errors);
      throw new Error(result.errors[0].message);
    }

    return result.data;
  },

  async getServiceDomains(projectId, environmentId, serviceId, workspaceKey = null) {
    const query = `
      query domains($projectId: String!, $environmentId: String!, $serviceId: String!) {
        domains(
          projectId: $projectId
          environmentId: $environmentId
          serviceId: $serviceId
        ) {
          serviceDomains {
            id
            domain
          }
          customDomains {
            id
            domain
          }
        }
      }
    `;
    const result = await railwayQuery(query, { projectId, environmentId, serviceId }, await resolveProjectToken(projectId, workspaceKey));
    return result.data?.domains || null;
  },

  async searchTemplates(queryText) {
    try {
      const workspaces = getTemplateWorkspaces();
      if (workspaces.length === 0) {
        console.warn("No hay workspaces de templates definidos en .env");
        return [];
      }

      const query = `
        query workspaceTemplates($workspaceId: String!) {
          workspaceTemplates(workspaceId: $workspaceId) {
            edges {
              node {
                id
                name
                description
                category
              }
            }
          }
        }
      `;

      const allTemplates = [];
      const seen = new Set();

      for (const workspace of workspaces) {
        try {
          const result = await railwayQuery(query, { workspaceId: workspace.workspaceId }, workspace.token);
          const templates = result.data?.workspaceTemplates?.edges.map(e => ({
            ...e.node,
          railwayWorkspaceId: workspace.workspaceId,
          railwayWorkspaceKey: workspace.key,
          railwayWorkspaceName: workspace.name
        })) || [];

          for (const template of templates) {
            const key = `${template.id}:${workspace.workspaceId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            allTemplates.push(template);
          }
        } catch (workspaceError) {
          console.warn(`No se pudieron cargar templates de ${workspace.name}:`, workspaceError.message);
        }
      }

      // Ya no necesitamos filtrar por palabras clave porque estamos pidiendo solo los templates de este workspace
      let filtered = allTemplates;

      // Si se especificó una búsqueda adicional por el usuario, filtramos sobre lo encontrado
      if (queryText && queryText.trim()) {
        const lowerQuery = queryText.toLowerCase();
        filtered = filtered.filter(t =>
          (t.name && t.name.toLowerCase().includes(lowerQuery)) ||
          (t.description && t.description.toLowerCase().includes(lowerQuery))
        );
      }

      return filtered;
    } catch (error) {
      console.error("Error en searchTemplates (workspace-list):", error);
      return [];
    }
  },

  async searchGlobalTemplates(queryText) {
    const query = `
      query templates($query: String, $first: Int) {
        templates(query: $query, first: $first) {
          edges {
            node {
              id
              name
              description
              category
              config
            }
          }
        }
      }
    `;
    const result = await railwayQuery(query, { query: queryText || "", first: 20 }, RAILWAY_TOKEN_TEMPLATE);
    return result.data?.templates?.edges.map(e => e.node) || [];
  },

  async deleteProject(projectId, workspaceKey = null) {
    console.log(`[railwayService] Requesting deletion of Railway project: ${projectId}`);
    try {
      const query = `
        mutation projectDelete($id: String!) {
          projectDelete(id: $id)
        }
      `;
      const result = await railwayQuery(query, { id: projectId }, await resolveProjectToken(projectId, workspaceKey));
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      console.log(`[railwayService] Result for ${projectId}:`, result.data);
      return { success: true, data: result.data };
    } catch (error) {
      console.error(`[railwayService] Failed to delete project ${projectId}:`, error.message);
      return { success: false, error: error.message };
    }
  }
};

module.exports = railwayService;
