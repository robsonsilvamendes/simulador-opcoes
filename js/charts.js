/* Gráficos SVG sem dependências: LineChart, Histogram, Heatmap.
 * Todas as cores vêm de variáveis CSS (var(--s1) etc.), então o tema claro/escuro
 * troca sem redesenhar. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) {
      if (attrs[k] == null) continue;
      if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function div(cls, parent) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }

  function niceNum(range, round) {
    const exp = Math.floor(Math.log10(range));
    const f = range / Math.pow(10, exp);
    let nf;
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
  }
  function niceTicks(min, max, count) {
    if (!(max > min)) return [min];
    const step = niceNum((max - min) / Math.max(count - 1, 1), true);
    const out = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
    return out;
  }

  function interp(xs, ys, x) {
    const n = xs.length;
    if (!n) return NaN;
    const asc = xs[0] <= xs[n - 1];
    if (asc ? x <= xs[0] : x >= xs[0]) return ys[0];
    if (asc ? x >= xs[n - 1] : x <= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((xs[mid] <= x) === asc) lo = mid; else hi = mid;
    }
    const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return ys[lo] + (ys[hi] - ys[lo]) * t;
  }

  // rótulos de linhas verticais em fileiras, para não sobrepor
  function placeVLabels(g, items, X, l, r, top) {
    const rows = [];
    const list = items.filter((v) => v.label).map((v) => ({ v, px: X(v.x), w: v.label.length * 6.2 + 10 })).sort((a, b) => a.px - b.px);
    list.forEach(({ v, px, w }) => {
      let anchor = 'start', x0 = px + 4;
      if (x0 + w > r) { anchor = 'end'; x0 = px - 4; }
      const a = anchor === 'start' ? x0 : x0 - w, b = a + w;
      let row = 0;
      while (rows[row] && rows[row].some(([s, e]) => a < e + 4 && b > s - 4)) row++;
      (rows[row] = rows[row] || []).push([a, b]);
      const y = top + 12 + row * 16;
      svgEl('rect', { x: a - 3 + (anchor === 'start' ? 0 : 0), y: y - 11, width: w, height: 15, rx: 3, class: 'lbl-bg' }, g);
      svgEl('text', { x: anchor === 'start' ? x0 : x0, y: y, 'text-anchor': anchor, class: 'lbl-text', text: v.label }, g);
    });
  }

  function makeShell(host, legendItems) {
    host.classList.add('chart');
    host.innerHTML = '';
    const legend = div('legend', host);
    const wrap = div('plot', host);
    const tip = div('tip', wrap);
    tip.style.display = 'none';
    return { legend, wrap, tip };
  }

  function drawLegend(el, items) {
    el.innerHTML = '';
    if (items.length < 2) { el.style.display = 'none'; return; }
    el.style.display = '';
    items.forEach((it) => {
      const chip = div('chip', el);
      const key = div('key ' + (it.type || 'line'), chip);
      key.style.setProperty('--c', it.color);
      if (it.dash) key.classList.add('dashed');
      const t = document.createElement('span');
      t.textContent = it.name;
      chip.appendChild(t);
    });
  }

  function placeTip(tip, wrap, px, py) {
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight, W = wrap.clientWidth;
    let x = px + 14;
    if (x + w > W - 4) x = px - w - 14;
    if (x < 4) x = 4;
    let y = py - h / 2;
    y = Math.max(4, Math.min(y, wrap.clientHeight - h - 4));
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  /* ------------------------------------------------------------------ */
  class LineChart {
    constructor(host) {
      this.host = host;
      const s = makeShell(host);
      this.legendEl = s.legend; this.wrap = s.wrap; this.tip = s.tip;
      this.svg = svgEl('svg', { class: 'svg' });
      this.wrap.insertBefore(this.svg, this.tip);
      this.tableHost = document.createElement('details');
      this.tableHost.className = 'table-view';
      host.appendChild(this.tableHost);
      this.lastW = 0;
      this.ro = new ResizeObserver(() => {
        const w = this.wrap.clientWidth;
        if (w && Math.abs(w - this.lastW) > 1) { this.lastW = w; this.draw(); }
      });
      this.ro.observe(this.wrap);
    }

    set(cfg) { this.cfg = cfg; this.draw(); }

    draw() {
      const cfg = this.cfg;
      if (!cfg) return;
      const W = this.wrap.clientWidth;
      if (W < 60) return;
      const H = cfg.height || 320;
      const svg = this.svg;
      svg.innerHTML = '';
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      this.wrap.style.height = H + 'px';
      this.tip.style.display = 'none';

      const series = (cfg.series || []).filter((s) => s.xs && s.xs.length);
      const bands = cfg.bands || [];
      const xcfg = cfg.x || {}, ycfg = cfg.y || {};

      // domínios
      let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      series.forEach((s) => {
        if (s.domain === false) return;
        s.xs.forEach((x) => { if (x < xmin) xmin = x; if (x > xmax) xmax = x; });
        s.ys.forEach((y) => { if (isFinite(y)) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; } });
      });
      bands.forEach((b) => {
        b.lo.forEach((y) => { if (y < ymin) ymin = y; });
        b.hi.forEach((y) => { if (y > ymax) ymax = y; });
      });
      (cfg.hlines || []).forEach((h) => { if (h.domain) { ymin = Math.min(ymin, h.y); ymax = Math.max(ymax, h.y); } });
      if (xcfg.min != null) xmin = xcfg.min;
      if (xcfg.max != null) xmax = xcfg.max;
      if (!isFinite(ymin)) { ymin = 0; ymax = 1; }
      if (ycfg.zero !== false && ycfg.min == null) { ymin = Math.min(ymin, 0); }
      if (ycfg.zero !== false && ycfg.max == null) { ymax = Math.max(ymax, 0); }
      if (ycfg.min != null) ymin = ycfg.min;
      if (ycfg.max != null) ymax = ycfg.max;
      if (ymax - ymin < 1e-9) { ymax = ymin + 1; }
      const pad = (ymax - ymin) * 0.06;
      if (ycfg.min == null) ymin -= (ymin < 0 || ycfg.zero === false) ? pad : 0;
      if (ycfg.max == null) ymax += pad;

      const yfmt = ycfg.fmt || ((v) => String(v));
      const xfmt = xcfg.fmt || ((v) => String(v));
      const yticks = niceTicks(ymin, ymax, Math.max(3, Math.min(7, Math.floor(H / 55))));
      const lblw = Math.max(...yticks.map((t) => yfmt(t).length)) * 6.6 + 16;
      const m = { l: Math.max(44, lblw), r: 16, t: 10, b: xcfg.label ? 46 : 30 };
      const pw = W - m.l - m.r, ph = H - m.t - m.b;
      const rev = !!xcfg.reverse;
      const X = (x) => m.l + (rev ? (xmax - x) : (x - xmin)) / (xmax - xmin) * pw;
      const invX = (px) => { const f = (px - m.l) / pw; return rev ? xmax - f * (xmax - xmin) : xmin + f * (xmax - xmin); };
      const Y = (y) => m.t + (ymax - y) / (ymax - ymin) * ph;
      this.geom = { X, invX, Y, m, pw, ph, xmin, xmax };

      const defs = svgEl('defs', {}, svg);
      const clipId = 'clip' + Math.random().toString(36).slice(2, 8);
      const cp = svgEl('clipPath', { id: clipId }, defs);
      svgEl('rect', { x: m.l, y: m.t, width: pw, height: ph }, cp);

      // grade horizontal + rótulos do eixo y
      const gGrid = svgEl('g', {}, svg);
      yticks.forEach((t) => {
        const y = Y(t);
        svgEl('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y, class: t === 0 && ycfg.zero !== false ? 'zero' : 'grid' }, gGrid);
        svgEl('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end', class: 'tick', text: yfmt(t) }, gGrid);
      });
      // eixo x
      const xticks = niceTicks(Math.min(xmin, xmax), Math.max(xmin, xmax), Math.max(3, Math.floor(pw / 90)));
      xticks.forEach((t) => {
        const x = X(t);
        svgEl('line', { x1: x, x2: x, y1: m.t + ph, y2: m.t + ph + 4, class: 'axis' }, gGrid);
        svgEl('text', { x, y: m.t + ph + 18, 'text-anchor': 'middle', class: 'tick', text: xfmt(t) }, gGrid);
      });
      svgEl('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: 'axis' }, gGrid);
      if (xcfg.label) svgEl('text', { x: m.l + pw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title', text: xcfg.label }, gGrid);

      const g = svgEl('g', { 'clip-path': `url(#${clipId})` }, svg);

      // faixas (fan chart)
      bands.forEach((b) => {
        let d = '';
        b.xs.forEach((x, i) => { d += (i ? 'L' : 'M') + X(x) + ',' + Y(b.hi[i]); });
        for (let i = b.xs.length - 1; i >= 0; i--) d += 'L' + X(b.xs[i]) + ',' + Y(b.lo[i]);
        svgEl('path', { d: d + 'Z', class: 'band', style: `fill:${b.color};opacity:${b.opacity == null ? 0.16 : b.opacity}` }, g);
      });

      // sombreado lucro/prejuízo
      if (cfg.shade != null) {
        const s = series.find((q) => q.id === cfg.shade) || series[0];
        const y0 = Math.max(m.t, Math.min(m.t + ph, Y(0)));
        let d = '';
        s.xs.forEach((x, i) => { d += (i ? 'L' : 'M') + X(x) + ',' + Y(s.ys[i]); });
        d += 'L' + X(s.xs[s.xs.length - 1]) + ',' + y0 + 'L' + X(s.xs[0]) + ',' + y0 + 'Z';
        const idA = clipId + 'a', idB = clipId + 'b';
        svgEl('rect', { id: idA, x: m.l, y: m.t, width: pw, height: Math.max(0, y0 - m.t) }, svgEl('clipPath', { id: 'c' + idA }, defs));
        svgEl('rect', { id: idB, x: m.l, y: y0, width: pw, height: Math.max(0, m.t + ph - y0) }, svgEl('clipPath', { id: 'c' + idB }, defs));
        svgEl('path', { d, class: 'shade-pos', 'clip-path': `url(#c${idA})` }, g);
        svgEl('path', { d, class: 'shade-neg', 'clip-path': `url(#c${idB})` }, g);
      }

      // hlines
      (cfg.hlines || []).forEach((h) => {
        const y = Y(h.y);
        svgEl('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y, class: 'ref', style: `stroke:${h.color || 'var(--muted)'}`, 'stroke-dasharray': h.dash === false ? null : '4 4' }, g);
      });

      // séries: fracas primeiro
      const order = series.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
      order.forEach((s) => {
        let d = '';
        let pen = false;
        s.xs.forEach((x, i) => {
          const y = s.ys[i];
          if (!isFinite(y)) { pen = false; return; }
          d += (pen ? 'L' : 'M') + X(x).toFixed(2) + ',' + Y(y).toFixed(2);
          pen = true;
        });
        svgEl('path', {
          d, class: 'line',
          style: `stroke:${s.color};stroke-width:${s.width || 2};opacity:${s.opacity == null ? 1 : s.opacity}`,
          'stroke-dasharray': s.dash || null
        }, g);
      });

      // vlines (fora do clip para o rótulo)
      const gV = svgEl('g', {}, svg);
      (cfg.vlines || []).forEach((v) => {
        if (v.x < Math.min(xmin, xmax) || v.x > Math.max(xmin, xmax)) return;
        const x = X(v.x);
        svgEl('line', { x1: x, x2: x, y1: m.t, y2: m.t + ph, class: 'ref', style: `stroke:${v.color || 'var(--muted)'}`, 'stroke-dasharray': v.dash === false ? null : '4 4' }, gV);
      });
      placeVLabels(gV, (cfg.vlines || []).filter((v) => v.x >= Math.min(xmin, xmax) && v.x <= Math.max(xmin, xmax)), X, m.l, m.l + pw, m.t);

      // pontos fixos
      (cfg.dots || []).forEach((d) => {
        if (d.x < Math.min(xmin, xmax) || d.x > Math.max(xmin, xmax)) return;
        svgEl('circle', { cx: X(d.x), cy: Y(d.y), r: 5, class: 'dot', style: `fill:${d.color || 'var(--text)'}` }, gV);
        if (d.label) svgEl('text', { x: X(d.x), y: Y(d.y) + (d.below ? 20 : -10), 'text-anchor': 'middle', class: 'lbl-text', text: d.label }, gV);
      });
      // rótulos diretos no fim das linhas
      (cfg.endLabels ? series.filter((s) => s.name && s.endLabel !== false && s.legend !== false) : []).forEach((s) => {
        const i = rev ? 0 : s.xs.length - 1;
        svgEl('text', { x: Math.min(X(s.xs[i]) - 4, m.l + pw - 4), y: Y(s.ys[i]) - 8, 'text-anchor': 'end', class: 'lbl-text', text: s.name }, gV);
      });

      // legenda
      const items = series.filter((s) => s.name && s.legend !== false).map((s) => ({ name: s.name, color: s.color, dash: !!s.dash }));
      (cfg.legendExtra || []).forEach((i) => items.push(i));
      drawLegend(this.legendEl, items);

      // hover
      const overlay = svgEl('rect', { x: m.l, y: m.t, width: pw, height: ph, class: 'overlay', style: cfg.onPick ? 'cursor:crosshair;touch-action:none' : 'touch-action:pan-y' }, svg);
      const cross = svgEl('line', { y1: m.t, y2: m.t + ph, class: 'cross', style: 'display:none' }, svg);
      const dots = series.filter((s) => s.hover !== false).map((s) => svgEl('circle', { r: 4.5, class: 'dot', style: `fill:${s.color};display:none` }, svg));
      const hoverSeries = series.filter((s) => s.hover !== false);
      const show = (ev) => {
        const r = svg.getBoundingClientRect();
        const px = Math.max(m.l, Math.min(m.l + pw, ev.clientX - r.left));
        const x = invX(px);
        cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.style.display = '';
        const rows = hoverSeries.map((s, i) => {
          const y = interp(s.xs, s.ys, x);
          dots[i].setAttribute('cx', px); dots[i].setAttribute('cy', Y(y)); dots[i].style.display = '';
          return { name: s.name, color: s.color, y, text: yfmt(y, true) };
        });
        const head = cfg.tipHead ? cfg.tipHead(x) : (xcfg.label ? xcfg.label + ': ' : '') + xfmt(x, true);
        const html = cfg.tooltip ? cfg.tooltip(x, rows) : null;
        this.tip.innerHTML = html || `<div class="tip-h">${head}</div>` + rows.filter((q) => q.name).map((q) => `<div class="tip-r"><i style="background:${q.color}"></i><span>${q.name}</span><b>${q.text}</b></div>`).join('');
        placeTip(this.tip, this.wrap, px, ev.clientY - r.top);
        if (cfg.onPick && ev.buttons) cfg.onPick(x);
      };
      const hide = () => { cross.style.display = 'none'; dots.forEach((d) => (d.style.display = 'none')); this.tip.style.display = 'none'; };
      overlay.addEventListener('pointermove', show);
      overlay.addEventListener('pointerleave', hide);
      overlay.addEventListener('pointerdown', (ev) => { overlay.setPointerCapture(ev.pointerId); show(ev); if (cfg.onPick) cfg.onPick(invX(Math.max(m.l, Math.min(m.l + pw, ev.clientX - svg.getBoundingClientRect().left)))); });

      this.drawTable(series, xfmt, yfmt, xcfg, invX);
    }

    drawTable(series, xfmt, yfmt, xcfg) {
      const cfg = this.cfg;
      const th = this.tableHost;
      if (cfg.table === false) { th.style.display = 'none'; return; }
      const named = series.filter((s) => s.name && s.hover !== false);
      if (!named.length) { th.style.display = 'none'; return; }
      th.style.display = '';
      const wasOpen = th.open;
      const g = this.geom;
      const n = 12;
      const rows = [];
      for (let i = 0; i <= n; i++) {
        const x = g.xmin + (g.xmax - g.xmin) * i / n;
        rows.push(`<tr><th>${xfmt(x, true)}</th>${named.map((s) => `<td>${yfmt(interp(s.xs, s.ys, x), true)}</td>`).join('')}</tr>`);
      }
      th.innerHTML = `<summary>Ver os dados em tabela</summary><div class="tbl-wrap"><table><thead><tr><th>${(xcfg.label || 'x')}</th>${named.map((s) => `<th>${s.name}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
      th.open = wasOpen;
    }
  }

  /* ------------------------------------------------------------------ */
  class Histogram {
    constructor(host) {
      this.host = host;
      const s = makeShell(host);
      this.legendEl = s.legend; this.wrap = s.wrap; this.tip = s.tip;
      this.svg = svgEl('svg', { class: 'svg' });
      this.wrap.insertBefore(this.svg, this.tip);
      this.lastW = 0;
      this.ro = new ResizeObserver(() => {
        const w = this.wrap.clientWidth;
        if (w && Math.abs(w - this.lastW) > 1) { this.lastW = w; this.draw(); }
      });
      this.ro.observe(this.wrap);
    }
    set(cfg) { this.cfg = cfg; this.draw(); }
    draw() {
      const cfg = this.cfg;
      if (!cfg) return;
      const W = this.wrap.clientWidth;
      if (W < 60) return;
      const H = cfg.height || 300;
      const svg = this.svg;
      svg.innerHTML = '';
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      this.wrap.style.height = H + 'px';
      const bins = cfg.bins;
      const xfmt = cfg.xfmt || String, yfmt = cfg.yfmt || String;
      const xmin = bins[0].x0, xmax = bins[bins.length - 1].x1;
      const ymax = Math.max(...bins.map((b) => b.v)) * 1.08 || 1;
      const yticks = niceTicks(0, ymax, 5);
      const lblw = Math.max(...yticks.map((t) => yfmt(t).length)) * 6.6 + 16;
      const m = { l: Math.max(44, lblw), r: 16, t: 10, b: cfg.xlabel ? 46 : 30 };
      const pw = W - m.l - m.r, ph = H - m.t - m.b;
      const X = (x) => m.l + (x - xmin) / (xmax - xmin) * pw;
      const Y = (y) => m.t + (1 - y / ymax) * ph;
      const gg = svgEl('g', {}, svg);
      yticks.forEach((t) => {
        svgEl('line', { x1: m.l, x2: m.l + pw, y1: Y(t), y2: Y(t), class: t === 0 ? 'axis' : 'grid' }, gg);
        svgEl('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick', text: yfmt(t) }, gg);
      });
      niceTicks(xmin, xmax, Math.max(3, Math.floor(pw / 90))).forEach((t) => {
        svgEl('text', { x: X(t), y: m.t + ph + 18, 'text-anchor': 'middle', class: 'tick', text: xfmt(t) }, gg);
        svgEl('line', { x1: X(t), x2: X(t), y1: m.t + ph, y2: m.t + ph + 4, class: 'axis' }, gg);
      });
      if (cfg.xlabel) svgEl('text', { x: m.l + pw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title', text: cfg.xlabel }, gg);
      const gb = svgEl('g', {}, svg);
      const r = 3;
      bins.forEach((b) => {
        const x = X(b.x0) + 1, w = Math.max(1, X(b.x1) - X(b.x0) - 2), y = Y(b.v), h = Math.max(0, m.t + ph - y);
        if (h <= 0) return;
        const rr = Math.min(r, w / 2, h);
        const d = `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
        const p = svgEl('path', { d, class: 'bar', style: `fill:${b.color}` }, gb);
        p.addEventListener('pointermove', (ev) => {
          const rc = svg.getBoundingClientRect();
          this.tip.innerHTML = cfg.tooltip ? cfg.tooltip(b) : `<div class="tip-h">${xfmt(b.x0, true)} a ${xfmt(b.x1, true)}</div><div class="tip-r"><span>Frequência</span><b>${yfmt(b.v, true)}</b></div>`;
          placeTip(this.tip, this.wrap, ev.clientX - rc.left, ev.clientY - rc.top);
        });
        p.addEventListener('pointerleave', () => { this.tip.style.display = 'none'; });
      });
      const gv = svgEl('g', {}, svg);
      (cfg.vlines || []).forEach((v) => {
        if (v.x < xmin || v.x > xmax) return;
        svgEl('line', { x1: X(v.x), x2: X(v.x), y1: m.t, y2: m.t + ph, class: 'ref', style: `stroke:${v.color || 'var(--muted)'}`, 'stroke-dasharray': v.dash === false ? null : '4 4' }, gv);
      });
      placeVLabels(gv, (cfg.vlines || []).filter((v) => v.x >= xmin && v.x <= xmax), X, m.l, m.l + pw, m.t);
      drawLegend(this.legendEl, cfg.legend || []);
    }
  }

  /* ------------------------------------------------------------------ */
  class Heatmap {
    constructor(host) {
      this.host = host;
      const s = makeShell(host);
      this.legendEl = s.legend; this.wrap = s.wrap; this.tip = s.tip;
      this.svg = svgEl('svg', { class: 'svg' });
      this.wrap.insertBefore(this.svg, this.tip);
      this.scaleEl = div('scale', host);
      this.lastW = 0;
      this.ro = new ResizeObserver(() => {
        const w = this.wrap.clientWidth;
        if (w && Math.abs(w - this.lastW) > 1) { this.lastW = w; this.draw(); }
      });
      this.ro.observe(this.wrap);
    }
    set(cfg) { this.cfg = cfg; this.draw(); }

    static color(v, zmax) {
      const t = Math.min(1, Math.abs(v) / (zmax || 1));
      const side = v >= 0 ? 'pos' : 'neg';
      if (t < 0.02) return 'var(--mid)';
      const lo = `var(--${side}-lo)`, hi = `var(--${side}-hi)`;
      if (t < 0.5) return `color-mix(in oklab, ${lo} ${(t * 2 * 100).toFixed(0)}%, var(--mid))`;
      return `color-mix(in oklab, ${hi} ${((t - 0.5) * 2 * 100).toFixed(0)}%, ${lo})`;
    }

    draw() {
      const cfg = this.cfg;
      if (!cfg) return;
      const W = this.wrap.clientWidth;
      if (W < 60) return;
      const nx = cfg.xs.length, ny = cfg.ys.length;
      const H = cfg.height || 320;
      const svg = this.svg;
      svg.innerHTML = '';
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      this.wrap.style.height = H + 'px';
      const m = { l: 52, r: 12, t: 8, b: 46 };
      const pw = W - m.l - m.r, ph = H - m.t - m.b;
      const cw = pw / nx, ch = ph / ny;
      let zmax = cfg.zmax;
      if (!zmax) { zmax = 0; cfg.z.forEach((row) => row.forEach((v) => { zmax = Math.max(zmax, Math.abs(v)); })); }
      const xfmt = cfg.xfmt || String, yfmt = cfg.yfmt || String, zfmt = cfg.zfmt || String;
      const gc = svgEl('g', {}, svg);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const v = cfg.z[j][i];
          const c = svgEl('rect', { x: m.l + i * cw, y: m.t + j * ch, width: cw + 0.6, height: ch + 0.6, class: 'cell', style: `fill:${Heatmap.color(v, zmax)}` }, gc);
          c.addEventListener('pointermove', (ev) => {
            const rc = svg.getBoundingClientRect();
            this.tip.innerHTML = cfg.tooltip ? cfg.tooltip(cfg.xs[i], cfg.ys[j], v) : `<div class="tip-h">${xfmt(cfg.xs[i], true)}</div><div class="tip-r"><span>${yfmt(cfg.ys[j], true)}</span><b>${zfmt(v)}</b></div>`;
            placeTip(this.tip, this.wrap, ev.clientX - rc.left, ev.clientY - rc.top);
          });
          c.addEventListener('pointerleave', () => { this.tip.style.display = 'none'; });
        }
      }
      // eixos
      const ga = svgEl('g', {}, svg);
      const xstep = Math.max(1, Math.ceil(nx / Math.max(3, Math.floor(pw / 70))));
      for (let i = 0; i < nx; i += xstep) svgEl('text', { x: m.l + (i + 0.5) * cw, y: m.t + ph + 16, 'text-anchor': 'middle', class: 'tick', text: xfmt(cfg.xs[i]) }, ga);
      const ystep = Math.max(1, Math.ceil(ny / Math.max(3, Math.floor(ph / 26))));
      for (let j = 0; j < ny; j += ystep) svgEl('text', { x: m.l - 8, y: m.t + (j + 0.5) * ch + 4, 'text-anchor': 'end', class: 'tick', text: yfmt(cfg.ys[j]) }, ga);
      if (cfg.xlabel) svgEl('text', { x: m.l + pw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title', text: cfg.xlabel }, ga);
      if (cfg.ylabel) svgEl('text', { x: 12, y: m.t + ph / 2, 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 12 ${m.t + ph / 2})`, text: cfg.ylabel }, ga);
      // linhas de referência (preço atual)
      const xmin = cfg.xs[0], xmax = cfg.xs[nx - 1];
      const gv = svgEl('g', {}, svg);
      (cfg.vlines || []).forEach((v) => {
        if (v.x < xmin || v.x > xmax) return;
        const x = m.l + ((v.x - xmin) / (xmax - xmin)) * (pw - cw) + cw / 2;
        svgEl('line', { x1: x, x2: x, y1: m.t, y2: m.t + ph, class: 'ref', style: `stroke:${v.color || 'var(--text)'}`, 'stroke-dasharray': '4 4' }, gv);
        if (v.label) {
          svgEl('rect', { x: x + 3, y: m.t + 3, width: v.label.length * 6.2 + 10, height: 15, rx: 3, class: 'lbl-bg' }, gv);
          svgEl('text', { x: x + 8, y: m.t + 14, class: 'lbl-text', text: v.label }, gv);
        }
      });
      // escala de cores
      const stops = [-1, -0.5, 0, 0.5, 1].map((t) => Heatmap.color(t * zmax, zmax) + ' ' + ((t + 1) * 50) + '%');
      this.scaleEl.innerHTML = `<span>${zfmt(-zmax)}</span><div class="bar" style="background:linear-gradient(90deg,${stops.join(',')})"></div><span>${zfmt(zmax)}</span>`;
    }
  }

  window.Charts = { LineChart, Histogram, Heatmap, niceTicks, interp };
})();
