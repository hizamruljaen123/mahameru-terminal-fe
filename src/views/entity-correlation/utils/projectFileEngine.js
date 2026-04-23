/**
 * Project File Engine — Correlation Canvas
 * =========================================
 * Handles all project persistence operations via JSON file I/O.
 * No server-side or localStorage required; all state is serialized
 * into a portable .corr.json file that can be loaded at any time.
 */

const FILE_EXTENSION = '.corr.json';
const SCHEMA_VERSION = '1.0';

// ──────────────────────────────────────────────────────────────────────────────
// SERIALISATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a project snapshot from the current canvas state.
 * @param {string} projectName  Human-readable title.
 * @param {Array}  nodes        Reactive signal getter result.
 * @param {Array}  links        Reactive signal getter result.
 * @returns {object} A plain-JS project object ready to be JSON-serialised.
 */
export function buildProjectSnapshot(projectName, nodes, links) {
  return {
    schema: SCHEMA_VERSION,
    name: projectName || 'Untitled Project',
    savedAt: new Date().toISOString(),
    canvas: {
      nodes: nodes.map(node => ({ ...node })),
      links: links.map(link => ({ ...link })),
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SAVE  →  Download JSON file
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Trigger a browser file download of the project as a JSON file.
 * @param {string} projectName
 * @param {Array}  nodes
 * @param {Array}  links
 */
export function saveProjectToFile(projectName, nodes, links) {
  const snapshot = buildProjectSnapshot(projectName, nodes, links);
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const safeName = (projectName || 'project')
    .replace(/[^a-z0-9_\-\s]/gi, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}${FILE_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return snapshot;
}

// ──────────────────────────────────────────────────────────────────────────────
// LOAD  →  Read JSON file via <input type="file">
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Open the OS file picker and parse the selected .corr.json file.
 * Returns a Promise that resolves with the parsed project object,
 * or rejects on validation/parse errors.
 * @returns {Promise<object>} The project snapshot.
 */
export function loadProjectFromFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.corr.json,application/json';

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return reject(new Error('No file selected.'));

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const project = JSON.parse(evt.target.result);
          if (!project.canvas || !Array.isArray(project.canvas.nodes)) {
            return reject(new Error('Invalid project file format.'));
          }
          resolve(project);
        } catch (err) {
          reject(new Error(`Failed to parse JSON: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsText(file);
    };

    // If the user cancels the dialog
    input.oncancel = () => reject(new Error('cancelled'));

    document.body.appendChild(input);
    input.click();
    input.remove();
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Format a project name to be safe for use as a filename.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeProjectName(name) {
  return name?.trim() || 'Untitled Project';
}

/**
 * Extract a readable date string from a project snapshot's savedAt field.
 * @param {string} isoString
 * @returns {string}
 */
export function formatSaveDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}
