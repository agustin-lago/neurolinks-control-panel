import React, { createContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { store } from '../core/store';
import { useNotifications } from './NotificationContext';

const SmartRefreshContext = createContext(null);
const emitter = new EventTarget();

/**
 * Hook para suscribirse a eventos de tiempo real.
 * Usa un ref interno para el callback, evitando re-registros en cada render.
 */
export function useSmartRefresh(eventType, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback; // Siempre actualiza sin re-suscribir

  useEffect(() => {
    if (!eventType) return;
    const handler = (e) => callbackRef.current(e.detail);
    emitter.addEventListener(eventType, handler);
    return () => emitter.removeEventListener(eventType, handler);
  }, [eventType]); // Solo se re-registra si cambia el tipo de evento
}

export function SmartRefreshProvider({ children }) {
  const { addNotification, notifyDesktop } = useNotifications();

  // Refs para acceder a las funciones sin ponerlas como deps del efecto
  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;
  const notifyDesktopRef = useRef(notifyDesktop);
  notifyDesktopRef.current = notifyDesktop;

  const socketRef = useRef(null);

  useEffect(() => {
    // Se conecta una sola vez al montar el provider
    try {
      const socket = io({
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 20000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Socket.IO] Conectado al servidor. ID:', socket.id);
      });

      socket.on('disconnect', (reason) => {
        console.log('[Socket.IO] Desconectado:', reason);
      });

      socket.on('stream_event', (data) => {
        try {
          const channel = data.channel;
          const payload = data.payload;
          if (!channel || !payload) return;

          // Dispatcher universal para todos los canales
          emitter.dispatchEvent(new CustomEvent(`stream_${channel}`, { detail: payload }));

          // 1. Logs Logic
          if (channel === 'logs' && payload.type === 'INSERT') {
            const { log } = payload;
            emitter.dispatchEvent(new CustomEvent('log_update', { detail: payload }));
            if (log && log.nivel === 'error' && log.accion !== 'ticket_reads') {
              addNotificationRef.current('error', `Error: ${log.accion || 'Error'}`, log.detalles || 'Ocurrió un error en el sistema', `sys-err-${log.id}`);
            }
          }

          // 2. Tickets Logic
          if (channel === 'tickets' && (payload.type === 'INSERT' || payload.type === 'UPDATE')) {
            console.log('[Socket] Ticket event received:', payload.type, JSON.stringify(payload).slice(0, 300));
            setTimeout(() => {
              store.invalidate('ticketsMeta');
              emitter.dispatchEvent(new CustomEvent('ticket_update', { detail: payload }));
            }, 1000);

            const tick = payload.ticket;
            if (!tick) {
              console.warn('[Socket] Ticket payload missing .ticket field:', payload);
              return;
            }

            console.log('[Socket] Ticket tipo:', tick.tipo, '| id:', tick.id);

            let clientName = 'Cliente Desconocido';
            try {
              const clientsCache = store.get('clients');
              if (clientsCache && Array.isArray(clientsCache)) {
                const c = clientsCache.find(x => String(x.id) === String(tick.cliente_id));
                if (c) clientName = c.nombre;
              }
            } catch { }

            let chats = [];
            if (tick.chats_adjuntos) {
              if (typeof tick.chats_adjuntos === 'string') {
                try { chats = JSON.parse(tick.chats_adjuntos); } catch (e) { }
              } else if (Array.isArray(tick.chats_adjuntos)) {
                chats = tick.chats_adjuntos;
              }
            }

            if (tick.tipo === 'Soporte') {
              if (payload.type === 'INSERT') {
                const title = `Nuevo Ticket: ${clientName}`;
                const msg = `Nuevo ticket de ${clientName}${tick.titulo ? `: ${tick.titulo}` : ''}`;
                console.log('[Socket] Firing ticket INSERT notification:', title);
                addNotificationRef.current('ticket', title, msg, `ticket-ins-${tick.id}`, true, { ticketId: tick.id, clienteId: tick.cliente_id });
                notifyDesktopRef.current(title, msg);
              } else if (payload.type === 'UPDATE') {
                const lastMsg = chats.length > 0 ? chats[chats.length - 1] : null;
                const hasClientMsg = lastMsg && lastMsg.rol !== 'admin';
                const totalMessages = (tick.descripcion ? 1 : 0) + chats.length;
                const unreadMessages = Math.max(0, totalMessages - (tick.read_admin_count || 0));
                const isTicketOpen = window.location.pathname.includes(`/soporte/ticket/${tick.id}`);

                if (hasClientMsg && unreadMessages > 0 && !isTicketOpen) {
                  const msgText = lastMsg.mensaje || 'Nuevo mensaje adjunto';
                  const title = `Mensaje de ${clientName}`;
                  const notifKey = `ticket-msg-${tick.id}-${chats.length}`;
                  console.log('[Socket] Firing ticket UPDATE notification:', title, '| chats:', chats.length);
                  addNotificationRef.current('ticket', title, `Ultimo mensaje: ${msgText}`, notifKey, true, { ticketId: tick.id, clienteId: tick.cliente_id });
                  notifyDesktopRef.current(title, msgText);
                }
              }
            } else {
              console.log('[Socket] Ticket tipo no es Soporte, ignorando notificacion');
            }
          }

          // 3. Shared store invalidation
          if (channel === 'clients' && (payload.type === 'INSERT' || payload.type === 'UPDATE' || payload.type === 'DELETE')) {
            store.invalidate('clients', 'ticketsMeta');
            emitter.dispatchEvent(new CustomEvent('client_update', { detail: payload }));
          }

          if (channel === 'project_links' && (payload.type === 'INSERT' || payload.type === 'UPDATE' || payload.type === 'DELETE')) {
            store.invalidate('clients', 'assistants', 'ticketsMeta');
            emitter.dispatchEvent(new CustomEvent('client_project_update', { detail: payload }));
          }

          if (channel === 'settings' && (payload.type === 'INSERT' || payload.type === 'UPDATE' || payload.type === 'DELETE')) {
            store.invalidate('clients');
            emitter.dispatchEvent(new CustomEvent('settings_update', { detail: payload }));
          }

          if (channel === 'sessions' || channel === 'meta' || channel === 'project_onboarding') {
            emitter.dispatchEvent(new CustomEvent('project_data_update', { detail: { channel, payload } }));
          }
        } catch (e) {
          console.error('Error parsing Socket.IO payload:', e);
        }
      });

      socket.on('connect_error', (err) => {
        console.warn('Socket.IO connection error:', err.message);
      });

      const refreshTimer = window.setInterval(() => {
        store.fetchAssistants().catch(() => {});
        store.fetchClients().catch(() => {});
        store.fetchTicketsMeta().catch(() => {});
      }, 15000);

      socketRef.currentRefreshTimer = refreshTimer;

    } catch (e) {
      console.error('Global Socket.IO initialization error:', e);
    }

    return () => {
      if (socketRef.currentRefreshTimer) {
        window.clearInterval(socketRef.currentRefreshTimer);
        socketRef.currentRefreshTimer = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Sin dependencias: conecta UNA SOLA VEZ al montar

  return (
    <SmartRefreshContext.Provider value={{}}>
      {children}
    </SmartRefreshContext.Provider>
  );
}
