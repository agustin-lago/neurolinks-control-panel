import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area, LineChart, Line } from 'recharts';

export default function DashboardStats({ assistants, clients, tickets, logs }) {
  // --- Data Calculations ---
  
  // Clients & Abonos
  const activeClients = clients.filter(c => {
    const status = String(c.subscription_status || '').toLowerCase();
    return c.plan !== 'Baja' && (['active', 'manual'].includes(status) || Boolean(c.mp_preapproval_id));
  });
  const totalAbono = activeClients.reduce((sum, c) => sum + (parseFloat(c.abono) || 0), 0);
  const pendingTickets = tickets.filter(t => t.estado !== 'Cerrado');

  // MRR Evolution
  const mrrDataMap = {};
  activeClients.forEach(c => {
    if (c.created_at) {
      const date = new Date(c.created_at);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!mrrDataMap[month]) mrrDataMap[month] = 0;
      mrrDataMap[month] += (parseFloat(c.abono) || 0);
    }
  });
  const sortedMonths = Object.keys(mrrDataMap).sort();
  let cumulativeMrr = 0;
  const mrrData = sortedMonths.map(month => {
    cumulativeMrr += mrrDataMap[month];
    return { name: month, Ingresos: cumulativeMrr };
  });

  // Services Health
  let onlineServices = 0;
  let errorServices = 0;
  let totalServices = 0;
  assistants.forEach(a => {
    if (a.services) {
      a.services.forEach(s => {
        totalServices++;
        if (s.status === 'online') onlineServices++;
        if (s.status === 'error') errorServices++;
      });
    }
  });
  const offlineServices = totalServices - onlineServices - errorServices;
  const uptimePct = totalServices > 0 ? Math.round((onlineServices / totalServices) * 100) : 0;

  const servicesData = [
    { name: 'Online', value: onlineServices, color: '#10b981' },
    { name: 'Error', value: errorServices, color: '#ef4444' },
    { name: 'Inactivo', value: offlineServices, color: '#6b7280' }
  ].filter(d => d.value > 0);

  // Client Plans
  const planColorFor = (planName) => {
    const normalized = String(planName || '').toLowerCase();
    if (normalized.includes('standard') || normalized.includes('standar')) return '#3b82f6';
    if (normalized.includes('chatbot')) return '#f59e0b';
    if (normalized.includes('personalizado')) return '#64748b';
    return '#8b5cf6';
  };
  const planCounts = activeClients.reduce((acc, client) => {
    const planName = client.plan || 'Sin plan';
    acc[planName] = (acc[planName] || 0) + 1;
    return acc;
  }, {});

  const plansData = Object.entries(planCounts)
    .map(([name, value]) => ({ name, value, color: planColorFor(name) }))
    .filter(d => d.value > 0);

  // Infrastructure Mapping
  const linkedIds = new Set();
  for (const c of clients) {
    if (Array.isArray(c.linked_projects)) {
      c.linked_projects.forEach(project => {
        if (project?.railway_project_id) linkedIds.add(String(project.railway_project_id));
      });
    }
  }

  const totalProj = assistants.length;
  const linkedProj = assistants.filter(a => linkedIds.has(String(a.id))).length;
  const orphanProj = totalProj - linkedProj;

  const totalCli = clients.length;
  const withInst = clients.filter(c => Array.isArray(c.linked_projects) && c.linked_projects.length > 0).length;
  const orphanCli = totalCli - withInst;

  const infraData = [
    { name: 'Clientes', Vinculados: withInst, Huerfanos: orphanCli },
    { name: 'Proyectos', Vinculados: linkedProj, Huerfanos: orphanProj }
  ];

  // Logs (Last 7 Days)
  const logsDataMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = `${d.getDate()}/${d.getMonth()+1}`;
    logsDataMap[day] = { name: day, INFO: 0, ERROR: 0 };
  }
  (logs || []).forEach(l => {
    if (l.created_at) {
      const d = new Date(l.created_at);
      const day = `${d.getDate()}/${d.getMonth()+1}`;
      if (logsDataMap[day]) {
        if (l.level === 'ERROR') logsDataMap[day].ERROR++;
        else logsDataMap[day].INFO++;
      }
    }
  });
  const logsData = Object.values(logsDataMap);

  // --- Tooltips ---
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 rounded-lg border border-[var(--border-light)] text-sm shadow-xl bg-[var(--bg-main)]">
          {label && <div className="text-dim mb-2 pb-1 border-b border-[var(--border-light)]">{label}</div>}
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color || entry.payload.color }}></div>
              <span className="text-dim">{entry.name}:</span>
              <span className="font-bold text-main">
                {entry.name === 'Ingresos' ? `$${entry.value.toLocaleString('es-AR')}` : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
      
      {/* 1. Evolución de Ingresos (MRR) - Toma 2 columnas */}
      <div className="col-span-1 md:col-span-2 glass-card p-5 rounded-xl border border-[var(--border-light)] hover:border-white/20 transition-all flex flex-col h-full">
        <h6 className="mb-1 font-bold text-main text-sm flex items-center gap-2">
          <i className="bi bi-graph-up-arrow text-emerald-500"></i> Evolución de Ingresos (MRR)
        </h6>
        <div className="text-xs text-dim mb-4">Crecimiento histórico de facturación recurrente</div>
        
        <div className="flex-1 w-full min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mrrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-light)', strokeWidth: 1, strokeDasharray: '5 5' }} />
              <Area type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Radar de Salud del Sistema (Logs) - Toma 2 columnas */}
      <div className="col-span-1 md:col-span-2 glass-card p-5 rounded-xl border border-[var(--border-light)] hover:border-white/20 transition-all flex flex-col h-full">
        <h6 className="mb-1 font-bold text-main text-sm flex items-center gap-2">
          <i className="bi bi-heart-pulse text-rose-500"></i> Radar de Salud del Sistema (7 días)
        </h6>
        <div className="text-xs text-dim mb-4">Tasa de errores vs actividad normal</div>
        
        <div className="flex-1 w-full min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={logsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-light)', strokeWidth: 1, strokeDasharray: '5 5' }} />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-dim)' }} />
              <Line type="monotone" dataKey="INFO" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="ERROR" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Servicios / Health (PieChart) */}
      <div className="col-span-1 glass-card p-5 rounded-xl border border-[var(--border-light)] hover:border-white/20 transition-all flex flex-col h-full">
        <h6 className="mb-1 font-bold text-main text-sm flex items-center gap-2">
          <i className="bi bi-activity text-[var(--accent)]"></i> Estado de Servicios
        </h6>
        <div className="text-xs text-dim mb-4">{totalServices} servicios registrados</div>
        <div className="flex-1 w-full min-h-[160px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={servicesData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                {servicesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-main font-mono leading-none">{uptimePct}%</span>
            <span className="text-[10px] text-dim uppercase font-bold">Uptime</span>
          </div>
        </div>
      </div>

      {/* 4. Planes de Clientes (PieChart) */}
      <div className="col-span-1 glass-card p-5 rounded-xl border border-[var(--border-light)] hover:border-white/20 transition-all flex flex-col h-full">
        <h6 className="mb-1 font-bold text-main text-sm flex items-center gap-2">
          <i className="bi bi-people text-blue-500"></i> Distribución de Planes
        </h6>
        <div className="text-xs text-dim mb-4">{activeClients.length} clientes activos</div>
        <div className="flex-1 w-full min-h-[160px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={plansData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                {plansData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-main font-mono leading-none">{activeClients.length}</span>
            <span className="text-[10px] text-dim uppercase font-bold">Total</span>
          </div>
        </div>
      </div>

      {/* 5. Infraestructura y Vínculos (BarChart) */}
      <div className="col-span-1 glass-card p-5 rounded-xl border border-[var(--border-light)] hover:border-white/20 transition-all flex flex-col h-full">
        <h6 className="mb-1 font-bold text-main text-sm flex items-center gap-2">
          <i className="bi bi-diagram-3 text-purple-500"></i> Infraestructura
        </h6>
        <div className="text-xs text-dim mb-4">Relación Clientes/Proyectos</div>
        <div className="flex-1 w-full min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={infraData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }} barSize={30}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--text-dim)' }} />
              <Bar dataKey="Vinculados" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
              <Bar dataKey="Huerfanos" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Abonos KPI */}
      <div className="col-span-1 glass-card p-5 rounded-xl border border-[var(--border-light)] hover:border-white/20 transition-all flex flex-col h-full bg-gradient-to-br from-transparent to-emerald-500/5">
        <h6 className="mb-1 font-bold text-main text-sm flex items-center gap-2">
          <i className="bi bi-cash-stack text-emerald-500"></i> Ingresos Estimados
        </h6>
        <div className="text-xs text-dim mb-4">Facturación mensual recurrente</div>
        
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[160px]">
          <div className="text-3xl xl:text-4xl font-bold text-main font-mono text-emerald-500 text-center break-words w-full">
            ${totalAbono.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}
