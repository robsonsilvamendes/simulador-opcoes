/* Black-Scholes-Merton, gregas e volatilidade implícita.
 * Convenções: T em anos (dias corridos / 365), taxas e vol em decimais (0.14 = 14% a.a.).
 * theta é por DIA, vega e rho são por 1 ponto percentual (1%). */
(function () {
  const SQRT2PI = Math.sqrt(2 * Math.PI);
  const pdf = (x) => Math.exp(-0.5 * x * x) / SQRT2PI;

  // Função de distribuição normal acumulada (algoritmo de Hart, dupla precisão)
  function cdf(x) {
    const a = Math.abs(x);
    let c;
    if (a > 37) c = 0;
    else {
      const e = Math.exp(-a * a / 2);
      if (a < 7.07106781186547) {
        let b = 3.52624965998911e-2 * a + 0.700383064443688;
        b = b * a + 6.37396220353165;
        b = b * a + 33.912866078383;
        b = b * a + 112.079291497871;
        b = b * a + 221.213596169931;
        b = b * a + 220.206867912376;
        c = e * b;
        b = 8.83883476483184e-2 * a + 1.75566716318264;
        b = b * a + 16.064177579207;
        b = b * a + 86.7807322029461;
        b = b * a + 296.564248779674;
        b = b * a + 637.333633378831;
        b = b * a + 793.826512519948;
        b = b * a + 440.413735824752;
        c = c / b;
      } else {
        let b = a + 0.65;
        b = a + 4 / b;
        b = a + 3 / b;
        b = a + 2 / b;
        b = a + 1 / b;
        c = e / b / 2.506628274631;
      }
    }
    return x > 0 ? 1 - c : c;
  }

  // Inversa da normal (Acklam) — usada para quantis do cone de probabilidade
  function invCdf(p) {
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    let q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  function intrinsic(type, S, K) {
    return type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
  }

  function d1d2(S, K, T, r, q, v) {
    const sq = v * Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * v * v) * T) / sq;
    return [d1, d1 - sq];
  }

  /** o = {type:'call'|'put', S, K, T, r, q, v} → preço teórico por ação */
  function price(o) {
    const { type, S, K, T, r, v } = o;
    const q = o.q || 0;
    if (T <= 1e-9 || v <= 1e-9) return intrinsic(type, S, K);
    const [d1, d2] = d1d2(S, K, T, r, q, v);
    const dfr = Math.exp(-r * T), dfq = Math.exp(-q * T);
    return type === 'call'
      ? S * dfq * cdf(d1) - K * dfr * cdf(d2)
      : K * dfr * cdf(-d2) - S * dfq * cdf(-d1);
  }

  function greeks(o) {
    const { type, S, K, T, r, v } = o;
    const q = o.q || 0;
    if (T <= 1e-9 || v <= 1e-9) {
      const itm = type === 'call' ? S > K : S < K;
      return { price: intrinsic(type, S, K), delta: itm ? (type === 'call' ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    }
    const [d1, d2] = d1d2(S, K, T, r, q, v);
    const dfr = Math.exp(-r * T), dfq = Math.exp(-q * T);
    const sqT = Math.sqrt(T);
    const nd1 = pdf(d1);
    const gamma = dfq * nd1 / (S * v * sqT);
    const vega = S * dfq * nd1 * sqT / 100;
    let delta, theta, rho;
    if (type === 'call') {
      delta = dfq * cdf(d1);
      theta = (-S * dfq * nd1 * v / (2 * sqT) - r * K * dfr * cdf(d2) + q * S * dfq * cdf(d1)) / 365;
      rho = K * T * dfr * cdf(d2) / 100;
    } else {
      delta = -dfq * cdf(-d1);
      theta = (-S * dfq * nd1 * v / (2 * sqT) + r * K * dfr * cdf(-d2) - q * S * dfq * cdf(-d1)) / 365;
      rho = -K * T * dfr * cdf(-d2) / 100;
    }
    return { price: price(o), delta, gamma, theta, vega, rho };
  }

  /** Volatilidade implícita por bisseção. Retorna null se o prêmio for incompatível. */
  function impliedVol(target, o) {
    let lo = 0.001, hi = 5;
    const f = (v) => price({ ...o, v }) - target;
    if (f(lo) > 0 || f(hi) < 0) return null;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  /** Probabilidade lognormal: P(S_T <= x), com deriva mu (a.a.) */
  function lnCdf(x, S, T, mu, q, v) {
    if (x <= 0) return 0;
    if (T <= 0) return x >= S ? 1 : 0;
    const m = Math.log(S) + (mu - (q || 0) - 0.5 * v * v) * T;
    return cdf((Math.log(x) - m) / (v * Math.sqrt(T)));
  }

  /** Quantil do preço do ativo no tempo T (p entre 0 e 1) */
  function lnQuantile(p, S, T, mu, q, v) {
    const m = Math.log(S) + (mu - (q || 0) - 0.5 * v * v) * T;
    return Math.exp(m + v * Math.sqrt(T) * invCdf(p));
  }

  window.BS = { pdf, cdf, invCdf, price, greeks, intrinsic, impliedVol, lnCdf, lnQuantile };
})();
