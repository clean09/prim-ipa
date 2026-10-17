// Primzahl-Läufe (Port von Engine.cs + Jobs.cs): Segmente auf Worker verteilen, sortiert einsammeln, Kontrollwerte prüfen.
import SieveWorker from '../workers/sieve.worker?worker';
import { MAX_N, REFERENCE } from './sieve';

export interface Live {
  phase: 'warmup' | 'bench' | 'endless' | 'range';
  numbers: number; start: number; count: number; last: number;
  elapsed: number; total: number; fraction: number;
  avgRate: number; curRate: number; peakRate: number;     // Mio Zahlen/s
}

export interface Check { limit: number; expected: number; got: number; ok: boolean }

/** Gleitende Rate über ~2 s. */
class RateMeter {
  private q: [number, number][] = [];
  peak = 0;
  add(t: number, n: number) {
    this.q.push([t, n]);
    while (this.q.length > 2 && t - this.q[0][0] > 2) this.q.shift();
    const [t0, n0] = this.q[0];
    const r = t - t0 > 0.25 ? (n - n0) / (t - t0) / 1e6 : 0;
    if (t > 3 && r > this.peak) this.peak = r;
    return r;
  }
}

export interface RunOpts {
  start: number; end: number | null; seg: number; threads: number; seconds?: number;
  wantPrimes?: boolean;
  onLive: (l: Live) => void;
  onCheck?: (c: Check) => void;
  onPrimes?: (list: Float64Array) => void;
  phase: Live['phase'];
}

export interface RunResult { numbers: number; count: number; last: number; elapsed: number; peak: number; checks: Check[]; aborted: boolean; hi: number }

export class PrimeRun {
  private workers: Worker[] = [];
  private stopped = false;
  /** geprüfte Zahlen je Worker (für die Kern-Anzeige) */
  perWorker: number[] = [];
  private reject: ((e: Error) => void) | null = null;

  stop() { this.stopped = true; }

  /** Sofort abbrechen (z. B. App im Hintergrund) – laufende Segmente werden verworfen. */
  kill() {
    this.stopped = true;
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.reject?.(new Error('cancelled'));
  }

  run(o: RunOpts): Promise<RunResult> {
    this.stopped = false;
    return new Promise((resolve, reject) => {
      this.reject = reject;
      const nseg = o.end != null ? Math.ceil((o.end - o.start) / o.seg) : Infinity;
      const bounds = (i: number): [number, number] => {
        const lo = o.start + i * o.seg;
        return [lo, o.end != null ? Math.min(lo + o.seg, o.end) : lo + o.seg];
      };
      let next = 0, ordered = 0, inflight = 0;
      let count = 0, last = 0, hi = o.start, done = 0;
      const pending = new Map<number, any>();
      const meter = new RateMeter();
      const checks: Check[] = [];
      const t0 = performance.now();
      let lastUi = -1;
      const seconds = o.seconds ?? Infinity;

      const finish = () => {
        this.workers.forEach(w => w.terminate());
        this.workers = [];
        this.reject = null;
        resolve({ numbers: hi - o.start, count, last, elapsed: (performance.now() - t0) / 1000, peak: meter.peak, checks, aborted: this.stopped, hi });
      };

      const feed = (w: Worker) => {
        const el = (performance.now() - t0) / 1000;
        if (this.stopped || el >= seconds || next >= nseg || bounds(next)[1] > MAX_N) return false;
        const [lo, h] = bounds(next);
        w.postMessage({ type: 'seg', idx: next, lo, hi: h, want: !!o.wantPrimes });
        next++; inflight++;
        return true;
      };

      const onMsg = (w: Worker, wi: number) => (e: MessageEvent) => {
        const m = e.data;
        inflight--;
        this.perWorker[wi] += m.hi - m.lo;
        done += m.hi - m.lo;
        pending.set(m.idx, m);
        while (pending.has(ordered)) {
          const s = pending.get(ordered); pending.delete(ordered); ordered++;
          count += s.count;
          if (s.last) last = s.last;
          hi = s.hi;
          if (s.list && o.onPrimes) o.onPrimes(s.list);
          const exp = REFERENCE[s.hi];
          if (exp !== undefined && o.start === 0) {
            const c = { limit: s.hi, expected: exp, got: count, ok: count === exp };
            checks.push(c);
            o.onCheck?.(c);
          }
        }
        const el = (performance.now() - t0) / 1000;
        if (el - lastUi >= 0.1) {
          lastUi = el;
          o.onLive({
            phase: o.phase, numbers: hi, start: o.start, count, last, elapsed: el, total: seconds,
            fraction: o.end != null ? (hi - o.start) / (o.end - o.start) : isFinite(seconds) ? Math.min(1, el / seconds) : -1,
            avgRate: (hi - o.start) / el / 1e6, curRate: meter.add(el, done), peakRate: meter.peak,
          });
        }
        // Zwei Segmente je Worker in der Warteschlange → kein Leerlauf zwischen den Nachrichten
        feed(w);
        if (inflight === 0 && pending.size === 0) finish();
      };

      this.perWorker = new Array(o.threads).fill(0);
      for (let i = 0; i < o.threads; i++) {
        const w = new SieveWorker();
        w.onmessage = onMsg(w, i);
        w.onerror = (ev) => { ev.preventDefault(); this.workers.forEach(x => x.terminate()); reject(new Error(String(ev.message || 'Worker-Fehler'))); };
        this.workers.push(w);
      }
      let any = false;
      for (const w of this.workers) { any = feed(w) || any; feed(w); }
      if (!any) finish();
    });
  }
}

export const BENCH_SECONDS = 180, SHORT_SECONDS = 30, WARMUP_SECONDS = 8;
/** Punkte = geprüfte Zahlen in Milliarden (wie in der Desktop-Version). */
export const points = (numbers: number) => numbers / 1e9;
