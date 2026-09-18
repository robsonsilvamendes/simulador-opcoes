/* Aba 3 — Estratégias com várias pernas */
(function () {
  const { h, fmt: F, t } = OP;
  const M = Strat.market;
  const S = Strat.state;
  const KIND = { call: 'Call', put: 'Put', stock: 'Ação' };
  const GROUPS = ['Altista', 'Baixista', 'Renda', 'Proteção', 'Volatilidade', 'Livre'];

  function profitZones(legs, bes) {
    const pts = [0, ...bes], zones = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = i + 1 < pts.length ? pts[i + 1] : Infinity;
      const mid = b === Infinity ? Math.max(a * 1.5, a + 1) : (a + b) / 2;
      if (Strat.pnlExpiry(legs, mid) > 1e-9) zones.push([a, b]);
    }
    return zones;
  }
  const zoneText = ([a, b]) => (a === 0 && b === Infinity ? 'qualquer preço' : a === 0 ? `abaixo de ${F.brl(b)}` : b === Infinity ? `acima de ${F.brl(a)}` : `entre ${F.brl(a)} e ${F.brl(b)}`);

  function mount(root) {
    const ui = { elapsed: Math.floor(M.days / 2), volShift: 0, showLegs: false };

    root.append(h('div', { class: 'hero-h' },
      h('h2', {}, 'Estratégias: combine as peças'),
      h('p', { html: `Escolha uma estratégia pronta (ou monte a sua) e veja o resultado no vencimento e <b>antes</b> dele. Os prêmios são calculados pelo ${t('bs')} com os parâmetros da barra de mercado; você pode digitar prêmios próprios (ficam com borda laranja).` })));

    // ---------- coluna esquerda: catálogo ----------
    const catalog = OP.card('Catálogo', 'Clique para carregar.');
    const listEl = h('div', { class: 'preset-groups' });
    catalog.body.append(listEl);
    GROUPS.forEach((g) => {
      const items = Strat.PRESETS.filter((p) => p.grupo === g);
      if (!items.length) return;
      const btns = items.map((p) => h('button', { type: 'button', 'data-id': p.id, onclick: () => { Strat.loadPreset(p.id); ui.elapsed = Math.floor(M.days / 2); renderAll(); OP.markDirtyExcept('estrategias'); } }, p.nome));
      listEl.append(h('div', {}, h('h4', {}, g === 'Livre' ? 'Do seu jeito' : g), h('div', { class: 'preset-list' }, btns)));
    });

    // ---------- coluna direita ----------
    const headCard = OP.card('');
    const titleEl = headCard.el.querySelector('h3');
    const headInfo = h('div');
    const legsHost = h('div', { style: 'overflow-x:auto' });
    const addRow = h('div', { class: 'row', style: 'margin-top:10px;gap:8px' },
      h('span', { class: 'muted', style: 'font-size:13px' }, 'Adicionar perna:'),
      [['call', 1, '+ Call comprada'], ['call', -1, '+ Call vendida'], ['put', 1, '+ Put comprada'], ['put', -1, '+ Put vendida'], ['stock', 1, '+ Ação']].map(([k, s, l]) =>
        h('button', { class: 'btn small', type: 'button', onclick: () => { Strat.addLeg(k, s); renderAll(); OP.markDirtyExcept('estrategias'); } }, l)));
    headCard.body.append(headInfo, legsHost, addRow);

    const statsCard = OP.card('Números da estratégia');
    const statsEl = h('div', { class: 'stats' });
    const zonesEl = h('div', { class: 'explain', style: 'margin-top:4px' });
    statsCard.body.append(statsEl, zonesEl);

    // gráfico principal
    const chartCard = OP.card('Resultado por preço do ativo', 'A linha azul é o resultado se você <b>segurar até o vencimento</b>. A laranja mostra o resultado teórico depois de alguns dias — repare como ela "suaviza" as quinas e converge para a azul.');
    const timeS = OP.slider({ label: 'Dias que já se passaram desde a entrada', min: 0, max: M.days, step: 1, value: ui.elapsed, decimals: 0, unit: 'dias', onInput: (v) => { ui.elapsed = Math.round(v); drawCharts(); } });
    const volS = OP.slider({ label: 'Choque na ' + t('iv', 'volatilidade implícita'), min: -20, max: 30, step: 1, value: 0, decimals: 0, unit: 'pts', onInput: (v) => { ui.volShift = v; drawCharts(); }, help: 'Some/subtraia pontos percentuais de vol para ver o efeito (vega).' });
    const legsT = OP.toggle({ label: 'Mostrar o resultado de cada perna', value: false, onChange: (v) => { ui.showLegs = v; drawCharts(); } });
    const chartHost = h('div');
    const chart = new Charts.LineChart(chartHost);
    chartCard.body.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, h('div', { style: 'flex:1;min-width:230px' }, timeS.el), h('div', { style: 'flex:1;min-width:230px' }, volS.el), legsT.el), chartHost);

    // mapa de calor
    const heatCard = OP.card('Mapa de calor: preço do ativo × tempo', 'Cada célula é o resultado da estratégia naquele preço e naquele número de dias restantes. <b>Azul = lucro</b>, <b>vermelho = prejuízo</b>, cinza = zero. O tempo corre de cima (hoje) para baixo (vencimento). Usa o mesmo choque de volatilidade acima.');
    const heatHost = h('div');
    const heat = new Charts.Heatmap(heatHost);
    heatCard.body.append(heatHost);

    // gregas
    const gCard = OP.card('Gregas da estratégia (agora)', 'Somam-se as gregas de cada perna. Elas dizem <i>como o resultado reage</i> a cada fator, a partir do preço de hoje.');
    const gEl = h('div', { class: 'stats' });
    const gExp = h('div', { class: 'explain' });
    gCard.body.append(gEl, gExp);

    // explicação
    const exCard = OP.card('Como funciona');
    const exEl = h('div', { class: 'explain' });
    exCard.body.append(exEl);

    root.append(h('div', { class: 'side' }, catalog.el, h('div', {}, headCard.el, statsCard.el, chartCard.el, heatCard.el, gCard.el, exCard.el)));

    // ---------------------------------------------------------------
    function renderLegs() {
      legsHost.innerHTML = '';
      if (!S.legs.length) { legsHost.append(h('p', { class: 'muted' }, 'Nenhuma perna ainda. Use os botões abaixo para adicionar.')); return; }
      const commit = () => { S.custom = true; Strat.syncPremiums(S.legs); renderAll(); OP.markDirtyExcept('estrategias'); };
      const tb = h('table', { class: 'legs' }, h('thead', {}, h('tr', {}, ['Lado', 'Tipo', 'Strike', 'Prêmio (R$)', 'Lotes', ''].map((x) => h('th', {}, x)))));
      const body = h('tbody');
      S.legs.forEach((l) => {
        const side = h('select', { 'aria-label': 'Lado', onchange: (e) => { l.side = +e.target.value; commit(); } },
          h('option', { value: 1, selected: l.side === 1 }, 'Compra'), h('option', { value: -1, selected: l.side === -1 }, 'Venda'));
        const kind = h('select', { 'aria-label': 'Tipo', onchange: (e) => { l.kind = e.target.value; if (l.kind !== 'stock' && !l.K) l.K = Strat.roundK(M.spot); l.manual = false; commit(); } },
          ...Object.entries(KIND).map(([v, n]) => h('option', { value: v, selected: l.kind === v }, n)));
        const K = h('input', { type: 'number', step: Strat.strikeStep(M.spot), min: 0.01, value: l.kind === 'stock' ? '' : l.K, disabled: l.kind === 'stock', 'aria-label': 'Strike', onchange: (e) => { const v = +e.target.value; if (v > 0) { l.K = v; l.manual = false; commit(); } } });
        const P = h('input', { type: 'number', step: 0.01, min: 0, value: l.prem.toFixed(2), class: l.manual ? 'manual' : '', 'aria-label': 'Prêmio', title: l.manual ? 'Prêmio digitado por você' : 'Prêmio teórico (Black-Scholes)', onchange: (e) => { const v = +e.target.value; if (v >= 0) { l.prem = v; l.manual = true; commit(); } } });
        const Q = h('input', { type: 'number', step: 1, min: 1, value: l.qty, class: 'q', 'aria-label': 'Lotes', onchange: (e) => { const v = Math.max(1, Math.round(+e.target.value)); l.qty = v; commit(); } });
        const acts = h('div', { style: 'display:flex;gap:4px' },
          l.manual ? h('button', { class: 'btn small ghost', type: 'button', title: 'Voltar ao prêmio teórico', onclick: () => { l.manual = false; commit(); } }, '↺') : null,
          h('button', { class: 'btn small ghost rm', type: 'button', title: 'Remover perna', 'aria-label': 'Remover perna', onclick: () => { S.legs.splice(S.legs.indexOf(l), 1); commit(); } }, '✕'));
        body.append(h('tr', {}, h('td', {}, side), h('td', {}, kind), h('td', {}, K), h('td', {}, P), h('td', {}, Q), h('td', {}, acts)));
      });
      tb.append(body);
      legsHost.append(tb);
    }

    function renderHead() {
      const p = Strat.PRESETS.find((x) => x.id === S.presetId);
      titleEl.textContent = S.custom ? `${S.nome} — modificada por você` : S.nome;
      headInfo.innerHTML = p ? `<p style="margin:0 0 4px"><span class="badge">Visão: ${p.vies}</span></p><p class="explain" style="margin:6px 0 12px">${p.resumo}</p>` : '';
      listEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === S.presetId));
    }

    function renderStats() {
      const legs = S.legs;
      statsEl.innerHTML = ''; zonesEl.innerHTML = '';
      const mt = Strat.metrics(legs);
      if (!mt) { statsEl.append(h('p', { class: 'muted' }, 'Adicione pernas para ver os números.')); return mt; }
      const pr = Strat.probability(legs, M.days, M.rate, M.vol);
      const hasStock = legs.some((l) => l.kind === 'stock');
      const optNet = legs.filter((l) => l.kind !== 'stock').reduce((s, l) => s + l.side * l.qty * M.lot * l.prem, 0);
      const risk = mt.unlimitedLoss ? Infinity : -mt.maxLoss;
      const reward = mt.unlimitedGain ? Infinity : mt.maxGain;
      statsEl.append(...[
        OP.stat(optNet >= 0 ? 'Débito das opções' : 'Crédito das opções', F.brl(Math.abs(optNet)), optNet >= 0 ? 'você paga para montar' : 'você recebe para montar'),
        hasStock ? OP.stat('Capital em ações', F.brl(legs.filter((l) => l.kind === 'stock').reduce((s, l) => s + l.side * l.qty * M.lot * l.prem, 0)), 'valor da posição em ações') : null,
        OP.stat('Lucro máximo', mt.unlimitedGain ? 'Ilimitado' : F.brl(mt.maxGain), '', 'pos'),
        OP.stat('Prejuízo máximo', mt.unlimitedLoss ? 'Ilimitado' : F.brl(mt.maxLoss), hasStock && !mt.unlimitedLoss ? 'inclui a queda da ação a zero' : '', 'neg'),
        OP.stat('Pontos de equilíbrio', mt.breakevens.length ? mt.breakevens.map((b) => F.num(b)).join(' e ') : '—', mt.breakevens.length ? 'R$ no vencimento' : ''),
        OP.stat('Chance de lucro', pr ? F.pct(pr.pop, 0) : '—', 'no vencimento, pelo modelo'),
        isFinite(reward) && isFinite(risk) && risk > 0 ? OP.stat('Ganho ÷ risco', F.num(reward / risk, 2) + ' : 1', 'lucro máx. para cada R$ 1 arriscado') : null
      ].filter(Boolean));
      const zones = profitZones(legs, mt.breakevens);
      zonesEl.innerHTML = zones.length ? `<p><b>Você lucra no vencimento se o ativo terminar ${zones.map(zoneText).join(' ou ')}.</b> Hoje ele está a ${F.brl(M.spot)}.</p>` : '<p><b>Com estes prêmios, não há preço em que a estratégia termine no lucro no vencimento.</b></p>';
      return mt;
    }

    function drawCharts() {
      const legs = S.legs;
      if (!legs.length) { chart.set({ height: 200, series: [], x: {}, y: {} }); heat.set({ xs: [1], ys: [1], z: [[0]] }); return; }
      const mt = Strat.metrics(legs);
      const ks = Strat.kinks(legs);
      const [lo, hi] = OP.priceRange(ks);
      const xs = [0, ...Strat.sampleX(lo, hi, 160, [...ks, ...mt.breakevens])];
      const vol = Math.max(0.01, M.vol + ui.volShift / 100);
      ui.elapsed = Math.max(0, Math.min(M.days, ui.elapsed));
      timeS.setRange(0, M.days); timeS.set(ui.elapsed);
      const left = M.days - ui.elapsed;

      const series = [{ id: 'exp', name: 'No vencimento', color: 'var(--s1)', xs, ys: xs.map((x) => Strat.pnlExpiry(legs, x)), z: 5 }];
      if (left > 0) series.push({ id: 'mid', name: ui.elapsed === 0 ? `Hoje (faltam ${left} dias)` : `Após ${ui.elapsed} dias (faltam ${left})`, color: 'var(--s2)', xs, ys: xs.map((x) => Strat.pnlAt(legs, x, left, vol)), z: 4 });
      if (ui.elapsed > 0 && ui.volShift === 0) series.push({ id: 'now', name: `Hoje (faltam ${M.days} dias)`, color: 'var(--muted)', dash: '2 4', xs, ys: xs.map((x) => Strat.pnlAt(legs, x, M.days, vol)), z: 3, width: 1.5 });
      if (ui.showLegs) {
        const cols = ['var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--muted)', 'var(--seq3)', 'var(--seq1)'];
        legs.forEach((l, i) => series.push({ id: 'leg' + i, name: `${l.side === 1 ? 'Compra' : 'Venda'} ${KIND[l.kind].toLowerCase()}${l.kind === 'stock' ? '' : ' ' + F.num(l.K)}`, color: cols[i % cols.length], xs, ys: xs.map((x) => Strat.pnlExpiry([l], x)), z: 1, width: 1.5 }));
      }
      chart.set({
        height: 400,
        x: { min: lo, max: hi, fmt: OP.axis.price, label: 'Preço do ativo' },
        y: { fmt: OP.axis.brl },
        series, shade: 'exp',
        vlines: [{ x: M.spot, label: `Preço atual ${F.num(M.spot)}`, color: 'var(--text)' }, ...ks.map((k) => ({ x: k, label: `K ${F.num(k)}`, color: 'var(--muted)' }))],
        dots: mt.breakevens.map((b) => ({ x: b, y: 0, color: 'var(--text)', label: F.num(b), below: true }))
      });

      // mapa de calor
      const nx = 41, xsH = Array.from({ length: nx }, (_, i) => lo + (hi - lo) * i / (nx - 1));
      const nrows = Math.min(M.days, 14);
      const ysH = [...new Set(Array.from({ length: nrows + 1 }, (_, j) => Math.round(M.days * (1 - j / nrows))))];
      const z = ysH.map((d) => xsH.map((x) => (d <= 0 ? Strat.pnlExpiry(legs, x) : Strat.pnlAt(legs, x, d, vol))));
      heat.set({
        xs: xsH, ys: ysH, z, height: Math.max(260, ysH.length * 24 + 60),
        xfmt: (v, tip) => (tip ? F.brl(v) : F.num(v, v >= 100 ? 0 : 1)),
        yfmt: (v, tip) => (tip ? `${v} dia(s) até o vencimento` : v === 0 ? 'venc.' : v + 'd'),
        zfmt: (v) => F.sbrl(v, 0),
        xlabel: 'Preço do ativo (R$)', ylabel: 'Dias até o vencimento',
        vlines: [{ x: M.spot, label: 'Preço atual', color: 'var(--text)' }],
        tooltip: (x, d, v) => `<div class="tip-h">Ativo a ${F.brl(x)}</div><div class="tip-r"><span>${d === 0 ? 'No vencimento' : 'Faltando ' + d + ' dia(s)'}</span><b class="${v >= 0 ? 'pos' : 'neg'}">${F.sbrl(v)}</b></div>`
      });
    }

    function renderGreeks() {
      gEl.innerHTML = ''; gExp.innerHTML = '';
      if (!S.legs.length) return;
      const g = Strat.netGreeks(S.legs);
      gEl.append(
        OP.stat(t('delta', 'Delta'), F.num(g.delta, 1), g.delta === 0 ? 'neutra a pequenos movimentos' : `≈ ${g.delta > 0 ? 'comprado' : 'vendido'} em ${F.num(Math.abs(g.delta), 0)} ações`, OP.tone(g.delta)),
        OP.stat(t('gamma', 'Gamma'), F.num(g.gamma, 2), g.gamma >= 0 ? 'delta cresce se o ativo sobe' : 'delta piora quando o ativo se move', OP.tone(g.gamma)),
        OP.stat(t('theta', 'Theta'), F.sbrl(g.theta), 'por dia, só pelo tempo', OP.tone(g.theta)),
        OP.stat(t('vega', 'Vega'), F.sbrl(g.vega), 'por +1 ponto de volatilidade', OP.tone(g.vega)),
        OP.stat(t('rho', 'Rho'), F.sbrl(g.rho), 'por +1 ponto de juros', OP.tone(g.rho))
      );
      const bits = [];
      bits.push(`Se o ativo subir R$ 1, a posição varia cerca de <b>${F.sbrl(g.delta)}</b> (delta).`);
      bits.push(g.theta >= 0 ? `O tempo joga <b>a seu favor</b>: cerca de ${F.brl(g.theta)} por dia.` : `O tempo joga <b>contra você</b>: cerca de ${F.brl(-g.theta)} por dia.`);
      bits.push(Math.abs(g.vega) < 1 ? 'Praticamente indiferente à volatilidade (vega ≈ 0).' : g.vega > 0 ? 'Você ganha se a volatilidade <b>subir</b> (posição "comprada em vol").' : 'Você ganha se a volatilidade <b>cair</b> (posição "vendida em vol").');
      gExp.innerHTML = '<p>' + bits.join(' ') + '</p>';
    }

    function renderExplain() {
      const p = Strat.PRESETS.find((x) => x.id === S.presetId);
      if (!p) { exEl.innerHTML = ''; return; }
      exEl.innerHTML = `
        <p><b>Como funciona.</b> ${p.como}</p>
        <p><b>Quando usar.</b> ${p.quando}</p>
        <p><b>Cuidados.</b> ${p.cuidado}</p>` + (S.custom ? '<p class="muted">Você alterou as pernas: os números acima já refletem a sua versão; o texto descreve a estratégia original.</p>' : '');
    }

    function renderAll() {
      Strat.syncPremiums(S.legs);
      renderHead(); renderLegs(); renderStats(); drawCharts(); renderGreeks(); renderExplain();
    }
    this.renderAll = renderAll;
    renderAll();
  }

  OP.register({ id: 'estrategias', title: 'Estratégias', icon: '🧩', mount, refresh() { if (this.renderAll) this.renderAll(); } });
})();
