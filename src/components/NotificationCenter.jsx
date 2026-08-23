import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationCenter({ isNotifOpen, setIsNotifOpen }) {
  const { notifications, unreadCount, markAsRead, clearAllNotifications } = useNotifications();

  return (
    <div id="notificationsCanvas" className={`offcanvas offcanvas-end ${isNotifOpen ? 'show' : ''}`} style={{ visibility: isNotifOpen ? 'visible' : 'hidden', zIndex: 1050 }}>
      <div className="offcanvas-header notif-canvas-header">
        <div className="flex items-center gap-2 grow">
          <div className="notif-header-icon">
            <i className="bi bi-bell-fill"></i>
          </div>
          <div>
            <div className="font-bold" style={{ fontSize: '0.95rem' }}>Notificaciones</div>
            <div className="notif-header-sub">
              <span>{unreadCount > 0 ? unreadCount : '0'}</span>
              <span className="notif-header-sub-label"> sin leer</span>
            </div>
          </div>
        </div>
        <button type="button" className="btn-close btn-close-white ml-1" onClick={() => setIsNotifOpen(false)}></button>
      </div>
      <div className="offcanvas-body p-0 flex flex-col" style={{ overflow: 'hidden' }}>
        <div className="flex-1 p-3 flex flex-col gap-2" style={{ overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <i className="bi bi-bell-slash notif-empty-icon"></i>
              <div>Sin notificaciones</div>
            </div>
          ) : (
            notifications.map((n, i) => {
              const icon = n.type === 'error' || n.type === 'deploy-error' ? 'bi-exclamation-triangle-fill' :
                           n.type === 'deploy' ? 'bi-arrow-repeat' :
                           n.type === 'ticket' ? 'bi-ticket-perforated-fill' :
                           n.type === 'update' ? 'bi-arrow-up-circle-fill' : 'bi-bell-fill';
              const cls = n.type === 'error' || n.type === 'deploy-error' ? 'notif-icon-error' :
                          n.type === 'ticket' ? 'notif-icon-warning' : 'notif-icon-info';
              
              const timeDiff = Math.floor((Date.now() - new Date(n.date)) / 1000);
              const relTime = timeDiff < 60 ? 'ahora' :
                              timeDiff < 3600 ? `hace ${Math.floor(timeDiff / 60)} min` :
                              timeDiff < 86400 ? `hace ${Math.floor(timeDiff / 3600)} h` :
                              new Date(n.date).toLocaleDateString();

              return (
                <div key={n.id} className={`notification-item ${n.read ? 'notif-read' : 'notif-unread'}`} onClick={() => markAsRead(n.id)}>
                  <div className="flex items-start gap-4">
                    <div className={`notif-icon-badge ${cls}`}>
                      <i className={`bi ${icon}`}></i>
                    </div>
                    <div className="grow min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-time">{relTime}</div>
                      </div>
                      <div className="notif-message">{n.message}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <div className="notif-mobile-footer p-3 border-t border-[var(--border-soft)] mt-auto" style={{ background: 'var(--bg-body)' }}>
        <button className="btn notif-footer-btn" onClick={() => markAsRead()}>
          <i className="bi bi-envelope-open mr-2"></i>Marcar como leídas
        </button>
        <button className="btn notif-footer-btn notif-footer-danger" onClick={clearAllNotifications}>
          <i className="bi bi-trash mr-2"></i>Vaciar
        </button>
      </div>
    </div>
  );
}
