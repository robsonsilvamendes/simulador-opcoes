/* Motor de estratégias: pernas, P&L, métricas, probabilidade de lucro e catálogo de presets.
 * Perna: {id, kind:'call'|'put'|'stock', side:+1|-1, K, prem, qty, manual}
 *  - qty é em LOTES (1 lote = mkt.lot opções ou ações)
 *  - prem é o preço por opção/ação na entrada (para 'stock', o preço de compra) */
(function () {
  let uid = 1;
  const newId = () => 'l' + uid++;

  const market = { spot: 30, vol: 0.35, rate: 0.14, days: 30, lot: 100 };

  function T(days) { return Math.max(days, 0) / 365; }

  function optParams(leg, S, days, vol) {
    return { type: leg.kind, S, K: leg.K, T: T(days), r: market.rate, q: 0, v: vol == null ? market.vol : vol };
  }

  /** valor por unidade (ação/opção) da perna no cenário (S, dias restantes, vol) */
  function legValue(leg, S, days, vol) {
    if (leg.kind === 'stock') return S;
    return BS.price(optParams(leg, S, days, vol));
  }

  /** preço teórico "de mercado" por unidade para uma perna hoje */
  function theoPrice(leg) {
    return legValue(leg, market.spot, market.days, market.vol);
  }

  /** mantém o prêmio das pernas não-manuais sincronizado com o modelo */
  function syncPremiums(legs) {
    legs.forEach((l) => {
      if (l.kind === 'stock') { if (!l.manual) l.prem = market.spot; return; }
      if (!l.manual) l.prem = Math.round(theoPrice(l) * 100) / 100;
    });
  }

  /** P&L total em R$ no vencimento */
  function pnlExpiry(legs, S) {
    let t = 0;
    for (const l of legs) {
      const v = l.kind === 'stock' ? S : BS.intrinsic(l.kind, S, l.K);
      t += l.side * l.qty * market.lot * (v - l.prem);
    }
    return t;
  }

  /** P&L total em R$ em um instante antes do vencimento */
  function pnlAt(legs, S, daysLeft, vol) {
    let t = 0;
    for (const l of legs) {
      t += l.side * l.qty * market.lot * (legValue(l, S, daysLeft, vol) - l.prem);
    }
    return t;
  }

  /** Pontos de quebra da payoff (strikes) — usados para amostragem exata */
  function kinks(legs) {
    return [...new Set(legs.filter((l) => l.kind !== 'stock').map((l) => l.K))].sort((a, b) => a - b);
  }

  /** Amostra uniformemente [lo,hi] garantindo que os kinks entrem na grade */
  function sampleX(lo, hi, n, extra) {
    const xs = [];
    for (let i = 0; i <= n; i++) xs.push(lo + (hi - lo) * i / n);
    (extra || []).forEach((k) => { if (k > lo && k < hi) xs.push(k); });
    return [...new Set(xs)].sort((a, b) => a - b);
  }

  /** Métricas exatas (payoff linear por partes). */
  function metrics(legs) {
    if (!legs.length) return null;
    const ks = kinks(legs);
    const pts = [0, ...ks];
    if (pts.length === 1) pts.push(market.spot); // só ações
    const vals = pts.map((x) => pnlExpiry(legs, x));
    const slopeRight = legs.reduce((s, l) => s + (l.kind === 'put' ? 0 : l.side * l.qty * market.lot), 0);
    const last = pts[pts.length - 1];
    const lastVal = vals[vals.length - 1];

    let maxGain = Math.max(...vals), maxLoss = Math.min(...vals);
    let unlimitedGain = false, unlimitedLoss = false;
    if (slopeRight > 1e-9) unlimitedGain = true;
    if (slopeRight < -1e-9) unlimitedLoss = true;

    const be = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = vals[i], b = vals[i + 1];
      if (a === 0 && i > 0) { be.push(pts[i]); continue; }
      if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
        be.push(pts[i] + (0 - a) * (pts[i + 1] - pts[i]) / (b - a));
      }
    }
    if (vals[vals.length - 1] === 0 && Math.abs(slopeRight) < 1e-9 && vals.length > 1 && vals[vals.length - 2] !== 0) be.push(last);
    if (Math.abs(slopeRight) > 1e-9) {
      const x = last - lastVal / slopeRight;
      if (x > last - 1e-9) be.push(x);
    }
    const uniq = [];
    be.sort((a, b) => a - b).forEach((x) => { if (!uniq.length || Math.abs(x - uniq[uniq.length - 1]) > 1e-6) uniq.push(x); });

    // custo líquido de entrada: débito (>0) ou crédito (<0) — ações contam como capital
    const net = legs.reduce((s, l) => s + l.side * l.qty * market.lot * l.prem, 0);
    return { maxGain, maxLoss, unlimitedGain, unlimitedLoss, breakevens: uniq, net, slopeRight };
  }

  /** Probabilidade de lucro e valor esperado no vencimento (lognormal, deriva mu). */
  function probability(legs, days, mu, vol) {
    if (!legs.length || days <= 0) return null;
    const S0 = market.spot, Tt = T(days);
    const hi = S0 * 4, n = 4000;
    let pop = 0, ev = 0, prevCdf = 0;
    for (let i = 1; i <= n; i++) {
      const x1 = hi * i / n, x0 = hi * (i - 1) / n;
      const c1 = BS.lnCdf(x1, S0, Tt, mu, 0, vol);
      const p = c1 - prevCdf;
      prevCdf = c1;
      const v = pnlExpiry(legs, (x0 + x1) / 2);
      if (v > 0) pop += p;
      ev += v * p;
    }
    // cauda acima de hi (payoff ~linear): aproxima com o valor em hi
    const tail = 1 - prevCdf;
    if (tail > 0) { const v = pnlExpiry(legs, hi); if (v > 0) pop += tail; ev += v * tail; }
    return { pop, ev };
  }

  /** Gregas líquidas da estratégia (em R$ por lote total) no estado atual do mercado */
  function netGreeks(legs) {
    const out = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    for (const l of legs) {
      const m = l.side * l.qty * market.lot;
      if (l.kind === 'stock') { out.delta += m; continue; }
      const g = BS.greeks(optParams(l, market.spot, market.days));
      out.delta += m * g.delta; out.gamma += m * g.gamma; out.theta += m * g.theta;
      out.vega += m * g.vega; out.rho += m * g.rho;
    }
    return out;
  }

  // ---------- strikes ----------
  function strikeStep(s) { return s < 15 ? 0.5 : s < 60 ? 1 : s < 150 ? 2.5 : 5; }
  function roundK(x) { const st = strikeStep(market.spot); return Math.max(st, Math.round(x / st) * st); }
  function strikesAround(pcts) { return pcts.map((p) => roundK(market.spot * p)); }
  /** strikes simétricos: centro ATM e n asas espaçadas por ~pct do preço (mínimo 1 passo) */
  function wingStrikes(pct) {
    const st = strikeStep(market.spot), c = roundK(market.spot);
    const w = Math.max(st, Math.round(market.spot * pct / st) * st);
    return { c, w };
  }

  // ---------- catálogo ----------
  const mk = (kind, side, K, qty) => ({ id: newId(), kind, side, K: kind === 'stock' ? 0 : K, qty: qty || 1, prem: 0, manual: false });

  const PRESETS = [
    {
      id: 'compra-call', nome: 'Compra de Call', grupo: 'Altista', vies: 'Altista',
      legs: () => { const [k] = strikesAround([1.0]); return [mk('call', 1, k)]; },
      resumo: 'A aposta direta na alta: paga um prêmio para ter o direito de comprar o ativo pelo strike.',
      como: 'Você compra a call e paga o prêmio. Se o ativo subir acima do strike + prêmio, você lucra — e o lucro não tem teto. Se ficar abaixo do strike no vencimento, a opção vira pó e você perde só o prêmio.',
      quando: 'Você espera uma alta forte e rápida (antes do vencimento) e quer risco limitado ao prêmio pago.',
      cuidado: 'O tempo trabalha contra você (theta negativo). Mesmo acertando a direção, se a alta for lenta ou pequena, o prêmio pode evaporar. Queda da volatilidade implícita também machuca.'
    },
    {
      id: 'compra-put', nome: 'Compra de Put', grupo: 'Baixista', vies: 'Baixista',
      legs: () => { const [k] = strikesAround([1.0]); return [mk('put', 1, k)]; },
      resumo: 'A aposta direta na queda — ou um seguro puro contra uma queda do ativo.',
      como: 'Você compra a put e paga o prêmio. Se o ativo cair abaixo do strike − prêmio, você lucra. A perda máxima é o prêmio; o ganho máximo acontece se o ativo for a zero.',
      quando: 'Você espera uma queda relevante, ou quer se proteger sem vender o que já tem (ver "Put protetora").',
      cuidado: 'Também sofre com o passar do tempo. Puts costumam ficar mais caras (vol implícita alta) justamente em momentos de medo — quando todo mundo quer proteção.'
    },
    {
      id: 'venda-coberta', nome: 'Venda Coberta (Financiamento)', grupo: 'Renda', vies: 'Neutra / levemente altista',
      legs: () => { const [k] = strikesAround([1.05]); return [mk('stock', 1, 0), mk('call', -1, k)]; },
      resumo: 'Você tem a ação e vende uma call acima do preço atual para receber um prêmio — uma "renda" sobre a carteira.',
      como: 'Você é dono da ação e vende (lança) uma call OTM. O prêmio recebido reduz seu custo e dá um colchão contra pequenas quedas. Em troca, você abre mão da alta acima do strike: se o ativo disparar, sua ação será "exercida" e vendida ao preço do strike.',
      quando: 'Você já tem a ação, acha que ela ficará de lado ou subirá pouco, e aceita vendê-la no strike.',
      cuidado: 'O ganho é limitado; a perda é quase a mesma de ter só a ação (menos o prêmio). Se o papel cair muito, o prêmio recebido só ameniza.'
    },
    {
      id: 'put-protetora', nome: 'Put Protetora (Seguro)', grupo: 'Proteção', vies: 'Altista com proteção',
      legs: () => { const [k] = strikesAround([0.95]); return [mk('stock', 1, 0), mk('put', 1, k)]; },
      resumo: 'Ação + put: você mantém toda a alta, mas com um piso de perda. O prêmio é o custo do seguro.',
      como: 'Você compra a ação e uma put abaixo do preço atual. Se o ativo desabar, a put compensa a queda a partir do strike. Se subir, você ganha normalmente, descontado o prêmio da put.',
      quando: 'Você quer continuar exposto à alta, mas precisa limitar o pior cenário (evento de risco, resultado trimestral, eleição…).',
      cuidado: 'Seguro custa. Renovado todo mês, o prêmio pode consumir boa parte do retorno.'
    },
    {
      id: 'trava-alta-call', nome: 'Trava de Alta com Calls', grupo: 'Altista', vies: 'Altista moderada',
      legs: () => { const [a, b] = strikesAround([1.0, 1.1]); return [mk('call', 1, a), mk('call', -1, b)]; },
      resumo: 'Compra uma call e vende outra mais cara de strike (mais alta). Barateia a aposta, mas limita o ganho.',
      como: 'A call vendida financia parte da call comprada. O custo é menor que o de uma call seca, e o ganho máximo acontece quando o ativo chega ao strike vendido. Acima disso, nada mais se ganha.',
      quando: 'Você espera alta até certo patamar (não uma explosão) e quer pagar menos prêmio.',
      cuidado: 'Ganho e perda são limitados — bom para saber o risco de antemão, ruim se o ativo disparar bem além do strike vendido.'
    },
    {
      id: 'trava-baixa-put', nome: 'Trava de Baixa com Puts', grupo: 'Baixista', vies: 'Baixista moderada',
      legs: () => { const [a, b] = strikesAround([1.0, 0.9]); return [mk('put', 1, a), mk('put', -1, b)]; },
      resumo: 'Compra uma put e vende outra de strike mais baixo. Aposta na queda com custo menor e risco definido.',
      como: 'A put vendida (strike menor) reduz o custo da put comprada, mas limita o ganho à distância entre os strikes menos o débito.',
      quando: 'Você espera queda moderada e quer risco fixo.',
      cuidado: 'Se o ativo despencar além do strike inferior, você não ganha o extra.'
    },
    {
      id: 'trava-alta-put', nome: 'Trava de Alta com Puts (crédito)', grupo: 'Renda', vies: 'Neutra / altista',
      legs: () => { const [a, b] = strikesAround([0.95, 0.9]); return [mk('put', -1, a), mk('put', 1, b)]; },
      resumo: 'Você RECEBE prêmio vendendo uma put e compra outra mais barata como proteção. Lucra se o ativo não cair.',
      como: 'Vende put de strike maior (recebe mais) e compra put de strike menor (paga menos). Sobra um crédito. Se o ativo terminar acima do strike vendido, você embolsa todo o crédito. A put comprada limita a perda no pior caso.',
      quando: 'Você acredita que o ativo se sustenta acima de um nível (suporte) e quer ganhar com a passagem do tempo.',
      cuidado: 'Lucro pequeno, perda maior: risco/retorno costuma ser assimétrico contra você — só funciona se a probabilidade de acerto compensar.'
    },
    {
      id: 'trava-baixa-call', nome: 'Trava de Baixa com Calls (crédito)', grupo: 'Renda', vies: 'Neutra / baixista',
      legs: () => { const [a, b] = strikesAround([1.05, 1.1]); return [mk('call', -1, a), mk('call', 1, b)]; },
      resumo: 'Recebe prêmio vendendo uma call e compra outra mais alta para limitar o risco. Lucra se o ativo não subir.',
      como: 'A call vendida traz o crédito; a call comprada (strike maior) é o seguro contra uma alta violenta. Ganho máximo = crédito, se o ativo ficar abaixo do strike vendido.',
      quando: 'Você acha que o ativo tem uma "resistência" e não deve passar de certo nível.',
      cuidado: 'Ganho limitado ao crédito; perda máxima é a diferença entre strikes menos o crédito.'
    },
    {
      id: 'straddle', nome: 'Straddle (compra)', grupo: 'Volatilidade', vies: 'Neutra em direção, aposta em movimento',
      legs: () => { const [k] = strikesAround([1.0]); return [mk('call', 1, k), mk('put', 1, k)]; },
      resumo: 'Compra call e put no mesmo strike. Lucra se o ativo se mover MUITO, para qualquer lado.',
      como: 'Você paga dois prêmios. O ativo precisa se afastar do strike mais do que o total pago — para cima ou para baixo. Se ficar parado, você perde quase tudo.',
      quando: 'Você espera um grande movimento (balanço, decisão judicial, notícia) mas não sabe a direção.',
      cuidado: 'É caro. O mercado já precifica o evento na volatilidade implícita: se o movimento vier menor que o esperado, você perde mesmo "acertando" que haveria movimento.'
    },
    {
      id: 'strangle', nome: 'Strangle (compra)', grupo: 'Volatilidade', vies: 'Aposta em movimento grande',
      legs: () => { const [a, b] = strikesAround([0.95, 1.05]); return [mk('put', 1, a), mk('call', 1, b)]; },
      resumo: 'Como o straddle, mas com strikes afastados: mais barato, porém exige movimento ainda maior.',
      como: 'Compra uma put OTM e uma call OTM. O custo é menor; a "zona de prejuízo" (entre os strikes) é mais larga.',
      quando: 'Espera um movimento grande, quer pagar menos que no straddle e aceita precisar de um movimento maior.',
      cuidado: 'Probabilidade de lucro geralmente menor que a do straddle.'
    },
    {
      id: 'straddle-vendido', nome: 'Straddle Vendido', grupo: 'Volatilidade', vies: 'Neutra — aposta em calmaria',
      legs: () => { const [k] = strikesAround([1.0]); return [mk('call', -1, k), mk('put', -1, k)]; },
      resumo: 'Vende call e put no mesmo strike para receber muito prêmio. Ganha se o ativo ficar parado — e pode perder MUITO se não ficar.',
      como: 'É o oposto do straddle comprado. Você embolsa dois prêmios; o lucro máximo ocorre com o ativo exatamente no strike. Fora dele, o prejuízo cresce sem limite (para cima) ou até o ativo zerar (para baixo).',
      quando: 'Apenas para quem entende os riscos: aposta em baixa volatilidade e passagem do tempo.',
      cuidado: 'Risco ilimitado e exigência de margem alta. Uma única notícia pode gerar prejuízo enorme. Estude a versão com proteção (iron condor) antes.'
    },
    {
      id: 'borboleta', nome: 'Borboleta (Call Butterfly)', grupo: 'Volatilidade', vies: 'Neutra — aposta em preço estável',
      legs: () => { const { c, w } = wingStrikes(0.05); return [mk('call', 1, c - w), { ...mk('call', -1, c), qty: 2 }, mk('call', 1, c + w)]; },
      resumo: 'Compra 1 call baixa, vende 2 do meio e compra 1 alta. Lucro máximo se o ativo terminar exatamente no strike do meio.',
      como: 'O formato lembra uma borboleta: um pico de lucro no meio e "asas" de perda pequena e limitada. Custa pouco e tem ótimo retorno/risco, mas a chance de acertar o pico é baixa.',
      quando: 'Você prevê que o ativo ficará próximo de um preço específico no vencimento.',
      cuidado: 'Quatro pernas → custos de corretagem pesam e a liquidez pode ser ruim.'
    },
    {
      id: 'iron-condor', nome: 'Iron Condor', grupo: 'Renda', vies: 'Neutra — aposta em lateralidade',
      legs: () => {
        const { c, w } = wingStrikes(0.06);
        return [mk('put', 1, c - 2 * w), mk('put', -1, c - w), mk('call', -1, c + w), mk('call', 1, c + 2 * w)];
      },
      resumo: 'Vende um strangle e compra proteções nas pontas. Recebe crédito e ganha se o ativo ficar dentro de uma faixa.',
      como: 'Junta uma trava de alta com puts e uma trava de baixa com calls. Você recebe crédito e o lucro máximo ocorre se o ativo terminar entre os dois strikes vendidos. As asas compradas limitam a perda.',
      quando: 'Você espera lateralidade e quer ganhar com o tempo, com risco definido.',
      cuidado: 'Ganho pequeno frente ao risco. Um movimento forte contra qualquer lado causa perda máxima.'
    },
    {
      id: 'collar', nome: 'Colar (Collar)', grupo: 'Proteção', vies: 'Proteção com custo zero',
      legs: () => { const [a, b] = strikesAround([0.93, 1.07]); return [mk('stock', 1, 0), mk('put', 1, a), mk('call', -1, b)]; },
      resumo: 'Ação + put comprada (piso) + call vendida (teto). O prêmio da call paga a put (total ou parcialmente): proteção barata ou até de graça.',
      como: 'Você limita a queda com a put e financia esse seguro abrindo mão da alta acima do strike da call. O resultado fica preso numa "faixa" — perda e ganho limitados.',
      quando: 'Você quer proteger uma posição grande sem gastar caixa.',
      cuidado: 'Você abre mão de altas fortes. E é preciso cuidado com dividendos e exercício antecipado.'
    },
    {
      id: 'venda-put', nome: 'Venda de Put (garantida)', grupo: 'Renda', vies: 'Altista / neutra',
      legs: () => { const [k] = strikesAround([0.95]); return [mk('put', -1, k)]; },
      resumo: 'Recebe prêmio se comprometendo a comprar o ativo mais barato (no strike). Lucra se ele não cair abaixo disso.',
      como: 'Você vende a put e recebe o prêmio. Se o ativo ficar acima do strike, embolsa o prêmio. Se cair abaixo, será "exercido" e terá de comprar o ativo pelo strike — que, com o prêmio recebido, sai mais barato que o preço de hoje.',
      quando: 'Você quer comprar o ativo com desconto e, enquanto espera, ser pago por isso.',
      cuidado: 'A perda pode ser grande se o ativo despencar (até ir a zero). Só venda puts de ativos que você aceitaria carregar, com caixa reservado.'
    },
    {
      id: 'vazio', nome: 'Montar do zero', grupo: 'Livre', vies: 'Você decide',
      legs: () => [],
      resumo: 'Adicione pernas livremente e veja o efeito.',
      como: 'Use o botão "+ Adicionar perna" para combinar calls, puts e ações. Experimente reproduzir estratégias que você viu em cursos ou livros.',
      quando: 'Para testar suas próprias ideias.',
      cuidado: 'Lembre: cada perna vendida sem cobertura pode gerar perdas grandes.'
    }
  ];

  const state = { presetId: null, nome: '', legs: [], custom: false };

  function loadPreset(id) {
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
    state.presetId = p.id;
    state.nome = p.nome;
    state.custom = false;
    state.legs = p.legs();
    syncPremiums(state.legs);
  }

  function addLeg(kind, side) {
    const K = roundK(market.spot);
    const leg = mk(kind || 'call', side || 1, K);
    state.legs.push(leg);
    syncPremiums(state.legs);
    state.custom = true;
    return leg;
  }

  window.Strat = {
    market, state, PRESETS, newId,
    T, legValue, theoPrice, syncPremiums, pnlExpiry, pnlAt, kinks, sampleX,
    metrics, probability, netGreeks, strikeStep, roundK, loadPreset, addLeg, optParams
  };
})();
