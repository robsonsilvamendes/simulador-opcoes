/* Aba 4 — Gregas */
(function () {
  const { h, fmt: F, t } = OP;
  const M = Strat.market;

  const GREEKS = [
    {
      key: 'delta', nome: 'Delta (Δ)', sub: 'A sensibilidade ao preço do ativo',
      get: (g) => g.delta, fmt: (v) => F.num(v, 3), axis: (v, tip) => F.num(v, tip ? 3 : 2),
      resumo: (ty) => `Quanto o prêmio muda, em R$, quando o ativo sobe R$ 1. ${ty === 'call' ? 'Na call vai de 0 a +1.' : 'Na put vai de −1 a 0.'}`,
      ler: ['ATM: delta perto de ±0,50 — a opção anda "meio a meio" com o ativo.', 'Bem ITM: perto de ±1 — a opção se comporta como a própria ação.', 'Bem OTM: perto de 0 — quase não reage.', 'Serve também como uma <i>aproximação</i> da chance de terminar ITM.'],
      ex: (g, o) => {
        const d = g.delta, up = BS.price({ ...o, S: o.S + 1 }) - g.price;
        return `Com delta <b>${F.num(d, 2)}</b>: se o ativo subir R$ 1 (de ${F.brl(o.S)} para ${F.brl(o.S + 1)}), o prêmio ${d >= 0 ? 'sobe' : 'cai'} cerca de <b>${F.brl(Math.abs(d))}</b> (de ${F.brl(g.price)} para ~${F.brl(g.price + d)}). Isso equivale a ${F.num(Math.abs(d) * M.lot, 0)} ações por lote de ${M.lot} opções. Chance aproximada de terminar ITM: <b>${F.pct(Math.abs(d), 0)}</b>.`;
      }
    },
    {
      key: 'gamma', nome: 'Gamma (Γ)', sub: 'A "aceleração": como o delta muda',
      get: (g) => g.gamma, fmt: (v) => F.num(v, 3), axis: (v, tip) => F.num(v, tip ? 4 : 2),
      resumo: () => 'Quanto o DELTA muda quando o ativo sobe R$ 1. É a curvatura do prêmio — igual para call e put.',
      ler: ['Pico no ATM: é onde o delta muda mais rápido.', 'Perto do vencimento a curva vira uma <b>agulha</b> altíssima: opções ATM ficam "nervosas" nos últimos dias.', 'Comprado em opção = gamma positivo (você se beneficia de movimentos grandes). Vendido = gamma negativo (você sofre com eles).'],
      ex: (g, o) => {
        const g2 = BS.greeks({ ...o, S: o.S + 1 });
        return `Com gamma <b>${F.num(g.gamma, 3)}</b>: se o ativo subir R$ 1, o delta passa de <b>${F.num(g.delta, 2)}</b> para cerca de <b>${F.num(g2.delta, 2)}</b>. O gamma é por isso que o lucro de uma call acelera em altas fortes.`;
      }
    },
    {
      key: 'theta', nome: 'Theta (Θ)', sub: 'O preço da passagem do tempo',
      get: (g) => g.theta, fmt: (v) => F.num(v, 4), axis: (v, tip) => F.num(v, tip ? 4 : 3),
      resumo: () => 'Quanto o prêmio perde por DIA (corrido), tudo mais constante. Negativo para quem compra; positivo para quem vende.',
      ler: ['Mais forte (mais negativo) no ATM.', 'Cresce em módulo conforme o vencimento se aproxima — o "derretimento" acelera.', 'É a razão pela qual comprar opções exige acertar direção <b>e</b> timing.', 'Quem vende opções "recebe" o theta — mas assume o risco de gamma.'],
      ex: (g, o) => {
        const d7 = Math.min(7, M.days);
        const p7 = BS.price({ ...o, T: Strat.T(M.days - d7) });
        return `Com theta <b>${F.num(g.theta, 4)}</b>: a opção perde cerca de <b>${F.brl(Math.abs(g.theta))}</b> por dia por opção (<b>${F.brl(Math.abs(g.theta) * M.lot)}</b> por lote). Se o ativo ficar parado por ${d7} dias, o prêmio vai de ${F.brl(g.price)} para <b>${F.brl(p7)}</b> (${F.pct((p7 - g.price) / g.price, 0)}).`;
      }
    },
    {
      key: 'vega', nome: 'Vega (ν)', sub: 'A sensibilidade à volatilidade',
      get: (g) => g.vega, fmt: (v) => F.num(v, 4), axis: (v, tip) => F.num(v, tip ? 4 : 2),
      resumo: () => 'Quanto o prêmio muda, em R$, quando a volatilidade implícita sobe 1 ponto percentual (ex.: de 35% para 36%).',
      ler: ['Máximo no ATM; opções muito ITM ou OTM quase não reagem.', 'Maior em prazos longos e some perto do vencimento.', 'Comprar opção = comprar volatilidade (ganha se ela sobe). Vender opção = vender volatilidade.', 'Após um evento (balanço, eleição), a vol costuma despencar — o "vol crush" — e o prêmio cai mesmo sem o ativo se mexer.'],
      ex: (g, o) => {
        const pUp = BS.price({ ...o, v: o.v + 0.10 });
        return `Com vega <b>${F.num(g.vega, 4)}</b>: se a vol implícita subir de ${F.pct(o.v, 0)} para ${F.pct(o.v + 0.01, 0)}, o prêmio sobe cerca de <b>${F.brl(g.vega)}</b>. Se subir 10 pontos (para ${F.pct(o.v + 0.1, 0)}), o prêmio vai a ${F.brl(pUp)}.`;
      }
    },
    {
      key: 'rho', nome: 'Rho (ρ)', sub: 'A sensibilidade aos juros',
      get: (g) => g.rho, fmt: (v) => F.num(v, 4), axis: (v, tip) => F.num(v, tip ? 4 : 2),
      resumo: (ty) => `Quanto o prêmio muda quando a taxa de juros sobe 1 ponto percentual. ${ty === 'call' ? 'Positivo na call.' : 'Negativo na put.'}`,
      ler: ['Juros maiores → o valor presente do strike cai → calls valem um pouco mais, puts um pouco menos.', 'Aumenta com o prazo; em opções de poucas semanas é minúsculo.', 'Com a Selic alta, o Brasil dá algum peso a ele, mas ainda é a menos importante das gregas.'],
      ex: (g, o) => `Com rho <b>${F.num(g.rho, 4)}</b>: se a Selic subir 1 ponto (de ${F.pct(o.r, 2)} para ${F.pct(o.r + 0.01, 2)}), o prêmio muda cerca de <b>${F.sbrl(g.rho, 4)}</b> — quase irrelevante neste prazo.`
    }
  ];

  function mount(root) {
    const st = { type: 'call', K: Strat.roundK(M.spot) };
    root.append(h('div', { class: 'hero-h' },
      h('h2', {}, 'As Gregas: como o prêmio reage'),
      h('p', { html: `As gregas são as "derivadas" do preço da opção: cada uma mede a reação a <b>um</b> fator, com os outros fixos. Nos gráficos, cada linha é um prazo até o vencimento (mais escura = mais perto do vencimento). O ponto marca a sua opção hoje.` })));

    const ctl = OP.card('A opção analisada');
    const typeS = OP.seg({ label: 'Tipo', options: [{ v: 'call', label: 'Call' }, { v: 'put', label: 'Put' }], value: 'call', onChange: (v) => { st.type = v; drawAll(); } });
    const kS = OP.slider({ label: 'Strike (R$)', min: 1, max: 100, step: 0.5, value: st.K, onInput: (v) => { st.K = v; drawAll(); } });
    const sumEl = h('div', { class: 'stats', style: 'margin:0' });
    ctl.body.append(h('div', { class: 'row', style: 'align-items:flex-end' }, h('div', { style: 'min-width:170px' }, typeS.el), h('div', { style: 'min-width:260px;flex:1' }, kS.el)), h('div', { style: 'margin-top:14px' }, sumEl));
    root.append(ctl.el);

    const grid = h('div', { class: 'greek-grid' });
    const cards = GREEKS.map((g) => {
      const valEl = h('span', { class: 'val' });
      const host = h('div');
      const resumo = h('p', { class: 'greek-sub' });
      const ler = h('ul', { class: 'explain', style: 'margin:8px 0 0' });
      const ex = h('div', { class: 'greek-ex' });
      const el = h('section', { class: 'card' }, h('div', { class: 'greek-head' }, h('h3', {}, g.nome), valEl), h('p', { class: 'muted', style: 'margin:0 0 4px;font-size:13.5px' }, g.sub), resumo, host, h('b', { style: 'display:block;margin-top:10px;font-size:13.5px' }, 'Como ler:'), ler, ex);
      grid.append(el);
      return { g, valEl, chart: new Charts.LineChart(host), resumo, ler, ex };
    });
    // cola de sinais
    const cheat = OP.card('Cola rápida: sinal das gregas por posição', 'Útil para montar estratégias com a exposição que você quer.');
    cheat.body.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'cmp', html: `
      <thead><tr><th>Posição</th><th>Delta</th><th>Gamma</th><th>Theta (tempo)</th><th>Vega (vol)</th><th>Em uma frase</th></tr></thead>
      <tbody>
        <tr><td>Call comprada</td><td class="pos">+</td><td class="pos">+</td><td class="neg">−</td><td class="pos">+</td><td>Quer alta, movimento e volatilidade; o tempo corrói.</td></tr>
        <tr><td>Call vendida</td><td class="neg">−</td><td class="neg">−</td><td class="pos">+</td><td class="neg">−</td><td>Quer lateralidade ou queda; recebe do tempo, sofre com sustos.</td></tr>
        <tr><td>Put comprada</td><td class="neg">−</td><td class="pos">+</td><td class="neg">−</td><td class="pos">+</td><td>Quer queda; o tempo corrói; vol alta ajuda.</td></tr>
        <tr><td>Put vendida</td><td class="pos">+</td><td class="neg">−</td><td class="pos">+</td><td class="neg">−</td><td>Quer alta ou lateral; recebe do tempo; risco de queda forte.</td></tr>
      </tbody>` })));
    root.append(grid, cheat.el);

    function drawAll() {
      const S = M.spot, K = st.K;
      kS.setRange(Math.max(1, Math.round(S * 0.4)), Math.round(S * 1.8));
      const base = { type: st.type, S, K, T: Strat.T(M.days), r: M.rate, q: 0, v: M.vol };
      const g0 = BS.greeks(base);
      const [lo, hi] = OP.priceRange([K]);
      const xs = Strat.sampleX(lo, hi, 140, [K]);
      let mats = [...new Set([M.days, Math.max(1, Math.round(M.days / 3)), Math.min(2, M.days)])].sort((a, b) => b - a);
      const colors = mats.length === 3 ? ['var(--seq1)', 'var(--seq2)', 'var(--seq4)'] : mats.length === 2 ? ['var(--seq1)', 'var(--seq4)'] : ['var(--seq2)'];

      sumEl.innerHTML = '';
      const itm = st.type === 'call' ? S > K : S < K;
      sumEl.append(
        OP.stat('Prêmio teórico', F.brl(g0.price), itm ? 'ITM' : Math.abs(S / K - 1) < 0.015 ? 'ATM' : 'OTM'),
        OP.stat(t('delta', 'Delta'), F.num(g0.delta, 3), '', OP.tone(g0.delta)),
        OP.stat(t('gamma', 'Gamma'), F.num(g0.gamma, 3)),
        OP.stat(t('theta', 'Theta'), F.num(g0.theta, 4), 'R$ por dia', 'neg'),
        OP.stat(t('vega', 'Vega'), F.num(g0.vega, 4), 'R$ por +1 pt de vol'),
        OP.stat(t('rho', 'Rho'), F.num(g0.rho, 4), 'R$ por +1 pt de juros')
      );

      cards.forEach(({ g, valEl, chart, resumo, ler, ex }) => {
        valEl.textContent = g.fmt(g.get(g0));
        resumo.textContent = g.resumo(st.type);
        ler.innerHTML = g.ler.map((x) => `<li>${x}</li>`).join('');
        ex.innerHTML = g.ex(g0, base);
        const series = mats.map((d, i) => ({
          id: 'm' + d, name: `${d} dia${d > 1 ? 's' : ''}${d === M.days ? ' (hoje)' : ''}`, color: colors[i],
          xs, ys: xs.map((x) => g.get(BS.greeks({ ...base, S: x, T: Strat.T(d) })))
        }));
        chart.set({
          height: 250, table: false,
          x: { min: lo, max: hi, fmt: OP.axis.price, label: 'Preço do ativo' },
          y: { fmt: g.axis, zero: true },
          series,
          vlines: [{ x: S, label: 'Ativo', color: 'var(--text)' }, { x: K, label: 'Strike', color: 'var(--muted)' }],
          dots: [{ x: S, y: g.get(g0), color: 'var(--text)' }],
          tooltip: (x, rows) => `<div class="tip-h">Ativo a ${F.brl(x)}</div>` + rows.map((q) => `<div class="tip-r"><i style="background:${q.color}"></i><span>${q.name}</span><b>${g.fmt(q.y)}</b></div>`).join('')
        });
      });
    }
    this.drawAll = drawAll;
    drawAll();
  }

  OP.register({ id: 'gregas', title: 'Gregas', icon: '🔬', mount, refresh() { if (this.drawAll) this.drawAll(); } });
})();
