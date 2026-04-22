// ENQY TERMINAL ALERT MANAGER — Singleton
// Handles: Price alerts (polling) + Keyword alerts (socket)
// Persistence: localStorage
// Notifications: Browser Push Notification API

const PRICE_ALERTS_KEY = 'enqy_price_alerts_v2';
const KEYWORD_ALERTS_KEY = 'enqy_keyword_alerts_v2';
const MARKET_API = import.meta.env.VITE_MARKET_API || import.meta.env.VITE_MARKET_API;

class AlertManager {
  constructor() {
    this._timer = null;
    this._socket = null;
    this._callbacks = []; // in-app notification callbacks
    this._polling = false;
  }

  // ─── INIT ───────────────────────────────────────────────────────────────────
  init() {
    this._requestPermission();
    this._startPolling();
    console.log('[ALERT_MGR] Initialized — price polling every 30s');
  }

  _requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        console.log(`[ALERT_MGR] Notification permission: ${p}`);
      });
    }
  }

  // ─── SOCKET INTEGRATION (keyword alerts from live news) ─────────────────────
  setSocket(socket) {
    this._socket = socket;
    socket.on('new_articles', (payload) => {
      const articles = payload?.articles || [];
      const keywords = this._getKeywords().filter(k => k.enabled !== false);
      articles.forEach(article => {
        const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
        keywords.forEach(kw => {
          if (text.includes(kw.keyword.toLowerCase())) {
            this._notify(
              `🔔 KEYWORD: ${kw.keyword.toUpperCase()}`,
              article.title,
              article.link
            );
            this._markKeywordTriggered(kw.id, article.title);
          }
        });
      });
    });
    console.log('[ALERT_MGR] Socket connected for keyword alerts');
  }

  // ─── PRICE POLL ─────────────────────────────────────────────────────────────
  _startPolling() {
    if (this._timer) clearInterval(this._timer);
    // First check immediately, then every 30s
    setTimeout(() => this._checkPriceAlerts(), 5000);
    this._timer = setInterval(() => this._checkPriceAlerts(), 30000);
  }

  async _checkPriceAlerts() {
    if (this._polling) return;
    this._polling = true;
    try {
      const alerts = this._getPriceAlerts().filter(a => a.enabled && !a.triggeredAt);
      if (alerts.length === 0) return;

      const symbols = [...new Set(alerts.map(a => a.symbol))];
      const priceMap = {};

      await Promise.all(symbols.map(async sym => {
        try {
          const resp = await fetch(`${MARKET_API}/api/market/price?symbol=${encodeURIComponent(sym)}`);
          const json = await resp.json();
          if (json.status === 'success' && json.price != null) {
            priceMap[sym] = json.price;
          }
        } catch {}
      }));

      alerts.forEach(alert => {
        const current = priceMap[alert.symbol];
        if (current == null) return;
        const hit =
          (alert.condition === 'above' && current >= alert.targetPrice) ||
          (alert.condition === 'below' && current <= alert.targetPrice);
        if (hit) {
          this._notify(
            `🎯 PRICE ALERT: ${alert.name}`,
            `${alert.name} hit ${current.toFixed(4)} — target was ${alert.condition} ${alert.targetPrice}`
          );
          this._markPriceTriggered(alert.id, current);
        }
      });
    } finally {
      this._polling = false;
    }
  }

  // ─── NOTIFICATION ────────────────────────────────────────────────────────────
  _notify(title, body, url = null) {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `enqy-${Date.now()}`,
        silent: false,
      });
      if (url) n.onclick = () => window.open(url, '_blank');
    }
    // In-app callbacks (for toast/badge display)
    const event = { title, body, url, ts: new Date().toISOString() };
    this._callbacks.forEach(cb => { try { cb(event); } catch {} });
  }

  // Register in-app notification listener. Returns unsubscribe fn.
  onAlert(callback) {
    this._callbacks.push(callback);
    return () => { this._callbacks = this._callbacks.filter(c => c !== callback); };
  }

  // ─── PRICE ALERTS CRUD ───────────────────────────────────────────────────────
  getPriceAlerts() { return this._getPriceAlerts(); }
  _getPriceAlerts() {
    try { return JSON.parse(localStorage.getItem(PRICE_ALERTS_KEY) || '[]'); } catch { return []; }
  }
  _savePriceAlerts(alerts) {
    localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(alerts));
  }

  addPriceAlert({ symbol, name, condition, targetPrice, currency = 'USD' }) {
    const alerts = this._getPriceAlerts();
    const alert = {
      id: `pa_${Date.now()}`,
      symbol, name, condition, targetPrice: Number(targetPrice), currency,
      enabled: true,
      triggeredAt: null,
      triggeredPrice: null,
      createdAt: new Date().toISOString(),
    };
    alerts.push(alert);
    this._savePriceAlerts(alerts);
    return alert;
  }

  removePriceAlert(id) {
    this._savePriceAlerts(this._getPriceAlerts().filter(a => a.id !== id));
  }

  togglePriceAlert(id) {
    this._savePriceAlerts(
      this._getPriceAlerts().map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    );
  }

  resetPriceAlert(id) {
    this._savePriceAlerts(
      this._getPriceAlerts().map(a => a.id === id
        ? { ...a, triggeredAt: null, triggeredPrice: null, enabled: true } : a)
    );
  }

  _markPriceTriggered(id, price) {
    this._savePriceAlerts(
      this._getPriceAlerts().map(a => a.id === id
        ? { ...a, triggeredAt: new Date().toISOString(), triggeredPrice: price, enabled: false } : a)
    );
  }

  // ─── KEYWORD ALERTS CRUD ─────────────────────────────────────────────────────
  getKeywords() { return this._getKeywords(); }
  _getKeywords() {
    try { return JSON.parse(localStorage.getItem(KEYWORD_ALERTS_KEY) || '[]'); } catch { return []; }
  }
  _saveKeywords(kws) {
    localStorage.setItem(KEYWORD_ALERTS_KEY, JSON.stringify(kws));
  }

  addKeyword(keyword) {
    const kws = this._getKeywords();
    const kw = {
      id: `kw_${Date.now()}`,
      keyword: keyword.trim(),
      enabled: true,
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      lastArticle: null,
    };
    kws.push(kw);
    this._saveKeywords(kws);
    return kw;
  }

  removeKeyword(id) {
    this._saveKeywords(this._getKeywords().filter(k => k.id !== id));
  }

  toggleKeyword(id) {
    this._saveKeywords(
      this._getKeywords().map(k => k.id === id ? { ...k, enabled: !k.enabled } : k)
    );
  }

  _markKeywordTriggered(id, article) {
    this._saveKeywords(
      this._getKeywords().map(k => k.id === id
        ? { ...k, lastTriggered: new Date().toISOString(), lastArticle: article } : k)
    );
  }

  // ─── CLEANUP ─────────────────────────────────────────────────────────────────
  destroy() {
    if (this._timer) clearInterval(this._timer);
  }
}

// Export singleton
export const alertManager = new AlertManager();
