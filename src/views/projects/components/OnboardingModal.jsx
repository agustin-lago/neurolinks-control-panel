import React, { useState, useEffect } from 'react';
import { useSmartRefresh } from '../../../contexts/SmartRefreshContext';

export default function OnboardingModal({ projectId, projectName, onClose, api }) {
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState({});
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [customTask, setCustomTask] = useState('');
  
  // Controls which accordion is open
  const [expandedNoteItem, setExpandedNoteItem] = useState(null);

  // Default checklist structure
  const sections = [
    {
      id: 'alta',
      title: 'Alta de Cliente',
      items: [
        { id: 'asignacion_cobro', label: 'Asignación de cuenta de cobro' },
        { id: 'creacion_cliente', label: 'Creación de cliente y proyecto' },
        { id: 'es_crm', label: 'CRM (Es CRM)' },
        { id: 'es_bot', label: 'BOT (Es BOT)' },
      ]
    },
    {
      id: 'metaproceso',
      title: 'Meta proceso',
      items: [
        { id: 'portfolio_sin_verificar', label: 'Porfolio Avanzado sin verificar' },
        { id: 'whatsapp_vinculado', label: 'Whatsapp vinculado' },
        { id: 'portfolio_verificado', label: 'Porfolio verificado' },
      ]
    },
    {
      id: 'bot',
      title: 'Si es BOT',
      items: [
        { id: 'creacion_openai', label: 'Creación de asist en OpenAI' },
        { id: 'prompt_avanzado', label: 'Prompt avanzado' },
        { id: 'bot_linea', label: 'Bot en línea de trabajo' },
      ]
    },
    {
      id: 'capacitacion',
      title: 'Capacitación / Verificación CRM',
      items: [
        { id: 'creacion_plantilla', label: 'Creación de plantilla' },
        { id: 'envio_plantilla', label: 'Envío de plantilla de prueba' },
        { id: 'cargar_contactos', label: 'Cargar contactos y etiquetas' },
        { id: 'estados', label: 'Estados' },
        { id: 'fechas', label: 'Fechas' },
      ]
    }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.fetchProjectOnboarding(projectId);
      setChecklist(data.checklist_state || {});
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Error fetching onboarding:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  // Realtime updates
  useSmartRefresh('stream_project_onboarding', (payload) => {
    const item = payload.item;
    if (item && item.project_id === projectId) {
      setChecklist(item.checklist_state || {});
      setNotes(item.notes || []);
    }
  });

  const toggleCheck = async (itemId) => {
    const newVal = !checklist[itemId];
    const newChecklist = { ...checklist, [itemId]: newVal };
    setChecklist(newChecklist); // Optimistic UI
    try {
      await api.updateProjectOnboarding(projectId, { checklist_state: newChecklist });
    } catch (err) {
      console.error('Error updating checklist:', err);
      // Revert on error
      setChecklist({ ...checklist, [itemId]: !newVal });
      window.showToast('Error al actualizar tarea', 'danger');
    }
  };

  const handleAddCustomTask = async (e) => {
    e.preventDefault();
    if (!customTask.trim()) return;
    const taskId = `custom_${Date.now()}`;
    const newChecklist = { 
      ...checklist, 
      [taskId]: false,
      [`${taskId}_label`]: customTask.trim()
    };
    setChecklist(newChecklist);
    setCustomTask('');
    try {
      await api.updateProjectOnboarding(projectId, { checklist_state: newChecklist });
    } catch (err) {
      console.error('Error adding custom task:', err);
      window.showToast('Error al agregar tarea', 'danger');
    }
  };

  const handleRemoveCustomTask = async (taskId) => {
    const newChecklist = { ...checklist };
    delete newChecklist[taskId];
    delete newChecklist[`${taskId}_label`];
    setChecklist(newChecklist);
    
    // Also remove notes associated with this custom task
    const newNotes = notes.filter(n => n.item_id !== taskId);
    setNotes(newNotes);

    try {
      await api.updateProjectOnboarding(projectId, { checklist_state: newChecklist, notes: newNotes });
    } catch (err) {
      console.error('Error removing custom task:', err);
    }
  };

  const handleAddNote = async (e, itemId) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    
    let author = 'Admin';
    try {
      const user = localStorage.getItem('username'); // Adapt if needed
      if (user) author = user;
    } catch (e) {}

    const noteObj = {
      id: `note_${Date.now()}`,
      item_id: itemId,
      content: newNote.trim(),
      author,
      created_at: new Date().toISOString(),
      read: false
    };

    const newNotes = [noteObj, ...notes];
    setNotes(newNotes);
    setNewNote('');
    
    try {
      await api.updateProjectOnboarding(projectId, { notes: newNotes });
    } catch (err) {
      console.error('Error adding note:', err);
      window.showToast('Error al agregar nota', 'danger');
    }
  };

  const toggleNoteRead = async (noteId) => {
    const newNotes = notes.map(n => n.id === noteId ? { ...n, read: !n.read } : n);
    setNotes(newNotes);
    try {
      await api.updateProjectOnboarding(projectId, { notes: newNotes });
    } catch (err) {
      console.error('Error updating note:', err);
    }
  };

  const removeNote = async (noteId) => {
    const newNotes = notes.filter(n => n.id !== noteId);
    setNotes(newNotes);
    try {
      await api.updateProjectOnboarding(projectId, { notes: newNotes });
    } catch (err) {
      console.error('Error removing note:', err);
    }
  };

  // Extract custom tasks from checklist state
  const customTasks = Object.keys(checklist)
    .filter(key => key.startsWith('custom_') && !key.endsWith('_label'))
    .map(key => ({
      id: key,
      label: checklist[`${key}_label`] || 'Tarea personalizada'
    }));

  const getUnreadNotesCount = (itemId) => {
    return notes.filter(n => n.item_id === itemId && !n.read).length;
  };

  const renderNoteAccordion = (itemId) => {
    if (expandedNoteItem !== itemId) return null;

    const itemNotes = notes.filter(n => n.item_id === itemId);

    return (
      <div className="mt-3 pl-8 pr-2 pb-2">
        <div className="bg-black/20 rounded-lg p-3 border border-[var(--border-light)]">
          
          <form onSubmit={(e) => handleAddNote(e, itemId)} className="flex gap-2 mb-4">
            <input 
              type="text" 
              className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] text-sm bg-black/40" 
              placeholder="Escribí una nota para esta tarea..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-sm btn-primary flex items-center shrink-0" disabled={!newNote.trim()}>
              <i className="bi bi-send"></i>
            </button>
          </form>

          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {itemNotes.length === 0 ? (
              <div className="text-center py-4 text-[var(--text-dim)] italic text-xs">
                No hay notas para esta tarea.
              </div>
            ) : (
              itemNotes.map(note => (
                <div key={note.id} className={`p-2.5 rounded border flex flex-col gap-1.5 relative ${note.read ? 'bg-black/10 border-[var(--border-light)] opacity-75' : 'bg-accent/10 border-accent/40 shadow-sm'}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="text-[var(--text-main)] text-xs whitespace-pre-wrap flex-1">{note.content}</div>
                    <div className="flex gap-1 shrink-0">
                      <button 
                        className={`btn btn-sm p-0.5 border-0 text-xs ${note.read ? 'text-success' : 'text-[var(--text-dim)] hover:text-success'}`}
                        title={note.read ? "Marcar como no leída" : "Marcar como leída"}
                        onClick={() => toggleNoteRead(note.id)}
                      >
                        <i className={`bi ${note.read ? 'bi-check-all' : 'bi-check'}`}></i>
                      </button>
                      <button 
                        className="btn btn-sm p-0.5 border-0 text-xs text-[var(--text-dim)] hover:text-danger"
                        title="Eliminar nota"
                        onClick={() => removeNote(note.id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-[var(--text-dim)] uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <i className="bi bi-person"></i> {note.author}
                    </div>
                    <div>{new Date(note.created_at).toLocaleString()}</div>
                  </div>
                  {!note.read && <div className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full border border-[var(--bg-glass)]"></div>}
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    );
  };

  const renderTaskItem = (item, isCustom = false) => {
    const unreadCount = getUnreadNotesCount(item.id);
    const hasNotes = notes.some(n => n.item_id === item.id);
    const isExpanded = expandedNoteItem === item.id;

    return (
      <div key={item.id} className="flex flex-col">
        <div className="flex items-start justify-between gap-3 group">
          
          {/* CHECKBOX & LABEL */}
          <label className="flex items-start gap-3 cursor-pointer flex-1">
            <div className="relative flex items-center mt-0.5">
              <input 
                type="checkbox" 
                className="peer sr-only"
                checked={!!checklist[item.id]}
                onChange={() => toggleCheck(item.id)}
              />
              <div className="w-5 h-5 rounded border-2 border-[var(--border-light)] group-hover:border-accent peer-checked:bg-accent peer-checked:border-accent transition-all flex items-center justify-center">
                <i className={`bi bi-check text-white text-lg transition-opacity ${checklist[item.id] ? 'opacity-100' : 'opacity-0'}`}></i>
              </div>
            </div>
            <span className={`text-sm transition-colors ${checklist[item.id] ? 'text-[var(--text-dim)] line-through' : 'text-[var(--text-main)]'}`}>
              {item.label}
            </span>
          </label>
          
          {/* ACTION BUTTONS (DELETE CUSTOM & NOTE) */}
          <div className="flex items-center gap-2 shrink-0">
            {isCustom && (
              <button 
                className="text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1 border-0" 
                title="Eliminar tarea"
                onClick={() => handleRemoveCustomTask(item.id)}
              >
                <i className="bi bi-trash text-sm"></i>
              </button>
            )}

            <button 
              className={`p-1 border-0 transition-colors relative flex items-center justify-center rounded hover:bg-white/10
                ${isExpanded ? 'text-accent bg-white/5' : 
                  (unreadCount > 0 ? 'text-accent' : 
                    (hasNotes ? 'text-[var(--text-main)]' : 'text-[var(--text-dim)] opacity-0 group-hover:opacity-100')
                  )
                }`}
              title="Notas"
              onClick={() => {
                if (expandedNoteItem === item.id) {
                  setExpandedNoteItem(null);
                  setNewNote('');
                } else {
                  setExpandedNoteItem(item.id);
                  setNewNote('');
                }
              }}
            >
              <i className={`bi bi-chat-left-text text-sm`}></i>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger rounded-full border border-[var(--bg-glass)]"></span>
              )}
            </button>
          </div>
        </div>

        {/* ACCORDION (NOTES) */}
        {renderNoteAccordion(item.id)}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-2xl rounded-xl border border-[var(--border-light)] shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-[var(--border-light)] flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-[var(--text-main)] text-lg flex items-center gap-2">
              <i className="bi bi-card-checklist text-accent"></i>
              Onboarding Checklist
            </h3>
            <div className="text-xs text-[var(--text-dim)]">{projectName}</div>
          </div>
          <button type="button" className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors" onClick={onClose}>
            <i className="bi bi-x-lg text-lg"></i>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center py-20">
            <span className="spinner-border text-accent"></span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            <div className="flex flex-col gap-6">
              
              {/* SECTIONS */}
              {sections.map(sec => (
                <div key={sec.id} className="bg-black/10 rounded-lg p-4 border border-[var(--border-light)]">
                  <h4 className="text-xs uppercase text-accent font-bold tracking-wider mb-3">{sec.title}</h4>
                  <div className="flex flex-col gap-4">
                    {sec.items.map(item => renderTaskItem(item))}
                  </div>
                </div>
              ))}

              {/* CUSTOM TASKS */}
              <div className="bg-black/10 rounded-lg p-4 border border-[var(--border-light)]">
                <h4 className="text-xs uppercase text-accent font-bold tracking-wider mb-3">Tareas Adicionales</h4>
                <div className="flex flex-col gap-4 mb-4">
                  {customTasks.length === 0 ? (
                    <span className="text-xs text-[var(--text-dim)] italic">No hay tareas adicionales</span>
                  ) : (
                    customTasks.map(item => renderTaskItem(item, true))
                  )}
                </div>
                <form onSubmit={handleAddCustomTask} className="flex gap-2">
                  <input 
                    type="text" 
                    className="form-control form-control-sm border-[var(--border-light)] text-[var(--text-main)] text-sm bg-black/20" 
                    placeholder="Nueva tarea personalizada..."
                    value={customTask}
                    onChange={(e) => setCustomTask(e.target.value)}
                  />
                  <button type="submit" className="btn btn-sm btn-outline-light border-[var(--border-light)] shrink-0" disabled={!customTask.trim()}>
                    Agregar
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
