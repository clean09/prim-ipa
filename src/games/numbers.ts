// Zahlen-Hilfen für die Spiele: Primtest, Zerlegung, Lerntipps, Zufall mit Startwert, große Zahlen.
import { millerRabin } from '../core/bigmath';
import { L } from '../core/i18n';

export const isPrime = (n: number) => {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  if (n % 3 === 0) return n === 3;
  for (let d = 5; d * d <= n; d += 6) if (n % d === 0 || n % (d + 2) === 0) return false;
  return true;
};
export const factor = (n: number) => {
  const f: number[] = [];
  for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; }
  if (n > 1) f.push(n);
  return f;
};
/** Kleinster Teiler > 1 (für das Zerschneiden in zwei Teile). */
export const smallestFactor = (n: number) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return d; return n; };
/** Alle Primzahlen ≤ n. */
export const simplePrimes = (n: number) => { const r: number[] = []; for (let i = 2; i <= n; i++) if (isPrime(i)) r.push(i); return r; };
export const digitSum = (n: number) => String(n).split('').reduce((s, c) => s + +c, 0);

/** Teilbarkeitsregel als Lerntipp. */
export function rule(n: number): string {
  if (n % 2 === 0) return L(`${n} ist gerade → durch 2 teilbar`, `${n} is even → divisible by 2`);
  if (n % 5 === 0) return L(`endet auf ${n % 10} → durch 5 teilbar`, `ends in ${n % 10} → divisible by 5`);
  if (n % 3 === 0) return L(`Quersumme ${digitSum(n)} ist durch 3 teilbar → ${n} auch`, `digit sum ${digitSum(n)} is divisible by 3 → so is ${n}`);
  if (n % 11 === 0 && n > 11) return L('durch 11 teilbar (alternierende Quersumme)', 'divisible by 11 (alternating digit sum)');
  return `${n} = ${factor(n).join(' × ')}`;
}

/** Lerntipp für große Zahlen: kleiner Teiler, falls schnell zu finden. */
export function bigRule(t: string): string {
  const n = BigInt(t);
  for (let d = 2n; d < 20000n; d += d === 2n ? 1n : 2n) if (n % d === 0n && n !== d) return d < 100n ? L(`durch ${d} teilbar`, `divisible by ${d}`) : `= ${d} × ${n / d}`;
  return L('hat nur große Teiler', 'has only large divisors');
}
export const short = (t: string) => (t.length > 14 ? `${t.slice(0, 6)}…${t.slice(-5)}` : t);

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashStr = (s: string) => { let x = 2166136261; for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return x >>> 0; };

export const bigPrime = (n: bigint) => (n < 2n ? false : millerRabin(n, 6)[0]);
export const randDigits = (d: number) => { let t = String(1 + Math.floor(Math.random() * 9)); for (let i = 1; i < d; i++) t += Math.floor(Math.random() * 10); return BigInt(t); };

export const MERSENNE = new Set([3, 7, 31, 127, 8191, 131071]);

export const TIPS = () => [
  L('Alle Primzahlen über 3 liegen direkt neben einem Vielfachen von 6 (6k ± 1).', 'Every prime above 3 sits right next to a multiple of 6 (6k ± 1).'),
  L('Quersumme durch 3 teilbar? Dann ist die Zahl auch durch 3 teilbar.', 'Digit sum divisible by 3? Then so is the number.'),
  L('Endet eine Zahl auf 0, 2, 4, 5, 6 oder 8, ist sie (außer 2 und 5) nicht prim.', 'Numbers ending in 0, 2, 4, 5, 6 or 8 are not prime (except 2 and 5).'),
  L('91 = 7 × 13 sieht prim aus – ist es aber nicht. Der Klassiker unter den Fallen!', '91 = 7 × 13 looks prime – but it isn’t. The classic trap!'),
  L('Primzahlzwillinge wie 11 und 13 bringen Bonuspunkte, wenn du sie nacheinander triffst.', 'Twin primes like 11 and 13 give bonus points when you hit them in a row.'),
  L('Es reicht, Teiler bis zur Wurzel zu prüfen: Für 97 genügen 2, 3, 5 und 7.', 'Checking divisors up to the square root is enough: for 97 test 2, 3, 5 and 7.'),
  L('Durch 7 teilbar? Letzte Ziffer verdoppeln und vom Rest abziehen: 91 → 9 − 2 = 7 ✓', 'Divisible by 7? Double the last digit and subtract it from the rest: 91 → 9 − 2 = 7 ✓'),
];
