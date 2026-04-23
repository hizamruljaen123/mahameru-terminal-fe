const STORAGE_KEY = 'asetpedia_entity_correlation_nodes';
const LINKS_KEY = 'asetpedia_entity_correlation_links';

export const storage = {
  saveNodes: (nodes) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
    } catch (err) { console.error(err); }
  },
  loadNodes: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) { return []; }
  },
  saveLinks: (links) => {
    try {
      localStorage.setItem(LINKS_KEY, JSON.stringify(links));
    } catch (err) { console.error(err); }
  },
  loadLinks: () => {
    try {
      const data = localStorage.getItem(LINKS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) { return []; }
  },
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LINKS_KEY);
  }
};
