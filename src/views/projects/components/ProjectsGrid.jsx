import React from 'react';

export default function ProjectsGrid({
  search,
  setSearch,
  selectedClientFilter,
  setSelectedClientFilter,
  selectedWorkspaceFilter,
  setSelectedWorkspaceFilter,
  clients,
  anyUpdatable,
  handleUpdateAll,
  autoUpdateEnabled,
  autoUpdateLoading,
  handleAutoUpdateToggle,
  refreshing,
  handleRefresh,
  isListView,
  filteredAssistants,
  getStatusColor,
  projectClientMap,
  setSelectedProjectId,
  handleDeployNewProject,
  setOnboardingProjectId,
  allOnboardings = {}
}) {
  const defaultTasks = ['asignacion_cobro', 'creacion_cliente', 'es_crm', 'es_bot', 'portfolio_sin_verificar', 'whatsapp_vinculado', 'portfolio_verificado', 'creacion_openai', 'prompt_avanzado', 'bot_linea', 'creacion_plantilla', 'envio_plantilla', 'cargar_contactos', 'estados', 'fechas'];

  return (
    <div id="assistants-grid-panel">
      {/* HEADER PANEL */}
      <style>{`
        .assistant-custom-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          width: 100%;
        }
        .assistant-header-top {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1 1 auto;
        }
        .assistant-header-inputs {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .assistant-header-controls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-shrink: 0;
        }
        .assistant-auto-update-toggle {
          border: 1px solid var(--border-light);
          background: var(--bg-glass);
          border-radius: 999px;
          padding: 0.25rem 0.55rem;
        }
        .assistant-btn-label {
          display: inline !important;
        }
        .assistant-btn-icon {
          margin-right: 0.5rem !important;
        }

        /* VISTA TABLET Y MOBILE: <= 991px */
        @media (max-width: 991px) {
          .assistant-custom-header {
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            width: 100%;
          }
          .assistant-header-top {
            flex-direction: column;
            align-items: center;
            width: 100%;
            gap: 0.8rem;
          }
          .assistant-header-inputs {
            flex-direction: column;
            align-items: center;
            width: 100%;
            gap: 0.8rem;
          }
          .assistant-header-inputs > div {
            width: 100% !important;
            max-width: 400px;
          }
          .assistant-header-controls {
            width: 100%;
            justify-content: center;
          }
          .assistant-header-controls .flex {
            justify-content: center;
            width: 100%;
            flex-wrap: wrap;
          }
        }
      `}</style>
      <div className="view-header assistant-custom-header">
        <div className="assistant-header-top">
          <div className="assistant-header-inputs">
            <div className="input-group input-group-sm mb-0" style={{ width: '180px' }}>
              <span className="input-group-text text-dim">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-main"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-row items-center gap-1" style={{ width: '180px' }}>
              <select
                className="form-select form-select-sm text-main bg-transparent border-secondary w-full"
                value={selectedWorkspaceFilter}
                onChange={(e) => setSelectedWorkspaceFilter(e.target.value)}
                title="Filtrar por cuenta de Railway"
              >
                <option value="">Todas las cuentas</option>
                <option value="1" className="bg-dark text-white">Cuenta 1</option>
                <option value="2" className="bg-dark text-white">Cuenta 2</option>
              </select>
              {selectedWorkspaceFilter && (
                <button className="btn btn-outline-secondary btn-sm shrink-0" onClick={() => setSelectedWorkspaceFilter('')} title="Limpiar filtro de cuenta">
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
            <div className="flex flex-row items-center gap-1" style={{ width: '180px' }}>
              <select
                className="form-select form-select-sm text-main bg-transparent border-secondary w-full"
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
              >
                <option value="">Todos los clientes</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-dark text-white">
                    {c.nombre}
                  </option>
                ))}
              </select>
              {selectedClientFilter && (
                <button className="btn btn-outline-secondary btn-sm shrink-0" onClick={() => setSelectedClientFilter('')} title="Limpiar filtro">
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="assistant-header-controls">
          <div className="flex gap-2 items-center justify-center flex-wrap">
            <div className="assistant-auto-update-toggle flex items-center gap-2" title="Actualiza automaticamente los proyectos todos los dias a las 00:00 hs">
              <span className="text-[11px] text-dim font-bold uppercase tracking-wider whitespace-nowrap">Auto 00:00</span>
              <label className="sysconfig-toggle" htmlFor="AutoUpdateProjectsToggle" style={{ opacity: autoUpdateLoading ? 0.5 : 1 }}>
                <input
                  type="checkbox"
                  id="AutoUpdateProjectsToggle"
                  className="btn-ca-sysconfig"
                  checked={autoUpdateEnabled}
                  onChange={handleAutoUpdateToggle}
                  disabled={autoUpdateLoading}
                />
                <span className="sysconfig-thumb">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-off"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-on"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                </span>
              </label>
            </div>
            {anyUpdatable && (
              <button className="btn btn-warning btn-sm flex items-center" onClick={handleUpdateAll}>
                <i className="bi bi-arrow-up-circle assistant-btn-icon"></i>
                <span className="assistant-btn-label">Actualizar Todo</span>
              </button>
            )}
            <button className="btn btn-success btn-sm flex items-center" onClick={handleDeployNewProject}>
              <i className="bi bi-plus-lg assistant-btn-icon"></i>
              <span className="assistant-btn-label">Nuevo Proyecto</span>
            </button>
          </div>
        </div>
      </div>

      {/* GRID / LIST */}
      <div className={`mt-4 ${isListView ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}`}>
        {filteredAssistants.length === 0 ? (
          <div className="col-span-full text-center text-white/50 py-12">No hay proyectos desplegados.</div>
        ) : (
          filteredAssistants.map((project, index) => {
            const statusColor = getStatusColor(project.status);
            const hasUpdate = (project.services || []).some(s => s.isUpdatable);
            const client = projectClientMap[project.id];
            const workspaceLabel = project.railwayWorkspaceKey ? `Cuenta ${project.railwayWorkspaceKey}` : 'Cuenta ?';
            const workspaceTitle = [
              project.railwayWorkspaceName || workspaceLabel,
              project.railwayWorkspaceId ? `ID: ${project.railwayWorkspaceId}` : null
            ].filter(Boolean).join(' - ');
            const workspaceBadgeClass = project.railwayWorkspaceKey === '2'
              ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-300 border border-emerald-500/30'
              : 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 dark:text-sky-300 border border-sky-500/30';
            
            const borderLeftStyle = 
              statusColor === 'success' ? '4px solid var(--success)' :
              statusColor === 'warning' ? '4px solid var(--warning)' :
              statusColor === 'danger' ? '4px solid var(--error)' : '4px solid transparent';

            const checklist = allOnboardings[project.id]?.checklist_state || {};
            const customTasks = Object.keys(checklist).filter(k => k.startsWith('custom_') && !k.endsWith('_label'));
            const allTasks = [...defaultTasks, ...customTasks];
            const checkedCount = allTasks.filter(k => checklist[k] === true).length;
            const isAllDone = allTasks.length > 0 && checkedCount === allTasks.length;

            if (isListView) {
              const altaKeys = ['asignacion_cobro', 'creacion_cliente', 'es_crm', 'es_bot'];
              const metaKeys = ['portfolio_sin_verificar', 'whatsapp_vinculado', 'portfolio_verificado'];
              const botKeys = ['creacion_openai', 'prompt_avanzado', 'bot_linea'];
              const capKeys = ['creacion_plantilla', 'envio_plantilla', 'cargar_contactos', 'estados', 'fechas'];
              
              const countDone = (keys) => keys.filter(k => checklist[k] === true).length;
              
              const altaDone = countDone(altaKeys);
              const metaDone = countDone(metaKeys);
              const botDone = countDone(botKeys);
              const capDone = countDone(capKeys);
              const customDone = countDone(customTasks);
              
              const notes = allOnboardings[project.id]?.notes || [];
              const pendingNotes = notes.filter(n => !n.read).length;

              return (
                <div
                  key={project.id}
                  className="glass-card p-2.5 flex flex-col gap-1 assistant-card clickable anim-card-enter"
                  style={{ '--si': index, borderLeft: borderLeftStyle }}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      {client ? (
                        <div className="text-xs text-[var(--accent)] font-semibold mb-1">
                          <i className="bi bi-person-fill mr-1"></i>Cliente: {client.nombre}
                        </div>
                      ) : (
                        <div className="text-xs text-danger font-semibold mb-1">
                          <i className="bi bi-exclamation-triangle-fill mr-1"></i>Sin cliente vinculado
                        </div>
                      )}
                      <div className="font-bold truncate">{project.name}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-white/50">ID: {project.id.substring(0, 8)}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${workspaceBadgeClass}`}
                          title={workspaceTitle}
                        >
                          <i className="bi bi-building mr-1"></i>
                          {workspaceLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-[var(--text-main)] font-medium hidden sm:block">Servicios: {(project.services || []).length}</span>
                      <span className={`badge ${hasUpdate ? 'badge-status-warning' : 'bg-[var(--accent)]/10 dark:bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30'}`} title={hasUpdate ? 'Hay actualizaciones disponibles' : 'Sistema actualizado'}>
                        <i className="bi bi-info-circle-fill"></i>
                      </span>
                    </div>
                  </div>

                  <hr className="my-0.5 border-[var(--border-light)] opacity-50" />

                  {/* ONBOARDING BADGES ROW */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm ${altaDone === altaKeys.length ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-transparent border-[var(--text-dim)] text-[var(--text-main)] opacity-70'}`}>
                      <i className={`bi ${altaDone === altaKeys.length ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>
                      Alta Cliente {altaDone}/{altaKeys.length}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm ${metaDone === metaKeys.length ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-transparent border-[var(--text-dim)] text-[var(--text-main)] opacity-70'}`}>
                      <i className={`bi ${metaDone === metaKeys.length ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>
                      Meta proceso {metaDone}/{metaKeys.length}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm ${botDone === botKeys.length ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-transparent border-[var(--text-dim)] text-[var(--text-main)] opacity-70'}`}>
                      <i className={`bi ${botDone === botKeys.length ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>
                      Si es Bot {botDone}/{botKeys.length}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm ${capDone === capKeys.length ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-transparent border-[var(--text-dim)] text-[var(--text-main)] opacity-70'}`}>
                      <i className={`bi ${capDone === capKeys.length ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>
                      Capacitación {capDone}/{capKeys.length}
                    </span>
                    {customTasks.length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm ${customDone === customTasks.length ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-transparent border-[var(--text-dim)] text-[var(--text-main)] opacity-70'}`}>
                        <i className={`bi ${customDone === customTasks.length ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>
                        Adicionales {customDone}/{customTasks.length}
                      </span>
                    )}
                    {pendingNotes > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-danger/20 border-danger/30 text-danger">
                        <i className="bi bi-chat-dots-fill mr-1"></i>
                        Notas: Sí
                      </span>
                    )}
                    <button 
                      className="btn btn-outline-light relative flex items-center justify-center gap-1 px-2 py-0.5 ml-auto h-auto rounded"
                      title="Onboarding Checklist"
                      onClick={(e) => { e.stopPropagation(); setOnboardingProjectId(project.id); }}
                    >
                      <i className="bi bi-card-checklist text-sm"></i>
                      <span className="text-[10px] font-semibold">Tareas</span>
                      {isAllDone ? (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-black dark:bg-white rounded-full border border-[var(--bg-glass)] flex items-center justify-center shadow-sm">
                          <i className="bi bi-check text-white dark:text-black text-[10px] font-bold"></i>
                        </div>
                      ) : (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-black dark:bg-white rounded-full border border-[var(--bg-glass)] flex items-center justify-center shadow-sm">
                          <i className="bi bi-exclamation text-white dark:text-black text-[10px] font-bold"></i>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={project.id}
                className="glass-card p-3 h-full assistant-card clickable anim-card-enter"
                style={{ '--si': index, borderLeft: borderLeftStyle }}
                onClick={() => setSelectedProjectId(project.id)}
              >
                {client ? (
                  <div className="text-xs text-[var(--accent)] font-semibold mb-1">
                    <i className="bi bi-person-fill mr-1"></i>Cliente: {client.nombre}
                  </div>
                ) : (
                  <div className="text-xs text-danger font-semibold mb-1">
                    <i className="bi bi-exclamation-triangle-fill mr-1"></i>Sin cliente vinculado
                  </div>
                )}
                <div className="font-bold truncate mb-2">{project.name}</div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs text-white/50">ID: {project.id.substring(0, 8)}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${workspaceBadgeClass}`}
                    title={workspaceTitle}
                  >
                    <i className="bi bi-building mr-1"></i>
                    {workspaceLabel}
                  </span>
                </div>

                <hr className="my-0.5 border-[var(--border-light)] opacity-50" />

                <div className="flex items-center gap-1.5 flex-wrap mt-0">
                  <span className="text-xs text-[var(--text-main)] font-medium">Servicios: {(project.services || []).length}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${hasUpdate ? 'bg-warning/20 text-warning border border-warning/30' : 'bg-[var(--accent)]/10 dark:bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30'}`} title={hasUpdate ? 'Hay actualizaciones disponibles' : 'Sistema actualizado'}>
                    <i className="bi bi-info-circle-fill mr-1"></i>Update
                  </span>
                  <button 
                    className="btn btn-outline-light relative flex items-center justify-center gap-1 px-2 py-0.5 ml-auto h-auto rounded"
                    title="Onboarding Checklist"
                    onClick={(e) => { e.stopPropagation(); setOnboardingProjectId(project.id); }}
                  >
                    <i className="bi bi-card-checklist text-sm"></i>
                    <span className="text-[10px] font-semibold">Tareas</span>
                    {isAllDone ? (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-black dark:bg-white rounded-full border border-[var(--bg-glass)] flex items-center justify-center shadow-sm">
                        <i className="bi bi-check text-white dark:text-black text-[10px] font-bold"></i>
                      </div>
                    ) : (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-black dark:bg-white rounded-full border border-[var(--bg-glass)] flex items-center justify-center shadow-sm">
                        <i className="bi bi-exclamation text-white dark:text-black text-[10px] font-bold"></i>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
