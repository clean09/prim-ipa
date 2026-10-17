// Sieb-Worker: bekommt Segmente [lo, hi) und meldet Anzahl + letzte Primzahl (optional die Primzahlen selbst).
import { BasePrimes, Siever } from '../core/sieve';

let siever: Siever | null = null;
const base = new BasePrimes();

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'seg') {
    if (!siever) siever = new Siever(m.hi - m.lo);
    const primes = base.ensure(m.hi);
    const r = siever.sieve(m.lo, m.hi, primes);
    let list: Float64Array | undefined;
    if (m.want) {
      list = new Float64Array(r.count);
      let k = 0;
      siever.emit(m.lo, m.hi, r.nbits, p => { list![k++] = p; });
    }
    (self as any).postMessage({ type: 'seg', idx: m.idx, lo: m.lo, hi: m.hi, count: r.count, last: r.last, list }, list ? [list.buffer] : []);
  }
};
