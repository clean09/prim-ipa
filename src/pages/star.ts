// Seite „Sternenleben“ (Port der Desktop-Seite StarLife): Masse wählen, das Leben vorspulen, ins Innere schneiden.
// Innen steuert Außen – Radius, Temperatur, Farbe, Oberfläche und Wind kommen aus dem Modell (star/model.ts).
import { F, L, N, isEn } from '../core/i18n';
import { saveSettings, settings } from '../core/store';
import { h, seg, sheet, fitCanvas } from '../ui/dom';
import { icon } from '../ui/icons';
import { sfx } from '../ui/fx';
import { EL_COLORS, EL_NAMES, StarState, StellarModel, blackbody, fmtYears } from '../star/model';
import { StarView } from '../star/render';
import { scramble } from '../ui/motion';

const MASSES = [0.05, 0.3, 1, 2, 5, 8, 15, 25, 40, 90, 200];
const GROUP_COL = ['#6c7aa8', '#ffd25a', '#ff8a3d', '#ff4f6d', '#b07cff', '#58c7ff'];
const GROUP_NAME = () => [L('Entstehung', 'Birth'), L('Hauptreihe', 'Main sequence'), L('Riese', 'Giant'), L('Spätes Brennen', 'Late burning'), L('Ende', 'End'), L('Überrest', 'Remnant')];
type Tab = 'phase' | 'inside' | 'hr' | 'end';
let lastTab: Tab = 'phase';

const sci = (x: number, unit = '') => {
  if (!isFinite(x)) return '–';
  if (x === 0) return '0' + unit;
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e < 5) return F(x, x < 10 ? 2 : x < 100 ? 1 : 0) + unit;
  const m = x / 10 ** e;
  const sup = String(e).replace(/-/g, '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
  return `${F(m, 1)}·10${sup}${unit}`;
};

export function mountStar(root: HTMLElement) {
  const saved = settings().star ?? { m: 1, z: 0.014, rot: 0, comp: 0, sep: 0, cut: false };
  let opts = { ...saved };
  let model = new StellarModel(opts);
  let prog = startProg(model);
  let playing = true;
  let st: StarState = model.at(model.uFromProgress(prog));

  // ---------------------------------------------------------------- Bühne
  const canvas = h('canvas');
  const phaseK = h('div', { class: 'sl-k' });
  const phaseN = h('div', { class: 'sl-name' });
  const ageEl = h('div', { class: 'sl-age' });
  const cutBtn = h('button', { class: 'sl-ib' + (opts.cut ? ' on' : ''), 'aria-label': L('Schnitt', 'Cutaway'), onclick: () => {
    view && (view.cut = !view.cut); opts.cut = !!view?.cut; cutBtn.classList.toggle('on', opts.cut); persist(); sfx.tap();
  } }, icon('cut'));
  const setBtn = h('button', { class: 'sl-ib', 'aria-label': L('Was wäre wenn', 'What if'), onclick: () => openWhatIf() }, icon('settings'));
  const stage = h('div', { class: 'sl-stage' }, canvas,
    h('div', { class: 'sl-top' }, h('div', { style: { minWidth: '0' } }, phaseK, phaseN, ageEl), h('div', { class: 'sl-btns' }, cutBtn, setBtn)));
  // Zeitleiste: Phasen als Abschnitte (Breite ∝ Gewicht), Farbe = Lebensabschnitt
  const bar = h('div', { class: 'sl-bar' });
  const thumb = h('div', { class: 'sl-thumb' });
  const playBtn = h('button', { class: 'sl-play', 'aria-label': 'Play', onclick: () => { playing = !playing; if (playing && prog >= 0.999) prog = 0; syncPlay(); sfx.tap(); } });
  const timeline = h('div', { class: 'sl-time' }, playBtn, h('div', { class: 'sl-track' }, bar, thumb));
  stage.append(timeline);
  const syncPlay = () => { playBtn.innerHTML = ''; playBtn.append(icon(playing ? 'pause' : 'play')); };
  syncPlay();

  // ---------------------------------------------------------------- Bedienfeld
  const massRow = h('div', { class: 'chips sl-mass' });
  const tiles = h('div', { class: 'tiles' });
  const tabSeg = seg<Tab>([['phase', L('Phase', 'Phase')], ['inside', L('Innen', 'Inside')], ['hr', 'HR'], ['end', L('Ende', 'End')]], lastTab, v => { lastTab = v; renderTab(true); });
  const tabBody = h('div', { class: 'sl-body' });
  const panel = h('div', { class: 'sl-panel' }, massRow, tiles, tabSeg.el, tabBody);
  root.append(h('div', { class: 'sl' }, stage, panel));

  let view: StarView | null = null;
  try { view = new StarView(canvas); view.cut = opts.cut; }
  catch (e: any) { stage.append(h('div', { class: 'card', style: { margin: '70px 16px', position: 'relative' } }, L('Das Sternenleben braucht WebGL2: ', 'Star life needs WebGL2: ') + String(e?.message ?? e))); }

  // Masse-Auswahl
  const renderMass = () => {
    massRow.innerHTML = '';
    for (const m of MASSES) massRow.append(h('button', { class: 'chip' + (Math.abs(m - opts.m) < 1e-6 ? ' on' : ''), onclick: () => { setModel({ m }); } }, `${F(m, m < 1 ? 2 : 0).replace(/,00$/, '')} M☉`));
    if (!MASSES.some(m => Math.abs(m - opts.m) < 1e-6)) massRow.prepend(h('button', { class: 'chip on' }, `${F(opts.m, 2)} M☉`));
  };

  function setModel(o: Partial<typeof opts>) {
    opts = { ...opts, ...o };
    model = new StellarModel(opts);
    prog = startProg(model);
    playing = true; syncPlay();
    persist();
    renderMass(); buildBar(); lastSeg = -1; shownSeg = -1; hrCache = null;
    sfx.tap();
  }
  function persist() { saveSettings({ star: opts }); }

  function buildBar() {
    bar.innerHTML = '';
    const tot = model.totalWeight;
    model.segs.forEach((s, k) => bar.append(h('i', { style: { flex: String(s.weight / tot), background: GROUP_COL[s.group] }, title: s.name, 'data-k': String(k) })));
  }

  // Zeitleiste ziehen
  const track = timeline.querySelector('.sl-track') as HTMLElement;
  let dragging = false;
  const scrub = (e: PointerEvent) => {
    const r = track.getBoundingClientRect();
    prog = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  track.addEventListener('pointerdown', e => { dragging = true; playing = false; syncPlay(); track.setPointerCapture(e.pointerId); scrub(e); });
  track.addEventListener('pointermove', e => { if (dragging) scrub(e); });
  track.addEventListener('pointerup', () => { dragging = false; });
  track.addEventListener('pointercancel', () => { dragging = false; });

  // Stern drehen (wischen)
  let px = -1, py = 0;
  canvas.addEventListener('pointerdown', e => { px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (px < 0 || !view) return;
    view.yaw -= (e.clientX - px) * 0.008; view.pitch = Math.max(-1.3, Math.min(1.3, view.pitch + (e.clientY - py) * 0.008));
    px = e.clientX; py = e.clientY;
  });
  canvas.addEventListener('pointerup', () => { px = -1; });

  // ---------------------------------------------------------------- Kennzahlen + Tabs
  const tileEls: Record<string, HTMLElement> = {};
  const mkTiles = () => {
    tiles.innerHTML = '';
    for (const [k, t] of [['R', L('Radius', 'Radius')], ['T', L('Oberfläche', 'Surface')], ['L', L('Leuchtkraft', 'Luminosity')], ['M', L('Masse', 'Mass')]] as const) {
      const v = h('div', { class: 'v' }, '–');
      tileEls[k] = v;
      tiles.append(h('div', { class: 'tile' }, h('div', { class: 't' }, t), v));
    }
  };
  mkTiles();
  const updTiles = () => {
    const R = st.R, sk = model.segs[st.seg].look;
    tileEls.R.textContent = sk === 'Nothing' ? '–' : R < 0.01 ? `${N(R * 695700)} km` : `${sci(R)} R☉`;
    tileEls.T.textContent = sk === 'BlackHole' || sk === 'Nothing' ? '–' : `${N(st.T)} K`;
    tileEls.L.textContent = sk === 'BlackHole' || sk === 'Nothing' ? '–' : `${sci(st.L)} L☉`;
    tileEls.M.textContent = `${F(st.M, st.M < 10 ? 2 : 1)} M☉`;
    const [r, g, b] = blackbody(st.T);
    tileEls.T.style.color = `rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})`;
  };

  let lastSeg = -1;
  let hrCanvas: HTMLCanvasElement | null = null;
  let hrCache: { pts: [number, number, number][]; } | null = null;
  let tabT = 0;
  function renderTab(force = false) {
    if (!force && st.seg === lastSeg && lastTab !== 'hr' && lastTab !== 'inside') return;
    // HR/Innen laufend nachführen, aber nicht in jedem Bild (DOM/2D-Zeichnen)
    const now = performance.now();
    if (!force && st.seg === lastSeg && now - tabT < 150) return;
    tabT = now;
    const s = model.segs[st.seg];
    if (lastTab === 'hr') {
      if (!hrCanvas || force || !tabBody.contains(hrCanvas)) {
        tabBody.innerHTML = '';
        hrCanvas = h('canvas', { class: 'vis', style: { height: '260px' } });
        hrCanvas.addEventListener('pointerdown', e => hrTap(e));
        tabBody.append(hrCanvas, h('p', { class: 'muted small' }, L('Hertzsprung-Russell-Diagramm: links heiß, rechts kühl, oben hell. Antippen springt zu diesem Zeitpunkt.',
          'Hertzsprung–Russell diagram: hot on the left, cool on the right, bright at the top. Tap to jump to that moment.')));
      }
      drawHR();
      lastSeg = st.seg;
      return;
    }
    if (lastTab === 'inside') {
      if (force || st.seg !== lastSeg || !tabBody.querySelector('.sl-onion')) {
        tabBody.innerHTML = '';
        tabBody.append(
          h('div', { class: 'sl-onion' }),
          h('h3', { class: 'lbl', style: { margin: '14px 0 6px' } }, L('Kern: Zusammensetzung', 'Core: composition')),
          h('div', { class: 'sl-comp' }), h('div', { class: 'sl-legend' }),
          h('dl', { class: 'kv sl-core' }),
          h('h3', { class: 'lbl', style: { margin: '14px 0 6px' } }, L('Reaktionen', 'Reactions')),
          h('div', { class: 'sl-rx mono' }, s.reactions.length ? s.reactions.map(r => h('div', null, r)) : '–'),
          h('p', { class: 'muted small', style: { marginTop: '10px' } }, L('Tipp: Schnitt-Knopf oben rechts zeigt die Schalen im Stern.', 'Tip: the cut button at the top right shows the shells inside the star.')));
      }
      const on = tabBody.querySelector('.sl-onion') as HTMLElement;
      on.innerHTML = '';
      let prev = 0;
      for (const sh of st.onion) {
        on.append(h('div', { class: 'sl-shell' + (sh.burning ? ' burn' : '') },
          h('span', { class: 'dot', style: { background: EL_COLORS[sh.main] } }),
          h('span', { class: 'nm' }, sh.label), h('span', { class: 'bar' }, h('i', { style: { width: `${Math.max(2, (sh.massFrac - prev) * 100)}%`, background: EL_COLORS[sh.main] } })),
          h('span', { class: 'pc' }, `${F((sh.massFrac - prev) * 100, 0)} %`)));
        prev = sh.massFrac;
      }
      if (!st.onion.length) on.append(h('div', { class: 'muted small' }, L('Keine Schichtung (kein Stern im Gleichgewicht).', 'No layering (no star in equilibrium).')));
      const comp = tabBody.querySelector('.sl-comp') as HTMLElement, leg = tabBody.querySelector('.sl-legend') as HTMLElement;
      comp.innerHTML = ''; leg.innerHTML = '';
      st.core.forEach((x, i) => {
        if (x < 0.004) return;
        comp.append(h('i', { style: { flex: String(x), background: EL_COLORS[i] } }));
        leg.append(h('span', null, h('b', { style: { background: EL_COLORS[i] } }), `${EL_NAMES[i]} ${F(x * 100, x < 0.1 ? 1 : 0)} %`));
      });
      const kv = tabBody.querySelector('.sl-core') as HTMLElement;
      kv.innerHTML = '';
      kv.append(h('dt', null, L('Kern-T', 'Core T')), h('dd', null, `${sci(st.Tc)} K`), h('dt', null, L('Dichte', 'Density')), h('dd', null, `${sci(st.Rho)} g/cm³`),
        h('dt', null, L('Im Kern', 'Core')), h('dd', null, s.core || '–'), s.shellBurn ? h('dt', null, L('Schale', 'Shell')) : '', s.shellBurn ? h('dd', null, s.shellBurn) : '');
      lastSeg = st.seg;
      return;
    }
    if (!force && st.seg === lastSeg) return;
    lastSeg = st.seg;
    tabBody.innerHTML = '';
    if (lastTab === 'phase') {
      tabBody.append(h('p', { class: 'sl-text' }, s.text || '–'),
        h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
          h('span', { class: 'badge', style: { color: GROUP_COL[s.group], borderColor: GROUP_COL[s.group] } }, GROUP_NAME()[s.group]),
          h('span', { class: 'badge' }, `${L('Dauer', 'Duration')} ≈ ${fmtYears(s.years)}`)),
        isEn() ? h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'Phase descriptions are in German (as in the desktop version).') : '');
    } else {
      tabBody.append(
        h('div', { class: 'hero', style: { '--tint': '#ff7a3d' } as any }, h('div', { class: 'lbl' }, L('Ende dieses Sterns', 'End of this star')),
          h('div', { class: 'big', style: { fontSize: '26px', marginTop: '6px' } }, model.endingShort),
          h('p', { class: 'sub small', style: { marginTop: '8px' } }, model.ending)),
        h('dl', { class: 'kv' },
          h('dt', null, L('Lebensdauer', 'Lifetime')), h('dd', null, fmtYears(model.segs.filter(x => x.group < 5).reduce((a, x) => a + x.years, 0))),
          h('dt', null, L('Überrest', 'Remnant')), h('dd', null, model.remnant || '–'),
          model.snType ? h('dt', null, 'Supernova') : null, model.snType ? h('dd', null, `Typ ${model.snType}`) : null,
          h('dt', null, L('Phasen', 'Phases')), h('dd', null, String(model.segs.length))),
        h('div', { class: 'sl-phases' }, model.segs.map((x, k) => h('button', { class: 'sl-ph' + (k === st.seg ? ' on' : ''), onclick: () => { prog = model.progressFromU(k + 0.02); playing = false; syncPlay(); } },
          h('i', { style: { background: GROUP_COL[x.group] } }), h('span', null, x.name), h('small', null, fmtYears(x.years))))));
    }
  }

  // ---------------------------------------------------------------- HR-Diagramm
  const hrX = (T: number, w: number) => ((Math.log10(50000) - Math.log10(Math.max(T, 1500))) / (Math.log10(50000) - Math.log10(1500))) * (w - 40) + 30;
  const hrY = (Lx: number, hh: number) => hh - 22 - ((Math.log10(Math.max(Lx, 1e-5)) + 5) / 12) * (hh - 34);
  function hrPoints() {
    if (hrCache) return hrCache.pts;
    const pts: [number, number, number][] = [];
    const n = model.segs.length;
    for (let i = 0; i <= 900; i++) {
      const u = (i / 900) * n;
      const k = Math.min(n - 1, Math.floor(u));
      const lk = model.segs[k].look;
      if (lk === 'Cloud' || lk === 'Nothing' || lk === 'BlackHole' || lk === 'Supernova') continue;
      const s = model.at(u);
      pts.push([s.T, s.L, u]);
    }
    hrCache = { pts };
    return pts;
  }
  function drawHR() {
    if (!hrCanvas) return;
    const [g, w, hh] = fitCanvas(hrCanvas);
    g.clearRect(0, 0, w, hh);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.fillStyle = 'rgba(255,255,255,.4)'; g.font = '10px ui-monospace, monospace';
    for (const T of [40000, 20000, 10000, 6000, 4000, 2500]) { const x = hrX(T, w); g.beginPath(); g.moveTo(x, 8); g.lineTo(x, hh - 22); g.stroke(); g.fillText(`${T / 1000}k`, x - 8, hh - 8); }
    for (let e = -4; e <= 6; e += 2) { const y = hrY(10 ** e, hh); g.beginPath(); g.moveTo(30, y); g.lineTo(w, y); g.stroke(); g.fillText(`10${e}`.replace('10-', '10⁻').replace(/\d$/, d => d), 2, y + 3); }
    // Hauptreihe (Referenz)
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([3, 4]); g.beginPath();
    for (let m = 0.1; m <= 100; m *= 1.15) { const Lx = m < 0.43 ? 0.034 * (m / 0.43) ** 3 : m < 2 ? m ** 4 : m < 20 ? 1.4 * m ** 3.5 : 1.4 * 20 ** 3.5 * (m / 20) ** 2; const R = m < 1 ? m ** 0.8 : m ** 0.57; const T = 5772 * (Lx / (R * R)) ** 0.25; const x = hrX(T, w), y = hrY(Lx, hh); m === 0.1 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke(); g.setLineDash([]);
    const pts = hrPoints();
    g.lineWidth = 2;
    for (let i = 1; i < pts.length; i++) {
      const [T0, L0, u0] = pts[i - 1], [T1, L1, u1] = pts[i];
      if (u1 - u0 > 0.2) continue;
      const [r, gg, b] = blackbody(T1);
      g.strokeStyle = `rgba(${r * 255 | 0},${gg * 255 | 0},${b * 255 | 0},${u1 <= model.uFromProgress(prog) ? 1 : 0.3})`;
      g.beginPath(); g.moveTo(hrX(T0, w), hrY(L0, hh)); g.lineTo(hrX(T1, w), hrY(L1, hh)); g.stroke();
    }
    const lk = model.segs[st.seg].look;
    if (lk !== 'Cloud' && lk !== 'Nothing' && lk !== 'BlackHole') {
      const x = hrX(st.T, w), y = hrY(st.L, hh);
      const [r, gg, b] = blackbody(st.T);
      const gr = g.createRadialGradient(x, y, 0, x, y, 16); gr.addColorStop(0, `rgba(${r * 255 | 0},${gg * 255 | 0},${b * 255 | 0},.8)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - 16, y - 16, 32, 32);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
    }
    // Sonne heute
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(hrX(5772, w), hrY(1, hh), 4, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText('☉', hrX(5772, w) + 6, hrY(1, hh) - 5);
  }
  function hrTap(e: PointerEvent) {
    if (!hrCanvas) return;
    const r = hrCanvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = 1e9, bu = 0;
    for (const [T, Lx, u] of hrPoints()) { const d = (hrX(T, r.width) - x) ** 2 + (hrY(Lx, r.height) - y) ** 2; if (d < best) { best = d; bu = u; } }
    prog = model.progressFromU(bu); playing = false; syncPlay();
  }

  // ---------------------------------------------------------------- Was wäre wenn
  function openWhatIf() {
    const zSeg = seg<number>([[0.0002, L('Pop. III', 'Pop. III')], [0.002, L('arm', 'poor')], [0.014, L('Sonne', 'Sun')], [0.03, L('reich', 'rich')]], opts.z, v => setModel({ z: v }));
    const rotSeg = seg<number>([[0, L('keine', 'none')], [0.3, L('mittel', 'medium')], [0.7, L('schnell', 'fast')]], opts.rot, v => setModel({ rot: v }));
    const compSeg = seg<number>([[0, L('allein', 'single')], [0.5, '0,5 M☉'], [1, '1 M☉'], [5, '5 M☉']], opts.comp, v => setModel({ comp: v, sep: v ? (opts.sep || 1) : 0 }));
    const sepSeg = seg<number>([[0.1, '0,1 AE'], [1, '1 AE'], [3, '3 AE'], [30, '30 AE']], opts.sep || 1, v => setModel({ sep: v, comp: opts.comp || 1 }));
    const mIn = h('input', { type: 'range', min: '-1.3', max: '2.4', step: '0.01', value: String(Math.log10(opts.m)) });
    const mOut = h('span', { class: 'sub' }, `${F(opts.m, 2)} M☉`);
    mIn.addEventListener('input', () => { mOut.textContent = `${F(10 ** Number(mIn.value), 2)} M☉`; });
    mIn.addEventListener('change', () => setModel({ m: Math.round(10 ** Number(mIn.value) * 100) / 100 }));
    sheet(L('Was wäre wenn …', 'What if …'),
      h('div', { class: 'stack', style: { gap: '14px' } },
        h('div', { class: 'field' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, L('Anfangsmasse', 'Initial mass')), mOut), mIn),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, L('Metallizität (schwere Elemente)', 'Metallicity (heavy elements)')), zSeg.el),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, L('Rotation', 'Rotation')), rotSeg.el),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, L('Begleitstern', 'Companion star')), compSeg.el),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, L('Abstand zum Begleiter', 'Separation')), sepSeg.el),
        h('p', { class: 'muted small' }, L('Ein naher Begleiter kann dem Riesen die Hülle abziehen (Roche-Grenze) – das ändert das ganze Ende: Helium-Zwerg, Typ IIb/Ib/Ic oder sogar eine Typ-Ia-Supernova.',
          'A close companion can strip the giant’s envelope (Roche limit) – that changes the whole ending: helium dwarf, type IIb/Ib/Ic or even a type Ia supernova.'))));
  }

  // ---------------------------------------------------------------- Schleife
  let alive = true, t0 = performance.now(), last = t0, shownSeg = -1;
  const loop = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing && !dragging) {
      // ganzes Leben ≈ 60 s, kurze Ereignisse etwas langsamer
      const ev = model.segs[st.seg]?.event ? 0.4 : 1;
      prog += dt / 60 * ev;
      if (prog >= 1) { prog = 1; playing = false; syncPlay(); }
    }
    const u = model.uFromProgress(prog);
    st = model.at(u);
    if (st.seg !== shownSeg) {
      shownSeg = st.seg;
      const s = model.segs[st.seg];
      phaseK.textContent = `${String(st.seg + 1).padStart(2, '0')} / ${String(model.segs.length).padStart(2, '0')} — ${GROUP_NAME()[s.group]}`;
      scramble(phaseN, s.name, 380);
      bar.querySelectorAll('i').forEach((e, k) => e.classList.toggle('on', k === st.seg));
      if (s.event) sfx.module();
    }
    ageEl.textContent = `${L('Alter', 'Age')} ${fmtYears(st.age)}`;
    thumb.style.left = `${prog * 100}%`;
    updTiles();
    renderTab();
    if (view && !document.hidden) view.render(model, st, (now - t0) / 1000);
    requestAnimationFrame(loop);
  };

  renderMass(); buildBar(); renderTab(true);
  requestAnimationFrame(loop);
  // nur zum Prüfen im Entwicklungsserver: Zeitpunkt/Masse setzen
  if (import.meta.env.DEV) (window as any).__star = {
    at: (p: number) => { prog = p; playing = false; syncPlay(); }, seg: (k: number, f = 0.5) => { prog = model.progressFromU(k + f); playing = false; syncPlay(); },
    model: (o: any) => setModel(o), segs: () => model.segs.map(x => x.name), cut: (on: boolean) => { if (view) view.cut = on; },
  };
  return () => { alive = false; view?.dispose(); };
}

/** Start auf der Hauptreihe (das Bild, das man zuerst erwartet). */
function startProg(m: StellarModel) {
  const k = m.segs.findIndex(s => s.group === 1);
  return k >= 0 ? m.progressFromU(k + 0.3) : 0;
}
