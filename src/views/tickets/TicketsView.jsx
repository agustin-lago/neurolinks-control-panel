import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../core/api';
import { useSmartRefresh } from '../../contexts/SmartRefreshContext';
import { useParams, useNavigate } from 'react-router-dom';
import TicketsSidebarList from './components/TicketsSidebarList';
import TicketChat from './components/TicketChat';
import { confirmAlert } from '../../components/SweetAlert';
import { useNotifications } from '../../contexts/NotificationContext';

export default function TicketsView({ navigate, isTab }) {
  const { markTicketNotificationsAsRead } = useNotifications();

  // List State
  const [tickets, setTickets] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Selected Chat State
  const { '*': currentPath } = useParams();
  const selectedTicketId = currentPath && currentPath.startsWith('ticket/') ? currentPath.split('/')[1] : null;
  const navigateRouter = useNavigate();

  const setSelectedTicketId = (id) => {
    if (id) {
      navigateRouter(`/soporte/ticket/${id}`);
    } else {
      navigateRouter(`/soporte`);
    }
  };
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);


  // Fetch List
  const fetchTicketsList = async () => {
    setLoadingList(true);
    try {
      const res = await api.getTickets({ limit: 1000 }) || {};
      let list = res.data || [];
      list.sort((a, b) => {
        if (a.estado === 'Abierto' && b.estado !== 'Abierto') return -1;
        if (a.estado !== 'Abierto' && b.estado === 'Abierto') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setTickets(list);
    } catch (err) {
      console.error('[TicketsView] Error loading tickets:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch Chat
  const fetchActiveTicketDetails = async (shouldScroll = true) => {
    if (!selectedTicketId) return;
    try {
      const tick = await api.getTicketById(selectedTicketId);
      if (tick) {
        setActiveTicket(tick);
        markTicketNotificationsAsRead(tick.id);

        let chats = [];
        try { chats = typeof tick.chats_adjuntos === 'string' ? JSON.parse(tick.chats_adjuntos) : (tick.chats_adjuntos || []); } catch (e) { }

        const totalMsgCount = (tick.descripcion ? 1 : 0) + chats.length;
        const currentReadCount = tick.read_admin_count || 0;
        if (totalMsgCount > currentReadCount) {
          await api.updateTicket(tick.id, { read_admin_count: totalMsgCount }).catch(() => { });
        }

        if (shouldScroll) setTimeout(scrollToBottom, 60);
      } else {
        setSelectedTicketId(null);
        setActiveTicket(null);
      }
    } catch (err) {
      console.error('[TicketsView] Error loading chat:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Initial loads and Globals
  useEffect(() => {
    fetchTicketsList();
  }, []);

  useSmartRefresh('ticket_update', () => {
    fetchTicketsList();
    if (selectedTicketId) {
      fetchActiveTicketDetails(true);
    }
  });

  useEffect(() => {
    if (selectedTicketId) {
      setLoadingChat(true);
      fetchActiveTicketDetails(true);
    } else {
      setActiveTicket(null);
    }

    const interval = setInterval(() => {
      if (selectedTicketId) fetchActiveTicketDetails(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedTicketId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputText]);

  // Actions
  const handleSelectTicket = (id) => {
    setSelectedTicketId(id);
  };

  const handleBackToList = () => {
    navigateRouter(-1);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !activeTicket || activeTicket.estado === 'Cerrado') return;

    setSending(true);
    try {
      await api.addTicketMessage(activeTicket.id, { rol: 'admin', mensaje: text });
      setInputText('');
      await fetchActiveTicketDetails(true);
      fetchTicketsList();
    } catch (err) {
      window.showToast('Error al enviar el mensaje', 'danger');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!activeTicket) return;
    try {
      if (newStatus === 'Cerrado') {
        await api.addTicketMessage(activeTicket.id, {
          rol: 'admin',
          mensaje: 'Este ticket se dio por concluido por el personal de soporte. Muchas gracias!'
        });
      }
      await api.updateTicket(activeTicket.id, { estado: newStatus });
      window.showToast('Estado actualizado', 'success');
      fetchActiveTicketDetails(true);
      fetchTicketsList();
    } catch (err) {
      window.showToast('Error al cambiar estado', 'danger');
    }
  };



  const handleDeleteTicket = async (id) => {
    if (!(await confirmAlert('¿Seguro que querés eliminar este ticket?', 'Eliminar Ticket', 'Eliminar', 'Cancelar'))) return;
    try {
      await api.deleteTicket(id);
      window.showToast('Ticket eliminado', 'warning');
      if (selectedTicketId === id) setSelectedTicketId(null);
      fetchTicketsList();
    } catch (err) {
      window.showToast('Error al eliminar ticket', 'danger');
    }
  };

  const filteredList = tickets.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (t.titulo?.toLowerCase().includes(s) || 
            t.clientes?.nombre?.toLowerCase().includes(s) || 
            t.chat_id?.toLowerCase().includes(s));
  });

  const totalUnreadInView = tickets.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  return (
    <>
      <style>{`
        .wa-chat-msg { max-width: 85%; padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.95rem; position: relative; line-height: 1.5; word-wrap: break-word; transition: var(--transition-fast); }
        .wa-chat-msg.admin { background: var(--accent); color: white; align-self: flex-end; border-bottom-right-radius: 4px; box-shadow: 0 4px 12px rgba(0, 120, 212, 0.2); }
        .wa-chat-msg.cliente { background: var(--bg-card); border: 1px solid var(--border-soft); color: var(--text-main); align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: var(--glass-shadow); }
        .wa-chat-time { font-size: 0.7rem; color: var(--text-dim); margin-top: 6px; display: block; text-align: right; }
        .wa-chat-msg.admin .wa-chat-time { color: rgba(255, 255, 255, 0.7); }
        
        .chat-card {
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 1px solid var(--border-soft);
        }
        .chat-card:hover {
          filter: brightness(1.2);
        }
        .tickets-split-container {
          min-height: 400px;
        }

        .status-select {
            font-size: 9px !important;
            font-weight: 800 !important;
            line-height: 1 !important;
        }

        .tchat-label-container { 
            display: flex; align-items: center; gap: 0.75rem; margin: 0; cursor: pointer;
            background: rgba(128, 128, 128, 0.08);
            border: 1px solid var(--border-soft);
            padding: 4px 6px 4px 14px;
            border-radius: 8px;
        }
      `}</style>
      <div className={`animate-fade flex flex-col w-full bg-transparent overflow-hidden ${isTab ? 'h-full pt-4' : 'h-[calc(100dvh-65px)] md:h-[100dvh]'}`}>
        {/* SPLIT PANE CONTAINER */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* COLUMNA IZQUIERDA (LISTA DE CHATS) */}
          <div className={`w-full md:w-[350px] lg:w-[400px] border-r border-[var(--border-soft)] flex flex-col shrink-0 ${selectedTicketId ? 'hidden md:flex' : 'flex'}`}>
            <TicketsSidebarList 
              totalUnreadInView={totalUnreadInView}
              fetchTicketsList={fetchTicketsList}
              loadingList={loadingList}
              search={search}
              setSearch={setSearch}
              setCurrentPage={setCurrentPage}
              tickets={tickets}
              filteredList={filteredList}
              currentPage={currentPage}
              ITEMS_PER_PAGE={ITEMS_PER_PAGE}
              selectedTicketId={selectedTicketId}
              handleSelectTicket={handleSelectTicket}
              handleDeleteTicket={handleDeleteTicket}
            />
          </div>

          {/* COLUMNA DERECHA (CHAT ACTIVO) */}
          <div className={`flex-1 flex-col bg-dark/30 relative ${selectedTicketId ? 'flex' : 'hidden md:flex'}`}>
            <TicketChat 
              selectedTicketId={selectedTicketId}
              loadingChat={loadingChat}
              activeTicket={activeTicket}
              handleBackToList={handleBackToList}
              navigate={navigate}
              handleStatusChange={handleStatusChange}
              inputText={inputText}
              setInputText={setInputText}
              handleSend={handleSend}
              sending={sending}
              messagesEndRef={messagesEndRef}
              textareaRef={textareaRef}
            />
          </div>
        </div>
      </div>

    </>
  );
}
