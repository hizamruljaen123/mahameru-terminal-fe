import { render } from 'solid-js/web';
import './index.css';
import App from './App';

// Global CORS Fix for Local Development
if (import.meta.env.DEV) {
  const originalFetch = window.fetch;
  window.fetch = (...args) => {
    let [resource, config] = args;
    if (typeof resource === 'string' && resource.includes('api.asetpedia.online')) {
      resource = resource.replace('https://api.asetpedia.online', '/api-proxy');
    }
    return originalFetch(resource, config);
  };
}

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute is misspelled?',
  );
}

render(() => <App />, root);
