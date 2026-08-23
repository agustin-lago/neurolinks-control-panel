import React, { useState } from 'react';
import Skeleton from '../../../components/Skeleton';

const linkify = (text) => {
  if (!text) return { __html: '' };
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
  const html = text.replace(/\n/g, '<br>').replace(urlRegex, function(url) {
      let href = url;
      if (!href.toLowerCase().startsWith('http')) {
          href = 'https://' + href;
      }
      return `<a href="${href}" target="_blank" style="color: inherit; text-decoration: underline;">${url}</a>`;
  });
  return { __html: html };
};

export default function TicketChat({
  selectedTicketId,
  loadingChat,
  activeTicket,
  handleBackToList,
  navigate,
  handleStatusChange,
  inputText,
  setInputText,
  handleSend,
  sending,
  messagesEndRef,
  textareaRef
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const EMOJI_LIST = [
      '😀','😂','🥰','😎','😭','🙏','👍','👏','🔥','✨','🎉','❤️',
      '🤔','👀','🙌','💡','✅','❌','⚠️','👋','🚀','💪','💯','😊'
  ];

  const handleEmojiSelect = (emoji) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = inputText;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setInputText(newText);
    setShowEmojiPicker(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(start + emoji.length, start + emoji.length);
        textareaRef.current.focus();
      }
    }, 0);
  };

  if (!selectedTicketId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-dim h-full relative">
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>
        <i className="bi bi-whatsapp fs-1 mb-3 opacity-50"></i>
        <div className="text-lg">Soporte y Tickets</div>
        <div className="text-sm mt-1">Selecciona un chat para ver la conversación</div>
      </div>
    );
  }

  if (loadingChat || !activeTicket) {
    return (
      <div className="flex-1 flex flex-col p-4 md:px-8 gap-4 justify-end h-full">
        <Skeleton variant="chat-bubble" />
        <Skeleton variant="chat-bubble" className="self-end opacity-80" />
        <Skeleton variant="chat-bubble" className="opacity-60" />
        <Skeleton variant="chat-bubble" className="self-end opacity-40" />
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none -z-10"></div>

      {/* CHAT HEADER */}
      <div className="glass-header px-3 py-2 z-10 shadow-sm border-b border-[var(--border-soft)] flex justify-between items-center min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="btn btn-outline-secondary btn-sm md:hidden shrink-0"
            onClick={handleBackToList}
            style={{ width: '28px', height: '28px', padding: 0 }}
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <div className="min-w-0 flex-1">
            <div 
              className="text-[10px] text-dim opacity-60 hover:opacity-100 cursor-pointer font-mono uppercase tracking-wider leading-none mb-1 transition-opacity truncate"
              onClick={(e) => {
                e.stopPropagation();
                if (activeTicket.project_id) {
                  navigator.clipboard.writeText(activeTicket.project_id);
                  if (window.showToast) window.showToast('Project ID copiado', 'success');
                }
              }}
              title={activeTicket.project_id ? "Copiar Project ID al portapapeles" : "No hay proyecto vinculado"}
            >
              {activeTicket.project_id ? `PRJ: ${activeTicket.project_id}` : 'SIN PROYECTO'}
            </div>
            <div
              className="text-sm font-bold truncate leading-none cursor-pointer hover:opacity-75 transition-opacity hover:underline"
              onClick={() => {
                if (activeTicket?.cliente_id) {
                  window.localStorage.setItem('selectedClientId', activeTicket.cliente_id);
                  window.dispatchEvent(new CustomEvent('local-storage-sync', { detail: { key: 'selectedClientId', newValue: activeTicket.cliente_id } }));
                  navigate(`clientes/${activeTicket.cliente_id}`);
                }
              }}
              title="Ver perfil del cliente"
            >
              {activeTicket.clientes?.nombre || 'Cliente'}
            </div>
            <div className="text-xs text-dim truncate mt-1">{activeTicket.titulo}</div>
          </div>
        </div>

        <div className="flex flex-col items-end justify-center gap-1 shrink-0 ml-2">
          <div className="text-[10px] text-dim opacity-60 font-mono uppercase tracking-wider leading-none">#{activeTicket.id.substring(0, 6)}</div>
          <select
            className="status-select border rounded uppercase cursor-pointer outline-none"
            style={{
              height: '24px',
              padding: '0 14px 0 6px',
              fontSize: '11px',
              backgroundColor: activeTicket.estado === 'Abierto' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              color: activeTicket.estado === 'Abierto' ? '#eab308' : '#22c55e',
              borderColor: activeTicket.estado === 'Abierto' ? 'rgba(234, 179, 8, 0.5)' : 'rgba(34, 197, 94, 0.5)'
            }}
            value={activeTicket.estado}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="Abierto" style={{ fontSize: '11px', fontWeight: 'normal' }} className="bg-dark text-white">Abierto</option>
            <option value="Cerrado" style={{ fontSize: '11px', fontWeight: 'normal' }} className="bg-dark text-white">Cerrado</option>
          </select>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 md:px-8 flex flex-col gap-3 z-0">
        {activeTicket.descripcion && (
          <div className="wa-chat-msg cliente mt-2">
            <span dangerouslySetInnerHTML={linkify(activeTicket.descripcion)}></span>
            <span className="wa-chat-time">Ticket inicial</span>
          </div>
        )}

        {(() => {
          let chats = [];
          try { chats = typeof activeTicket.chats_adjuntos === 'string' ? JSON.parse(activeTicket.chats_adjuntos) : (activeTicket.chats_adjuntos || []); } catch (e) { }
          return chats.map((msg, index) => {
            const isMe = msg.rol === 'admin';
            const timeString = new Date(msg.timestamp || msg.fecha || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={index} className={`wa-chat-msg ${isMe ? 'admin' : 'cliente'}`}>
                {msg.mensaje && <span dangerouslySetInnerHTML={linkify(msg.mensaje)}></span>}
                <span className="wa-chat-time">{timeString}</span>
              </div>
            );
          });
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT BAR */}
      <form
        onSubmit={handleSend}
        className="px-4 py-3 flex gap-3 items-center border-t border-[var(--border-soft)] z-10 relative"
        style={{ background: 'var(--bg-card)' }}
      >
        <button
          type="button"
          className="btn btn-link text-dim hover:text-primary p-0 flex items-center justify-center shrink-0"
          style={{ width: '32px', height: '32px' }}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={activeTicket.estado === 'Cerrado' || sending}
        >
          <i className="bi bi-emoji-smile fs-5"></i>
        </button>

        {showEmojiPicker && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowEmojiPicker(false)}
            ></div>
            <div 
              className="absolute bottom-full left-4 mb-2 z-50 p-2 rounded-lg border border-[var(--border-soft)] flex flex-wrap gap-1 shadow-xl bg-white dark:bg-slate-900"
              style={{ width: '260px' }}
            >
              {EMOJI_LIST.map(emoji => (
                <div 
                  key={emoji}
                  className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded p-1 text-lg transition-colors"
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </div>
              ))}
            </div>
          </>
        )}

        <textarea
          ref={textareaRef}
          className="form-control text-main"
          placeholder={activeTicket.estado === 'Cerrado' ? 'Conversación finalizada' : 'Escribe un mensaje...'}
          disabled={activeTicket.estado === 'Cerrado' || sending}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          style={{
            maxHeight: '132px', // ~5 lines
            minHeight: '42px',
            resize: 'none',
            overflowY: 'auto'
          }}
          rows={1}
        />
        <button
          type="submit"
          className="btn btn-primary rounded-circle flex items-center justify-center shrink-0"
          disabled={activeTicket.estado === 'Cerrado' || sending || !inputText.trim()}
          style={{ width: '42px', height: '42px', padding: 0 }}
        >
          {sending ? <span className="spinner-border spinner-border-sm text-white"></span> : <i className="bi bi-send-fill fs-5" style={{ marginLeft: '-2px' }}></i>}
        </button>
      </form>
    </>
  );
}
