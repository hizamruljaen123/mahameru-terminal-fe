import { createSignal, Show } from 'solid-js';
import {
  saveProjectToFile,
  loadProjectFromFile,
  sanitizeProjectName,
  formatSaveDate,
} from '../utils/projectFileEngine';

const Toolbar = (props) => {
  const [isEditingName, setIsEditingName] = createSignal(false);
  const [draftName, setDraftName] = createSignal('');
  const [status, setStatus] = createSignal(null); // { type: 'success' | 'error', msg }

  const flashStatus = (type, msg) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleSave = () => {
    try {
      const snapshot = saveProjectToFile(props.projectName(), props.nodes(), props.links());
      props.setLastSaved(snapshot.savedAt);
      flashStatus('success', `SYNC_SUCCESS: ${snapshot.name}`);
    } catch (err) {
      flashStatus('error', `STORAGE_ERROR: ${err.message}`);
    }
  };

  const handleLoad = async () => {
    try {
      const project = await loadProjectFromFile();
      props.setProjectName(sanitizeProjectName(project.name));
      props.setLastSaved(project.savedAt);
      props.onLoad({ nodes: project.canvas.nodes, links: project.canvas.links });
      flashStatus('success', `DATA_RESTORED: ${project.name}`);
    } catch (err) {
      if (err.message !== 'cancelled') {
        flashStatus('error', `RESTORE_FAILED: ${err.message}`);
      }
    }
  };

  const handleNewProject = () => {
    if (props.nodes().length > 0) {
      if (!confirm('Discard current intelligence layer and initialize new workspace?')) return;
    }
    props.setProjectName('Untitled Intelligence Layer');
    props.setLastSaved(null);
    props.onNewProject();
    flashStatus('success', 'WORKSPACE_READY');
  };

  const commitName = () => {
    const n = sanitizeProjectName(draftName());
    props.setProjectName(n);
    setIsEditingName(false);
  };

  return (
    <div class="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center p-1.5 bg-[#050608]/90 backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom-10 duration-1000 min-w-[500px]">
      
      {/* GROUP: FILE OPERATIONS */}
      <div class="flex items-center gap-1.5 pr-3 ml-1">
        <button
          onClick={handleNewProject}
          title="Initialize New"
          class="w-11 h-11 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </button>

        <button
          onClick={handleLoad}
          title="Load Archive"
          class="w-11 h-11 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>

        <button
          onClick={handleSave}
          title="Save Workspace"
          class="w-11 h-11 rounded-full bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500/60 hover:text-white hover:bg-emerald-600 hover:border-emerald-400 transition-all duration-500 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </button>
      </div>

      {/* DYNAMIC: IDENTITY ZONE */}
      <div class="flex-1 flex flex-col justify-center px-6 border-x border-white/10 min-w-0">
        <Show
          when={isEditingName()}
          fallback={
            <button
              onClick={() => { setDraftName(props.projectName()); setIsEditingName(true); }}
              class="text-[12px] font-black text-white/80 uppercase tracking-[0.2em] hover:text-blue-400 transition-all text-left truncate leading-tight"
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
            class="bg-transparent border-b border-blue-500/50 py-0 text-[12px] font-black text-white uppercase tracking-[0.2em] outline-none w-full animate-in fade-in duration-300"
          />
        </Show>
        <Show when={props.lastSaved()}>
          <div class="text-[8px] font-bold text-white/20 uppercase tracking-[0.25em] mt-1 flex items-center gap-2">
            <span class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
            SYNCED: {formatSaveDate(props.lastSaved())}
          </div>
        </Show>
      </div>

      {/* GROUP: CORE ACTIONS */}
      <div class="flex items-center gap-3 px-4 ml-2">
        <button 
          onClick={props.onAddClick}
          class="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-500 hover:scale-110 active:scale-95 transition-all duration-300 shadow-[0_8px_25px_rgba(37,99,235,0.4)] relative group border border-white/10"
          title="Deploy New Probe"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <div class="absolute -top-12 scale-0 group-hover:scale-100 transition-all duration-300 bg-[#0a0a0c]/95 border border-white/10 px-3 py-1.5 rounded-lg text-[9px] font-black tracking-[0.25em] whitespace-nowrap text-blue-400 shadow-2xl">
            MAP_ENTITY
          </div>
        </button>
        
        <button 
          onClick={props.onClear}
          class="w-11 h-11 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/20 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 hover:scale-110 active:scale-90 transition-all duration-300" 
          title="Clear Session"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>

      {/* NOTIFICATION: OVERLAY */}
      <Show when={status()}>
        <div
          class={`absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] transition-all animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500 border border-white/10 backdrop-blur-xl shadow-2xl ${
            status().type === 'success'
              ? 'bg-emerald-600/20 text-emerald-400 shadow-[0_15px_40px_rgba(16,185,129,0.3)]'
              : 'bg-red-600/20 text-red-400 shadow-[0_15px_40px_rgba(220,38,38,0.3)]'
          }`}
        >
          {status().msg}
        </div>
      </Show>
    </div>
  );
};

export default Toolbar;
