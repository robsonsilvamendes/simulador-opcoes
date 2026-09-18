/* Aba 6 — Simulação Monte Carlo da estratégia montada na aba Estratégias */
(function () {
  const { h, fmt: F, t } = OP;
  const M = Strat.market;
  const S = Strat.state;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeGauss(rng) {
    let spare = null;
    return () => {
      if (spare != null) { const s = spare; spare = null; return s; }
      let u = 0, v = 0;
      while (u === 0) u = rng();
      v = rng();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    };
  }
  const pctile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];

  /** GBM diário. Guarda todos os preços finais, 60 pontos de controle (para o leque) e 30 trajetórias. */
  function simulate(N, days, mu, sigma, seed) {
    const gauss = makeGauss(mulberry32(seed));
    const steps = Math.max(1, days);
    const dt = (days / 365) / steps;
    const drift = (mu - 0.5 * sigma * sigma) * dt, vol = sigma * Math.sqrt(dt);
    const nCheck = Math.min(60, steps);
    const checkIdx = Array.from({ length: nCheck + 1 }, (_, i) => Math.round(steps * i / nCheck));
    const isCheck = new Map(checkIdx.map((s, i) => [s, i]));
    const checks = checkIdx.map(() => new Float64Array(N));
    const finals = new Float64Array(N);
    const NP = 30;
    const sample = Array.from({ length: NP }, () => new Float64Array(checkIdx.length));
    for (let i = 0; i < N; i++) {
      let s = M.spot;
      checks[0][i] = s;
      if (i < NP) sample[i][0] = s;
      for (let k = 1; k <= steps; k++) {
        s *= Math.exp(drift + vol * gauss());
        const ci = isCheck.get(k);
        if (ci !== undefined) { checks[ci][i] = s; if (i < NP) sample[i][ci] = s; }
      }
      finals[i] = s;
    }
    return { N, finals, checks, checkIdx, steps, sample };
  }

  function histogram(values, lo, hi, nb, colorFn) {
    const w = (hi - lo) / nb, counts = new Array(nb).fill(0);
    values.forEach((v) => { let b = Math.floor((v - lo) / w); if (b < 0) b = 0; if (b >= nb) b = nb - 1; counts[b]++; });
    return counts.map((c, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, v: c / values.length, color: colorFn((lo + (i + 0.5) * w)) }));
  }

  function mount(root) {
    const ui = { N: 5000, mu: null, sigma: null, seed: 12345, sims: null };

    root.append(h('div', { class: 'hero-h' },
      h('h2', {}, 'Monte Carlo: milhares de futuros possíveis'),
      h('p', { html: `Em vez de olhar um único cenário, a ${t('montecarlo', 'simulação de Monte Carlo')} sorteia milhares de trajetórias para o preço do ativo (usando o ${t('gbm', 'movimento browniano geométrico')}) e mede o que a <b>sua estratégia</b> teria rendido em cada uma. O resultado é uma <i>distribuição</i> de lucros e prejuízos — muito mais honesta que um número só.` })));

    const stratLine = h('div');
    const emptyEl = h('div');
    const ctl = OP.card('Parâmetros da simulação');
    const nS = OP.seg({ label: 'Número de simulações', options: [{ v: 1000, label: '1.000' }, { v: 5000, label: '5.000' }, { v: 20000, label: '20.000' }], value: ui.N, onChange: (v) => { ui.N = v; run(); } });
    const muS = OP.slider({ label: 'Retorno esperado do ativo (a.a.)', min: -60, max: 100, step: 1, value: M.rate * 100, unit: '%', decimals: 0, onInput: (v) => { ui.mu = v / 100; run(); }, help: 'Por padrão = a taxa de juros (mundo "neutro ao risco", onde as opções são justamente precificadas). Suba para simular um ativo em tendência de alta; desça para queda.' });
    const sgS = OP.slider({ label: 'Volatilidade REAL do ativo (a.a.)', min: 5, max: 150, step: 1, value: M.vol * 100, unit: '%', decimals: 0, onInput: (v) => { ui.sigma = v / 100; run(); }, help: 'Por padrão = a vol usada no preço das opções. Se a vol REAL for maior que a implícita, quem comprou opções tende a ganhar; se menor, quem vendeu.' });
    const reroll = h('button', { class: 'btn primary', type: 'button', onclick: () => { ui.seed = Math.floor(Math.random() * 1e9); run(); } }, '🎲 Sortear de novo');
    const reset = h('button', { class: 'btn', type: 'button', onclick: () => { ui.mu = null; ui.sigma = null; run(); } }, 'Igualar ao mercado');
    ctl.body.append(h('div', { class: 'row' }, nS.el, h('div', { style: 'flex:1;min-width:230px' }, muS.el), h('div', { style: 'flex:1;min-width:230px' }, sgS.el), h('div', { style: 'display:flex;gap:8px' }, reroll, reset)));

    const statsCard = OP.card('Resultados da estratégia (mantida até o vencimento)');
    const statsEl = h('div', { class: 'stats' });
    const readEl = h('div', { class: 'explain' });
    statsCard.body.append(stratLine, statsEl, readEl);

    const fanCard = OP.card('Trajetórias do ativo', 'Cada linha cinza é um futuro possível. As faixas azuis mostram onde o preço fica em 50% e 90% dos casos. As linhas laranjas tracejadas são os strikes da sua estratégia.');
    const fanHost = h('div'); const fan = new Charts.LineChart(fanHost); fanCard.body.append(fanHost);

    const hCard = OP.card('Distribuição dos resultados', 'À esquerda, quanto a estratégia ganhou/perdeu (R$) nas simulações; à direita, onde o ativo terminou. Cada barra é a fração das simulações.');
    const h1 = h('div'), h2 = h('div');
    const hist1 = new Charts.Histogram(h1), hist2 = new Charts.Histogram(h2);
    hCard.body.append(h('div', { class: 'grid g2' }, h('div', {}, h('p', { class: 'chart-title' }, 'Resultado da estratégia (R$)'), h1), h('div', {}, h('p', { class: 'chart-title' }, 'Preço final do ativo (R$)'), h2)));

    const convCard = OP.card('Por que rodar milhares de vezes? A lei dos grandes números', 'A estimativa da chance de lucro oscila com poucas simulações e vai se aproximando do valor exato (linha laranja, calculada por fórmula) conforme o número de simulações cresce.');
    const convHost = h('div'); const conv = new Charts.LineChart(convHost); convCard.body.append(convHost);

    const noteCard = OP.card('Como interpretar');
    noteCard.body.append(h('div', { class: 'explain', html: `
      <ul>
        <li><b>Média × mediana.</b> A média (resultado esperado) pode ser positiva enquanto a maioria das simulações perde — típico de comprar opções OTM: muitos pequenos prejuízos e poucos ganhos enormes. A mediana mostra o caso "típico".</li>
        <li><b>Chance de lucro não é tudo.</b> Vender opções costuma ter chance de lucro alta, mas com perdas raras e grandes. Olhe também o pior 5% (P5) e o pior caso.</li>
        <li><b>Neutro ao risco.</b> Com retorno esperado = juros e vol real = implícita, o resultado <i>médio</i> de uma opção comprada é ≈ 0 (antes de custos): o prêmio é "justo". Lucro sistemático exige uma visão diferente do mercado — sobre direção ou sobre volatilidade.</li>
        <li><b>Limites do modelo.</b> Trajetórias reais têm saltos, caudas gordas, volatilidade que muda e dividendos. O Monte Carlo aqui assume vol constante: é uma bússola didática, não uma previsão.</li>
      </ul>` }));

    root.append(ctl.el, emptyEl, statsCard.el, fanCard.el, hCard.el, convCard.el, noteCard.el);

    function run() {
      const legs = S.legs;
      const empty = !legs.length;
      emptyEl.innerHTML = '';
      [statsCard, fanCard, hCard, convCard].forEach((c) => { c.el.hidden = empty; });
      if (empty) {
        emptyEl.append(OP.callout('warn', 'Você ainda não montou nenhuma estratégia. Vá até a aba <b>Estratégias</b>, escolha uma ou adicione pernas e volte aqui.', 'Nada para simular'));
        return;
      }
      const mu = ui.mu == null ? M.rate : ui.mu;
      const sigma = ui.sigma == null ? M.vol : ui.sigma;
      if (ui.mu == null) muS.set(M.rate * 100);
      if (ui.sigma == null) sgS.set(M.vol * 100);
      const days = M.days;
      const sim = simulate(ui.N, days, mu, sigma, ui.seed);
      const N = sim.N;

      const pnl = new Float64Array(N);
      for (let i = 0; i < N; i++) pnl[i] = Strat.pnlExpiry(legs, sim.finals[i]);
      const sorted = Float64Array.from(pnl).sort();
      let sum = 0, wins = 0;
      for (let i = 0; i < N; i++) { sum += pnl[i]; if (pnl[i] > 0) wins++; }
      const mean = sum / N, pop = wins / N;
      let v2 = 0; for (let i = 0; i < N; i++) v2 += (pnl[i] - mean) ** 2;
      const sd = Math.sqrt(v2 / N);
      const se = Math.sqrt(pop * (1 - pop) / N);
      const mt = Strat.metrics(legs);
      const ana = Strat.probability(legs, days, mu, sigma);
      const p5 = pctile(sorted, 0.05), p95 = pctile(sorted, 0.95), med = pctile(sorted, 0.5);
      const best = sorted[N - 1], worst = sorted[0];
      const atMaxLoss = mt && !mt.unlimitedLoss ? pnl.filter((v) => v <= mt.maxLoss + 0.01).length / N : null;

      stratLine.innerHTML = `<p style="margin:0 0 10px"><b>${S.custom ? S.nome + ' (modificada)' : S.nome}</b> — ${legs.map((l) => `${l.side === 1 ? 'compra' : 'venda'} ${l.qty}× ${l.kind === 'stock' ? 'ação' : (l.kind === 'call' ? 'call' : 'put') + ' ' + F.num(l.K)}`).join(' · ')} · ${F.num(N, 0)} simulações · ${days} dias · μ ${F.pct(mu, 0)} · σ ${F.pct(sigma, 0)}. <a href="#estrategias" onclick="OP.go('estrategias');return false">Editar estratégia →</a></p>`;
      statsEl.innerHTML = '';
      statsEl.append(
        OP.stat(t('pop', 'Chance de lucro'), F.pct(pop, 1), `± ${F.num(se * 196, 1)} p.p. (95%) · fórmula exata: ${ana ? F.pct(ana.pop, 1) : '—'}`),
        OP.stat('Resultado médio', F.sbrl(mean), `desvio-padrão ${F.brl(sd, 0)}`, OP.tone(mean)),
        OP.stat('Resultado mediano', F.sbrl(med), 'o caso "típico"', OP.tone(med)),
        OP.stat('Pior 5% dos casos', F.sbrl(p5), 'em 95% das vezes é melhor que isso', OP.tone(p5)),
        OP.stat('Melhor 5% dos casos', F.sbrl(p95), 'em 5% das vezes passa disso', OP.tone(p95)),
        OP.stat('Melhor / pior simulação', `${F.sbrl(best, 0)} / ${F.sbrl(worst, 0)}`, atMaxLoss != null ? `${F.pct(atMaxLoss, 0)} das simulações terminaram na perda máxima` : 'perda sem limite teórico')
      );
      const skew = mean > med + 1 ? 'A média está acima da mediana: poucos resultados muito bons puxam a média para cima, enquanto o caso típico é pior.' : mean < med - 1 ? 'A média está abaixo da mediana: o caso típico é positivo, mas existem perdas raras e grandes que puxam a média para baixo.' : 'Média e mediana são parecidas: a distribuição é relativamente simétrica.';
      readEl.innerHTML = `<p><b>Leitura:</b> em ${F.pct(pop, 0)} das ${F.num(N, 0)} simulações a estratégia terminou no lucro. ${skew} Em 5% dos casos o resultado foi pior que <b>${F.sbrl(p5)}</b>.</p>`;

      // leque
      const cx = sim.checkIdx.map((k) => k / sim.steps * days);
      const sortedChecks = sim.checks.map((c) => Float64Array.from(c).sort());
      const q = (p) => sortedChecks.map((c) => pctile(c, p));
      const [q05, q25, q50, q75, q95] = [0.05, 0.25, 0.5, 0.75, 0.95].map(q);
      const ks = Strat.kinks(legs);
      const series = sim.sample.map((s, i) => ({ id: 'p' + i, name: null, color: 'var(--muted)', xs: cx, ys: Array.from(s), width: 1, opacity: 0.4, hover: false, legend: false, z: 0 }));
      series.push({ id: 'med', name: 'Mediana das simulações', color: 'var(--s1)', xs: cx, ys: q50, z: 5 });
      fan.set({
        height: 380, table: false,
        x: { min: 0, max: days, fmt: (v) => F.num(v, 0), label: 'Dias a partir de hoje' },
        y: { fmt: OP.axis.price, zero: false },
        bands: [{ xs: cx, lo: q05, hi: q95, color: 'var(--s1)', opacity: 0.12 }, { xs: cx, lo: q25, hi: q75, color: 'var(--s1)', opacity: 0.22 }],
        series,
        hlines: ks.map((k) => ({ y: k, color: 'var(--s2)' })),
        legendExtra: [{ name: 'Uma simulação', color: 'var(--muted)' }, { name: '50% das simulações', color: 'var(--s1)', type: 'area' }, { name: '90% das simulações', color: 'var(--s1)', type: 'area' }, { name: 'Strikes', color: 'var(--s2)', dash: true }],
        tipHead: (x) => `Dia ${F.num(x, 0)}`
      });

      // histogramas
      const lo = Math.min(pctile(sorted, 0.003), 0), hi = Math.max(pctile(sorted, 0.997), 0);
      const span = hi - lo || 1;
      hist1.set({
        height: 300,
        bins: histogram(pnl, lo, hi + span * 1e-9, 36, (c) => (c >= 0 ? 'var(--pos)' : 'var(--neg)')),
        xfmt: (v, tip) => (tip ? F.sbrl(v, 0) : F.axisBrl(v)), yfmt: (v, tip) => F.pct(v, tip ? 1 : 0),
        xlabel: 'Resultado no vencimento',
        vlines: [{ x: 0, label: 'Zero', color: 'var(--text)', dash: false }, { x: mean, label: `Média ${F.sbrl(mean, 0)}`, color: 'var(--s2)' }],
        legend: [{ name: 'Lucro', color: 'var(--pos)', type: 'area' }, { name: 'Prejuízo', color: 'var(--neg)', type: 'area' }]
      });
      const fs = Float64Array.from(sim.finals).sort();
      const plo = pctile(fs, 0.003), phi = pctile(fs, 0.997);
      const mtBE = mt ? mt.breakevens : [];
      hist2.set({
        height: 300,
        bins: histogram(sim.finals, plo, phi + (phi - plo) * 1e-9, 36, () => 'var(--s1)'),
        xfmt: (v, tip) => (tip ? F.brl(v) : F.axisPrice(v)), yfmt: (v, tip) => F.pct(v, tip ? 1 : 0),
        xlabel: 'Preço do ativo no vencimento',
        vlines: [{ x: M.spot, label: `Hoje ${F.num(M.spot)}`, color: 'var(--text)', dash: false }, ...mtBE.map((b) => ({ x: b, label: `Equilíbrio ${F.num(b)}`, color: 'var(--s2)' }))]
      });

      // convergência
      const pts = 120, cxs = [], cys = [];
      let acc = 0;
      const stepN = Math.max(1, Math.floor(N / pts));
      for (let i = 0; i < N; i++) {
        if (pnl[i] > 0) acc++;
        if ((i + 1) % stepN === 0 && i + 1 >= 20) { cxs.push(i + 1); cys.push(acc / (i + 1)); }
      }
      const ser = [{ id: 'run', name: 'Chance de lucro estimada', color: 'var(--s1)', xs: cxs, ys: cys }];
      conv.set({
        height: 280, table: false,
        x: { min: cxs[0], max: cxs[cxs.length - 1], fmt: (v) => F.num(v, 0), label: 'Número de simulações' },
        y: { fmt: (v) => F.pct(v, 0), zero: false },
        series: ser,
        hlines: ana ? [{ y: ana.pop, color: 'var(--s2)', domain: true }] : [],
        legendExtra: ana ? [{ name: `Valor exato (fórmula): ${F.pct(ana.pop, 1)}`, color: 'var(--s2)', dash: true }] : [],
        tipHead: (x) => `${F.num(x, 0)} simulações`
      });
    }
    this.run = run;
    run();
  }

  OP.register({ id: 'montecarlo', title: 'Monte Carlo', icon: '🎲', mount, refresh() { if (this.run) this.run(); } });
})();
