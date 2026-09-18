/* Inicialização: tema, barra de mercado, abas e roteamento por hash (#payoff, #gregas…). */
(function () {
  const { h, fmt: F } = OP;
  const M = Strat.market;

  // ---------- tema ----------
  const root = document.documentElement;
  try { const saved = localStorage.getItem('op-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) { /* sem storage */ }
  document.getElementById('theme').addEventListener('click', () => {
    const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('op-theme', next); } catch (e) { /* ignora */ }
  });

  // ---------- estado inicial ----------
  Strat.loadPreset('trava-alta-call');

  // ---------- barra de mercado ----------
  const mk = document.getElementById('market');
  const spot = OP.slider({ label: `Preço do ${OP.t('opcao', 'ativo')}`, min: 5, max: 150, step: 0.1, value: M.spot, unit: 'R$', onInput: (v) => OP.setMarket({ spot: v }) });
  const vol = OP.slider({ label: OP.t('vol', 'Volatilidade') + ' (a.a.)', min: 5, max: 150, step: 1, value: M.vol * 100, unit: '%', onInput: (v) => OP.setMarket({ vol: v / 100 }) });
  const rate = OP.slider({ label: OP.t('selic', 'Juros (Selic)') + ' (a.a.)', min: 0, max: 30, step: 0.25, value: M.rate * 100, unit: '%', decimals: 2, onInput: (v) => OP.setMarket({ rate: v / 100 }) });
  const days = OP.slider({ label: 'Dias até o ' + OP.t('vencimento'), min: 1, max: 180, step: 1, value: M.days, unit: 'dias', decimals: 0, onInput: (v) => OP.setMarket({ days: Math.max(1, Math.round(v)) }) });
  mk.append(h('div', { class: 'wrap' }, spot.el, vol.el, rate.el, days.el, h('div', { class: 'lot', html: `Lote: <b>${M.lot}</b> opções por lote` })));

  // ---------- abas ----------
  const tabsEl = document.getElementById('tabs');
  const main = document.getElementById('main');
  const state = {};
  OP.tabs.forEach((tab) => {
    const panel = h('section', { class: 'tabpanel', id: 'panel-' + tab.id, role: 'tabpanel', hidden: true });
    main.appendChild(panel);
    const btn = h('button', { type: 'button', role: 'tab', id: 'tab-' + tab.id, 'aria-controls': 'panel-' + tab.id, onclick: () => OP.go(tab.id) }, `${tab.icon} ${tab.title}`);
    tabsEl.appendChild(btn);
    state[tab.id] = { tab, panel, btn, mounted: false, dirty: false };
  });

  let current = null;
  function show(id) {
    if (!state[id]) id = OP.tabs[0].id;
    Object.values(state).forEach((s) => { s.panel.hidden = s.tab.id !== id; s.btn.setAttribute('aria-selected', s.tab.id === id); });
    const s = state[id];
    current = id;
    if (!s.mounted) { s.mounted = true; s.tab.mount(s.panel); }
    else if (s.dirty) { s.dirty = false; s.tab.refresh && s.tab.refresh(); }
    // gráficos redesenham sozinhos ao ficarem visíveis (ResizeObserver)
  }
  OP.go = (id) => { if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id); show(id); window.scrollTo({ top: 0 }); };
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  OP.onMarket(() => {
    Object.values(state).forEach((s) => {
      if (!s.mounted) return;
      if (s.tab.id === current) s.tab.refresh && s.tab.refresh(); else s.dirty = true;
    });
  });
  // ao mudar as pernas dentro de Estratégias, as outras abas precisam saber
  OP.markDirtyExcept = (id) => Object.values(state).forEach((s) => { if (s.mounted && s.tab.id !== id) s.dirty = true; });

  show(location.hash.slice(1) || OP.tabs[0].id);
})();
