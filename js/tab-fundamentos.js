/* Aba 1 — Fundamentos */
(function () {
  const { h, fmt: F, t } = OP;
  const M = Strat.market;

  function mount(root) {
    root.append(
      h('div', { class: 'hero-h' },
        h('h2', {}, 'Comece por aqui'),
        h('p', {}, 'Uma opção é um contrato que dá um direito. Esta aba explica as peças do quebra-cabeça com exemplos que você pode mexer. Passe o mouse nos termos com sublinhado pontilhado para ver a definição.'))
    );

    // ---- trilha ----
    const trilha = OP.card('Trilha de estudo sugerida', 'Cada passo tem uma aba. Clique para ir direto.');
    const steps = [
      ['fundamentos', 'Fundamentos', 'Direito x obrigação, call e put, ITM/OTM.'],
      ['payoff', 'Payoff', 'O gráfico de lucro e prejuízo de UMA opção no vencimento.'],
      ['estrategias', 'Estratégias', 'Combine opções e ações: travas, straddle, colar…'],
      ['gregas', 'Gregas', 'Como o prêmio reage a preço, tempo, volatilidade e juros.'],
      ['tempo', 'Tempo e volatilidade', 'Por que opções "derretem" e o que é volatilidade implícita.'],
      ['montecarlo', 'Monte Carlo', 'Milhares de futuros possíveis: qual a chance de lucro?']
    ];
    trilha.body.append(h('div', { class: 'steps' }, steps.map(([id, ti, d]) =>
      h('button', { class: 'step', type: 'button', onclick: () => OP.go(id) }, h('b', {}, ti), d))));
    root.append(trilha.el);

    // ---- analogia ----
    const ana = OP.card('O que é uma opção? Pense num sinal de compra de imóvel');
    ana.body.append(h('div', { class: 'explain', html: `
      <p>Você quer comprar uma casa de <b>R$ 500 mil</b>, mas não tem certeza se o bairro vai valorizar. Você paga <b>R$ 5 mil</b> ao dono para ele <b>reservar a casa por 3 meses pelos mesmos R$ 500 mil</b>.</p>
      <ul>
        <li>Se em 3 meses a casa valer R$ 600 mil, você exerce o direito, compra por 500 e ganha 100 (menos os 5 que pagou).</li>
        <li>Se a casa desvalorizar para R$ 450 mil, você simplesmente não compra. Perdeu só os R$ 5 mil.</li>
        <li>O dono ficou com os R$ 5 mil de qualquer jeito — e ficou <b>obrigado</b> a vender se você quiser.</li>
      </ul>
      <p>Isso é uma ${t('call')}: o <b>${t('premio', 'prêmio')}</b> é o sinal (R$ 5 mil), o <b>${t('strike')}</b> é o preço combinado (R$ 500 mil), o <b>${t('vencimento')}</b> é o prazo (3 meses). Quem paga o sinal é o ${t('titular')}; quem recebe e assume a obrigação é o ${t('lancador', 'lançador')}. Uma ${t('put')} é o inverso: o direito de <i>vender</i> por um preço fixo — funciona como um seguro contra a queda.</p>` }));
    root.append(ana.el);

    // ---- 4 posições ----
    const pos = OP.card('As quatro posições básicas', 'Todas as estratégias são combinações destes quatro blocos. O gráfico mostra o resultado <b>por opção</b> no vencimento — passe o mouse.');
    const K = { v: 30 }, P = { v: 2 };
    const ctrls = h('div', { class: 'row', style: 'margin-bottom:14px' });
    const sK = OP.slider({ label: 'Strike (R$)', min: 20, max: 40, step: 0.5, value: 30, onInput: (v) => { K.v = v; drawPos(); } });
    const sP = OP.slider({ label: 'Prêmio por opção (R$)', min: 0.5, max: 5, step: 0.1, value: 2, onInput: (v) => { P.v = v; drawPos(); } });
    sK.el.style.minWidth = sP.el.style.minWidth = '240px';
    ctrls.append(sK.el, sP.el);
    pos.body.append(ctrls);
    const four = h('div', { class: 'pos4' });
    pos.body.append(four);
    const defs = [
      { id: 'lc', type: 'call', side: 1, nome: 'Titular de Call (compra a call)', visao: 'Aposta na alta',
        facts: (k, p) => [['Você', `paga R$ ${F.num(p)} de prêmio`], ['Lucro máximo', 'ilimitado (o ativo pode subir sem teto)'], ['Prejuízo máximo', `só o prêmio: R$ ${F.num(p)}`], ['Ponto de equilíbrio', `R$ ${F.num(k + p)} (strike + prêmio)`]] },
      { id: 'sc', type: 'call', side: -1, nome: 'Lançador de Call (vende a call)', visao: 'Aposta em lateral ou queda',
        facts: (k, p) => [['Você', `recebe R$ ${F.num(p)} de prêmio`], ['Lucro máximo', `só o prêmio: R$ ${F.num(p)}`], ['Prejuízo máximo', 'ilimitado (se não estiver coberto pela ação)'], ['Ponto de equilíbrio', `R$ ${F.num(k + p)}`]] },
      { id: 'lp', type: 'put', side: 1, nome: 'Titular de Put (compra a put)', visao: 'Aposta na queda / seguro',
        facts: (k, p) => [['Você', `paga R$ ${F.num(p)} de prêmio`], ['Lucro máximo', `R$ ${F.num(k - p)} (se o ativo for a zero)`], ['Prejuízo máximo', `só o prêmio: R$ ${F.num(p)}`], ['Ponto de equilíbrio', `R$ ${F.num(k - p)} (strike − prêmio)`]] },
      { id: 'sp', type: 'put', side: -1, nome: 'Lançador de Put (vende a put)', visao: 'Aposta em alta ou lateral',
        facts: (k, p) => [['Você', `recebe R$ ${F.num(p)} de prêmio`], ['Lucro máximo', `só o prêmio: R$ ${F.num(p)}`], ['Prejuízo máximo', `R$ ${F.num(k - p)} (se o ativo for a zero)`], ['Ponto de equilíbrio', `R$ ${F.num(k - p)}`]] }
    ];
    defs.forEach((d) => {
      d.chartHost = h('div');
      d.factsEl = h('dl', { class: 'facts' });
      four.append(h('section', { class: 'card' }, h('h4', {}, d.nome), h('p', { class: 'muted', style: 'margin:0 0 6px;font-size:13.5px' }, d.visao), d.chartHost, d.factsEl));
      d.chart = new Charts.LineChart(d.chartHost);
    });
    function drawPos() {
      defs.forEach((d) => {
        const xs = [0, ...Strat.sampleX(K.v * 0.6, K.v * 1.4, 60, [K.v])];
        const ys = xs.map((x) => d.side * (BS.intrinsic(d.type, x, K.v) - P.v));
        const be = d.type === 'call' ? K.v + P.v : K.v - P.v;
        d.chart.set({
          height: 230, table: false,
          x: { min: K.v * 0.6, max: K.v * 1.4, fmt: OP.axis.price, label: 'Preço do ativo no vencimento' },
          y: { fmt: OP.axis.brl },
          series: [{ id: 'p', name: 'Resultado por opção', color: 'var(--s1)', xs, ys }],
          shade: 'p',
          vlines: [{ x: K.v, label: `Strike ${F.num(K.v)}`, color: 'var(--muted)' }],
          dots: [{ x: be, y: 0, color: 'var(--s2)', label: 'Equilíbrio', below: true }],
          tooltip: (x, rows) => `<div class="tip-h">Ativo a ${F.brl(x)}</div><div class="tip-r"><span>Resultado</span><b class="${rows[0].y >= 0 ? 'pos' : 'neg'}">${F.sbrl(rows[0].y)}</b></div>`
        });
        d.factsEl.innerHTML = d.facts(K.v, P.v).map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
      });
    }
    root.append(pos.el);
    drawPos();

    // ---- direito x obrigação ----
    const cmp = OP.card('Direito × obrigação: quem carrega o risco?');
    cmp.body.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'cmp', html: `
      <thead><tr><th></th><th>${t('titular', 'Titular (comprou)')}</th><th>${t('lancador', 'Lançador (vendeu)')}</th></tr></thead>
      <tbody>
        <tr><td>Fluxo do prêmio</td><td>Paga no início</td><td>Recebe no início</td></tr>
        <tr><td>Direito ou obrigação?</td><td>Tem o <b>direito</b> de exercer, mas escolhe se quer</td><td>Tem a <b>obrigação</b> de cumprir se o titular exercer</td></tr>
        <tr><td>Risco</td><td>Limitado ao prêmio pago</td><td>Pode ser grande (na call descoberta, ilimitado)</td></tr>
        <tr><td>Ganho</td><td>Potencialmente grande</td><td>Limitado ao prêmio recebido</td></tr>
        <tr><td>Tempo (theta)</td><td>Contra: a opção perde valor todo dia</td><td>A favor: o prêmio "derrete" e vira lucro</td></tr>
        <tr><td>Garantias</td><td>Nenhuma além do prêmio</td><td>Precisa depositar ${t('margem', 'margem/garantias')}</td></tr>
      </tbody>` })));
    cmp.body.append(h('div', { style: 'margin-top:12px' }, OP.callout('good', 'As opções são um <b>jogo de soma zero</b> (antes de custos): tudo que o titular ganha, o lançador perde, e vice-versa. Quem vende opções não tem vantagem automática: recebe o prêmio com frequência, mas em troca assume uma cauda de risco que pode ser muito maior que o prêmio.', 'Ideia importante')));
    root.append(cmp.el);

    // ---- moneyness ----
    root.append(moneyness());

    // ---- código B3 ----
    root.append(decoder());

    // ---- regras ----
    const regras = OP.card('Regras do jogo na B3 (o que muda na prática)');
    regras.body.append(h('div', { class: 'explain', html: `
      <ul>
        <li><b>Lote padrão:</b> normalmente 100 opções por lote. É por isso que os gráficos deste simulador multiplicam o prêmio por 100.</li>
        <li><b>Vencimento:</b> as séries mensais de ações costumam vencer na <b>3ª sexta-feira do mês</b>. Existem também séries semanais em alguns ativos.</li>
        <li><b>Estilo:</b> ${t('americana', 'americanas')} (exercício a qualquer momento) são comuns em ações; ${t('europeia', 'europeias')} (só no vencimento) são comuns em índices. Confira o estilo da série antes de operar.</li>
        <li><b>Liquidação:</b> em opções de ações, o exercício costuma ser com <b>entrega física</b> dos papéis (quem é exercido compra ou vende as ações de verdade). Opções ITM no vencimento costumam ser exercidas automaticamente — confirme as regras com sua corretora.</li>
        <li><b>Liquidez:</b> só algumas séries têm negociação relevante. O <i>spread</i> entre compra e venda pode ser grande e comer seu resultado.</li>
        <li><b>Custos e impostos:</b> corretagem, emolumentos e imposto de renda existem e <u>não estão neste simulador</u>.</li>
      </ul>` }));
    root.append(regras.el);

    // ---- glossário ----
    const gl = OP.card('Glossário completo');
    gl.body.append(h('div', { class: 'gloss' }, Object.values(OP.glossary).map(([k, v]) => h('div', {}, h('b', {}, k), h('span', {}, v)))));
    root.append(gl.el);
  }

  // ------------------------------------------------------------------
  function moneyness() {
    const card = OP.card('ITM, ATM, OTM — e o que forma o prêmio',
      'Mexa no strike e no tipo. O prêmio se divide em ' + OP.t('intrinseco', 'valor intrínseco') + ' (o que já "existe" se exercer hoje) e ' +
      OP.t('extrinseco', 'valor extrínseco') + ' (o que se paga pela esperança: tempo e volatilidade).');
    const st = { type: 'call', K: Math.round(M.spot) };
    const type = OP.seg({ label: 'Tipo', options: [{ v: 'call', label: 'Call' }, { v: 'put', label: 'Put' }], value: 'call', onChange: (v) => { st.type = v; draw(); } });
    const kS = OP.slider({ label: 'Strike (R$)', min: 5, max: 60, step: 0.5, value: st.K, onInput: (v) => { st.K = v; draw(); } });
    const left = h('div', { class: 'controls' }, type.el, kS.el, h('div', { class: 'help', html: 'O preço do ativo, a volatilidade e os dias vêm da barra de mercado no topo — mude lá para ver o efeito.' }));
    const out = h('div');
    const chartHost = h('div');
    const chart = new Charts.LineChart(chartHost);
    const right = h('div', {}, out, chartHost);
    card.body.append(h('div', { class: 'side' }, left, right));

    function draw() {
      const S = M.spot, K = st.K;
      kS.setRange(Math.max(1, Math.round(S * 0.5)), Math.round(S * 1.6));
      const o = { type: st.type, S, K, T: Strat.T(M.days), r: M.rate, q: 0, v: M.vol };
      const p = BS.price(o), iv = BS.intrinsic(st.type, S, K), ev = Math.max(p - iv, 0);
      const ratio = S / K - 1;
      const atm = Math.abs(ratio) < 0.015;
      const itm = st.type === 'call' ? S > K : S < K;
      const cls = atm ? 'atm' : itm ? 'itm' : 'otm';
      const label = atm ? 'ATM — no dinheiro' : itm ? 'ITM — dentro do dinheiro' : 'OTM — fora do dinheiro';
      const tot = p || 1;
      const why = atm ? 'O ativo está praticamente no strike: não há valor intrínseco, mas é onde a incerteza é maior — e o prêmio extrínseco é máximo.'
        : itm ? `Exercer agora renderia ${F.brl(iv)} por ação. Isso já é ${F.pct(iv / tot, 0)} do prêmio; o resto é o que o mercado cobra pelo tempo e pela volatilidade.`
          : `Exercer agora não compensa (ativo ${st.type === 'call' ? 'abaixo' : 'acima'} do strike). Todo o prêmio de ${F.brl(p)} é extrínseco: é só a <b>chance</b> de a opção virar ITM até o vencimento.`;
      out.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
          <span class="badge ${cls}">${label}</span>
          <span style="font-size:14px;color:var(--text2)">Ativo R$ ${F.num(S)} · Strike R$ ${F.num(K)} · ${F.num(Math.abs(ratio) * 100, 1)}% ${ratio >= 0 ? 'acima' : 'abaixo'} do strike</span>
        </div>
        <div style="font-size:14.5px;color:var(--text2);margin-bottom:8px"><b style="color:var(--text)">Prêmio teórico: ${F.brl(p)}</b> por opção (${F.brl(p * M.lot, 0)} por lote de ${M.lot})</div>
        <div class="stackbar" role="img" aria-label="Composição do prêmio">
          <div class="intr" style="flex:${iv}">${iv / tot > 0.14 ? F.brl(iv) : ''}</div>
          <div class="extr" style="flex:${ev}">${ev / tot > 0.14 ? F.brl(ev) : ''}</div>
        </div>
        <div class="keyline"><span><i style="background:var(--s1)"></i>Intrínseco ${F.brl(iv)}</span><span><i style="background:var(--s2)"></i>Extrínseco ${F.brl(ev)}</span></div>
        <p class="explain" style="margin:10px 0 12px">${why}</p>`;

      const [lo, hi] = OP.priceRange([K]);
      const xs = Strat.sampleX(lo, hi, 120, [K]);
      const price = xs.map((x) => BS.price({ ...o, S: x }));
      const intr = xs.map((x) => BS.intrinsic(st.type, x, K));
      chart.set({
        height: 300,
        x: { min: lo, max: hi, fmt: OP.axis.price, label: 'Preço do ativo' },
        y: { fmt: OP.axis.price, zero: true },
        series: [
          { id: 'p', name: 'Prêmio hoje (Black-Scholes)', color: 'var(--s1)', xs, ys: price },
          { id: 'i', name: 'Valor intrínseco (= valor no vencimento)', color: 'var(--s2)', xs, ys: intr, z: 1 }
        ],
        bands: [{ xs, lo: intr, hi: price, color: 'var(--s2)', opacity: 0.18 }],
        legendExtra: [{ name: 'Valor extrínseco (o que se paga pelo tempo e pela volatilidade)', color: 'var(--s2)', type: 'area' }],
        vlines: [{ x: K, label: `Strike ${F.num(K)}`, color: 'var(--muted)' }, { x: S, label: `Preço atual ${F.num(S)}`, color: 'var(--text)' }],
        dots: [{ x: S, y: p, color: 'var(--s1)' }]
      });
    }
    OP.moneynessDraw = draw;
    draw();
    return card.el;
  }

  // ------------------------------------------------------------------
  function decoder() {
    const card = OP.card('Decifrando o código de uma opção da B3', 'O código carrega o ativo, o tipo (call/put), o mês de vencimento e o strike.');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const input = h('input', { class: 'txt', value: 'PETRK320', maxlength: 12, 'aria-label': 'Código da opção', style: 'width:150px;font-family:ui-monospace,monospace;text-transform:uppercase' });
    const out = h('div');
    const draw = () => {
      const c = input.value.trim().toUpperCase();
      const m = c.match(/^([A-Z]{4})([A-X])(\d{1,4})(W\d)?$/);
      if (!m) { out.innerHTML = '<p class="muted">Digite algo como <b>PETRK320</b> ou <b>VALEB700</b> (4 letras do ativo + letra do mês/tipo + número).</p>'; return; }
      const idx = m[2].charCodeAt(0) - 65;
      const isCall = idx < 12;
      const mes = meses[idx % 12];
      const digits = m[3];
      const guess = +digits / 10;
      out.innerHTML = `
        <div class="code"><span style="--c:var(--s1)">${m[1]}</span><span style="--c:var(--s2)">${m[2]}</span><span style="--c:var(--s3)">${digits}</span>${m[4] ? `<span style="--c:var(--s5)">${m[4]}</span>` : ''}</div>
        <dl class="facts">
          <dt>${m[1]}</dt><dd>Ativo-objeto (4 letras iniciais do ticker, ex.: PETR = Petrobras)</dd>
          <dt>${m[2]}</dt><dd><b>${isCall ? 'Call' : 'Put'}</b> com vencimento em <b>${mes}</b> (A–L = calls de jan–dez · M–X = puts de jan–dez)</dd>
          <dt>${digits}</dt><dd>Strike — lido de forma aproximada como <b>R$ ${F.num(guess)}</b>. Em geral é o strike × 10 para preços baixos; a B3 pode ajustar por proventos, então confirme sempre na plataforma.</dd>
          ${m[4] ? `<dt>${m[4]}</dt><dd>Série semanal (W1 a W5 = semana do mês)</dd>` : ''}
        </dl>`;
    };
    input.addEventListener('input', draw);
    card.body.append(h('div', { class: 'row', style: 'margin-bottom:6px' }, h('div', { class: 'ctl' }, h('label', {}, 'Digite um código'), input)), out);
    draw();
    return card.el;
  }

  OP.register({ id: 'fundamentos', title: 'Fundamentos', icon: '📚', mount, refresh() { if (OP.moneynessDraw) OP.moneynessDraw(); } });
})();
