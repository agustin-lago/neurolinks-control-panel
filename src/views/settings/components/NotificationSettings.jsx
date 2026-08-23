import React from 'react';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { useNotifications } from '../../../contexts/NotificationContext';

export default function NotificationSettings() {
  const [backgroundNotificationsStr, setBackgroundNotificationsStr] = useLocalStorage('desktop_notifications', 'true');
  const [showPreviewsStr, setShowPreviewsStr] = useLocalStorage('show_notification_previews', 'true');
  const [playSoundsStr, setPlaySoundsStr] = useLocalStorage('play_incoming_sounds', 'true');
  
  const backgroundNotifications = backgroundNotificationsStr !== 'false';
  const showPreviews = showPreviewsStr !== 'false';
  const playSounds = playSoundsStr !== 'false';
  
  const { notifyDesktop } = useNotifications();

  const handleToggleNotifications = async (e) => {
    const checked = e.target.checked;
    
    if (checked) {
      if (!('Notification' in window)) {
        if (window.showToast) window.showToast('Tu navegador no soporta notificaciones de escritorio', 'danger');
        return;
      }
      
      let permission = Notification.permission;
      if (permission !== 'granted') {
        try {
          permission = await Notification.requestPermission();
        } catch (err) {
          console.error("Error requesting notification permission:", err);
        }
      }
      
      if (permission === 'granted') {
        setBackgroundNotificationsStr('true');
        if (window.showToast) window.showToast('Notificaciones activadas', 'success');
      } else {
        setBackgroundNotificationsStr('false');
        if (window.showToast) window.showToast('Tu navegador bloqueó las notificaciones. Hacé click en el candadito al lado de la URL para permitirlas.', 'warning');
      }
    } else {
      setBackgroundNotificationsStr('false');
    }
  };

  const handleTestNotification = async () => {
    if (!backgroundNotifications) {
      if (window.showToast) window.showToast('Primero activá las notificaciones de mensajes', 'warning');
      return;
    }
    
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        if (window.showToast) window.showToast('Permiso denegado por el navegador', 'danger');
        return;
      }
    } else if (Notification.permission === 'denied') {
      if (window.showToast) window.showToast('Tu navegador tiene bloqueadas las notificaciones. Tocá el candado en la URL para permitirlas.', 'danger');
      return;
    }
    
    notifyDesktop('Mensaje de prueba', '¡Las notificaciones están funcionando perfectamente en Windows!');
    if (window.showToast) window.showToast('Se envió la orden al Sistema Operativo', 'success');
  };

  return (
    <div className="glass-card p-0 rounded overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-soft)] bg-black/10 flex items-center gap-3">
        <i className="bi bi-bell text-xl text-[var(--primary)]"></i>
        <h4 className="font-bold m-0 text-lg">Notificaciones</h4>
      </div>
      
      <div className="p-2">
        <div className="text-xs font-bold uppercase tracking-wider text-dim px-4 py-3">Mensajes</div>
        
        {/* Item 1 */}
        <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-card)] transition-colors rounded">
          <div>
            <div className="font-medium text-[0.95rem] mb-0.5 text-main">Notificaciones de mensajes</div>
            <div className="text-sm text-dim">
              Mostrar notificaciones para nuevos mensajes entrantes.
            </div>
          </div>
          <label className="sysconfig-toggle">
            <input
              type="checkbox"
              className="btn-ca-sysconfig"
              checked={backgroundNotifications}
              onChange={handleToggleNotifications}
            />
            <span className="sysconfig-thumb">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-off"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-on"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            </span>
          </label>
        </div>

        {/* Item 2 */}
        <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-card)] transition-colors rounded">
          <div>
            <div className="font-medium text-[0.95rem] mb-0.5 text-main">Mostrar vistas previas</div>
            <div className="text-sm text-dim">
              Mostrar el texto del mensaje dentro de la notificación de escritorio.
            </div>
          </div>
          <label className="sysconfig-toggle">
            <input
              type="checkbox"
              className="btn-ca-sysconfig"
              checked={showPreviews}
              onChange={(e) => setShowPreviewsStr(e.target.checked ? 'true' : 'false')}
            />
            <span className="sysconfig-thumb">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-off"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-on"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            </span>
          </label>
        </div>

        <div className="h-px bg-[var(--border-soft)] mx-4 my-2"></div>
        <div className="text-xs font-bold uppercase tracking-wider text-dim px-4 py-3">Sonidos de Notificación</div>

        {/* Item 3 */}
        <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-card)] transition-colors rounded">
          <div>
            <div className="font-medium text-[0.95rem] mb-0.5 text-main">Sonidos de notificaciones entrantes</div>
            <div className="text-sm text-dim">
              Reproducir sonidos para notificaciones entrantes.
            </div>
          </div>
          <label className="sysconfig-toggle">
            <input
              type="checkbox"
              className="btn-ca-sysconfig"
              checked={playSounds}
              onChange={(e) => setPlaySoundsStr(e.target.checked ? 'true' : 'false')}
            />
            <span className="sysconfig-thumb">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-off"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-on"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            </span>
          </label>
        </div>
        
        {/* Test Button */}
        <div className="px-4 py-4 mt-2">
          <button 
            className="btn w-full justify-center gap-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/30"
            onClick={handleTestNotification}
          >
            <i className="bi bi-window-desktop"></i> Enviar Notificación de Prueba al SO
          </button>
        </div>
      </div>
    </div>
  );
}
