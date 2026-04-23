import { createSignal, Show } from 'solid-js';
import {
  saveProjectToFile,
  loadProjectFromFile,
  sanitizeProjectName,
  formatSaveDate,
} from '../utils/projectFileEngine';

/**
 * ProjectManager — Floating project control bar for the Correlation Canvas.
 *
 * Props:
 *   projectName   (Signal accessor)  Current project name.
 *   setProjectName (Setter)           Update the project name signal.
 *   lastSaved     (Signal accessor)  ISO string of last save, or null.
 *   setLastSaved  (Setter)           Update the last-saved signal.
 *   nodes         (Signal accessor)  Canvas nodes.
 *   links         (Signal accessor)  Canvas links.
 *   onLoad        (Function)         Called with { nodes, links } when a project is loaded.
 *   onNewProject  (Function)         Called when user creates a new project.
 */
const ProjectManager = (props) => {
  const [isEditingName, setIsEditingName] = createSignal(false);
  const [draftName, setDraftName] = createSignal('');
  const [status, setStatus] = createSignal(null); // { type: 'success' | 'error', msg }
  const [loadError, setLoadError] = createSignal(null);

  const flashStatus = (type, msg) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleSave = () => {
    try {
      const snapshot = saveProjectToFile(props.projectName(), props.nodes(), props.links());
      props.setLastSaved(snapshot.savedAt);
      flashStatus('success', `Saved as "${snapshot.name}"`);
    } catch (err) {
      flashStatus('error', `Save failed: ${err.message}`);
    }
  };

  const handleLoad = async () => {
    setLoadError(null);
    try {
      const project = await loadProjectFromFile();
      props.setProjectName(sanitizeProjectName(project.name));
      props.setLastSaved(project.savedAt);
      props.onLoad({ nodes: project.canvas.nodes, links: project.canvas.links });
      flashStatus('success', `Loaded: "${project.name}"`);
    } catch (err) {
      if (err.message !== 'cancelled') {
        flashStatus('error', `Load failed: ${err.message}`);
      }
    }
  };

  const handleNewProject = () => {
    if (props.nodes().length > 0) {
      if (!confirm('Buat proyek baru? Canvas saat ini akan dikosongkan.')) return;
    }
    props.setProjectName('Untitled Project');
    props.setLastSaved(null);
    props.onNewProject();
    flashStatus('success', 'New project created');
  };

  const commitName = () => {
    const n = sanitizeProjectName(draftName());
    props.setProjectName(n);
    setIsEditingName(false);
  };

  return (
    <div class="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#0d1117]/90 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl ring-1 ring-white/5 select-none">

      {/* New Project */}
      <button
        onClick={handleNewProject}
        title="New Project"
        class="p-1.5 text-white/30 hover:text-white transition-colors rounded hover:bg-white/5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      </button>

      <div class="w-px h-4 bg-white/10" />

      {/* Project name / editable */}
      <Show
        when={isEditingName()}
        fallback={
          <button
            onClick={() => { setDraftName(props.projectName()); setIsEditingName(true); }}
            class="text-[11px] font-black text-white uppercase tracking-wider hover:text-blue-400 transition-colors px-1 max-w-[220px] truncate"
          >
            {props.projectName()}
          </button>
        }
      >
        <input
          type="text"
          autofocus
          value={draftName()}
          onInput={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') setIsEditingName(false);
          }}
          onBlur={commitName}
          class="bg-white/10 border border-blue-500/60 rounded px-2 py-0.5 text-[11px] font-black text-white uppercase tracking-wider outline-none w-[200px]"
        />
      </Show>

      {/* Last saved badge */}
      <Show when={props.lastSaved()}>
        <div class="text-[8px] font-black text-white/20 uppercase tracking-tighter whitespace-nowrap">
          {formatSaveDate(props.lastSaved())}
        </div>
      </Show>

      <div class="w-px h-4 bg-white/10" />

      {/* Load */}
      <button
        onClick={handleLoad}
        title="Load Project (JSON)"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-black text-white/50 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-all border border-transparent hover:border-white/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Load
      </button>

      {/* Save */}
      <button
        onClick={handleSave}
        title="Save Project (Download JSON)"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-black text-emerald-400 hover:text-white hover:bg-emerald-600 uppercase tracking-wider transition-all border border-emerald-500/30 hover:border-emerald-500 shadow-sm shadow-emerald-900/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save
      </button>

      {/* Status Toast */}
      <Show when={status()}>
        <div
          class={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
            status().type === 'success'
              ? 'bg-emerald-600/90 text-white'
              : 'bg-red-600/90 text-white'
          }`}
        >
          {status().msg}
        </div>
      </Show>
    </div>
  );
};

export default ProjectManager;
