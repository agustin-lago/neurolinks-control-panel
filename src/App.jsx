import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { api } from './core/api';
import { store, useStoreKey } from './core/store';
import useLocalStorage from './hooks/useLocalStorage';
import DashboardView from './views/dashboard/DashboardView';
import ProjectsView from './views/projects/ProjectsView';
import AuditView from './views/audit/AuditView';
import ClientsView from './views/clients/ClientsView';
import BillingView from './views/billing/BillingView';
import SettingsView from './views/settings/SettingsView';
import ActivityView from './views/activity/ActivityView';
import TicketsView from './views/tickets/TicketsView';
import DeployProject from './views/deploy/DeployProject';
import ManagementView from './views/management/ManagementView';
import LogsView from './views/logs/LogsView';
import SupabaseView from './views/supabase/SupabaseView';
import ChatsView from './views/supabase/chats/ChatsView';
import MetaOnboardingView from './views/supabase/meta_onboarding/MetaOnboardingView';
import WhatsappSessionsView from './views/supabase/whatsapp_sessions/WhatsappSessionsView';
import RailwayView from './views/railway/RailwayView';
import ToastAlert from './components/ToastAlert';
import { useNotifications } from './contexts/NotificationContext';
import NotificationCenter from './components/NotificationCenter';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extraemos la primera parte de la ruta para los estilos activos (ej. /proyectos -> proyectos)
  const view = location.pathname.split('/')[1] || 'dashboard';

  const [theme, setTheme] = useLocalStorage('theme', 'dark');
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [actionSpinner, setActionSpinner] = useState(null);
  const [pendingAppUpdate, setPendingAppUpdate] = useState(false);

  const { unreadCount, addNotification, notifyDesktop } = useNotifications();
  const ticketsMetaData = useStoreKey('ticketsMeta', () => store.fetchTicketsMeta());

  let totalUnreadTickets = 0;
  let hasTicketsBadge = false;
  if (ticketsMetaData) {
    hasTicketsBadge = ticketsMetaData.some(t => t.estado !== 'Cerrado');
    ticketsMetaData.forEach(t => {
      let chats = [];
      if (t.chats_adjuntos) {
        try { chats = typeof t.chats_adjuntos === 'string' ? JSON.parse(t.chats_adjuntos) : t.chats_adjuntos; } catch (e) { }
      }
      const total = (t.descripcion ? 1 : 0) + chats.length;
      totalUnreadTickets += Math.max(0, total - (t.read_admin_count || 0));
    });
  }

  const canvasRef = useRef(null);

  // Solicitar permiso de notificaciones al iniciar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, []);

  const legacyNavigate = (path) => {
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    navigate(`/${cleanPath}`);
    setIsMobileSidebarOpen(false);
  };

  // Expose routing globally so legacy code can call it
  useEffect(() => {
    window.navigate = legacyNavigate;
    window.openDeployModal = () => {
      navigate('/deploy');
      setIsMobileSidebarOpen(false);
    };
    document.body.classList.remove('app-preload');
  }, [navigate]);

  // Expose action spinner control globally
  useEffect(() => {
    let spinnerCount = 0;
    window.showActionSpinner = (text = "Sincronizando con Railway...") => {
      spinnerCount++;
      setActionSpinner({ text });
    };
    window.hideActionSpinner = () => {
      spinnerCount = Math.max(0, spinnerCount - 1);
      if (spinnerCount === 0) {
        setActionSpinner(null);
      }
    };
    return () => {
      window.showActionSpinner = null;
      window.hideActionSpinner = null;
    };
  }, []);

  // Theme synchronization
  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Expose showToast globally
  useEffect(() => {
    window._toastTimeouts = window._toastTimeouts || new Map();
    
    window.showToast = (message, type = 'success', duration = 5000, id = null, title = null) => {
      const toastId = id || crypto.randomUUID();
      
      setToasts(prev => {
        const existing = prev.find(t => t.id === toastId);
        if (existing) {
          return prev.map(t => t.id === toastId ? { ...t, message, type, title } : t);
        }
        return [...prev, { id: toastId, message, type, title }];
      });

      // Clear previous timeout for this toast if exists
      if (window._toastTimeouts.has(toastId)) {
        clearTimeout(window._toastTimeouts.get(toastId));
      }
      
      const timeout = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
        window._toastTimeouts.delete(toastId);
      }, duration);
      
      window._toastTimeouts.set(toastId, timeout);
    };
  }, []);

  // Fetch current user
  useEffect(() => {
    api.getCurrentUser()
      .then(data => {
        if (data && data.username) {
          const name = data.username.trim();
          const parts = name.split(/\s+/).filter(Boolean);
          let initials = '';
          if (parts.length > 0) {
            initials += parts[0][0];
            if (parts.length > 1) initials += parts[1][0];
          } else {
            initials = name.slice(0, 2);
          }
          setUser({
            username: displayName(parts),
            initials: initials.toUpperCase()
          });
        }
      })
      .catch(err => console.error('[Avatar] Error loading user:', err));

    function displayName(parts) {
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    }
  }, []);

  // Detecta deploys nuevos y ofrece recargar sin interrumpir la sesion actual.
  useEffect(() => {
    let baselineBuildId = null;
    let stopped = false;

    const resolveBuildId = (info) => info?.buildId || info?.deploymentId || info?.gitSha || info?.version || null;

    const checkVersion = async () => {
      try {
        const info = await api.getAppVersion();
        const buildId = resolveBuildId(info);
        if (!buildId || stopped) return;
        if (!baselineBuildId) {
          baselineBuildId = buildId;
          return;
        }
        if (buildId !== baselineBuildId) {
          setPendingAppUpdate(true);
        }
      } catch (err) {
        console.warn('[AppVersion] No se pudo verificar version:', err.message);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };

    checkVersion();
    const intervalId = window.setInterval(checkVersion, 60_000);
    window.addEventListener('focus', checkVersion);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkVersion);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Particle background animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const PARTICLE_COUNT = 130, MAX_DISTANCE = 160, SPEED = 0.45;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      size: Math.random() * 1.8 + 0.8,
    }));

    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_DISTANCE) continue;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,153,255,${(1 - dist / MAX_DISTANCE) * 0.22})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(72,202,228,0.45)';
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, []);

  // El renderizado de vistas ahora se delega a las <Routes> de React Router
  const activeRoutes = (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {/* Rutas principales de Gestión envueltas en ManagementView */}
      <Route element={<ManagementView navigate={legacyNavigate} supportUnreadCount={totalUnreadTickets} />}>
        <Route path="/dashboard" element={<DashboardView navigate={legacyNavigate} />} />
        <Route path="/proyectos/*" element={<ProjectsView isTab={true} navigate={legacyNavigate} />} />
        <Route path="/clientes/*" element={<ClientsView isTab={true} navigate={legacyNavigate} />} />
        <Route path="/facturacion/*" element={<BillingView isTab={true} navigate={legacyNavigate} />} />
        <Route path="/soporte/*" element={<TicketsView isTab={true} navigate={legacyNavigate} />} />
      </Route>
      
      <Route path="/activity" element={<ActivityView navigate={legacyNavigate} />} />
      <Route path="/audit" element={<AuditView navigate={legacyNavigate} />} />
      <Route path="/logs" element={<LogsView navigate={legacyNavigate} />} />
      <Route path="/supabase" element={<SupabaseView navigate={legacyNavigate} />} />
      <Route path="/railway" element={<RailwayView navigate={legacyNavigate} />} />
      <Route path="/deploy" element={<DeployProject navigate={legacyNavigate} />} />
      <Route path="/meta_onboarding" element={<MetaOnboardingView navigate={legacyNavigate} />} />
      <Route path="/whatsapp_sessions" element={<WhatsappSessionsView navigate={legacyNavigate} />} />
      <Route path="/settings" element={<SettingsView navigate={legacyNavigate} theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );

  return (
    <>
      {/* Particle background */}
      <canvas ref={canvasRef} id="neural-bg" aria-hidden="true" style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.16
      }} />

      {/* TOPBAR (Mobile/Tablet) */}
      <div className="topbar-mobile" id="topbar-mobile" style={{ zIndex: 1060 }}>
        <button className="btn btn-sidebar-toggle" onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}>
          <i className={isMobileSidebarOpen ? "bi bi-x-lg" : "bi bi-list"}></i>
        </button>
        <div className="topbar-brand">
          <span className="topbar-brand-name">Neurolinks Control</span>
        </div>
        <button className="btn btn-topbar-notif" onClick={() => setIsNotifOpen(!isNotifOpen)} style={{ position: 'relative' }}>
          <i className="bi bi-bell"></i>
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: '#ef4444', color: 'white', borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.65rem', width: '16px', height: '16px', zIndex: 10 }}>{unreadCount}</span>
          )}
        </button>
      </div>

      {/* BACKDROPS */}
      {isMobileSidebarOpen && <div className="offcanvas-backdrop fade show" onClick={() => setIsMobileSidebarOpen(false)} style={{ zIndex: 1040 }}></div>}
      {isNotifOpen && <div className="offcanvas-backdrop fade show" onClick={() => setIsNotifOpen(false)} style={{ zIndex: 1040 }}></div>}

      {/* SIDEBAR OFFCANVAS (Mobile/Tablet) */}
      <div className={`offcanvas offcanvas-start sidebar-offcanvas ${isMobileSidebarOpen ? 'show' : ''}`} tabIndex="-1" style={{ visibility: isMobileSidebarOpen ? 'visible' : 'hidden', zIndex: 1050, paddingTop: '65px' }}>
        <div className="offcanvas-body flex flex-col">
          {user && (
            <div className="flex items-center justify-between px-3 py-2 mb-3" style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: '12px' }}>
              <div className="flex items-center gap-3">
                <div className="sidebar-user-avatar" style={{ margin: 0, width: '34px', height: '34px', fontSize: '0.8rem' }}>
                  <span>{user.initials}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{user.username}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Administrador</div>
                </div>
              </div>
              <button 
                onClick={() => navigate('settings')} 
                className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors p-1 flex items-center justify-center bg-transparent border-none"
                title="Configuración"
              >
                <i className="bi bi-gear text-lg"></i>
              </button>
            </div>
          )}

          <div className="offcanvas-nav flex flex-col gap-1">
            <div className="offcanvas-section-label">NAVEGACIÓN</div>
            <div className={`sidebar-item ${['dashboard', 'management', 'projects', 'clients', 'billing', 'tickets', 'ticket-chat', 'proyectos', 'variables', 'deploy', 'clientes', 'facturacion', 'soporte'].includes(view) ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
              <i className="bi bi-briefcase"></i><span>Gestión</span>
              {totalUnreadTickets > 0 && <span aria-label="Tickets sin leer" title="Tickets sin leer" style={{ marginLeft: 'auto', width: '9px', height: '9px', backgroundColor: '#ef4444', borderRadius: '999px', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.18)' }} />}
            </div>
            <div className={`sidebar-item ${view === 'audit' ? 'active' : ''}`} onClick={() => navigate('audit')}>
              <i className="bi bi-shield-check"></i><span>Auditoría</span>
            </div>
            <div className={`sidebar-item ${view === 'logs' ? 'active' : ''}`} onClick={() => navigate('logs')}>
              <i className="bi bi-terminal"></i><span>Logs del Sistema</span>
            </div>

            <div className="sidebar-item" data-bs-toggle="collapse" data-bs-target="#supabaseCollapse" aria-expanded="false" style={{ justifyContent: 'flex-start' }}>
              <i className="bi bi-database"></i><span>Supabase</span>
              <i className="bi bi-chevron-down text-[0.7rem] ml-auto transition-transform"></i>
            </div>
            <div className="collapse" id="supabaseCollapse">
              <div className="flex flex-col gap-1 mt-1 pl-4">
                <div className={`sidebar-item ${view === 'chats' ? 'active' : ''}`} onClick={() => navigate('chats')}>
                  <i className="bi bi-chat-dots"></i><span>Chats</span>
                </div>
                <div className={`sidebar-item ${view === 'meta_onboarding' ? 'active' : ''}`} onClick={() => navigate('meta_onboarding')}>
                  <i className="bi bi-meta"></i><span>Meta Onboarding</span>
                </div>
                <div className={`sidebar-item ${view === 'whatsapp_sessions' ? 'active' : ''}`} onClick={() => navigate('whatsapp_sessions')}>
                  <i className="bi bi-whatsapp"></i><span>WhatsApp Sessions</span>
                </div>
              </div>
            </div>

            <div className={`sidebar-item ${['railway'].includes(view) ? 'active' : ''}`} onClick={() => navigate('railway')}>
              <i className="bi bi-train-front"></i><span>Railway</span>
            </div>
          </div>

          <div className="grow"></div>

          <div className="offcanvas-nav offcanvas-nav-bottom flex flex-col gap-1">
            <div className="sidebar-item" onClick={() => document.getElementById('logout-form').submit()}>
              <i className="bi bi-box-arrow-right"></i><span>Cerrar sesión</span>
            </div>
          </div>
        </div>
      </div>

      {/* SIDEBAR (Desktop) */}
      <div className="sidebar">
        <div className="sidebar-menu">
          <div className={`sidebar-item ${['dashboard', 'management', 'projects', 'clients', 'billing', 'tickets', 'ticket-chat', 'proyectos', 'variables', 'deploy', 'clientes', 'facturacion', 'soporte'].includes(view) ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
            <i className="bi bi-briefcase"></i>
            <span className="sidebar-item-text">Gestión</span>
            {totalUnreadTickets > 0 && <span aria-label="Tickets sin leer" title="Tickets sin leer" className="sidebar-badge-dot" />}
          </div>
          <div className={`sidebar-item ${['activity', 'audit', 'logs'].includes(view) ? 'active' : ''}`} onClick={() => navigate('activity')}>
            <i className="bi bi-activity"></i>
            <span className="sidebar-item-text">Actividad</span>
          </div>
          <div className={`sidebar-item ${['supabase', 'chats'].includes(view) ? 'active' : ''}`} onClick={() => navigate('supabase')}>
            <i className="bi bi-database"></i>
            <span className="sidebar-item-text">Supabase</span>
          </div>
          <div className={`sidebar-item ${['railway'].includes(view) ? 'active' : ''}`} onClick={() => navigate('railway')}>
            <i className="bi bi-train-front"></i>
            <span className="sidebar-item-text">Railway</span>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-item" onClick={() => setIsNotifOpen(true)} style={{ position: 'relative' }}>
            <i className="bi bi-bell"></i>
            <span className="sidebar-item-text">Notificaciones</span>
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: '#ef4444', color: 'white', borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.65rem', width: '16px', height: '16px', zIndex: 10 }}>{unreadCount}</span>
            )}
          </div>
          {user && (
            <div
              className="sidebar-user-avatar cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('settings')}
              title={`Conectado: ${user.username} - Ir a Configuración`}
            >
              <span>{user.initials}</span>
            </div>
          )}
          <div className="sidebar-item" onClick={() => document.getElementById('logout-form').submit()}>
            <i className="bi bi-box-arrow-right"></i>
            <span className="sidebar-item-text">Cerrar Sesión</span>
          </div>
          <form id="logout-form" action="/logout" method="POST" style={{ display: 'none' }}></form>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-wrapper">
        <div className="main-content bg-[var(--accent)]/10">
          <div className={`grow flex flex-col ${['soporte', 'proyectos', 'clientes', 'facturacion', 'deploy', 'activity', 'management', 'supabase', 'chats', 'variables', 'dashboard', 'railway'].includes(view) ? 'p-0 overflow-hidden' : 'p-6 overflow-auto'}`}>
            {activeRoutes}
          </div>
        </div>
      </div>

      {pendingAppUpdate && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            maxWidth: 'min(92vw, 440px)',
            padding: '0.8rem 0.9rem',
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            boxShadow: '0 18px 45px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
            <i className="bi bi-arrow-clockwise" style={{ color: 'var(--accent)', fontSize: '1.2rem', flexShrink: 0 }}></i>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', lineHeight: 1.1 }}>Actualizacion pendiente</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', lineHeight: 1.25 }}>Hay una nueva version disponible.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              border: '1px solid rgba(16,185,129,0.45)',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      )}

      {/* TOAST CONTAINER */}
      <div className="toast-container fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4" style={{ zIndex: 99999 }}>
        {toasts.map(t => (
          <ToastAlert
            key={t.id}
            type={t.type}
            title={t.title}
            message={t.message}
            theme={theme}
            onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          />
        ))}
      </div>

      <NotificationCenter isNotifOpen={isNotifOpen} setIsNotifOpen={setIsNotifOpen} />

      {actionSpinner && (
        <div id="action-spinner" style={{
          position: 'fixed',
          bottom: '5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          background: 'rgba(18,18,28,0.93)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '2rem',
          padding: '0.42rem 1.1rem',
          fontSize: '0.8rem',
          zIndex: '10001',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          color: '#d0d0e0',
          whiteSpace: 'nowrap',
        }}>
          <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true"
            style={{ width: '0.9rem', height: '0.9rem', borderWidth: '2px', flexShrink: 0 }}></div>
          <span id="action-spinner-label">{actionSpinner.text}</span>
        </div>
      )}
    </>
  );
}
