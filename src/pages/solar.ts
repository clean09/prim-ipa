// Seite „Sonnensystem“ (Port der Desktop-Seite PrimSieb/Solar): alle Planeten, Monde, Asteroiden und Kometen in echtem Maßstab
// auf echten Bahnen zur echten Zeit, Finsternisse, Missionen mit Autopilot und Bildern, Mathematik mit eingesetzten Zahlen.
import { L, isEn } from '../core/i18n';
import { h, toast } from '../ui/dom';
import { icon } from '../ui/icons';
import { sfx } from '../ui/fx';
import { scramble } from '../ui/motion';
import { setBusy } from '../core/nav';
import { BODIES, Body, BodyKind, KIND_NAME, find, nameOf, tr } from '../solar/catalog';
import { buildCatalog } from '../solar/catalog_data';
import { initEphem, abs, vel } from '../solar/ephem';
import { MISSIONS, Mission, buildMissions } from '../solar/missions';
import { AU, C, jdToMs, km, lightTime, msToJd, nf } from '../solar/math';
import { SolarRender } from '../solar/render';
import { SolarScene } from '../solar/scene';
import { MathPanel } from '../solar/mathpanel';
import '../solar/solar.css';

let ready = false;
function init() {
  if (ready) return;
  buildCatalog(); initEphem(); buildMissions();
  const iss = find('ISS'); if (iss) { iss.surf = 17; iss.albedo = 0.6; }
  ready = true;
}

const RATES: [number, () => string][] = [
  [1 / 86400, () => L('Echtzeit', 'Real time')], [1 / 1440, () => L('1 min/s', '1 min/s')], [1 / 24, () => L('1 Std/s', '1 hr/s')],
  [1, () => L('1 Tag/s', '1 day/s')], [7, () => L('1 Woche/s', '1 week/s')], [30.44, () => L('1 Monat/s', '1 month/s')], [365.25, () => L('1 Jahr/s', '1 yr/s')],
];
type Tab = 'go' | 'mis' | 'ev' | 'info' | 'math';
let lastTab: Tab = 'info';

export function mountSolar(root: HTMLElement) {
  init();
  setBusy(false);
  const base = import.meta.env.BASE_URL + 'solar/';
  // ---------------------------------------------------------------- Bühne
  const canvas = h('canvas');
  const labelsEl = h('div', { class: 'sol-labels' });
  const kick = h('div', { class: 'sl-k' }, L('Sonnensystem · echter Maßstab', 'Solar system · true scale'));
  const nameEl = h('div', { class: 'sl-name' });
  const subEl = h('div', { class: 'sl-age' });
  const layerBtn = (label: string, on: boolean, f: (v: boolean) => void) => {
    const b = h('button', { class: 'sol-lb' + (on ? ' on' : ''), onclick: () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); f(v); sfx.tap(); kickRender(); } }, label);
    return b;
  };
  const playBtn = h('button', { class: 'sl-play', 'aria-label': 'Play' });
  const rateBtn = h('button', { class: 'sol-rate' });
  const dateEl = h('div', { class: 'sol-date' });
  const nowBtn = h('button', { class: 'sol-now' }, L('Jetzt', 'Now'));
  const revBtn = h('button', { class: 'sol-rev', 'aria-label': L('Rückwärts', 'Reverse') }, '⇄');
  const stage = h('div', { class: 'sl-stage sol-stage' }, canvas, labelsEl,
    h('div', { class: 'sl-top' }, h('div', { style: { minWidth: '0' } }, kick, nameEl, subEl)),
    h('div', { class: 'sol-time' }, playBtn, h('div', { class: 'sol-tmid' }, dateEl, h('div', { class: 'sol-trow' }, revBtn, rateBtn, nowBtn))));
  const layers = h('div', { class: 'sol-layers' });
  const tabsEl = h('div', { class: 'chips sol-tabs' });
  const body = h('div', { class: 'sol-body' });
  const panel = h('div', { class: 'sl-panel' }, layers, tabsEl, body);
  root.append(h('div', { class: 'sl sol' }, stage, panel));

  let r: SolarRender, sc: SolarScene;
  try { r = new SolarRender(canvas, base); sc = new SolarScene(r); if (import.meta.env.DEV) (window as any).__sol = sc; }
  catch (e: any) { stage.append(h('div', { class: 'card', style: { margin: '90px 16px', position: 'relative' } }, L('Das Sonnensystem braucht WebGL2: ', 'The solar system needs WebGL2: ') + String(e?.message ?? e))); return; }
  r.onTexture = () => kickRender();
  layers.append(
    layerBtn(L('Bahnen', 'Orbits'), sc.showOrbits, v => { sc.showOrbits = v; }),
    layerBtn(L('Namen', 'Labels'), sc.showLabels, v => { sc.showLabels = v; }),
    layerBtn(L('Kleinkörper', 'Small bodies'), sc.showMinor, v => { sc.showMinor = v; }),
    layerBtn(L('Asteroidenwolke', 'Asteroid cloud'), sc.showDots, v => { sc.showDots = v; }));

  // ---------------------------------------------------------------- Zeit
  let rateIdx = 0, reverse = false;
  const syncTime = () => {
    playBtn.innerHTML = ''; playBtn.append(icon(sc.paused ? 'play' : 'pause'));
    const m = Math.abs(sc.rate);
    const k = RATES.findIndex(([v]) => Math.abs(v - m) / v < 0.01);
    rateBtn.textContent = k >= 0 ? RATES[k][1]() : `${nf(m * 86400)}×`;
    revBtn.classList.toggle('on', sc.rate < 0);
  };
  playBtn.addEventListener('click', () => { sc.paused = !sc.paused; syncTime(); sfx.tap(); kickRender(); });
  rateBtn.addEventListener('click', () => { rateIdx = (rateIdx + 1) % RATES.length; sc.rate = RATES[rateIdx][0] * (reverse ? -1 : 1); sc.paused = false; syncTime(); sfx.tap(); });
  revBtn.addEventListener('click', () => { reverse = !reverse; sc.rate = -sc.rate; syncTime(); sfx.tap(); });
  nowBtn.addEventListener('click', () => { sc.jd = msToJd(Date.now()); rateIdx = 0; reverse = false; sc.rate = RATES[0][0]; sc.paused = false; sc.startMission(null); renderTab(); syncTime(); sfx.tap(); });
  syncTime();
  const fmtDate = (jd: number) => {
    const d = new Date(jdToMs(jd));
    if (isNaN(d.getTime())) return '–';
    return d.toLocaleString(isEn() ? 'en-GB' : 'de-DE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: Math.abs(sc.rate) < 1 / 100 ? '2-digit' : undefined, timeZone: 'UTC' }) + ' UTC';
  };

  // ---------------------------------------------------------------- Gesten: ziehen = drehen, zwei Finger = zoomen, tippen = wählen, doppelt = hinfliegen
  const ptrs = new Map<number, { x: number; y: number }>();
  let pinch0 = 0, moved = 0, lastTap = 0, downAt = 0;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; downAt = performance.now(); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } interacting = true; kickRender(); });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) sc.orbit(dx * 0.006, dy * 0.006);
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0 && d > 0) sc.zoom(pinch0 / d); pinch0 = d; }
    kickRender();
  });
  const up = (e: PointerEvent) => {
    const wasSingle = ptrs.size === 1; ptrs.delete(e.pointerId);
    if (ptrs.size === 0) interacting = false;
    if (wasSingle && moved < 8 && performance.now() - downAt < 400) {
      const rc = canvas.getBoundingClientRect(), i = sc.pick(e.clientX - rc.left, e.clientY - rc.top);
      const now = performance.now();
      if (i >= 0) {
        if (now - lastTap < 350 && sc.selected === i) { sc.flyTo(i); sfx.tap(); }
        else { sc.selected = i; showBody(i); sfx.tap(); }
      }
      lastTap = now;
    }
    pinch0 = 0;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); sc.zoom(Math.exp(e.deltaY * 0.0015)); kickRender(); }, { passive: false });

  // ---------------------------------------------------------------- Kopf + Info
  let shownBody = -1;
  function showBody(i: number) {
    if (i !== shownBody) { shownBody = i; scramble(nameEl, nameOf(BODIES[i])); }
    if (lastTab === 'info' || lastTab === 'math') renderTab();
  }
  const liveEls: Record<string, HTMLElement> = {};
  function infoTab() {
    const b = BODIES[sc.selected];
    const vals = h('div', { class: 'tiles sol-live' });
    for (const [k, t] of [['de', L('Abstand zur Erde', 'Distance to Earth')], ['ds', L('Abstand zur Sonne', 'Distance to Sun')], ['lt', L('Licht braucht', 'Light needs')], ['v', L('Geschwindigkeit', 'Speed')]] as const) {
      const v = h('div', { class: 'v' }, '–'); liveEls[k] = v;
      vals.append(h('div', { class: 'tile' }, h('div', { class: 'k' }, t), v));
    }
    const facts = h('div', { class: 'sol-facts' }, b.facts.map(([k, v]) => h('div', null, h('span', null, tr(k)), h('b', null, tr(v)))));
    body.append(
      h('div', { class: 'sol-type' }, tr(b.type)),
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn', onclick: () => { sc.flyTo(b.index); sfx.tap(); } }, L('Hinfliegen', 'Fly there')),
        b.index !== sc.target ? h('button', { class: 'btn ghost', onclick: () => { sc.jump(b.index); sfx.tap(); } }, L('Sofort hin', 'Jump there')) : ''),
      vals,
      h('p', { class: 'sl-text' }, tr(b.info)),
      b.approx ? h('p', { class: 'muted small' }, L('Bahnlage nur ungefähr (genaue Phase unbekannt).', 'Orbital position only approximate (exact phase unknown).')) : '',
      h('div', { class: 'sec-h sol-sec' }, h('h2', null, L('Steckbrief', 'Fact sheet'))), facts,
      h('p', { class: 'muted small', style: { marginTop: '14px', lineHeight: '1.5' } }, L(
        'Quellen: Bahnen nach JPL (Planeten, Monde, Kleinkörper SBDB), Pole nach IAU. Oberflächenkarten und Milchstraße: Solar System Scope (CC BY 4.0). Sternkatalog: Yale Bright Star Catalogue (BSC5). Missionsbilder vom PrimSieb-Desktopprogramm gerendert.',
        'Sources: orbits from JPL (planets, moons, small bodies SBDB), poles from IAU. Surface maps and Milky Way: Solar System Scope (CC BY 4.0). Star catalogue: Yale Bright Star Catalogue (BSC5). Mission images rendered by the PrimSieb desktop program.')));
  }
  function updateLive() {
    if (!liveEls.de?.isConnected) return;
    const b = BODIES[sc.selected], p = sc.pos[b.index], e = sc.pos[find('Erde')!.index];
    liveEls.de.textContent = b.name === 'Erde' ? '–' : km(p.sub(e).len);
    liveEls.ds.textContent = b.index === 0 ? '–' : km(p.len);
    liveEls.lt.textContent = b.name === 'Erde' ? '–' : lightTime(p.sub(e).len);
    const v = b.index === 0 ? 0 : vel(b, sc.jd, 0.002).sub(b.parent > 0 ? vel(BODIES[b.parent], sc.jd, 0.002) : abs(BODIES[0], sc.jd)).len / 86400;
    liveEls.v.textContent = b.index === 0 ? '–' : `${nf(v, 2)} km/s`;
  }

  // ---------------------------------------------------------------- Ziele
  function goTab() {
    const q = h('input', { class: 'sol-search', type: 'search', placeholder: L('Name suchen …', 'Search a name …') });
    const list = h('div');
    const fill = () => {
      list.innerHTML = '';
      const s = q.value.trim().toLowerCase();
      const kinds: BodyKind[] = ['Star', 'Planet', 'Dwarf', 'Moon', 'Asteroid', 'Comet', 'Probe', 'Stream'];
      for (const k of kinds) {
        const items = BODIES.filter(b => b.kind === k && (!s || nameOf(b).toLowerCase().includes(s) || b.name.toLowerCase().includes(s)));
        if (!items.length) continue;
        list.append(h('div', { class: 'sol-gh' }, L(KIND_NAME[k][0], KIND_NAME[k][1])),
          h('div', { class: 'chips sol-wrap' }, items.map(b => h('button', { class: 'chip' + (b.index === sc.selected ? ' on' : ''), onclick: () => { sc.startMission(null); sc.flyTo(b.index); showBody(b.index); fill(); sfx.tap(); } },
            b.kind === 'Moon' ? `${nameOf(b)} · ${nameOf(BODIES[b.parent])}` : nameOf(b)))));
      }
    };
    q.addEventListener('input', fill);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') (list.querySelector('.chip') as HTMLElement | null)?.click(); });
    fill();
    body.append(q, list);
  }

  // ---------------------------------------------------------------- Missionen
  const phaseEls: HTMLElement[] = [];
  sc.onPhase = k => { phaseEls.forEach((e, i) => e.classList.toggle('on', i === k)); phaseEls[k]?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); };
  function missionsTab() {
    phaseEls.length = 0;
    const m = sc.mission;
    if (m) {
      const mi = MISSIONS.indexOf(m);
      body.append(
        h('div', { class: 'sol-mhead' }, h('div', null, h('div', { class: 'sl-k' }, String(new Date(jdToMs(m.start)).getUTCFullYear())), h('b', null, tr(m.name))),
          h('button', { class: 'btn ghost', onclick: () => { sc.startMission(null); renderTab(); sfx.tap(); } }, L('Beenden', 'End'))),
        m.route ? h('div', { class: 'sol-route' }, tr(m.route)) : '',
        h('p', { class: 'sl-text' }, tr(m.info)),
        h('label', { class: 'switch' }, h('div', null, L('Autopilot (Kamera und Tempo je Abschnitt)', 'Autopilot (camera and speed per phase)')),
          h('input', { type: 'checkbox', checked: sc.autopilot, onchange: (e: Event) => { sc.autopilot = (e.target as HTMLInputElement).checked; } })));
      const list = h('div', { class: 'sol-phases' });
      m.phases.forEach((p, k) => {
        const img = h('img', { src: `${base}missions/mission_${String(mi).padStart(2, '0')}_${String(k).padStart(2, '0')}.jpg`, alt: '', loading: 'lazy' });
        img.addEventListener('error', () => img.remove());
        const el = h('button', { class: 'sol-ph' + (k === sc.missionPhase ? ' on' : ''), onclick: () => { sc.startMission(m, k); sfx.tap(); } },
          img, h('div', null, h('small', null, fmtDate(p.jd)), h('b', null, tr(p.title)), h('p', null, tr(p.text))));
        phaseEls.push(el); list.append(el);
      });
      body.append(list);
      return;
    }
    body.append(h('p', { class: 'muted small' }, L('Echte Zeitpunkte, Startplätze und Vorbeiflüge. Die Bahnen sind aus Transferbahnen (Lambert) zusammengesetzt – die Knicke sind die Triebwerkszündungen.',
      'Real times, launch sites and fly-bys. The paths are built from transfer orbits (Lambert) – the kinks are the engine burns.')));
    for (const m of MISSIONS) {
      body.append(h('button', { class: 'sol-mcard2', onclick: () => { sc.startMission(m); renderTab(); sfx.tap(); } },
        h('span', { class: 'y' }, String(new Date(jdToMs(m.start)).getUTCFullYear())),
        h('div', null, h('b', null, tr(m.name)), h('small', null, m.route ? tr(m.route) : `${m.phases.length} ${L('Abschnitte', 'phases')}`)), icon('arrow')));
    }
  }

  // ---------------------------------------------------------------- Ereignisse
  const at = (y: number, mo: number, d: number, hh = 0, mi = 0) => msToJd(Date.UTC(y, mo - 1, d, hh, mi));
  const sunSideYaw = (jd: number) => { const e = abs(find('Erde')!, jd); return Math.atan2(-e.y, -e.x); };
  function go(jd: number, target: string, dist: number, yaw: number, pitch: number, rate: number, dots = false) {
    sc.startMission(null);
    sc.jd = jd; rateIdx = rate; reverse = false; sc.rate = RATES[rate][0]; sc.paused = false; syncTime();
    const t = find(target)!;
    sc.yaw = yaw; sc.pitch = pitch; sc.jump(t.index, dist); showBody(t.index);
    if (dots) { sc.showDots = true; layers.children[3]?.classList.add('on'); }
  }
  function eventsTab() {
    const e26 = at(2026, 8, 12, 17, 46), e27 = at(2027, 8, 2, 10, 7);
    const ev: [string, string, () => void][] = [
      [L('Heute, jetzt', 'Today, now'), L('Erde', 'Earth'), () => { const j = msToJd(Date.now()); go(j, 'Erde', 60000, sunSideYaw(j) + 0.7, 0.35, 0); }],
      [L('Totale Sonnenfinsternis 12.08.2026 (Spanien)', 'Total solar eclipse 12 Aug 2026 (Spain)'), '12.08.2026', () => go(e26, 'Erde', 32000, sunSideYaw(e26) + 0.5, 0.9, 1)],
      [L('Totale Sonnenfinsternis 02.08.2027 (Ägypten)', 'Total solar eclipse 2 Aug 2027 (Egypt)'), '02.08.2027', () => go(e27, 'Erde', 32000, sunSideYaw(e27) + 0.1, 0.35, 1)],
      [L('Totale Mondfinsternis 03.03.2026', 'Total lunar eclipse 3 Mar 2026'), '03.03.2026', () => go(at(2026, 3, 3, 11, 33), 'Mond', 12000, 0.3, 0.1, 1)],
      [L('Apophis rast an der Erde vorbei (13.04.2029)', 'Apophis races past Earth (13 Apr 2029)'), '13.04.2029', () => go(at(2029, 4, 12, 12), 'Erde', 400000, 1.0, 0.5, 2)],
      [L('Halley kehrt zurück (Juli 2061)', 'Halley returns (July 2061)'), '2061', () => go(at(2061, 6, 1), 'Halley', 6e7, 0.5, 0.4, 3)],
      [L('Komet Hale-Bopp (April 1997)', 'Comet Hale-Bopp (April 1997)'), '1997', () => go(at(1997, 3, 25), 'Hale-Bopp', 8e7, 2.0, 0.3, 3)],
      [L('Komet Tsuchinshan-ATLAS (Okt. 2024)', 'Comet Tsuchinshan-ATLAS (Oct 2024)'), '2024', () => go(at(2024, 10, 1), 'Tsuchinshan-ATLAS', 4e7, 1.0, 0.3, 3)],
      [L('Große Konjunktion Jupiter–Saturn (21.12.2020)', 'Great conjunction Jupiter–Saturn (21 Dec 2020)'), '21.12.2020', () => go(at(2020, 12, 21, 18), 'Erde', 2e5, 0.2, 0.1, 2)],
      [L('Perseiden: Erde im Staubstrom (12.08.)', 'Perseids: Earth in the dust stream (12 Aug)'), L('August', 'August'), () => go(at(new Date().getUTCFullYear(), 8, 12), 'Perseiden', 6e7, 0.5, 0.6, 3, true)],
      [L('Saturn-Tagundnachtgleiche (Ringe von der Kante, Mai 2025)', "Saturn's equinox (rings edge-on, May 2025)"), L('Mai 2025', 'May 2025'), () => go(at(2025, 5, 6), 'Saturn', 7e5, 0.6, 0.0, 2)],
      [L('New Horizons fliegt an Pluto vorbei (14.07.2015)', 'New Horizons flies past Pluto (14 Jul 2015)'), '14.07.2015', () => go(at(2015, 7, 14, 11, 50), 'Pluto', 12000, 0.4, 0.3, 1)],
      [L('Der ganze Asteroidengürtel', 'The whole asteroid belt'), L('Hauptgürtel mit Kirkwood-Lücken', 'Main belt with Kirkwood gaps'), () => { const j = msToJd(Date.now()); go(j, 'Sonne', 9 * AU, 0.4, 1.0, 5, true); }],
      [L('Jupiters Trojaner und Hildas', "Jupiter's Trojans and Hildas"), L('Resonanzen mit Jupiter', 'Resonances with Jupiter'), () => { const j = msToJd(Date.now()); go(j, 'Sonne', 16 * AU, 0.2, 1.4, 5, true); }],
    ];
    body.append(h('div', { class: 'sol-ev' }, ev.map(([n, s, f]) => h('button', { onclick: () => { f(); sfx.tap(); kickRender(); } }, h('b', null, n), h('small', null, s)))));
  }

  // ---------------------------------------------------------------- Tabs
  const math = new MathPanel();
  const TABS: [Tab, () => string][] = [['info', () => 'Info'], ['go', () => L('Ziele', 'Targets')], ['mis', () => L('Missionen', 'Missions')], ['ev', () => L('Ereignisse', 'Events')], ['math', () => L('Mathe', 'Math')]];
  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const [t, lab] of TABS) tabsEl.append(h('button', { class: 'chip' + (t === lastTab ? ' on' : ''), onclick: () => { lastTab = t; renderTabs(); renderTab(); sfx.tap(); } }, lab()));
  }
  function renderTab() {
    body.innerHTML = '';
    if (lastTab === 'info') infoTab();
    else if (lastTab === 'go') goTab();
    else if (lastTab === 'mis') missionsTab();
    else if (lastTab === 'ev') eventsTab();
    else { body.append(math.el); math.update(sc.selected, sc.jd); }
  }
  renderTabs(); renderTab();
  showBody(sc.selected);
  body.append();
  void C;

  // ---------------------------------------------------------------- Bildschleife (nur bei Bedarf schnell)
  let raf = 0, last = performance.now(), interacting = false, lastSlow = 0, lastUi = 0, alive = true;
  const labelPool: HTMLElement[] = [];
  function kickRender() { if (!raf && alive) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now: number) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const busyAnim = !sc.paused || sc.flying || interacting;
    // ruhig: 30 Bilder/s genügen, bei Bewegung 60
    if (!busyAnim && now - lastSlow < 33) { raf = requestAnimationFrame(frame); return; }
    lastSlow = now;
    r.resize();
    sc.step(dt, now);
    const scene = sc.build(now);
    r.draw(sc.cam, { jd: sc.jd, time: now / 1000, ...scene, dots: sc.showDots, skyB: 0.55, expo: 1 });
    // Beschriftungen
    let k = 0;
    // Beschriftungen ohne Überlappung: Auswahl zuerst, dann große Körper; nichts unter dem Titelblock
    const placed: number[][] = [];
    const prio = (lb: typeof sc.labels[number]) => (lb.b.index === sc.selected ? 0 : lb.b.index === sc.target ? 1 : lb.major ? 2 : 3);
    const order = [...sc.labels].sort((a, b) => prio(a) - prio(b));
    for (const lb of order) {
      const name = nameOf(lb.b), w = name.length * 6.6 + 6, x0 = lb.x - w / 2, y0 = lb.y;
      if (y0 < 132 && prio(lb) > 1) continue;
      if (placed.some(q => x0 < q[2] && x0 + w > q[0] && y0 < q[3] && y0 + 14 > q[1])) continue;
      placed.push([x0, y0, x0 + w, y0 + 14]);
      let el = labelPool[k];
      if (!el) { el = h('span'); labelPool.push(el); labelsEl.append(el); }
      if (el.textContent !== name) el.textContent = name;
      el.className = lb.major ? 'm' : '';
      el.classList.toggle('sel', lb.b.index === sc.selected);
      el.style.transform = `translate(${lb.x.toFixed(1)}px, ${lb.y.toFixed(1)}px) translateX(-50%)`;
      el.style.display = '';
      k++;
    }
    for (let i = k; i < labelPool.length; i++) labelPool[i].style.display = 'none';
    if (now - lastUi > 250) {
      lastUi = now;
      dateEl.textContent = fmtDate(sc.jd);
      const b = BODIES[sc.selected];
      subEl.textContent = `${tr(b.type)} · ${b.index === sc.target ? L('Abstand', 'distance') + ' ' + km(Math.max(0, sc.dist - b.R)) : km(sc.pos[b.index].sub(sc.cam.pos).len)}`;
      if (sc.target !== shownBody && !sc.flying) showBody(sc.target);
      updateLive();
      if (lastTab === 'math') math.update(sc.selected, sc.jd);
    } else if (lastTab === 'math') math.drawDiagram();
    if (busyAnim || lastTab === 'math') raf = requestAnimationFrame(frame);
    else raf = requestAnimationFrame(frame);       // langsamer Takt (s. o.)
  }
  const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kickRender(); };
  document.addEventListener('visibilitychange', vis);
  kickRender();
  toast(L('Ziehen: drehen · zwei Finger: zoomen · tippen: wählen · doppelt tippen: hinfliegen', 'Drag: rotate · two fingers: zoom · tap: select · double tap: fly there'), 4200);
  return () => { alive = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); r.gl.getExtension('WEBGL_lose_context')?.loseContext(); };
}

export type { Body, Mission };
