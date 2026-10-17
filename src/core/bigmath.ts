// Große Zahlen mit BigInt: Miller-Rabin, Lucas-Lehmer, Ausdrucks-Parser, π (Chudnovsky), Fibonacci (Fast Doubling).
// Port von NumberTheory.cs, PiCalc.cs und FibCalc.cs.

export function bitLength(n: bigint): number {
  if (n <= 0n) return 0;
  return n.toString(16).length * 4 - (Math.clz32(parseInt(n.toString(16)[0], 16)) - 28);
}

export function modPow(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n;
  b %= m;
  if (b < 0n) b += m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    e >>= 1n;
    if (e > 0n) b = (b * b) % m;
  }
  return r;
}

const DET_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
const DET_LIMIT = 3317044064679887385961981n;

function randomBelow(n: bigint): bigint {
  const bytes = Math.ceil(bitLength(n) / 8) + 1;
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let x = 0n;
  for (const v of buf) x = (x << 8n) | BigInt(v);
  return x % n;
}

/** [prim?, sicher?] */
export function millerRabin(n: bigint, extraRounds = 16, cancel?: () => boolean): [boolean, boolean] {
  if (n < 2n) return [false, true];
  for (const p of DET_BASES) {
    if (n === p) return [true, true];
    if (n % p === 0n) return [false, true];
  }
  let d = n - 1n, s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s++; }
  const witness = (a: bigint) => {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) return false;
    for (let i = 1; i < s; i++) {
      if (cancel?.()) throw new Error('abgebrochen');
      x = (x * x) % n;
      if (x === n - 1n) return false;
    }
    return true;
  };
  for (const a of DET_BASES) if (witness(a)) return [false, true];
  if (n < DET_LIMIT) return [true, true];
  for (let r = 0; r < extraRounds; r++) {
    if (cancel?.()) throw new Error('abgebrochen');
    const a = randomBelow(n - 4n) + 2n;
    if (witness(a)) return [false, true];
  }
  return [true, false];
}

/** true, wenn 2^p − 1 prim ist. */
export function lucasLehmer(p: number, progress?: (f: number) => void, cancel?: () => boolean): boolean {
  if (p === 2) return true;
  if (p < 2 || !millerRabin(BigInt(p))[0]) return false;
  const P = BigInt(p);
  const m = (1n << P) - 1n;
  let s = 4n;
  for (let i = 0; i < p - 2; i++) {
    if ((i & 63) === 0) {
      if (cancel?.()) throw new Error('abgebrochen');
      progress?.(i / (p - 2));
    }
    s = s * s - 2n;
    s = (s & m) + (s >> P);               // Reduktion mod 2^p−1 ohne Division
    if (s >= m) s -= m;
  }
  return s === 0n;
}

/** Kleiner Parser für + − * ^ und Klammern. */
export function parseExpr(text: string): bigint {
  const s = text.replace(/\*\*/g, '^');
  let i = 0;
  const err = (m: string) => { throw new Error(m); };
  const sum = (): bigint => {
    let v = prod();
    while (i < s.length && (s[i] === '+' || s[i] === '-')) {
      const op = s[i++];
      const r = prod();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const prod = (): bigint => {
    let v = pow();
    while (i < s.length && s[i] === '*') { i++; v *= pow(); }
    return v;
  };
  const pow = (): bigint => {
    const b = atom();
    if (i < s.length && s[i] === '^') {
      i++;
      const e = pow();
      const ab = b < 0n ? -b : b;
      if (e < 0n || e > 10_000_000n || (ab > 1n && Number(e) * bitLength(ab) > 20_000_000))
        err('Zahl zu groß|number too large');
      return b ** e;
    }
    return b;
  };
  const atom = (): bigint => {
    if (s[i] === '(') {
      i++;
      const v = sum();
      if (s[i++] !== ')') err('„)“ fehlt|missing ")"');
      return v;
    }
    if (s[i] === '-') { i++; return -atom(); }
    const st = i;
    while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
    if (st === i) err(i < s.length ? `unerwartetes Zeichen „${s[i]}“|unexpected character "${s[i]}"` : 'Zahl erwartet|number expected');
    return BigInt(s.slice(st, i));
  };
  const v = sum();
  if (i !== s.length) err(`unerwartetes Zeichen „${s[i]}“|unexpected character "${s[i]}"`);
  return v;
}

// ------------------------------------------------------------------------------------------------ π
const C3_OVER_24 = 10939058860032000n;           // 640320³ / 24

interface Pqt { P: bigint; Q: bigint; T: bigint }

function bs(a: number, b: number, tick: () => void): Pqt {
  if (b - a === 1) {
    let P: bigint, Q: bigint;
    if (a === 0) { P = 1n; Q = 1n; }
    else {
      const ka = BigInt(a);
      P = (6n * ka - 5n) * (2n * ka - 1n) * (6n * ka - 1n);
      Q = ka * ka * ka * C3_OVER_24;
    }
    let T = P * (13591409n + 545140134n * BigInt(a));
    if (a & 1) T = -T;
    tick();
    return { P, Q, T };
  }
  const m = (a + b) >>> 1;
  const l = bs(a, m, tick), r = bs(m, b, tick);
  return { P: l.P * r.P, Q: l.Q * r.Q, T: r.Q * l.T + l.P * r.T };
}

/** ⌊√c · 10^digits⌋ mit Newton und Genauigkeitsverdopplung. */
function sqrtScaled(c: bigint, digits: number): bigint {
  if (digits <= 12) return BigInt(Math.floor(Math.sqrt(Number(c)) * 10 ** digits));
  const h = Math.ceil(digits / 2) + 2;
  let s = sqrtScaled(c, h) * 10n ** BigInt(digits - h);
  const target = c * 10n ** BigInt(2 * digits);
  s = (s + target / s) >> 1n;
  while (s * s > target) s -= 1n;
  while ((s + 1n) * (s + 1n) <= target) s += 1n;
  return s;
}

export interface PiResult { digits: number; fraction: string; seconds: number; seriesSeconds: number; verified: boolean; check: string }

export function computePi(digits: number, progress?: (phase: string, f: number) => void): PiResult {
  const t0 = performance.now();
  const terms = Math.floor(digits / 14.181647462725477) + 2;
  let done = 0;
  progress?.('series', 0);
  const r = bs(0, terms, () => { if ((++done & 255) === 0) progress?.('series', (done / terms) * 0.75); });
  const tSeries = (performance.now() - t0) / 1000;
  progress?.('sqrt', 0.78);
  const extra = 12;
  const D = digits + extra;
  const sq = sqrtScaled(10005n, D);                 // √10005 · 10^D
  progress?.('div', 0.88);
  const pi = (r.Q * 426880n * sq) / r.T;            // π · 10^D
  progress?.('digits', 0.95);
  const s = pi.toString();
  const frac = s.slice(1, 1 + digits);
  const seconds = (performance.now() - t0) / 1000;
  const n = Math.min(digits, 10_000);
  const ref = machin(n);
  const ok = s[0] === '3' && frac.slice(0, n) === ref.slice(0, n);
  return {
    digits, fraction: frac, seconds, seriesSeconds: tSeries, verified: ok,
    check: ok ? `ok|${n}` : 'fail',
  };
}

/** Unabhängige Referenz: Machin-Formel 16·arctan(1/5) − 4·arctan(1/239). */
export function machin(digits: number): string {
  const scale = 10n ** BigInt(digits + 12);
  const atan = (x: bigint) => {
    let sum = 0n, term = scale / x, k = 1n, neg = false;
    const x2 = x * x;
    while (term !== 0n) {
      sum += neg ? -(term / k) : term / k;
      term /= x2; k += 2n; neg = !neg;
    }
    return sum;
  };
  const pi = 16n * atan(5n) - 4n * atan(239n);
  return pi.toString().slice(1, 1 + digits);
}

// ------------------------------------------------------------------------------------------------ Fibonacci
const CHECK_PRIMES = [2305843009213693951n, 2305843009213693921n, 2305843009213693907n];

export function fibMod(n: number, p: bigint): bigint {
  let a = 0n, b = 1n;
  for (let i = 52; i >= 0; i--) {
    const c = (a * ((2n * b + p - a) % p)) % p;
    const d = (a * a + b * b) % p;
    if (Math.floor(n / 2 ** i) % 2 === 0) { a = c; b = d; } else { a = d; b = (c + d) % p; }
  }
  return a;
}

export function fibBig(n: number, progress?: (f: number) => void): bigint {
  let a = 0n, b = 1n;
  const bits = n > 0 ? Math.floor(Math.log2(n)) + 1 : 1;
  for (let i = bits - 1; i >= 0; i--) {
    const c = a * (2n * b - a);
    const d = a * a + b * b;
    if (Math.floor(n / 2 ** i) % 2 === 0) { a = c; b = d; } else { a = d; b = c + d; }
    progress?.((bits - i) / bits);
  }
  return a;
}

export interface FibResult { n: number; digitCount: number; head: string; tail: string; seconds: number; verified: boolean }

export function computeFib(n: number, progress?: (f: number) => void): FibResult & { value: string } {
  const t0 = performance.now();
  const a = fibBig(n, progress);
  const seconds = (performance.now() - t0) / 1000;
  const s = a.toString();
  let ok = true;
  for (const p of CHECK_PRIMES) ok &&= a % p === fibMod(n, p);
  const expDigits = n * Math.log10((1 + Math.sqrt(5)) / 2) - Math.log10(Math.sqrt(5));
  ok &&= n < 10 || Math.abs(Math.floor(expDigits) + 1 - s.length) <= 1;
  return { n, digitCount: s.length, head: s.slice(0, 40), tail: s.slice(-40), seconds, verified: ok, value: s };
}

/** Bekannte Indizes der Fibonacci-Primzahlen (OEIS A001605). */
export const FIB_PRIME_KNOWN = [3, 4, 5, 7, 11, 13, 17, 23, 29, 43, 47, 83, 131, 137, 359, 431, 433, 449, 509, 569, 571,
  2971, 4723, 5387, 9311, 9677, 14431, 25561, 30757, 35999, 37511, 50833, 81839];

export function isProbablePrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n]) { if (n === p) return true; if (n % p === 0n) return false; }
  let d = n - 1n, s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s++; }
  for (const a of [2n, 3n, 5n, 7n]) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let comp = true;
    for (let r = 1; r < s; r++) { x = (x * x) % n; if (x === n - 1n) { comp = false; break; } }
    if (comp) return false;
  }
  return true;
}

/** Gibt es einen Teiler q = 2kp ± 1 (q prim, q ≤ bound) mit F(p) ≡ 0 mod q? Dann ist F(p) nicht prim. */
export function hasSmallFactor(p: number, isComp: Uint8Array, bound: number): boolean {
  for (let m = 2 * p; m - 1 <= bound; m += 2 * p) {
    for (const q of [m - 1, m + 1]) {
      if (q <= bound && q > 5 && !isComp[q] && fibModSmall(p, q) === 0 && q !== fibSmall(p)) return true;
    }
  }
  return false;
}

function mulMod(a: number, b: number, m: number): number {
  // a, b < m < 2^26 → Produkt < 2^52, exakt als double
  return (a * b) % m;
}

function fibModSmall(n: number, q: number): number {
  let a = 0, b = 1;
  for (let i = 31; i >= 0; i--) {
    const c = mulMod(a, (2 * b + q - a) % q, q);
    const d = (mulMod(a, a, q) + mulMod(b, b, q)) % q;
    if (((n >>> i) & 1) === 0) { a = c; b = d; } else { a = d; b = (c + d) % q; }
  }
  return a;
}

function fibSmall(n: number): number {
  if (n > 70) return -1;
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
