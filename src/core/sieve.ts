// Segmentiertes Sieb des Eratosthenes (Port von CpuSieve.cs).
// Bit-Array nur für ungerade Zahlen (Bit i = base + 2i, 1 = zusammengesetzt), 32-Bit-Wörter.
// Primzahlen 3..31 werden wortweise mit vorberechneten Mustern gesiebt, die übrigen in L1-großen Blöcken;
// Primzahlen ≥ Blockgröße in einem Durchgang über das ganze Segment.
// Zahlen bis 2^53 (exakt als double) – auf dem Handy reicht das für Jahre Rechenzeit.

export const MAX_N = 2 ** 53;
const SMALL = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
const PAT_STRIDE = 32;
const L1_BITS = 16 * 1024 * 8;          // 16 KB Block (passt auch in kleine L1-Caches)

const PATTERNS = (() => {
  // PATTERNS[k*32 + r]: Bit i gesetzt, wenn (i + r) % p == 0
  const pat = new Uint32Array(SMALL.length * PAT_STRIDE);
  for (let k = 0; k < SMALL.length; k++) {
    const p = SMALL[k];
    for (let r = 0; r < p; r++) {
      let w = 0;
      for (let i = 0; i < 32; i++) if ((i + r) % p === 0) w |= 1 << i;
      pat[k * PAT_STRIDE + r] = w >>> 0;
    }
  }
  return pat;
})();

/** Alle ungeraden Primzahlen ≤ limit (limit < 2^32). */
export function simpleSieve(limit: number): Uint32Array {
  if (limit < 3) return new Uint32Array(0);
  const n = Math.floor((limit - 1) / 2);
  const comp = new Uint8Array(n + 1);
  for (let i = 1; (2 * i + 1) * (2 * i + 1) <= limit; i++) {
    if (comp[i]) continue;
    const p = 2 * i + 1;
    for (let j = (p * p - 1) / 2; j <= n; j += p) comp[j] = 1;
  }
  let cnt = 0;
  for (let i = 1; i <= n; i++) if (!comp[i]) cnt++;
  const out = new Uint32Array(cnt);
  let k = 0;
  for (let i = 1; i <= n; i++) if (!comp[i]) out[k++] = 2 * i + 1;
  return out;
}

function firstIndex(base: number, p: number): number {
  const r = base % p;
  let t = r === 0 ? 0 : p - r;
  if (t & 1) t += p;
  return t / 2;
}

export function popcnt(v: number): number {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export interface SegResult { count: number; last: number; nbits: number }

/** Basisprimzahlen bis √hi, wachsen bei Bedarf. */
export class BasePrimes {
  limit = 0;
  primes: Uint32Array = new Uint32Array(0);
  ensure(hi: number): Uint32Array {
    const need = Math.floor(Math.sqrt(Math.max(hi, 4))) + 2;
    if (need <= this.limit) return this.primes;
    let nl = Math.max(need * 2, 1 << 16);
    nl = Math.min(nl, Math.floor(Math.sqrt(MAX_N)) + 2);
    nl = Math.max(nl, need);
    this.primes = simpleSieve(nl);
    this.limit = nl;
    return this.primes;
  }
}

/** Pro Worker eine Instanz (eigene Puffer). */
export class Siever {
  bits: Uint32Array;
  nxt = new Int32Array(1024);
  constructor(segSize: number) { this.bits = new Uint32Array(Math.ceil(segSize / 64) + 4); }

  sieve(lo: number, hi: number, primes: Uint32Array): SegResult {
    if (this.nxt.length < primes.length) this.nxt = new Int32Array(primes.length * 2);
    const need = Math.ceil((hi - lo) / 64) + 4;
    if (this.bits.length < need) this.bits = new Uint32Array(need * 2);
    const bits = this.bits, nxt = this.nxt;
    const base = lo % 2 === 0 ? lo + 1 : lo;
    if (hi <= base) {
      const two = lo <= 2 && 2 < hi;
      return { count: two ? 1 : 0, last: two ? 2 : 0, nbits: 0 };
    }
    const nbits = Math.floor((hi - base + 1) / 2);
    const nwords = (nbits + 31) >>> 5;

    // Phase A: kleine Primzahlen per Wort-Muster
    bits.fill(0, 0, nwords);
    for (let k = 0; k < SMALL.length; k++) {
      const p = SMALL[k];
      if (p * p >= hi) break;
      const j0 = firstIndex(base, p);
      let r = (p - (j0 % p)) % p;
      const step = 32 % p;
      const row = k * PAT_STRIDE;
      for (let w = 0; w < nwords; w++) {
        bits[w] |= PATTERNS[row + r];
        r += step;
        if (r >= p) r -= p;
      }
    }
    if (base <= 31)
      for (const p of SMALL)
        if (p >= base && p < hi) {
          const j = (p - base) >>> 1;
          bits[j >>> 5] &= ~(1 << (j & 31));
        }

    // Phase B: restliche Primzahlen
    let used = 0;
    const np = primes.length;
    for (let k = 0; k < np; k++) {
      const p = primes[k];
      if (p <= 31) { nxt[k] = nbits; continue; }
      const pp = p * p;
      if (pp >= hi) break;
      nxt[k] = pp >= base ? (pp - base) / 2 : firstIndex(base, p);
      used = k + 1;
    }
    let split = 0;
    while (split < used && primes[split] < L1_BITS) split++;
    for (let k = split; k < used; k++) {
      const p = primes[k];
      for (let j = nxt[k]; j < nbits; j += p) bits[j >>> 5] |= 1 << (j & 31);
    }
    for (let blk = 0; blk < nbits; blk += L1_BITS) {
      const end = Math.min(blk + L1_BITS, nbits);
      for (let k = 0; k < split; k++) {
        let j = nxt[k];
        if (j >= end) continue;
        const p = primes[k];
        for (; j < end; j += p) bits[j >>> 5] |= 1 << (j & 31);
        nxt[k] = j;
      }
    }
    if (base === 1) bits[0] |= 1;

    // Zählen + letzte Primzahl
    const tail = nbits & 31;
    if (tail !== 0) bits[nwords - 1] |= ~((1 << tail) - 1);
    let composite = 0;
    for (let w = 0; w < nwords; w++) composite += popcnt(bits[w]);
    let cnt = nwords * 32 - composite;
    let last = 0;
    for (let w = nwords - 1; w >= 0; w--) {
      const inv = ~bits[w] >>> 0;
      if (inv !== 0) { last = base + 2 * (w * 32 + 31 - Math.clz32(inv)); break; }
    }
    if (lo <= 2 && 2 < hi) { cnt++; if (last === 0) last = 2; }
    return { count: cnt, last, nbits };
  }

  /** Primzahlen des zuletzt gesiebten Segments ausgeben. */
  emit(lo: number, hi: number, nbits: number, out: (p: number) => void) {
    const base = lo % 2 === 0 ? lo + 1 : lo;
    if (lo <= 2 && 2 < hi) out(2);
    const nwords = (nbits + 31) >>> 5;
    for (let w = 0; w < nwords; w++) {
      let v = ~this.bits[w] >>> 0;
      while (v !== 0) {
        const t = 31 - Math.clz32(v & -v);
        const idx = w * 32 + t;
        if (idx >= nbits) break;
        out(base + 2 * idx);
        v = (v & (v - 1)) >>> 0;
      }
    }
  }
}

/** Kontrollwerte π(10^k). */
export const REFERENCE: Record<number, number> = {
  1e8: 5_761_455,
  1e9: 50_847_534,
  1e10: 455_052_511,
  1e11: 4_118_054_813,
  1e12: 37_607_912_018,
  1e13: 346_065_536_839,
};
