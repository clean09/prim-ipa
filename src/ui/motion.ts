// Bewegung wie in der Windows-Version (Ui/Motion.cs): Seiten fahren in Navigationsrichtung ein, Titel steigen aus einer
// Maske, kurze Beschriftungen „entschlüsseln“ sich, Karten erscheinen gestaffelt beim Scrollen, Kennzahlen zählen hoch.
// Stufen: Voll / Ruhig / Aus (Einstellungen).
import { motionLevel } from '../core/theme';

const GLYPHS = '01#%&*+=/<>?ΣπΔ∞';

/** Text „entschlüsseln“: zufällige Zeichen, die von links nach rechts zum echten Text werden. */
export function scramble(el: HTMLElement, text = el.textContent ?? '', ms = 520) {
  if (motionLevel() !== 'full' || !text) { el.textContent = text; return; }
  const t0 = performance.now();
  const step = (now: number) => {
    if (!el.isConnected) return;
    const k = Math.min(1, (now - t0) / ms);
    const n = Math.floor(k * text.length);
    let s = text.slice(0, n);
    for (let i = n; i < text.length; i++) s += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = s;
    if (k < 1) requestAnimationFrame(step); else el.textContent = text;
  };
  requestAnimationFrame(step);
}

/** Großer Titel: jedes Wort steigt aus einer Maske auf. */
export function maskTitle(text: string, cls = 'mtitle') {
  const el = document.createElement('h1');
  el.className = cls;
  text.split(' ').forEach((w, i) => {
    const m = document.createElement('span'); m.className = 'mw';
    const s = document.createElement('span'); s.textContent = w; s.style.setProperty('--d', `${i * 70}ms`);
    m.append(s); el.append(m, ' ');
  });
  fitText(el);
  return el;
}

/** Großen Titel so weit verkleinern, dass das längste Wort in die Breite passt (lange deutsche Wörter auf 320 px). */
export function fitText(el: HTMLElement, min = 26) {
  const fit = () => {
    if (!el.isConnected) return;
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize);
    const w = el.clientWidth;
    let guard = 0;
    while (guard++ < 40 && size > min && [...el.querySelectorAll<HTMLElement>('.mw')].some(m => m.scrollWidth > w + 1)) { size -= 2; el.style.fontSize = `${size}px`; }
  };
  setTimeout(fit, 0); setTimeout(fit, 250);
  window.addEventListener('resize', fit, { passive: true });
}

let io: IntersectionObserver | null = null;
/** Kinder eines Containers gestaffelt einblenden, sobald sie sichtbar werden. */
export function reveal(root: HTMLElement) {
  if (motionLevel() === 'off') return;
  io?.disconnect();
  io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { (e.target as HTMLElement).classList.add('in'); io!.unobserve(e.target); }
  }, { rootMargin: '0px 0px -6% 0px' });
  let i = 0;
  root.querySelectorAll<HTMLElement>('.rv').forEach(el => {
    el.style.setProperty('--d', `${Math.min(i++, 8) * 55}ms`);
    io!.observe(el);
  });
}

/** Zahl hochzählen (Kennzahlen). */
export function countUp(el: HTMLElement, to: number, fmt: (v: number) => string, ms = 900) {
  if (motionLevel() === 'off' || !isFinite(to)) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const f = (now: number) => {
    if (!el.isConnected) return;
    const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 4;
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

/** Lichtkegel beim Berühren (Position als CSS-Variablen). */
export function spotlight(el: HTMLElement) {
  const set = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  el.addEventListener('pointerdown', set); el.addEventListener('pointermove', set);
}

/** Intro beim Kaltstart: echter Zähler π(10ⁿ) – die Anzahl der Primzahlen bis 10, 100, … 10⁹ –, dann öffnet sich der Vorhang. */
export function intro(): Promise<void> {
  if (motionLevel() === 'off') return Promise.resolve();
  const PI = [4, 25, 168, 1229, 9592, 78498, 664579, 5761455, 50847534];
  const wrap = document.createElement('div');
  wrap.className = 'intro';
  wrap.innerHTML = `<div class="intro-k">π(10<sup>n</sup>)</div><div class="intro-n">0</div><div class="intro-bar"><i></i></div>
    <div class="intro-w"><span>Prim</span><span>Sieb</span></div><div class="intro-s">4.0</div>`;
  document.body.append(wrap);
  const num = wrap.querySelector('.intro-n') as HTMLElement, bar = wrap.querySelector('.intro-bar i') as HTMLElement;
  const sup = wrap.querySelector('sup')!;
  const fast = motionLevel() === 'calm';
  const dur = fast ? 900 : 1700;
  return new Promise(res => {
    let done = false;
    const end = () => {
      if (done) return; done = true;
      wrap.classList.add('out');
      setTimeout(() => { wrap.remove(); }, 900);
      setTimeout(res, 380);
    };
    wrap.addEventListener('pointerdown', end);
    const t0 = performance.now();
    const f = (now: number) => {
      if (done) return;
      const k = Math.min(1, (now - t0) / dur);
      const e = k < 1 ? k * (2 - k) : 1;
      const x = e * PI.length, i = Math.min(PI.length - 1, Math.floor(x));
      const prev = i ? PI[i - 1] : 0;
      num.textContent = Math.round(prev + (PI[i] - prev) * (x - i)).toLocaleString('de-DE');
      sup.textContent = String(i + 1);
      bar.style.width = `${k * 100}%`;
      if (k < 1) requestAnimationFrame(f);
      else { num.textContent = PI[PI.length - 1].toLocaleString('de-DE'); wrap.classList.add('full'); setTimeout(end, fast ? 150 : 420); }
    };
    requestAnimationFrame(f);
  });
}


/** Vorhang-Übergang zwischen Hauptbereichen: Fläche fährt hoch, zeigt den Zielnamen groß, gibt die Seite frei. */
export function curtain(label: string, no: string): Promise<void> {
  if (motionLevel() !== 'full') return Promise.resolve();
  const el = document.createElement('div');
  el.className = 'curtain';
  const s = document.createElement('small'); s.textContent = no;
  const b = document.createElement('b'); b.textContent = label;
  el.append(s, b);
  document.body.append(el);
  return new Promise(res => {
    setTimeout(res, 330);                               // Seite wechselt, solange der Vorhang deckt
    setTimeout(() => el.classList.add('out'), 420);
    setTimeout(() => el.remove(), 1000);
  });
}

/** 3D-Neigung beim Berühren (Karten folgen dem Finger leicht). */
export function tilt(el: HTMLElement, max = 7) {
  if (motionLevel() === 'off') return;
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) scale(.985)`;
    el.style.setProperty('--gx', `${(x + 0.5) * 100}%`); el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
  };
  const reset = () => { el.style.transform = ''; };
  el.classList.add('tilt');
  el.addEventListener('pointerdown', move);
  el.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') move(e); });
  el.addEventListener('pointerup', reset); el.addEventListener('pointerleave', reset); el.addEventListener('pointercancel', reset);
}

/** Großer Titel Buchstabe für Buchstabe (Startseite). */
export function charTitle(text: string, cls: string) {
  const el = document.createElement('h1');
  el.className = cls;
  let i = 0;
  text.split(' ').forEach(w => {
    const m = document.createElement('span'); m.className = 'mw';
    for (const ch of w) { const s = document.createElement('span'); s.textContent = ch; s.style.setProperty('--d', `${i++ * 45}ms`); m.append(s); }
    el.append(m, ' ');
  });
  fitText(el);
  return el;
}
