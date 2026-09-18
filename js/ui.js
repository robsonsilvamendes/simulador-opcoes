/* Componentes de interface, formatação pt-BR, glossário e estado global do mercado. */
(function () {
  const OP = (window.OP = window.OP || {});

  // ---------- DOM ----------
  OP.h = function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  };
  const h = OP.h;

  // ---------- formatação ----------
  const nf = (d) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const cache = {};
  const N = (d) => cache[d] || (cache[d] = nf(d));
  OP.fmt = {
    num: (v, d = 2) => (isFinite(v) ? N(d).format(v) : '—'),
    brl: (v, d = 2) => (isFinite(v) ? (v < 0 ? '−' : '') + 'R$\u00a0' + N(d).format(Math.abs(v)) : '—'),
    sbrl: (v, d = 2) => (isFinite(v) ? (v < 0 ? '−' : '+') + 'R$\u00a0' + N(d).format(Math.abs(v)) : '—'),
    pct: (v, d = 1) => (isFinite(v) ? N(d).format(v * 100) + '%' : '—'),
    // rótulos de eixo: sem casas quando grande
    axisBrl: (v) => (v < 0 ? '−' : '') + 'R$\u00a0' + N(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2).format(Math.abs(v)),
    axisPrice: (v) => 'R$\u00a0' + N(v >= 100 ? 0 : v >= 10 ? 1 : 2).format(v)
  };
  const F = OP.fmt;
  // formatadores prontos para os gráficos (o 2º argumento true = versão de tooltip, com mais precisão)
  OP.axis = {
    brl: (v, tip) => (tip ? F.sbrl(v) : F.axisBrl(v)),
    brlPlain: (v, tip) => (tip ? F.brl(v) : F.axisBrl(v)),
    price: (v, tip) => (tip ? F.brl(v) : F.axisPrice(v)),
    num3: (v, tip) => F.num(v, tip ? 4 : v !== 0 && Math.abs(v) < 0.1 ? 3 : 2),
    pct: (v) => F.pct(v, 0)
  };

  // ---------- glossário ----------
  OP.glossary = {
    opcao: ['Opção', 'Contrato que dá ao TITULAR o direito (não a obrigação) de comprar ou vender um ativo por um preço fixo até uma data. Quem vende o contrato (LANÇADOR) assume a obrigação se o titular exercer.'],
    call: ['Call (opção de compra)', 'Dá o direito de COMPRAR o ativo pelo preço de exercício (strike). Vale mais quando o ativo sobe.'],
    put: ['Put (opção de venda)', 'Dá o direito de VENDER o ativo pelo strike. Vale mais quando o ativo cai — funciona como seguro.'],
    strike: ['Strike (preço de exercício)', 'O preço combinado no contrato pelo qual o ativo poderá ser comprado (call) ou vendido (put).'],
    premio: ['Prêmio', 'O preço da opção — quanto o titular paga (e o lançador recebe) para abrir a posição. É por ação: 1 lote padrão = 100 opções.'],
    vencimento: ['Vencimento', 'Data em que a opção deixa de existir. Na B3, as opções de ações costumam vencer na 3ª sexta-feira do mês.'],
    titular: ['Titular (comprado)', 'Quem COMPRA a opção: paga o prêmio, tem direitos, perda máxima limitada ao prêmio.'],
    lancador: ['Lançador (vendido)', 'Quem VENDE a opção: recebe o prêmio e assume a obrigação. Pode ter perdas grandes; por isso a corretora exige garantias/margem.'],
    itm: ['ITM — dentro do dinheiro', 'Call com ativo > strike, ou put com ativo < strike. A opção tem valor intrínseco (exercer hoje daria lucro bruto).'],
    atm: ['ATM — no dinheiro', 'Ativo ≈ strike. É onde a opção tem maior valor extrínseco (incerteza máxima) e maior gamma.'],
    otm: ['OTM — fora do dinheiro', 'Call com ativo < strike, ou put com ativo > strike. Só tem valor extrínseco (esperança), sem valor intrínseco.'],
    intrinseco: ['Valor intrínseco', 'O quanto a opção "vale se fosse exercida agora": máx(ativo − strike, 0) na call; máx(strike − ativo, 0) na put.'],
    extrinseco: ['Valor extrínseco (temporal)', 'Parte do prêmio que excede o valor intrínseco. Paga pelo tempo restante e pela volatilidade. Vai a zero no vencimento.'],
    breakeven: ['Breakeven (ponto de equilíbrio)', 'Preço do ativo no vencimento em que o resultado da operação é exatamente zero (recupera o prêmio).'],
    payoff: ['Payoff', 'O resultado (lucro/prejuízo) da posição em função do preço do ativo em certa data — geralmente o vencimento.'],
    delta: ['Delta', 'Quanto o prêmio varia (em R$) quando o ativo varia R$ 1. Também é uma estimativa grosseira da chance de a opção terminar ITM.'],
    gamma: ['Gamma', 'Quanto o DELTA varia quando o ativo varia R$ 1. Mede a "curvatura": é alto ATM e perto do vencimento.'],
    theta: ['Theta', 'Quanto o prêmio perde por DIA só pela passagem do tempo (tudo mais constante). Negativo para o titular, positivo para o lançador.'],
    vega: ['Vega', 'Quanto o prêmio varia (em R$) quando a volatilidade implícita sobe 1 ponto percentual (ex.: 35% → 36%).'],
    rho: ['Rho', 'Quanto o prêmio varia quando a taxa de juros sobe 1 ponto percentual. Costuma ser o menos relevante em opções de curto prazo.'],
    vol: ['Volatilidade', 'A intensidade esperada das oscilações do ativo, em % ao ano. Quanto maior, mais caro é o prêmio (mais chance de grandes movimentos).'],
    iv: ['Volatilidade implícita (IV)', 'A volatilidade que, colocada no Black-Scholes, reproduz o prêmio que o mercado está cobrando. É o "preço" da incerteza.'],
    lote: ['Lote', 'Quantidade mínima negociada. Nas opções de ações da B3 o lote padrão costuma ser 100. Aqui, "1 lote" = 100 opções.'],
    exercicio: ['Exercício', 'O ato de o titular usar seu direito: comprar (call) ou vender (put) o ativo pelo strike.'],
    americana: ['Opção americana', 'Pode ser exercida a qualquer momento até o vencimento. A maioria das opções sobre ações na B3 é deste estilo.'],
    europeia: ['Opção europeia', 'Só pode ser exercida no vencimento. É o estilo que o modelo Black-Scholes assume.'],
    bs: ['Black-Scholes', 'Modelo matemático (1973) que calcula o preço teórico de uma opção europeia a partir de preço do ativo, strike, prazo, juros e volatilidade.'],
    selic: ['Taxa de juros (Selic)', 'A taxa livre de risco usada no modelo. Juros altos encarecem calls e barateiam puts (efeito pequeno).'],
    trava: ['Trava (spread)', 'Compra e venda simultânea de opções do mesmo tipo com strikes diferentes. Limita risco e ganho.'],
    margem: ['Margem / garantia', 'Ativos ou dinheiro que a corretora bloqueia para cobrir a obrigação do lançador.'],
    montecarlo: ['Simulação Monte Carlo', 'Técnica que sorteia milhares de trajetórias possíveis do preço e observa o resultado da estratégia em cada uma, revelando a distribuição de resultados.'],
    gbm: ['Movimento browniano geométrico', 'O modelo padrão de preço: retornos aleatórios com média (deriva) e desvio (volatilidade) constantes. É o mesmo do Black-Scholes.'],
    pop: ['Probabilidade de lucro', 'A chance, segundo o modelo, de a posição terminar no vencimento com resultado > 0.'],
    moneyness: ['Moneyness', 'A relação entre o preço do ativo e o strike; define se a opção é ITM, ATM ou OTM.']
  };
  OP.t = (key, label) => {
    const g = OP.glossary[key];
    if (!g) return label || key;
    let name = g[0].split(' (')[0];
    // no meio de frases: minúscula inicial, exceto siglas (ITM) e nomes próprios (Black-Scholes)
    if (!label && /^[A-ZÀ-Ú][a-zà-ú]/.test(name) && key !== 'bs') name = name[0].toLowerCase() + name.slice(1);
    return `<span class="term" tabindex="0" data-term="${key}">${label || name}</span>`;
  };
  // tooltip global para termos
  (function initTermTip() {
    let tip;
    const ensure = () => tip || (tip = document.body.appendChild(h('div', { class: 'termtip', role: 'tooltip' })));
    const show = (el) => {
      const g = OP.glossary[el.dataset.term];
      if (!g) return;
      const t = ensure();
      t.innerHTML = `<b>${g[0]}</b><span>${g[1]}</span>`;
      t.style.display = 'block';
      const r = el.getBoundingClientRect();
      const w = t.offsetWidth, hh = t.offsetHeight;
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
      let y = r.top - hh - 8;
      if (y < 8) y = r.bottom + 8;
      t.style.left = x + 'px'; t.style.top = y + 'px';
    };
    const hide = () => { if (tip) tip.style.display = 'none'; };
    document.addEventListener('pointerover', (e) => { const el = e.target.closest && e.target.closest('.term'); if (el) show(el); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest && e.target.closest('.term')) hide(); });
    document.addEventListener('focusin', (e) => { if (e.target.classList && e.target.classList.contains('term')) show(e.target); });
    document.addEventListener('focusout', hide);
  })();

  // ---------- componentes ----------
  /** slider + campo numérico. onInput recebe o valor em unidades de exibição. */
  OP.slider = function slider(o) {
    let value = o.value;
    const dec = o.decimals != null ? o.decimals : (String(o.step).split('.')[1] || '').length;
    const range = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, value });
    const num = h('input', { type: 'number', min: o.min, step: o.step, value: value.toFixed(dec), class: 'num', 'aria-label': o.label });
    const commit = (v, from) => {
      if (!isFinite(v)) return;
      value = v;
      if (from !== 'range') range.value = v;
      if (from !== 'num') num.value = v.toFixed(dec);
      o.onInput && o.onInput(v);
    };
    range.addEventListener('input', () => commit(+range.value, 'range'));
    num.addEventListener('change', () => {
      let v = +num.value;
      if (o.min != null && v < o.min) v = o.min;
      commit(v, 'num-final'); num.value = v.toFixed(dec);
    });
    num.addEventListener('input', () => { const v = +num.value; if (num.value !== '' && isFinite(v) && v >= (o.min || -Infinity)) commit(v, 'num'); });
    const el = h('div', { class: 'ctl' },
      h('div', { class: 'ctl-top' },
        h('label', { html: o.label }),
        h('div', { class: 'numwrap' }, num, o.unit ? h('span', { class: 'unit' }, o.unit) : null)),
      range,
      o.help ? h('div', { class: 'help', html: o.help }) : null);
    return {
      el, get: () => value,
      set: (v) => { value = v; range.value = v; num.value = v.toFixed(dec); },
      // o intervalo sempre inclui o valor atual, para o controle nunca "mentir" sobre onde está
      setRange: (min, max) => { range.min = Math.min(min, value); range.max = Math.max(max, value); range.value = value; }
    };
  };

  /** controle segmentado (botões exclusivos) */
  OP.seg = function seg(o) {
    let value = o.value;
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': o.label || '' });
    const btns = o.options.map((op) => {
      const b = h('button', { type: 'button', role: 'radio', 'data-v': op.v, class: op.cls || '' }, op.label);
      b.addEventListener('click', () => { value = op.v; paint(); o.onChange && o.onChange(value); });
      wrap.appendChild(b);
      return b;
    });
    const paint = () => btns.forEach((b, i) => { const on = o.options[i].v === value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    paint();
    const el = o.label ? h('div', { class: 'ctl' }, h('div', { class: 'ctl-top' }, h('label', { html: o.label })), wrap) : wrap;
    return { el, get: () => value, set: (v) => { value = v; paint(); } };
  };

  OP.toggle = function toggle(o) {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = !!o.value;
    cb.addEventListener('change', () => o.onChange(cb.checked));
    return { el: h('label', { class: 'toggle' }, cb, h('span', { html: o.label })), get: () => cb.checked, set: (v) => { cb.checked = v; } };
  };

  OP.callout = (type, html, title) => h('div', { class: 'callout ' + type }, title ? h('b', { class: 'ct' }, title) : null, h('div', { html }));

  OP.card = (title, sub) => {
    const body = h('div', { class: 'card-body' });
    const el = h('section', { class: 'card' }, h('header', { class: 'card-h' }, h('h3', {}, title), sub ? h('p', { class: 'sub', html: sub }) : null), body);
    return { el, body };
  };

  /** tile de estatística: rótulo · valor · nota */
  OP.stat = (label, value, note, tone) => h('div', { class: 'stat' + (tone ? ' ' + tone : '') }, h('div', { class: 'stat-l', html: label }), h('div', { class: 'stat-v' }, value), note ? h('div', { class: 'stat-n', html: note }) : null);

  OP.tone = (v) => (v > 1e-9 ? 'pos' : v < -1e-9 ? 'neg' : '');

  // ---------- estado global e eventos ----------
  const subs = [];
  OP.onMarket = (fn) => subs.push(fn);
  OP.setMarket = (patch) => {
    Object.assign(Strat.market, patch);
    Strat.syncPremiums(Strat.state.legs);
    subs.forEach((fn) => fn());
  };
  OP.notify = () => subs.forEach((fn) => fn());

  // ---------- registro de abas ----------
  OP.tabs = [];
  OP.register = (tab) => OP.tabs.push(tab);

  /** calcula o intervalo de preços a exibir nos gráficos */
  OP.priceRange = (extraStrikes) => {
    const s = Strat.market.spot;
    const ks = (extraStrikes || []).filter((k) => k > 0);
    const lo = Math.min(s * 0.7, ...(ks.length ? ks.map((k) => k * 0.85) : [Infinity]));
    const hi = Math.max(s * 1.3, ...(ks.length ? ks.map((k) => k * 1.15) : [-Infinity]));
    return [Math.max(0.01, lo), hi];
  };

  OP.lognormal = { cdf: BS.lnCdf, q: BS.lnQuantile };
})();
