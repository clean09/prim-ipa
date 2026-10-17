// Kleine DOM-Helfer ohne Framework.
type Attrs = Record<string, any> | null;
type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object')
        // CSS-Variablen (--name) gehen nur über setProperty
        for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, String(sv)); else (el.style as any)[sk] = sv; }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') (el as any)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  append(el, children);
  return el;
}

function append(el: Node, c: Child) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach(x => append(el, x)); return; }
  el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
}

/** Kachel mit Titel + Wert; gibt Setter zurück. */
export function tiles(titles: string[]) {
  const vals: Record<string, HTMLElement> = {};
  const el = h('div', { class: 'tiles' }, titles.map(t => {
    const v = h('div', { class: 'v' }, '–');
    vals[t] = v;
    return h('div', { class: 'tile' }, h('div', { class: 't' }, t), v);
  }));
  return {
    el, set: (t: string, v: string) => { if (vals[t]) vals[t].textContent = v; }, reset: () => Object.values(vals).forEach(v => (v.textContent = '–')),
    /** Titel einer Kachel ändern (Schlüssel für set() bleibt der alte). */
    relabel: (t: string, label: string) => { const tt = vals[t]?.previousElementSibling; if (tt) tt.textContent = label; },
  };
}

/** Segment-Schalter. */
export function seg<T extends string | number>(options: [T, string][], value: T, onChange: (v: T) => void, cls = '') {
  let cur = value;
  const btns = options.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => { if (el.dataset.disabled) return; set(v); onChange(v); } }, label));
  const el = h('div', { class: 'seg ' + cls }, btns);
  const set = (v: T) => { cur = v; btns.forEach((b, i) => b.classList.toggle('on', options[i][0] === v)); };
  return { el, set, get: () => cur, enable: (on: boolean) => { if (on) delete el.dataset.disabled; else el.dataset.disabled = '1'; el.style.opacity = on ? '' : '.5'; } };
}

export function select<T extends string | number>(options: [T, string][], value: T, onChange: (v: T) => void) {
  const el = h('select', { onchange: () => onChange(options[el.selectedIndex][0]) },
    options.map(([v, label]) => h('option', { selected: v === value }, label)));
  return el;
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string) {
  const input = h('input', { type: 'checkbox', checked, onchange: () => onChange(input.checked) });
  return h('label', { class: 'switch' }, h('div', null, h('div', null, label), hint ? h('div', { class: 'muted small' }, hint) : null), input);
}

export function field(label: string, control: Node) { return h('div', { class: 'field' }, h('label', null, label), control); }

export function progress(cls = '') {
  const bar = h('div');
  const el = h('div', { class: 'progress ' + cls }, bar);
  return { el, set: (f: number) => { bar.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; } };
}

export function log() {
  const el = h('div', { class: 'log selectable' });
  return {
    el,
    add(s: string) { el.textContent += (el.textContent ? '\n' : '') + s; el.scrollTop = el.scrollHeight; },
    clear() { el.textContent = ''; },
  };
}

export function checkBox() {
  const el = h('div', { class: 'check' });
  return { el, set(text: string, ok: boolean) { el.textContent = text; el.classList.toggle('fail', !ok); }, clear() { el.textContent = ''; } };
}

// ------------------------------------------------------------------------------------------- Sheet
export function sheet(title: string, ...content: Child[]) {
  const root = document.getElementById('sheet-root')!;
  const close = () => { bg.remove(); s.remove(); };
  const bg = h('div', { class: 'sheet-bg', onclick: close });
  const s = h('div', { class: 'sheet', role: 'dialog' }, h('div', { class: 'grab' }), h('h2', null, title), content);
  // nach unten wischen schließt
  let y0 = -1;
  s.addEventListener('touchstart', e => { y0 = s.scrollTop <= 0 ? e.touches[0].clientY : -1; }, { passive: true });
  s.addEventListener('touchend', e => { if (y0 >= 0 && e.changedTouches[0].clientY - y0 > 90) close(); }, { passive: true });
  root.append(bg, s);
  return close;
}

export function toast(text: string, ms = 2600) {
  const t = h('div', { class: 'toast' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

export function confirmSheet(title: string, text: string, ok: string, cancel: string): Promise<boolean> {
  return new Promise(res => {
    let done = false;
    const close = sheet(title, h('p', null, text), h('div', { class: 'row', style: { marginTop: '14px' } },
      h('button', { class: 'btn', onclick: () => { done = true; close(); res(false); } }, cancel),
      h('button', { class: 'btn primary', onclick: () => { done = true; close(); res(true); } }, ok)));
    const bg = document.querySelector('.sheet-bg');
    bg?.addEventListener('click', () => { if (!done) res(false); });
  });
}

// ------------------------------------------------------------------------------------------- Canvas
/** Canvas in Gerätepixeln; gibt 2D-Kontext in CSS-Pixeln zurück. */
export function fitCanvas(c: HTMLCanvasElement): [CanvasRenderingContext2D, number, number] {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = c.clientWidth, hh = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hh * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [g, w, hh];
}

/** Liniendiagramm (z. B. Rate über die Zeit). */
export function lineChart(c: HTMLCanvasElement, data: number[], color = '#2f9bff', label = '') {
  const [g, w, hh] = fitCanvas(c);
  g.clearRect(0, 0, w, hh);
  if (data.length < 2) return;
  const max = Math.max(...data) * 1.15 || 1;
  const pad = 8;
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const y = pad + ((hh - 2 * pad) * i) / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, hh - pad - (v / max) * (hh - 2 * pad)]);
  const grad = g.createLinearGradient(0, 0, 0, hh);
  grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
  g.beginPath(); g.moveTo(0, hh);
  pts.forEach(([x, y]) => g.lineTo(x, y));
  g.lineTo(w, hh); g.closePath(); g.fillStyle = grad; g.fill();
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = color; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
  if (label) { g.fillStyle = '#a3a8b3'; g.font = '12px system-ui'; g.fillText(label, 8, 16); }
}

/** Balkendiagramm. */
export function barChart(c: HTMLCanvasElement, data: number[], labels: string[] | null, color = '#2f9bff', ref?: number) {
  const [g, w, hh] = fitCanvas(c);
  g.clearRect(0, 0, w, hh);
  const max = Math.max(...data, ref ?? 0) * 1.1 || 1;
  const bottom = labels ? 18 : 4;
  const bw = w / data.length;
  data.forEach((v, i) => {
    const bh = (v / max) * (hh - bottom - 6);
    g.fillStyle = color;
    g.fillRect(i * bw + bw * 0.12, hh - bottom - bh, Math.max(1, bw * 0.76), bh);
    if (labels && labels[i]) { g.fillStyle = '#a3a8b3'; g.font = '11px system-ui'; g.textAlign = 'center'; g.fillText(labels[i], i * bw + bw / 2, hh - 4); }
  });
  if (ref) {
    const y = hh - bottom - (ref / max) * (hh - bottom - 6);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]);
  }
}

/** Kurz an den Browser abgeben, ohne auf den Bildschirmtakt zu warten (Messschleifen sollen nicht bei 60 Hz gedeckelt werden). */
export function yieldNow() {
  return new Promise<void>(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
}
