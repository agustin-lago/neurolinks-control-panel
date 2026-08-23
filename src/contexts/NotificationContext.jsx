import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useLocalStorage('app_notifications', []);
  const notificationMemory = useRef(new Map());

  const notifyDesktop = useCallback((title, body) => {
    if (localStorage.getItem('desktop_notifications') === 'false') return;
    if (!('Notification' in window)) return;
    
    // Read user settings
    const showPreviews = localStorage.getItem('show_notification_previews') !== 'false';
    const playSounds = localStorage.getItem('play_incoming_sounds') !== 'false';
    
    const notifBody = showPreviews ? body : 'Nuevo mensaje recibido';
    const notifSilent = !playSounds; // if playSounds is false, silent is true

    if (Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(registration => {
            console.log('[OS Notif] Despachando via ServiceWorker:', title);
            registration.showNotification(title, {
              body: notifBody,
              icon: '/assets/icons/android-chrome-192x192.png',
              tag: `notif-ticket`, // Static tag so it groups them
              renotify: true, // Forces sound/banner even if tag exists
              requireInteraction: false,
              silent: notifSilent
            });
          }).catch(e => {
            console.log('[OS Notif] Fallo ServiceWorker, intentando API normal:', e);
            const notif = new Notification(title, { body: notifBody, icon: '/assets/icons/android-chrome-192x192.png', silent: notifSilent });
            notif.onclick = () => { window.focus(); notif.close(); };
          });
        } else {
          console.log('[OS Notif] ServiceWorker no detectado, usando API normal');
          const notif = new Notification(title, { body: notifBody, icon: '/assets/icons/android-chrome-192x192.png', silent: notifSilent });
          notif.onclick = () => { window.focus(); notif.close(); };
        }
      } catch (e) {
        console.error('Error lanzando notificacion de escritorio:', e);
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const addNotification = useCallback((type, title, message, key = null, showToast = true, meta = null) => {
    const notifKey = key || `${type}-${message}`;
    const now = Date.now();

    // Deduplication check (TTL 60s) for EXACT same message
    if (notificationMemory.current.has(notifKey)) {
      if (now - notificationMemory.current.get(notifKey) < 60000) {
        setNotifications(prev => {
          const idx = prev.findIndex(n => n.key === notifKey);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], title, message, meta, date: new Date(), read: false };
            return updated;
          }
          return prev;
        });
        
        if (showToast && window.showToast) {
          const toastType = type === 'deploy-error' || type === 'error' ? 'danger' : (type === 'warning' ? 'warning' : 'info');
          window.showToast(message, toastType, 5000, notifKey, title);
        }
        return;
      }
    }
    notificationMemory.current.set(notifKey, now);

    const newNotif = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      date: new Date(),
      read: false,
      key: notifKey,
      meta
    };

    setNotifications(prev => {
      const existingIdx = prev.findIndex(n => n.key === notifKey);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...newNotif, id: updated[existingIdx].id };
        return updated;
      }
      const updated = [newNotif, ...prev];
      return updated.slice(0, 50); // limit to 50
    });

    if (showToast && window.showToast) {
      const toastType = type === 'deploy-error' || type === 'error' ? 'danger' : (type === 'warning' ? 'warning' : 'info');
      window.showToast(message, toastType, 5000, notifKey, title);
    }
  }, []);

  const markAsRead = useCallback((id = null) => {
    if (id) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }, []);

  const markTicketNotificationsAsRead = useCallback((ticketId) => {
    if (!ticketId) return;
    const ticketIdStr = String(ticketId);
    setNotifications(prev => prev.map(n => {
      const matchesMeta = String(n.meta?.ticketId || '') === ticketIdStr;
      const matchesLegacyKey = n.type === 'ticket' && (
        n.key === 'ticket-ins-' + ticketIdStr ||
        String(n.key || '').startsWith('ticket-msg-' + ticketIdStr + '-')
      );
      return matchesMeta || matchesLegacyKey ? { ...n, read: true } : n;
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      notifyDesktop,
      markAsRead,
      markTicketNotificationsAsRead,
      clearAllNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
}
