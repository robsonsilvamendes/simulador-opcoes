/* Aba 2 — Payoff de uma única opção */
(function () {
  const { h, fmt: F, t } = OP;
  const M = Strat.market;

  function mount(root) {
    const st = { type: 'call', side: 1, K: Strat.roundK(M.spot), prem: 0, auto: true, qty: 1, today: true, counter: false, S: null };
    const leg = () => ({ id: 'x', kind: st.type, side: st.side, K: st.K, prem: st.prem, qty: st.qty, manual: !st.auto });

    root.append(h('div', { class: 'hero-h' },
      h('h2', {}, 'Payoff: o resultado de uma opção'),
      h('p', { html: `O ${t('payoff')} mostra quanto você ganha ou perde <b>no vencimento</b> para cada preço possível do ativo. Escolha o tipo e a posição, arraste o strike e <b>clique no gráfico</b> para testar um cenário.` })));

    // ---------- controles ----------
    const typeS = OP.seg({ label: 'Tipo de opção', options: [{ v: 'call', label: 'Call (direito de comprar)' }, { v: 'put', label: 'Put (direito de vender)' }], value: 'call', onChange: (v) => { st.type = v; update(true); } });
    const sideS = OP.seg({ label: 'Sua posição', options: [{ v: 1, label: 'Comprado (titular)' }, { v: -1, label: 'Vendido (lançador)' }], value: 1, onChange: (v) => { st.side = v; update(); } });
    const kS = OP.slider({ label: 'Strike (R$)', min: 1, max: 100, step: 0.5, value: st.K, onInput: (v) => { st.K = v; update(true); } });
    const pS = OP.slider({ label: 'Prêmio por opção (R$)', min: 0, max: 20, step: 0.01, value: 1, onInput: (v) => { st.prem = v; st.auto = false; autoT.set(false); update(); } });
    const autoT = OP.toggle({ label: 'Usar prêmio teórico (Black-Scholes)', value: true, onChange: (v) => { st.auto = v; update(true); } });
    const qS = OP.slider({ label: 'Quantidade (lotes de 100)', min: 1, max: 20, step: 1, value: 1, onInput: (v) => { st.qty = v; update(); } });
    const sceS = OP.slider({ label: 'Cenário: preço do ativo no vencimento (R$)', min: 1, max: 100, step: 0.1, value: M.spot, onInput: (v) => { st.S = v; update(); }, help: 'Ou clique/arraste direto no gráfico.' });
    const todayT = OP.toggle({ label: 'Mostrar a curva de <b>hoje</b> (valor teórico antes do vencimento)', value: true, onChange: (v) => { st.today = v; update(); } });
    const counterT = OP.toggle({ label: 'Mostrar o <b>outro lado</b> da operação (contraparte)', value: false, onChange: (v) => { st.counter = v; update(); } });

    const controls = OP.card('Monte a posição');
    controls.body.append(h('div', { class: 'controls' }, typeS.el, sideS.el, kS.el, pS.el, autoT.el, qS.el, h('hr', { style: 'border:0;border-top:1px solid var(--grid);width:100%;margin:2px 0' }), sceS.el, todayT.el, counterT.el));

    // ---------- resultado ----------
    const resCard = OP.card('Resultado');
    const statsEl = h('div', { class: 'stats' });
    const chartHost = h('div');
    const chart = new Charts.LineChart(chartHost);
    resCard.body.append(statsEl, chartHost);
    const explCard = OP.card('Explicando esta posição, passo a passo');
    const explEl = h('div', { class: 'explain' });
    explCard.body.append(explEl);
    root.append(h('div', { class: 'side' }, controls.el, h('div', {}, resCard.el, explCard.el)));

    function update(recalcRange) {
      if (st.S == null) st.S = M.spot;
      const l0 = leg();
      if (st.auto) { l0.prem = Math.round(Strat.theoPrice(l0) * 100) / 100; st.prem = l0.prem; pS.set(st.prem); }
      const [lo, hi] = OP.priceRange([st.K]);
      if (recalcRange !== false) {
        kS.setRange(Math.max(1, Math.round(M.spot * 0.4)), Math.round(M.spot * 1.8));
        sceS.setRange(+lo.toFixed(1), +hi.toFixed(1));
        pS.setRange(0, Math.max(5, Math.ceil(M.spot * 0.4)));
      }
      st.S = Math.max(lo, Math.min(hi, st.S));
      sceS.set(st.S);
      const legs = [l0];
      const mt = Strat.metrics(legs);
      const lotN = l0.qty * M.lot;
      const total = l0.prem * lotN;
      const pnlS = Strat.pnlExpiry(legs, st.S);
      const pr = Strat.probability(legs, M.days, M.rate, M.vol);

      // ---- estatísticas ----
      const be = mt.breakevens[0];
      statsEl.innerHTML = '';
      statsEl.append(
        OP.stat(st.side === 1 ? 'Você paga (débito)' : 'Você recebe (crédito)', F.brl(total), `${F.brl(l0.prem)} × ${lotN} opções`),
        OP.stat('Ponto de equilíbrio', be != null ? F.brl(be) : '—', be != null ? `${be >= M.spot ? '+' : ''}${F.num((be / M.spot - 1) * 100, 1)}% do preço atual` : ''),
        OP.stat('Lucro máximo', mt.unlimitedGain ? 'Ilimitado' : F.brl(mt.maxGain), '', 'pos'),
        OP.stat('Prejuízo máximo', mt.unlimitedLoss ? 'Ilimitado' : F.brl(mt.maxLoss), '', 'neg'),
        OP.stat('Chance de lucro', pr ? F.pct(pr.pop, 0) : '—', 'no vencimento, pelo modelo'),
        (() => { const s = OP.stat('Cenário: ativo a ' + F.brl(st.S), F.sbrl(pnlS), pnlS !== 0 && total ? `${pnlS > 0 ? '+' : ''}${F.num(pnlS / total * 100, 0)}% do prêmio` : '', OP.tone(pnlS)); s.classList.add('hero'); return s; })()
      );

      // ---- gráfico ----
      const xs = [0, ...Strat.sampleX(lo, hi, 140, [st.K, ...(be != null ? [be] : [])])];
      const yExp = xs.map((x) => Strat.pnlExpiry(legs, x));
      const series = [{ id: 'exp', name: 'No vencimento', color: 'var(--s1)', xs, ys: yExp, z: 3 }];
      if (st.today && M.days > 0) series.push({ id: 'now', name: `Hoje (${M.days} dias até o vencimento)`, color: 'var(--s2)', xs, ys: xs.map((x) => Strat.pnlAt(legs, x, M.days)), z: 2 });
      if (st.counter) {
        const opp = [{ ...l0, side: -l0.side }];
        series.push({ id: 'opp', name: 'Contraparte (o outro lado)', color: 'var(--s3)', xs, ys: xs.map((x) => Strat.pnlExpiry(opp, x)), z: 1, width: 1.75 });
      }
      chart.set({
        height: 380,
        x: { min: lo, max: hi, fmt: OP.axis.price, label: 'Preço do ativo' },
        y: { fmt: OP.axis.brl },
        series, shade: 'exp',
        vlines: [
          { x: M.spot, label: `Preço atual ${F.num(M.spot)}`, color: 'var(--muted)' },
          { x: st.K, label: `Strike ${F.num(st.K)}`, color: 'var(--muted)' },
          { x: st.S, label: 'Cenário', color: 'var(--text)', dash: false }
        ],
        dots: [...(be != null ? [{ x: be, y: 0, color: 'var(--s2)', label: 'Equilíbrio', below: true }] : []), { x: st.S, y: pnlS, color: 'var(--text)' }],
        onPick: (x) => { st.S = Math.round(x * 100) / 100; update(false); },
        tooltip: (x, rows) => {
          const r0 = rows[0];
          const intr = BS.intrinsic(l0.kind, x, l0.K);
          return `<div class="tip-h">Ativo a ${F.brl(x)} no vencimento</div>` +
            rows.map((q) => `<div class="tip-r"><i style="background:${q.color}"></i><span>${q.name}</span><b class="${q.y >= 0 ? 'pos' : 'neg'}">${F.sbrl(q.y)}</b></div>`).join('') +
            `<div class="tip-note">Valor da opção no vencimento: ${F.brl(intr)} por opção</div>`;
        }
      });

      explEl.innerHTML = explain(l0, mt, pnlS, total, pr);
    }

    function explain(l, mt, pnlS, total, pr) {
      const lotN = l.qty * M.lot;
      const isCall = l.kind === 'call', long = l.side === 1;
      const nome = `${isCall ? 'CALL' : 'PUT'} de strike ${F.brl(l.K)}`;
      const be = mt.breakevens[0];
      const pct = be != null ? (be / M.spot - 1) * 100 : 0;
      const intr = BS.intrinsic(l.kind, st.S, l.K);
      const exerc = intr > 0;
      const g = BS.greeks(Strat.optParams(l, M.spot, M.days));
      const th = g.theta * lotN * l.side;
      const dirNeed = (isCall === long) ? 'acima' : 'abaixo'; // long call / short put → acima; long put / short call → abaixo
      const p = [];

      p.push(`<p><b>1. O que você fez.</b> Você ${long ? `<b>comprou</b> (é o ${t('titular')})` : `<b>vendeu</b> (é o ${t('lancador', 'lançador')})`} ${l.qty} lote(s) = <b>${lotN} opções</b> de ${nome}, ${long ? 'pagando' : 'recebendo'} ${F.brl(l.prem)} de ${t('premio', 'prêmio')} por opção — ${F.brl(total)} no total. ` +
        (long ? `Isso te dá o direito de ${isCall ? 'comprar' : 'vender'} as ações a ${F.brl(l.K)} até o vencimento.` : `Em troca, você <b>assumiu a obrigação</b> de ${isCall ? 'vender' : 'comprar'} as ações a ${F.brl(l.K)} se o titular decidir exercer.`) + '</p>');

      p.push(`<p><b>2. Quando dá lucro.</b> O ${t('breakeven')} é <b>${F.brl(be)}</b> (${isCall ? 'strike + prêmio' : 'strike − prêmio'}). ${long
        ? `Você só lucra se o ativo terminar <b>${dirNeed} de ${F.brl(be)}</b> — o que, a partir do preço atual de ${F.brl(M.spot)}, exige um movimento de <b>${F.num(pct, 1)}%</b>. Entre o strike e o equilíbrio você exerce, mas ainda não cobre o prêmio.`
        : `Você lucra enquanto o ativo terminar <b>${dirNeed} de ${F.brl(be)}</b>: o mercado tem uma "folga" de ${F.num(Math.abs(pct), 1)}% a seu favor a partir do preço atual de ${F.brl(M.spot)}.`}${pr ? ` Pelo modelo, a chance de terminar no lucro é de <b>${F.pct(pr.pop, 0)}</b>.` : ''}</p>`);

      p.push(`<p><b>3. Risco e retorno.</b> ` + (long
        ? (isCall ? `O pior que pode acontecer é perder o prêmio (<b>${F.brl(-mt.maxLoss)}</b>), se o ativo terminar abaixo do strike. O lucro cresce sem limite conforme o ativo sobe.` : `O pior é perder o prêmio (<b>${F.brl(-mt.maxLoss)}</b>). O lucro máximo (<b>${F.brl(mt.maxGain)}</b>) ocorreria só se o ativo fosse a zero.`)
        : (isCall ? `Seu ganho máximo é o prêmio (<b>${F.brl(mt.maxGain)}</b>), se o ativo terminar abaixo do strike. Se o ativo subir muito, o prejuízo <b>não tem limite</b> — por isso a corretora exige garantias, e por isso vender call "a seco" é perigoso.` : `Seu ganho máximo é o prêmio (<b>${F.brl(mt.maxGain)}</b>). Se o ativo despencar, você terá de comprá-lo pelo strike: o prejuízo chega a <b>${F.brl(-mt.maxLoss)}</b> (ativo a zero).`)) + '</p>');

      p.push(`<p><b>4. No cenário que você escolheu</b> (ativo a ${F.brl(st.S)} no vencimento): a opção vale ${F.brl(intr)} (${t('intrinseco', 'valor intrínseco')}). ` + (long
        ? (exerc ? `Vale a pena exercer: você ${isCall ? 'compra' : 'vende'} a ${F.brl(l.K)} e o mercado paga ${F.brl(st.S)}.` : `Não vale exercer — a opção <b>vira pó</b> e você perde o prêmio.`)
        : (exerc ? `O titular vai exercer e você <b>será exercido</b>: terá de ${isCall ? 'entregar' : 'comprar'} as ações a ${F.brl(l.K)}.` : `Ninguém exerce: a opção vira pó e o prêmio fica com você.`)) +
        ` Resultado líquido: <b class="${pnlS >= 0 ? 'pos' : 'neg'}">${F.sbrl(pnlS)}</b>.</p>`);

      p.push(`<p><b>5. O tempo.</b> Hoje faltam ${M.days} dias. Tudo mais constante, o ${t('theta')} faz a opção ${g.theta < 0 ? 'perder' : 'ganhar'} cerca de ${F.brl(Math.abs(g.theta))} por opção por dia — ou seja, o <i>tempo trabalha ${th >= 0 ? '<b>a seu favor</b>' : '<b>contra você</b>'}</i> (${F.sbrl(th)} por dia na sua posição). A linha laranja no gráfico mostra o valor teórico de hoje: ela converge para a linha azul conforme o vencimento se aproxima.</p>`);

      return p.join('');
    }

    update(true);
    this.update = () => update(true);
  }

  OP.register({ id: 'payoff', title: 'Payoff', icon: '🎯', mount, refresh() { if (this.update) this.update(); } });
})();
