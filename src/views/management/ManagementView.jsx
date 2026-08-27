import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

export default function ManagementView({ supportUnreadCount = 0 }) {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const getTabClass = (pathPrefix) => {
    const isActive = currentPath.startsWith(pathPrefix);
    return `py-2 px-3 font-semibold text-xs sm:text-sm transition-colors border-b-2 focus:outline-none flex items-center gap-2 shrink-0 ${
      isActive
        ? 'border-[var(--accent)] text-[var(--text-main)] bg-[var(--accent)]/10 rounded-t'
        : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-t'
    }`;
  };

  return (
    <div className="flex flex-col w-full h-[calc(100dvh-65px)] md:h-[100dvh] overflow-hidden bg-transparent fade-in">
      {/* Pestañas (Tabs) - Solo se renderiza este componente en Desktop */}
      <div className="hidden md:flex items-end justify-center md:justify-start overflow-x-auto whitespace-nowrap flex-nowrap tabs-header-glass px-4 pt-2 gap-2 shrink-0 mt-4 md:mt-0">
        <NavLink to="/dashboard" className={getTabClass('/dashboard')}>
          <i className="bi bi-bar-chart"></i> Dashboard
        </NavLink>

        <span className="text-[var(--text-dim)] opacity-50 mb-3 font-light shrink-0">|</span>

        <NavLink to="/clientes" className={getTabClass('/clientes')}>
          <i className="bi bi-people"></i> Clientes
        </NavLink>

        <span className="text-[var(--text-dim)] opacity-50 mb-3 font-light shrink-0">|</span>

        <NavLink to="/facturacion" className={getTabClass('/facturacion')}>
          <i className="bi bi-receipt"></i> Facturación
        </NavLink>

        <span className="text-[var(--text-dim)] opacity-50 mb-3 font-light shrink-0">|</span>

        <NavLink to="/soporte" className={getTabClass('/soporte')}>
          <i className="bi bi-ticket-perforated"></i> Soporte
          {supportUnreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {supportUnreadCount}
            </span>
          )}
        </NavLink>
      </div>
      
      {/* Contenido de la pestaña activa */}
      <div className="flex-1 overflow-hidden relative flex flex-col p-2 pt-0">
        <Outlet />
      </div>
    </div>
  );
}
