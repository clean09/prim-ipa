// Worker-Verwaltung: Aufträge mit Fortschritt, Abbruch durch Beenden und Neustarten der Worker.
import MathWorker from '../workers/math.worker?worker';
import { tr } from './i18n';

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void; onProgress?: (f: number, phase: string) => void };

export class MathPool {
  private workers: Worker[] = [];
  private busy: boolean[] = [];
  private pending = new Map<number, Pending>();
  private queue: { msg: any; p: Pending }[] = [];
  private nextId = 1;

  constructor(readonly size: number) { for (let i = 0; i < size; i++) this.spawn(i); }

  private spawn(i: number) {
    const w = new MathWorker();
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      const p = this.pending.get(m.id);
      if (!p) return;
      if (m.type === 'progress') { p.onProgress?.(m.f, m.phase); return; }
      this.pending.delete(m.id);
      this.busy[i] = false;
      if (m.type === 'done') p.resolve(m.result); else p.reject(new Error(tr(m.message)));
      this.pump();
    };
    w.onerror = (e) => { e.preventDefault(); };
    this.workers[i] = w;
    this.busy[i] = false;
  }

  run<T = any>(msg: any, onProgress?: (f: number, phase: string) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ msg, p: { resolve, reject, onProgress } });
      this.pump();
    });
  }

  /** Auftrag an einen bestimmten Worker (z. B. Speicherblöcke, die dort liegen bleiben). */
  runOn<T = any>(i: number, msg: any, onProgress?: (f: number, phase: string) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject, onProgress });
      this.busy[i] = true;
      this.workers[i].postMessage({ ...msg, id });
    });
  }

  private pump() {
    for (let i = 0; i < this.size && this.queue.length; i++) {
      if (this.busy[i]) continue;
      const { msg, p } = this.queue.shift()!;
      const id = this.nextId++;
      this.pending.set(id, p);
      this.busy[i] = true;
      this.workers[i].postMessage({ ...msg, id });
    }
  }

  /** Alles abbrechen: Worker beenden (gibt auch Speicher frei) und neu starten. */
  cancel() {
    for (const p of this.pending.values()) p.reject(new Error('cancelled'));
    for (const q of this.queue) q.p.reject(new Error('cancelled'));
    this.pending.clear(); this.queue = [];
    for (let i = 0; i < this.size; i++) { this.workers[i].terminate(); this.spawn(i); }
  }

  dispose() {
    this.cancel();
    this.workers.forEach(w => w.terminate());
  }
}

export const isCancel = (e: any) => e?.message === 'cancelled';
