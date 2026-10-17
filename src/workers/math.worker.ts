// Allzweck-Rechenworker: π, Fibonacci, Zahlentest, Fibonacci-Primzahlen, Collatz, CPU-Matrixtest, Arbeitsspeicher, N-Körper (CPU).
import {
  computeFib, computePi, fibBig, hasSmallFactor, isProbablePrime, lucasLehmer, millerRabin, parseExpr,
} from '../core/bigmath';

const post = (m: any, t: Transferable[] = []) => (self as any).postMessage(m, t);
let cancelled = false;
const cancel = () => cancelled;

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'cancel') { cancelled = true; return; }
  cancelled = false;
  try {
    const r = handle(m);
    if (r !== undefined) post({ type: 'done', id: m.id, result: r });
  } catch (err: any) {
    post({ type: 'error', id: m.id, message: String(err?.message ?? err) });
  }
};

function progress(id: number, f: number, phase = '') { post({ type: 'progress', id, f, phase }); }

function handle(m: any): any {
  switch (m.type) {
    case 'pi': {
      const r = computePi(m.digits, (phase, f) => progress(m.id, f, phase));
      return r;
    }
    case 'fib': {
      const r = computeFib(m.n, f => progress(m.id, f));
      return { ...r, value: m.keep ? r.value : '' };
    }
    case 'check': return checkNumber(m.text, m.id);
    case 'fibprimes': return fibPrimesChunk(m.indices, m.bound);
    case 'collatz': return collatzBatch(m.start, m.count, m.bins);
    case 'gemm': return gemm(m.n, m.seconds, m.row0, m.rows);
    case 'ram-bw': return ramBandwidth(m.bytes, m.op, m.seconds);
    case 'ram-lat': return ramLatency(m.entries, m.hops);
    case 'ram-density': return ramDensity(m.blocks, m.blockBytes, m.pass, m.id);
    case 'nbody-init': nb = { x: m.x, y: m.y, z: m.z, mass: m.mass, eps2: m.eps2 }; return true;
    case 'nbody-acc': return nbodyAcc(m.x, m.y, m.z, m.i0, m.i1);
  }
  throw new Error('unbekannter Auftrag ' + m.type);
}

// ------------------------------------------------------------------------------------------ Zahl prüfen
function checkNumber(text: string, id: number) {
  const t = text.replace(/[\s.,_']/g, '');
  if (!t) return { kind: 'empty' };
  const mm = /^[Mm](\d+)$/.exec(t);
  if (mm) {
    const p = parseInt(mm[1], 10);
    if (p > 200_000) return { kind: 'error', message: 'Exponent zu groß (max. 200.000).|Exponent too large (max. 200,000).' };
    const t0 = performance.now();
    const ok = lucasLehmer(p, f => progress(id, f), cancel);
    return { kind: 'mersenne', p, prime: ok, seconds: (performance.now() - t0) / 1000 };
  }
  let n: bigint;
  try { n = parseExpr(t); } catch (err: any) {
    const [de, en = de] = String(err.message).split('|');
    return { kind: 'error', message: `Ungültige Eingabe: ${de}|Invalid input: ${en}` };
  }
  const t0 = performance.now();
  const [prime, det] = millerRabin(n, 16, cancel);
  const s = (n < 0n ? -n : n).toString();
  return { kind: 'mr', digits: s.length, prime, det, head: s.length <= 40 ? s : s.slice(0, 30), tail: s.length > 40 ? s.slice(-10) : '', seconds: (performance.now() - t0) / 1000 };
}

// ------------------------------------------------------------------------------------------ Fibonacci-Primzahlen
let compCache: { bound: number; comp: Uint8Array } | null = null;
function fibPrimesChunk(indices: number[], bound: number) {
  if (!compCache || compCache.bound !== bound) {
    const comp = new Uint8Array(bound + 1);
    for (let i = 2; i * i <= bound; i++) if (!comp[i]) for (let j = i * i; j <= bound; j += i) comp[j] = 1;
    compCache = { bound, comp };
  }
  const found: [number, number][] = [];
  let trial = 0;
  for (const n of indices) {
    if (cancelled) break;
    if (n > 5 && hasSmallFactor(n, compCache.comp, bound)) { trial++; continue; }
    const f = fibBig(n);
    if (isProbablePrime(f)) found.push([n, f.toString().length]);
  }
  return { found, trial, tested: indices.length };
}

// ------------------------------------------------------------------------------------------ Collatz
// Startwerte < 2^53, Zwischenwerte bis 2^64 als zwei 32-Bit-Hälften; darüber exakt mit BigInt.
const TWO32 = 4294967296;
function stepsBig(n: bigint): number {
  let s = 0;
  while (n !== 1n) {
    if (n & 1n) { n = 3n * n + 1n; s++; }
    while ((n & 1n) === 0n) { n >>= 1n; s++; }
  }
  return s;
}

function collatzBatch(start: number, count: number, bins: number) {
  const hist = new Float64Array(bins);
  let best = -1, bestN = 0, overflows = 0;
  const end = start + count;
  for (let n0 = start; n0 < end; n0++) {
    let lo = n0 % TWO32, hi = Math.floor(n0 / TWO32), s = 0, ovf = false;
    while (hi !== 0 || lo !== 1) {
      if (lo & 1) {
        if (hi >= 0x55555555) { ovf = true; break; }
        const l3 = lo * 3 + 1;
        const carry = Math.floor(l3 / TWO32);
        lo = l3 >>> 0;
        hi = hi * 3 + carry;
        s++;
      }
      if (lo === 0) { lo = hi; hi = 0; s += 32; }
      const tz = 31 - Math.clz32(lo & -lo);
      if (tz > 0) {
        lo = ((lo >>> tz) | (hi << (32 - tz))) >>> 0;
        hi = hi >>> tz;
        s += tz;
      }
    }
    if (ovf) { s = stepsBig(BigInt(n0)); overflows++; }
    hist[s < bins ? s : bins - 1]++;
    if (s > best) { best = s; bestN = n0; }
  }
  return { start, count, best, bestN, hist, overflows };
}

// ------------------------------------------------------------------------------------------ Matrix (CPU, FP32)
// Werte aus {−1, 0, 1} → das Ergebnis ist exakt und wird stichprobenartig geprüft.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; };
}
export function gemmMatrices(n: number) {
  const A = new Float32Array(n * n), B = new Float32Array(n * n);
  const r = lcg(12345);
  for (let i = 0; i < n * n; i++) A[i] = (r() % 3) - 1;
  for (let i = 0; i < n * n; i++) B[i] = (r() % 3) - 1;
  return { A, B };
}
let gemmCache: { n: number; A: Float32Array; B: Float32Array } | null = null;
function gemm(n: number, seconds: number, row0: number, rows: number) {
  if (!gemmCache || gemmCache.n !== n) gemmCache = { n, ...gemmMatrices(n) };
  const { A, B } = gemmCache;
  const C = new Float32Array(rows * n);
  const t0 = performance.now();
  let passes = 0;
  do {
    C.fill(0);
    // i-k-j mit 4er-Abrollung über k (Zeile von B wird linear gelesen)
    for (let i = 0; i < rows; i++) {
      const ci = i * n, ai = (row0 + i) * n;
      let k = 0;
      for (; k + 4 <= n; k += 4) {
        const a0 = A[ai + k], a1 = A[ai + k + 1], a2 = A[ai + k + 2], a3 = A[ai + k + 3];
        const b0 = k * n, b1 = b0 + n, b2 = b1 + n, b3 = b2 + n;
        for (let j = 0; j < n; j++) C[ci + j] += a0 * B[b0 + j] + a1 * B[b1 + j] + a2 * B[b2 + j] + a3 * B[b3 + j];
      }
      for (; k < n; k++) { const a = A[ai + k], b = k * n; for (let j = 0; j < n; j++) C[ci + j] += a * B[b + j]; }
    }
    passes++;
  } while (!cancelled && performance.now() - t0 < seconds * 1000);
  const dt = (performance.now() - t0) / 1000;
  // Stichprobe in doppelter Genauigkeit
  const r = lcg(row0 + 7);
  let ok = true;
  for (let s = 0; s < 32; s++) {
    const i = r() % rows, j = r() % n;
    let ref = 0;
    for (let k = 0; k < n; k++) ref += A[(row0 + i) * n + k] * B[k * n + j];
    if (ref !== C[i * n + j]) ok = false;
  }
  return { flops: 2 * rows * n * n * passes, seconds: dt, ok };
}

// ------------------------------------------------------------------------------------------ Arbeitsspeicher
let ramBuf: Int32Array | null = null;
function ramBandwidth(bytes: number, op: 'read' | 'write' | 'copy', seconds: number) {
  const n = bytes >>> 2;
  if (!ramBuf || ramBuf.length !== n) { ramBuf = new Int32Array(n); ramBuf.fill(1); }
  const a = ramBuf, half = n >>> 1;
  const t0 = performance.now();
  let moved = 0, sink = 0, pass = 0;
  do {
    if (op === 'read') {
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
      for (let i = 0; i < n; i += 4) { s0 ^= a[i]; s1 ^= a[i + 1]; s2 ^= a[i + 2]; s3 ^= a[i + 3]; }
      sink ^= s0 ^ s1 ^ s2 ^ s3;
      moved += n * 4;
    } else if (op === 'write') {
      a.fill(pass);
      moved += n * 4;
    } else {
      if (pass & 1) a.copyWithin(0, half, n); else a.copyWithin(half, 0, half);
      moved += half * 8;                      // gelesen + geschrieben
    }
    pass++;
  } while (performance.now() - t0 < seconds * 1000 && !cancelled);
  return { bytes: moved, seconds: (performance.now() - t0) / 1000, sink };
}

function ramLatency(entries: number, hops: number) {
  // Sattolo: ein einziger zufälliger Zyklus über alle Einträge (Zeigerverfolgung, kein Vorausladen möglich)
  const next = new Int32Array(entries);
  for (let i = 0; i < entries; i++) next[i] = i;
  const r = lcg(99);
  for (let i = entries - 1; i > 0; i--) {
    const j = r() % i;
    const t = next[i]; next[i] = next[j]; next[j] = t;
  }
  let p = 0;
  for (let i = 0; i < 100_000; i++) p = next[p];         // Warm-up
  const t0 = performance.now();
  for (let i = 0; i < hops; i++) p = next[p];
  const dt = performance.now() - t0;
  return { ns: (dt * 1e6) / hops, sink: p };
}

let densityBlocks: Int32Array[] = [];
function ramDensity(blocks: number, blockBytes: number, pass: number, id: number) {
  const words = blockBytes >>> 2;
  try {
    while (densityBlocks.length < blocks) densityBlocks.push(new Int32Array(words));
  } catch {
    // weniger Speicher verfügbar als gewünscht – mit dem weitermachen, was geht
  }
  const inv = pass & 1 ? -1 : 0;
  const salt = Math.imul(pass + 1, 0x9e3779b1);
  let errors = 0, verified = 0, firstError = '';
  const states: number[] = [];
  for (let b = 0; b < densityBlocks.length; b++) {
    if (cancelled) break;
    const a = densityBlocks[b];
    const base = Math.imul(b + 1, 0x85ebca6b) ^ salt;
    for (let i = 0; i < words; i++) a[i] = (Math.imul(i, 0x27d4eb2d) ^ base ^ inv) | 0;
    let e = 0;
    for (let i = 0; i < words; i++) if (a[i] !== ((Math.imul(i, 0x27d4eb2d) ^ base ^ inv) | 0)) {
      if (!e && !firstError) firstError = `Block ${b}, Wort ${i}`;
      e++;
    }
    errors += e;
    verified += blockBytes;
    states.push(e ? 3 : 2);
    progress(id, (b + 1) / densityBlocks.length);
  }
  return { errors, verified, states, blocks: densityBlocks.length, firstError };
}

// ------------------------------------------------------------------------------------------ N-Körper (CPU)
let nb: { x: Float32Array; y: Float32Array; z: Float32Array; mass: Float32Array; eps2: number } | null = null;
function nbodyAcc(x: Float32Array, y: Float32Array, z: Float32Array, i0: number, i1: number) {
  const M = nb!.mass, eps2 = nb!.eps2, n = x.length;
  const ax = new Float32Array(i1 - i0), ay = new Float32Array(i1 - i0), az = new Float32Array(i1 - i0);
  for (let i = i0; i < i1; i++) {
    const px = x[i], py = y[i], pz = z[i];
    let sx = 0, sy = 0, sz = 0;
    for (let j = 0; j < n; j++) {
      const dx = x[j] - px, dy = y[j] - py, dz = z[j] - pz;
      const r2 = dx * dx + dy * dy + dz * dz + eps2;
      const inv = 1 / Math.sqrt(r2);
      const s = M[j] * inv * inv * inv;
      sx += dx * s; sy += dy * s; sz += dz * s;
    }
    ax[i - i0] = sx; ay[i - i0] = sy; az[i - i0] = sz;
  }
  return { i0, ax, ay, az };
}
