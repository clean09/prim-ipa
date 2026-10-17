// Reproduzierbarer Zufall: ein Seed („PRIM-7Q2K“) bestimmt Karte, Gegner und Angebote. Zustand liegt im Lauf (run.rng),
// damit ein gespeicherter Lauf genau dort weitergeht.

export function hashSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h || 1;
}

/** mulberry32 – Zustand als Zahl, gibt [Zufall 0..1, neuer Zustand]. */
export function step(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Zufallsquelle, die ihren Zustand in ein Objekt zurückschreibt (z. B. run.rng). */
export function rngOf(holder: { rng: number }) {
  return () => { const [r, s] = step(holder.rng); holder.rng = s; return r; };
}

const ALPH = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function newSeed() {
  let s = 'PRIM-';
  for (let i = 0; i < 5; i++) s += ALPH[(Math.random() * ALPH.length) | 0];
  return s;
}
export const dailySeed = (day: string) => `DAILY-${day}`;

export const pick = <T>(rnd: () => number, a: readonly T[]): T => a[Math.floor(rnd() * a.length) % a.length];
export function shuffle<T>(rnd: () => number, a: T[]) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Gewichtete Auswahl: [Wert, Gewicht][] */
export function weighted<T>(rnd: () => number, list: [T, number][]): T {
  const tot = list.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * tot;
  for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
  return list[list.length - 1][0];
}

// Primzahlen bis 10 000 (Zugsummen bleiben darunter)
const SIEVE = (() => { const n = 10000, a = new Uint8Array(n + 1).fill(1); a[0] = a[1] = 0; for (let i = 2; i * i <= n; i++) if (a[i]) for (let j = i * i; j <= n; j += i) a[j] = 0; return a; })();
export const isPrime = (n: number) => n >= 0 && n <= 10000 ? SIEVE[n] === 1 : false;
export const nextPrime = (n: number) => { let k = Math.max(2, n + 1); while (!isPrime(k)) k++; return k; };
