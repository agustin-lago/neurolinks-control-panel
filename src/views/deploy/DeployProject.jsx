import React, { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { store } from '../../core/store';

export default function DeployProject({ navigate, isTab = false }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.searchTemplates("");
      let filtered = (data || []).filter(t => t.id === '7ee93cd3-5d50-444e-9c47-1617446449d3');
      if (filtered.length === 0) {
        filtered = [{ id: '7ee93cd3-5d50-444e-9c47-1617446449d3', name: 'Backoffice - Official Meta API' }];
      }
      setTemplates(filtered);
    } catch (error) {
      console.error("Error loading templates:", error);
      if (window.showToast) window.showToast("Error al conectar con Railway", "danger");
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates[0];

  const handleConfirmDeploy = async () => {
    if (!selectedTemplate) return;
    setDeploying(true);
    try {
      const result = await api.deployTemplate(selectedTemplate.id);
      if (result.success) {
        alert("Despliegue iniciado. El nuevo proyecto aparecerá en la lista de proyectos en unos momentos.");
        store.invalidate('assistants');
        navigate('projects');
      } else {
        alert("Error al desplegar: " + (result.error || "Respuesta desconocida"));
      }
    } catch (error) {
      console.error("Error in confirmDeploy:", error);
      alert("Error crítico al intentar desplegar el template.");
    } finally {
      setDeploying(false);
    }
  };

  const benefits = [
    { label: "Reportes de leads", desc: "Métricas avanzadas de captación" },
    { label: "Etiquetas personalizadas", desc: "Organización eficiente de contactos" },
    { label: "Envíos masivos de plantillas (META)", desc: "Campañas oficiales sin riesgo de ban" },
    { label: "Sincronización con historial de WhatsApp", desc: "Respaldo y acceso en tiempo real" }
  ];

  return (
    <div id="deploy-project-view" className={`flex flex-col w-full ${isTab ? 'h-full pt-4 overflow-y-auto pr-1' : ''}`}>
      <div className="mt-2 mb-12 flex flex-col items-center justify-center px-4 w-full max-w-3xl mx-auto relative">
        {/* Subtle accent glow in background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

        {loading ? (
          <div className="text-center py-16">
            <div className="spinner-border text-success mb-3" role="status" style={{ width: '2.5rem', height: '2.5rem' }}></div>
            <div className="text-dim text-base font-medium">Conectando con Railway...</div>
          </div>
        ) : !selectedTemplate ? (
          <div className="text-center py-16 text-dim text-base">No se encontró la configuración de "Backoffice - Official Meta API".</div>
        ) : (
          <div className="text-center py-1 w-full">
            {/* Premium Icon Header */}
            <div className="deploy-confirm-icon mb-4" style={{
              width: '72px',
              height: '72px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)'
            }}>
              <i className="bi bi-rocket-takeoff-fill text-emerald-400" style={{ fontSize: '2.2rem', filter: 'drop-shadow(0 4px 10px rgba(16, 185, 129, 0.4))' }}></i>
            </div>

            {/* Title & Subtitle */}
            <h2 className="font-extrabold mb-1 text-main text-2xl tracking-tight">
              Backoffice - Official Meta API
            </h2>
            <p className="mb-6 text-sm text-sky-400/90 font-medium tracking-wide max-w-lg mx-auto">
              Backoffice con API oficial de META
            </p>

            {/* Benefits Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6 text-left max-w-2xl mx-auto">
              {benefits.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl transition-all duration-300 hover:bg-white/5" style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-soft)',
                  backdropFilter: 'blur(8px)'
                }}>
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-main text-sm mb-0.5">{item.label}</div>
                    <div className="text-xs text-dim leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Premium Deployment Info Card */}
            <div className="text-left mb-8 p-4 rounded-xl max-w-2xl mx-auto transition-all duration-300 shadow-lg" style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(14, 165, 233, 0.02) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderLeft: '4px solid #38bdf8',
              backdropFilter: 'blur(12px)'
            }}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-md bg-sky-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
                </div>
                <span className="font-bold text-main text-sm tracking-wide">Despliegue Instantáneo y Seguro</span>
              </div>
              <p className="mb-0 mt-1 text-xs leading-relaxed text-sky-100/70 deploy-info-text pl-1">
                Se aprovisionará una instancia dedicada en Railway de forma automática. Una vez completado, podrás personalizar todas tus claves y variables de entorno desde la sección de Variables.
              </p>
            </div>

            {/* Action Button */}
            <div className="flex justify-center">
              <button
                className="btn btn-success px-8 py-2.5 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 w-full sm:w-auto text-sm tracking-wide"
                onClick={handleConfirmDeploy}
                disabled={deploying}
              >
                {deploying ? (
                  <>
                    <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>
                    Iniciando despliegue...
                  </>
                ) : (
                  <>
                    <i className="bi bi-rocket-takeoff text-lg mr-1"></i>Confirmar despliegue de instancia
                  </>
                )}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
