import { createSignal, For, Show, onMount, onCleanup, createMemo } from 'solid-js';
import { alertManager } from '../utils/alertManager';

const MARKET_API = import.meta.env.VITE_MARKET_API || import.meta.env.VITE_MARKET_API;

const fmtPct = (v) => (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';
const signColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';

export default function AlertCenterView() {
  const [priceAlerts, setPriceAlerts] = createSignal(alertManager.getPriceAlerts());
  const [keywords, setKeywords] = createSignal(alertManager.getKeywords());
  const [tab, setTab] = createSignal('PRICE'); // PRICE | KEYWORD
  const [newPA, setNewPA] = createSignal({ symbol: '', name: '', condition: 'below', targetPrice: '' });
  const [newKW, setNewKW] = createSignal('');
  const [pError, setPError] = createSignal('');
  const [kError, setKError] = createSignal('');
  const [lookupLoading, setLookupLoading] = createSignal(false);
  const [notifPerm, setNotifPerm] = createSignal(Notification?.permission || 'default');

  const refresh = () => {
    setPriceAlerts(alertManager.getPriceAlerts());
    setKeywords(alertManager.getKeywords());
  };

  onMount(() => {
    refresh();
    const unsub = alertManager.onAlert(() => refresh());
    const itv = setInterval(refresh, 5000); // refresh UI state every 5s
    onCleanup(() => { unsub(); clearInterval(itv); });
  });

  const requestNotif = async () => {
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  };

  const lookupSymbol = async () => {
    const sym = newPA().symbol?.trim();
    if (!sym) return;
    setLookupLoading(true);
    try {
      const resp = await fetch(`${MARKET_API}/api/market/price?symbol=${encodeURIComponent(sym)}`);
      const json = await resp.json();
      if (json.status === 'success') {
        setNewPA(f => ({ ...f, name: json.name || sym, targetPrice: json.price?.toFixed(4) || '' }));
        setPError('');
      } else {
        setPError('Symbol not found');
      }
    } catch { setPError('Backend unavailable'); }
    finally { setLookupLoading(false); }
  };

  const addPriceAlert = () => {
    const f = newPA();
    if (!f.symbol || !f.targetPrice) { setPError('Symbol and target price required'); return; }
    alertManager.addPriceAlert({
      symbol: f.symbol.toUpperCase(),
      name: f.name || f.symbol,
      condition: f.condition,
      targetPrice: Number(f.targetPrice),
    });
    setNewPA({ symbol: '', name: '', condition: 'below', targetPrice: '' });
    setPError('');
    refresh();
  };

  const addKeyword = () => {
    const kw = newKW().trim();
    if (!kw) { setKError('Enter a keyword'); return; }
    alertManager.addKeyword(kw);
    setNewKW('');
    setKError('');
    refresh();
  };

  // Stats
  const stats = createMemo(() => {
    const pa = priceAlerts();
    const kw = keywords();
    return {
      totalAlerts: pa.length + kw.length,
      activeAlerts: pa.filter(a => a.enabled && !a.triggeredAt).length + kw.filter(k => k.enabled !== false).length,
      triggeredAlerts: pa.filter(a => a.triggeredAt).length,
      keywordFired: kw.filter(k => k.lastTriggered).length,
    };
  });

  return (
    <div class="h-full w-full flex flex-col bg-bg_main text-text_primary text-[11px] uppercase tracking-tight overflow-hidden font-mono">

      {/* ── HEADER ── */}
      <div class="flex items-center justify-between px-6 py-3 bg-bg_header border-b border-border_main shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-px h-6 bg-yellow-400"></div>
          <div>
            <div class="text-[13px] font-black tracking-[0.3em]">NOTIFICATION CENTER</div>
            <div class="text-[8px] text-yellow-400/50 tracking-[0.3em] mt-0.5">PRICE TRIGGERS // KEYWORD ALERTS // NOTIFICATIONS</div>
          </div>
        </div>

        {/* Notification permission banner */}
        <Show when={notifPerm() !== 'granted'}>
          <button
            onClick={requestNotif}
            class="flex items-center gap-2 px-4 py-2 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-[9px] font-black hover:bg-yellow-500/20 transition-all"
          >
            🔔 ENABLE NOTIFICATIONS
          </button>
        </Show>
        <Show when={notifPerm() === 'granted'}>
          <div class="flex items-center gap-2 px-4 py-2 border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-[9px] font-black">
            ✓ NOTIFICATIONS ACTIVE
          </div>
        </Show>
      </div>

      {/* ── STATS ROW ── */}
      <div class="grid grid-cols-4 border-b border-border_main shrink-0 bg-bg_sidebar/30">
        <div class="px-6 py-3 border-r border-border_main flex flex-col">
          <span class="text-[7px] text-text_secondary/40 tracking-widest">TOTAL RULES</span>
          <span class="text-[18px] font-black text-text_primary mt-1">{stats().totalAlerts}</span>
        </div>
        <div class="px-6 py-3 border-r border-border_main flex flex-col">
          <span class="text-[7px] text-text_secondary/40 tracking-widest">ACTIVE MONITORING</span>
          <span class="text-[18px] font-black text-blue-400 mt-1">{stats().activeAlerts}</span>
        </div>
        <div class="px-6 py-3 border-r border-border_main flex flex-col">
          <span class="text-[7px] text-text_secondary/40 tracking-widest">PRICE ALERTS TRIGGERED</span>
          <span class="text-[18px] font-black text-red-400 mt-1">{stats().triggeredAlerts}</span>
        </div>
        <div class="px-6 py-3 flex flex-col">
          <span class="text-[7px] text-text_secondary/40 tracking-widest">KEYWORD MATCHES</span>
          <span class="text-[18px] font-black text-yellow-400 mt-1">{stats().keywordFired}</span>
        </div>
      </div>

      {/* ── TABS ── */}
      <div class="flex border-b border-border_main shrink-0 bg-bg_sidebar/10">
        <For each={[['PRICE', '💰 PRICE ALERTS'], ['KEYWORD', '🔍 KEYWORD ALERTS']]}>
          {([t, label]) => (
            <button
              onClick={() => setTab(t)}
              class={`px-8 py-2.5 text-[9px] font-black border-r border-border_main transition-all ${tab() === t ? 'bg-bg_header text-text_accent border-b-2 border-b-text_accent' : 'text-text_secondary/50 hover:text-text_primary'}`}
            >{label}</button>
          )}
        </For>
      </div>

      <div class="flex-1 flex overflow-hidden">

        {/* ── PRICE ALERTS ── */}
        <Show when={tab() === 'PRICE'}>
          <div class="flex-1 flex overflow-hidden">
            {/* List */}
            <div class="flex-1 overflow-auto">
              <Show when={priceAlerts().length === 0}>
                <div class="flex-1 flex flex-col items-center justify-center gap-4 opacity-20 p-20">
                  <div class="text-[40px]">🎯</div>
                  <div class="text-[12px] font-black tracking-[0.5em]">NO PRICE ALERTS</div>
                  <div class="text-[9px] tracking-widest text-text_secondary">Add a rule to monitor price levels</div>
                </div>
              </Show>
              <Show when={priceAlerts().length > 0}>
                <table class="w-full text-left border-collapse">
                  <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                    <tr class="text-[7px] text-text_secondary/40 uppercase font-black tracking-widest">
                      <th class="px-4 py-2">STATUS</th>
                      <th class="px-4 py-2">SYMBOL</th>
                      <th class="px-4 py-2">CONDITION</th>
                      <th class="px-4 py-2 text-right">TARGET</th>
                      <th class="px-4 py-2 text-right">TRIGGERED AT</th>
                      <th class="px-4 py-2 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border_main/20">
                    <For each={priceAlerts().slice().reverse()}>
                      {(alert) => (
                        <tr class="hover:bg-white/[0.02] transition-colors group">
                          <td class="px-4 py-3">
                            <div class="flex items-center gap-2">
                              <div class={`w-2 h-2 rounded-full ${alert.triggeredAt ? 'bg-red-400' : alert.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-white/10'}`}></div>
                              <span class={`text-[7px] font-black tracking-widest ${alert.triggeredAt ? 'text-red-400' : alert.enabled ? 'text-emerald-400' : 'text-text_secondary/30'}`}>
                                {alert.triggeredAt ? 'FIRED' : alert.enabled ? 'WATCHING' : 'PAUSED'}
                              </span>
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex flex-col">
                              <span class="font-black text-[10px]">{alert.symbol}</span>
                              <span class="text-[8px] text-text_secondary/40 truncate">{alert.name}</span>
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            <Show when={alert.condition === 'above'}>
                              <span class="text-emerald-400 font-black text-[9px]">↑ ABOVE</span>
                            </Show>
                            <Show when={alert.condition === 'below'}>
                              <span class="text-red-400 font-black text-[9px]">↓ BELOW</span>
                            </Show>
                          </td>
                          <td class="px-4 py-3 text-right font-mono text-[10px] font-black text-yellow-400">
                            {Number(alert.targetPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>
                          <td class="px-4 py-3 text-right text-[8px] text-text_secondary/40">
                            <Show when={alert.triggeredAt}>
                              <div class="flex flex-col items-end">
                                <span class="text-red-400 font-black">{new Date(alert.triggeredAt).toLocaleTimeString()}</span>
                                <span>{new Date(alert.triggeredAt).toLocaleDateString()}</span>
                              </div>
                            </Show>
                            <Show when={!alert.triggeredAt}>
                              <span>—</span>
                            </Show>
                          </td>
                          <td class="px-4 py-3 text-center">
                            <div class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { alertManager.togglePriceAlert(alert.id); refresh(); }}
                                class="px-2 py-1 text-[7px] font-black border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">
                                {alert.enabled ? 'PAUSE' : 'RESUME'}
                              </button>
                              <Show when={alert.triggeredAt}>
                                <button onClick={() => { alertManager.resetPriceAlert(alert.id); refresh(); }}
                                  class="px-2 py-1 text-[7px] font-black border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                                  RESET
                                </button>
                              </Show>
                              <button onClick={() => { alertManager.removePriceAlert(alert.id); refresh(); }}
                                class="px-2 py-1 text-[7px] font-black border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </div>

            {/* Add form */}
            <div class="w-72 border-l border-border_main flex flex-col bg-bg_sidebar/20 shrink-0">
              <div class="px-4 py-3 border-b border-border_main text-[8px] font-black text-text_accent/50 tracking-widest">NEW PRICE ALERT</div>
              <div class="flex-1 p-4 flex flex-col gap-3 overflow-auto">
                <div class="flex flex-col gap-1">
                  <label class="text-[7px] font-black text-text_secondary/40 tracking-widest">SYMBOL</label>
                  <div class="flex gap-1">
                    <input
                      type="text" placeholder="BTC-USD, BBCA.JK..."
                      value={newPA().symbol}
                      onInput={e => setNewPA(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                      class="flex-1 bg-bg_main border border-border_main px-2 py-1.5 text-[9px] focus:border-text_accent focus:outline-none"
                    />
                    <button onClick={lookupSymbol} disabled={lookupLoading()}
                      class="px-2 border border-text_accent text-text_accent text-[8px] font-black hover:bg-text_accent hover:text-bg_main transition-all disabled:opacity-40">
                      {lookupLoading() ? '...' : 'LOOK'}
                    </button>
                  </div>
                </div>

                <Show when={newPA().name}>
                  <div class="px-2 py-1.5 border border-border_main bg-bg_main text-[9px] text-text_accent font-black">{newPA().name}</div>
                </Show>

                <div class="flex flex-col gap-1">
                  <label class="text-[7px] font-black text-text_secondary/40 tracking-widest">CONDITION</label>
                  <div class="flex gap-1">
                    <For each={[{ v: 'above', l: '↑ ABOVE' }, { v: 'below', l: '↓ BELOW' }]}>
                      {opt => (
                        <button
                          onClick={() => setNewPA(f => ({ ...f, condition: opt.v }))}
                          class={`flex-1 py-1.5 text-[8px] font-black border transition-all ${newPA().condition === opt.v ? 'border-text_accent text-text_accent bg-text_accent/10' : 'border-border_main text-text_secondary'}`}
                        >{opt.l}</button>
                      )}
                    </For>
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[7px] font-black text-text_secondary/40 tracking-widest">TARGET PRICE</label>
                  <input
                    type="number" placeholder="0.00" step="any" min="0"
                    value={newPA().targetPrice}
                    onInput={e => setNewPA(f => ({ ...f, targetPrice: e.target.value }))}
                    class="bg-bg_main border border-border_main px-2 py-1.5 text-[9px] focus:border-yellow-500 focus:outline-none"
                  />
                </div>

                <Show when={pError()}>
                  <div class="text-red-400 text-[8px] font-black">{pError()}</div>
                </Show>

                <button onClick={addPriceAlert}
                  class="mt-auto w-full py-2.5 bg-yellow-500 text-bg_main text-[9px] font-black tracking-widest hover:bg-yellow-400 transition-all">
                  SAVE ALERT
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* ── KEYWORD ALERTS ── */}
        <Show when={tab() === 'KEYWORD'}>
          <div class="flex-1 flex overflow-hidden">
            {/* List */}
            <div class="flex-1 overflow-auto">
              <Show when={keywords().length === 0}>
                <div class="flex flex-col items-center justify-center gap-4 opacity-20 p-20">
                  <div class="text-[40px]">🔍</div>
                  <div class="text-[12px] font-black tracking-[0.5em]">NO KEYWORD ALERTS</div>
                  <div class="text-[9px] tracking-widest text-text_secondary">Monitor news for specific keywords or company names</div>
                </div>
              </Show>
              <Show when={keywords().length > 0}>
                <table class="w-full text-left border-collapse">
                  <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                    <tr class="text-[7px] text-text_secondary/40 uppercase font-black tracking-widest">
                      <th class="px-4 py-2">STATUS</th>
                      <th class="px-4 py-2">KEYWORD</th>
                      <th class="px-4 py-2">LAST MATCH</th>
                      <th class="px-4 py-2">LATEST ARTICLE</th>
                      <th class="px-4 py-2 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border_main/20">
                    <For each={keywords().slice().reverse()}>
                      {(kw) => (
                        <tr class="hover:bg-white/[0.02] transition-colors group">
                          <td class="px-4 py-3">
                            <div class="flex items-center gap-2">
                              <div class={`w-2 h-2 rounded-full ${kw.lastTriggered ? 'bg-yellow-400' : 'bg-emerald-400 animate-pulse'}`}></div>
                              <span class={`text-[7px] font-black tracking-widest ${kw.lastTriggered ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                {kw.lastTriggered ? 'MATCHED' : 'WATCHING'}
                              </span>
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            <span class="font-black text-[11px] text-text_accent">{kw.keyword}</span>
                          </td>
                          <td class="px-4 py-3 text-[8px] text-text_secondary/50">
                            {kw.lastTriggered ? new Date(kw.lastTriggered).toLocaleString() : '—'}
                          </td>
                          <td class="px-4 py-3 text-[8px] text-text_secondary/40 max-w-[300px]">
                            <span class="truncate block">{kw.lastArticle || '—'}</span>
                          </td>
                          <td class="px-4 py-3 text-center">
                            <div class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { alertManager.toggleKeyword(kw.id); refresh(); }}
                                class="px-2 py-1 text-[7px] font-black border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">
                                {kw.enabled !== false ? 'PAUSE' : 'RESUME'}
                              </button>
                              <button onClick={() => { alertManager.removeKeyword(kw.id); refresh(); }}
                                class="px-2 py-1 text-[7px] font-black border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </div>

            {/* Add keyword form */}
            <div class="w-72 border-l border-border_main flex flex-col bg-bg_sidebar/20 shrink-0">
              <div class="px-4 py-3 border-b border-border_main text-[8px] font-black text-text_accent/50 tracking-widest">NEW KEYWORD ALERT</div>
              <div class="p-4 flex flex-col gap-3">
                <div class="text-[8px] text-text_secondary/40 leading-relaxed">
                  Keywords are matched against ALL incoming live news articles in real-time. You'll get a push notification + badge.
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[7px] font-black text-text_secondary/40 tracking-widest">KEYWORD OR PHRASE</label>
                  <input
                    type="text" placeholder="e.g. GOTO, Bank Indonesia, Fed Rate"
                    value={newKW()}
                    onInput={e => setNewKW(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addKeyword()}
                    class="bg-bg_main border border-border_main px-3 py-2 text-[9px] focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div class="flex flex-wrap gap-1">
                  <div class="text-[7px] text-text_secondary/30 tracking-widest mb-1 w-full">QUICK ADD:</div>
                  <For each={['Bank Indonesia', 'Fed Rate', 'IHSG', 'Rupiah', 'Bitcoin', 'Tariff', 'Inflation']}>
                    {kw => (
                      <button
                        onClick={() => { alertManager.addKeyword(kw); refresh(); setNewKW(''); }}
                        class="px-2 py-1 text-[8px] font-black border border-border_main text-text_secondary/50 hover:border-yellow-500/50 hover:text-yellow-400 transition-all"
                      >{kw}</button>
                    )}
                  </For>
                </div>
                <Show when={kError()}>
                  <div class="text-red-400 text-[8px] font-black">{kError()}</div>
                </Show>
                <button onClick={addKeyword}
                  class="w-full py-2.5 bg-yellow-500 text-bg_main text-[9px] font-black tracking-widest hover:bg-yellow-400 transition-all mt-2">
                  FOLLOW KEYWORD
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* ── FOOTER ── */}
      <div class="h-8 border-t border-border_main bg-bg_header/30 flex items-center px-6 justify-between shrink-0">
        <span class="text-[8px] text-text_secondary/30 tracking-widest">
          PRICE UPDATE: 30S // KEYWORD MATCH: REALTIME // STORAGE: LOCAL
        </span>
        <span class="text-[8px] font-black text-yellow-400/20 italic tracking-widest">ENQY TERMINAL // ALERT SYSTEM</span>
      </div>
    </div>
  );
}
