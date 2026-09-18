/* Aba 5 — Tempo e volatilidade */
(function () {
  const { h, fmt: F, t } = OP;
  const M = Strat.market;

  function mount(root) {
    const st = { type: 'call', K: Strat.roundK(M.spot), premInput: null };
    root.append(h('div', { class: 'hero-h' },
      h('h2', {}, 'Tempo e volatilidade: o que "enche" e "esvazia" o prêmio'),
      h('p', { html: `O prêmio de uma opção tem duas peças que você não controla: o <b>tempo</b> que falta e a <b>volatilidade</b> esperada. Aqui você vê os dois em ação — e o que significa dizer que uma opção está "cara" ou "barata".` })));

    const ctl = OP.card('A opção analisada');
    const typeS = OP.seg({ label: 'Tipo', options: [{ v: 'call', label: 'Call' }, { v: 'put', label: 'Put' }], value: 'call', onChange: (v) => { st.type = v; st.premInput = null; drawAll(); } });
    const kS = OP.slider({ label: 'Strike (R$)', min: 1, max: 100, step: 0.5, value: st.K, onInput: (v) => { st.K = v; st.premInput = null; drawAll(); } });
    ctl.body.append(h('div', { class: 'row' }, h('div', { style: 'min-width:170px' }, typeS.el), h('div', { style: 'min-width:260px;flex:1' }, kS.el)));
    root.append(ctl.el);

    const mkChartCard = (title, sub) => { const c = OP.card(title, sub); const host = h('div'); const text = h('div', { class: 'explain', style: 'margin-top:12px' }); c.body.append(host, text); return { c, host, text, chart: new Charts.LineChart(host) }; };
    const A = mkChartCard('1 · O prêmio ao longo do tempo', 'A mesma opção, em datas diferentes. Mais escura = mais perto do vencimento. No fim, sobra só o valor intrínseco (a "quina").');
    const B = mkChartCard('2 · O derretimento do valor extrínseco', 'O tempo corre da esquerda (hoje) para a direita (vencimento), com o ativo parado no preço atual. Compare opções ITM, ATM e OTM do mesmo tipo.');
    const C = mkChartCard('3 · Quanto vale a volatilidade', 'Prêmio em função da volatilidade implícita, com o ativo e o prazo atuais. É por isso que a IV é tratada como "o preço" da opção.');
    // calculadora de IV
    const ivCard = OP.card('Calculadora de volatilidade implícita', 'Digite o prêmio que você vê na tela da corretora — o simulador descobre qual volatilidade o mercado está embutindo nele (mesmo strike, prazo e preço do ativo da barra superior).');
    const premInp = h('input', { type: 'number', step: 0.01, min: 0, class: 'txt', style: 'width:110px', 'aria-label': 'Prêmio de mercado' });
    const ivOut = h('div', { class: 'stats', style: 'margin:12px 0 0' });
    premInp.addEventListener('input', () => { st.premInput = premInp.value === '' ? null : +premInp.value; drawIV(); });
    ivCard.body.append(h('div', { class: 'row' }, h('div', { class: 'ctl' }, h('label', {}, 'Prêmio de mercado (R$ por opção)'), premInp)), ivOut, h('div', { class: 'explain', style: 'margin-top:10px', html: `<p><b>Como usar:</b> compare a IV com a volatilidade que você acha que o ativo terá. Se a IV é <b>maior</b> que sua expectativa de oscilação, a opção está "cara" (bom para quem vende). Se é <b>menor</b>, está "barata" (bom para quem compra). Isso é o cerne do jogo de opções: você negocia <i>volatilidade</i>, não só direção.</p>` }));
    const D = mkChartCard('4 · O cone de preços: o que a volatilidade quer dizer', 'Com a volatilidade da barra superior, esta é a faixa de preços que o modelo considera plausível ao longo do tempo. A faixa escura tem ~68% de probabilidade; a clara, ~95%.');
    root.append(A.c.el, B.c.el, C.c.el, ivCard.el, D.c.el);

    function drawIV() {
      const o = base();
      const prem = st.premInput != null ? st.premInput : BS.price(o);
      if (st.premInput == null) premInp.value = (Math.round(prem * 100) / 100).toFixed(2);
      const iv = BS.impliedVol(prem, o);
      ivOut.innerHTML = '';
      if (iv == null) { ivOut.append(OP.callout('warn', `Esse prêmio é incompatível com o modelo: fica abaixo do valor intrínseco (${F.brl(BS.intrinsic(o.type, o.S, o.K))}) ou acima do máximo teórico. Verifique o strike e os dados.`)); return; }
      const move = iv * Math.sqrt(Strat.T(M.days));
      ivOut.append(
        OP.stat('Volatilidade implícita', F.pct(iv, 1), `a.a. — a barra de mercado usa ${F.pct(M.vol, 0)}`),
        OP.stat('Comparada à vol da barra', iv > M.vol + 0.005 ? 'Mais cara' : iv < M.vol - 0.005 ? 'Mais barata' : 'Igual', `${iv >= M.vol ? '+' : '−'}${F.num(Math.abs(iv - M.vol) * 100, 1)} pontos de volatilidade`),
        OP.stat('Movimento esperado (±1σ)', '±' + F.pct(move, 1), `até o vencimento (${M.days} dias): entre ${F.brl(M.spot * (1 - move))} e ${F.brl(M.spot * (1 + move))} com ~68% de chance`)
      );
    }
    function base() { return { type: st.type, S: M.spot, K: st.K, T: Strat.T(M.days), r: M.rate, q: 0, v: M.vol }; }

    function drawAll() {
      const S = M.spot, K = st.K;
      kS.setRange(Math.max(1, Math.round(S * 0.4)), Math.round(S * 1.8));
      const o = base();
      const isCall = st.type === 'call';
      const [lo, hi] = OP.priceRange([K]);
      const aLo = Math.min(S, K) * 0.8, aHi = Math.max(S, K) * 1.2;

      // ---- A: valor x preço em vários prazos ----
      const xs = Strat.sampleX(aLo, aHi, 140, [K]);
      let days = [...new Set([M.days, Math.round(M.days * 2 / 3), Math.round(M.days / 3), 0])].filter((d) => d >= 0).sort((a, b) => b - a);
      const cols = days.length === 4 ? ['var(--seq1)', 'var(--seq2)', 'var(--seq3)', 'var(--seq4)'] : days.length === 3 ? ['var(--seq1)', 'var(--seq3)', 'var(--seq4)'] : ['var(--seq1)', 'var(--seq4)'];
      A.chart.set({
        height: 340,
        x: { min: aLo, max: aHi, fmt: OP.axis.price, label: 'Preço do ativo' },
        y: { fmt: OP.axis.price },
        series: days.map((d, i) => ({ id: 'd' + d, name: d === 0 ? 'No vencimento' : `Faltam ${d} dias`, color: cols[i], xs, ys: xs.map((x) => BS.price({ ...o, S: x, T: Strat.T(d) })), width: d === 0 ? 2.5 : 2 })),
        vlines: [{ x: S, label: `Preço atual ${F.num(S)}`, color: 'var(--text)' }, { x: K, label: `Strike ${F.num(K)}`, color: 'var(--muted)' }]
      });
      const pNow = BS.price(o), intr = BS.intrinsic(st.type, S, K);
      A.text.innerHTML = `<p>Hoje a opção vale <b>${F.brl(pNow)}</b>, dos quais ${F.brl(intr)} são ${t('intrinseco', 'intrínsecos')} e <b>${F.brl(Math.max(0, pNow - intr))}</b> são ${t('extrinseco', 'extrínsecos')}. Repare que a diferença entre a curva mais clara e a quina do vencimento é máxima em torno do strike (ATM): é ali que o tempo tem mais a "tirar". Bem ITM ou bem OTM, as curvas quase se encostam.</p>`;

      // ---- B: derretimento do extrínseco ----
      const N = Math.max(M.days, 7);
      const kItm = Strat.roundK(S * (isCall ? 0.9 : 1.1)), kAtm = Strat.roundK(S), kOtm = Strat.roundK(S * (isCall ? 1.1 : 0.9));
      const dx = Array.from({ length: 121 }, (_, i) => N * i / 120);
      const ext = (Kx, d) => Math.max(0, BS.price({ ...o, K: Kx, T: Strat.T(d) }) - BS.intrinsic(st.type, S, Kx));
      const mkS = (id, name, Kx, color) => ({ id, name: `${name} (strike ${F.num(Kx)})`, color, xs: dx, ys: dx.map((d) => ext(Kx, d)) });
      B.chart.set({
        height: 320,
        x: { min: 0, max: N, reverse: true, fmt: (v) => String(Math.round(v)), label: 'Dias até o vencimento →  (o tempo corre para a direita)' },
        y: { fmt: OP.axis.price },
        series: [mkS('itm', 'ITM', kItm, 'var(--s1)'), mkS('atm', 'ATM', kAtm, 'var(--s2)'), mkS('otm', 'OTM', kOtm, 'var(--s3)')],
        tipHead: (x) => `Faltam ${F.num(x, 0)} dias`
      });
      const last7 = Math.min(7, N);
      const e0 = ext(kAtm, N), e7 = ext(kAtm, last7);
      B.text.innerHTML = `<p>A curva <b>não é uma reta</b>: o extrínseco cai com a raiz do tempo, então o derretimento <b>acelera</b> perto do vencimento. Na opção ATM (strike ${F.num(kAtm)}), o extrínseco de ${F.brl(e0)} hoje ainda é ${F.brl(e7)} (${F.pct(e0 > 0 ? e7 / e0 : 0, 0)}) quando faltam ${last7} dias — e todo esse valor evapora na última reta. Quem <b>compra</b> opção luta contra essa curva; quem <b>vende</b> joga a favor dela (mas assume o risco de o ativo se mexer).</p>`;

      // ---- C: prêmio x volatilidade ----
      const vx = Array.from({ length: 116 }, (_, i) => 0.05 + i * 0.01);
      const mkV = (id, name, Kx, color) => ({ id, name: `${name} (strike ${F.num(Kx)})`, color, xs: vx.map((v) => v * 100), ys: vx.map((v) => BS.price({ ...o, K: Kx, v })) });
      C.chart.set({
        height: 320,
        x: { min: 5, max: 120, fmt: (v) => F.num(v, 0) + '%', label: 'Volatilidade implícita (a.a.)' },
        y: { fmt: OP.axis.price },
        series: [mkV('itm', 'ITM', kItm, 'var(--s1)'), mkV('atm', 'ATM', kAtm, 'var(--s2)'), mkV('otm', 'OTM', kOtm, 'var(--s3)')],
        vlines: [{ x: M.vol * 100, label: `Vol atual ${F.num(M.vol * 100, 0)}%`, color: 'var(--text)' }],
        tipHead: (x) => `Vol implícita ${F.num(x, 0)}%`
      });
      const p20 = BS.price({ ...o, K: kAtm, v: 0.2 }), p60 = BS.price({ ...o, K: kAtm, v: 0.6 });
      C.text.innerHTML = `<p>Nas opções ATM o prêmio é quase uma <b>linha reta</b> da volatilidade: com vol de 20% a opção de strike ${F.num(kAtm)} custa ${F.brl(p20)}; com 60%, ${F.brl(p60)} — mais que o triplo, com o ativo no mesmo lugar. As ITM e OTM reagem menos, e as OTM são "convexas": só começam a valer quando a vol permite chegar ao strike. Essa sensibilidade é o ${t('vega')}.</p>
        <p><b>Vol histórica × implícita:</b> a histórica olha o passado (quanto o ativo realmente oscilou); a ${t('iv', 'implícita')} é o que o mercado <i>espera</i> e está embutida no prêmio. Antes de eventos (balanços, decisões), a IV sobe; depois, cai — o "vol crush".</p>`;

      drawIV();

      // ---- D: cone ----
      const nd = Math.min(M.days, 90), cx = Array.from({ length: nd * 2 + 1 }, (_, i) => M.days * i / (nd * 2));
      const q = (p) => cx.map((d) => (d <= 0 ? S : BS.lnQuantile(p, S, Strat.T(d), M.rate, 0, M.vol)));
      const q025 = q(0.025), q16 = q(0.16), q50 = q(0.5), q84 = q(0.84), q975 = q(0.975);
      D.chart.set({
        height: 340,
        x: { min: 0, max: M.days, fmt: (v) => F.num(v, 0), label: 'Dias a partir de hoje' },
        y: { fmt: OP.axis.price, zero: false },
        bands: [{ xs: cx, lo: q025, hi: q975, color: 'var(--s1)', opacity: 0.12 }, { xs: cx, lo: q16, hi: q84, color: 'var(--s1)', opacity: 0.22 }],
        series: [{ id: 'med', name: 'Trajetória mediana', color: 'var(--s1)', xs: cx, ys: q50 }],
        hlines: [{ y: K, color: 'var(--s2)', dash: true, domain: false }],
        legendExtra: [{ name: '~68% de chance', color: 'var(--s1)', type: 'area' }, { name: '~95% de chance', color: 'var(--s1)', type: 'area' }, { name: `Strike ${F.num(K)}`, color: 'var(--s2)', dash: true }],
        tipHead: (x) => `Daqui a ${F.num(x, 0)} dias`
      });
      const mv = M.vol * Math.sqrt(Strat.T(M.days));
      D.text.innerHTML = `<p>Com volatilidade de ${F.pct(M.vol, 0)}, em ${M.days} dias o ativo (hoje ${F.brl(S)}) ficaria entre <b>${F.brl(q16[q16.length - 1])}</b> e <b>${F.brl(q84[q84.length - 1])}</b> com ~68% de probabilidade (±${F.pct(mv, 1)}), e entre ${F.brl(q025[q025.length - 1])} e ${F.brl(q975[q975.length - 1])} com ~95%. O cone é "curvado" porque a incerteza cresce com a <b>raiz</b> do tempo. A linha laranja é o strike: quanto mais longe do cone, mais "barata" e improvável é a opção.</p>`;
    }
    this.drawAll = drawAll;
    drawAll();
  }

  OP.register({ id: 'tempo', title: 'Tempo e volatilidade', icon: '⏳', mount, refresh() { if (this.drawAll) this.drawAll(); } });
})();
