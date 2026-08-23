import React, { useState, useEffect } from 'react';
import { store, useStoreKey } from '../../core/store';
import { api } from '../../core/api';
import DashboardStats from './components/DashboardStats';

export default function DashboardView({ navigate }) {
  const assistantsData = useStoreKey('assistants', () => store.fetchAssistants());
  const clientsData = useStoreKey('clients', () => store.fetchClients());
  const ticketsData = useStoreKey('ticketsMeta', () => store.fetchTicketsMeta());

  const assistants = assistantsData || [];
  const clients = clientsData || [];
  const tickets = ticketsData || [];
  const [refreshing, setRefreshing] = useState(false);

  // Nuevos estados para las métricas adicionales
  const [logs, setLogs] = useState([]);
  const [waSessions, setWaSessions] = useState([]);
  const [globalUsage, setGlobalUsage] = useState({ cpu: 0, ram: 0 });
  const [isUsageLoading, setIsUsageLoading] = useState(true);

  useEffect(() => {
    // Cargar Logs y WhatsApp
    const fetchExtraData = async () => {
      try {
        const [logsData, waData] = await Promise.all([
          api.getLogs().catch(() => []),
          api.fetchWhatsappSessions ? api.fetchWhatsappSessions().catch(() => []) : Promise.resolve([])
        ]);
        setLogs(logsData || []);
        setWaSessions(waData || []);
      } catch (e) {
        console.error('Error fetching extra dashboard data:', e);
      }
    };
    fetchExtraData();
  }, []);

  useEffect(() => {
    // Only load data if assistants are available
    if (assistantsData && assistantsData.length === 0) {
      setIsUsageLoading(false);
    } else {
      setIsUsageLoading(false);
    }
  }, [assistantsData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        store.fetchAssistants(true),
        store.fetchClients(true),
        store.fetchTicketsMeta(true),
      ]);
      // También podríamos refrescar el resto aquí si fuera necesario
    } catch (err) {
      console.error('[DashboardView] Error refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const loading = assistantsData === null || clientsData === null || ticketsData === null;

  if (loading) {
    return (
      <div className="flex flex-col w-full h-full overflow-hidden bg-transparent fade-in pt-4">
        <div className="flex-1 overflow-y-auto px-2 pb-6 scrollbar-custom relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="glass-card p-6 h-full">
                <div className="flex items-start gap-4 mb-6">
                  <div className="skeleton shrink-0" style={{ width: '44px', height: '44px', borderRadius: '12px' }}></div>
                  <div className="grow">
                    <div className="skeleton mb-2" style={{ height: '15px', width: '70%' }}></div>
                    <div className="skeleton" style={{ height: '22px', width: '90px', borderRadius: '20px' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-transparent fade-in pt-4">
      <div className="flex-1 overflow-y-auto px-2 pb-6 scrollbar-custom relative z-10">
        <DashboardStats 
          assistants={assistants} 
          clients={clients} 
          tickets={tickets} 
          logs={logs}
        />
      </div>
    </div>
  );
}
