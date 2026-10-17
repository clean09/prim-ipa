// Seite „Singularität“: Schwarzes Loch im Vollbild – Erkunden (Finger) und 60-s-Testflug mit Punkten.
import { F, L, N } from '../core/i18n';
import { buzz, deviceName, stayAwake } from '../core/native';
import { immersive, onHidden, setBusy } from '../core/nav';
import { VERSION, addScore, saveSettings, settings } from '../core/store';
import { BlackHole, DEFAULT_SETTINGS, DEMO_CHAPTERS, DEMO_RES, DEMO_SECONDS, demoState } from '../gl/blackhole';
import { h, seg, sheet, toast, toggle, yieldNow } from '../ui/dom';
import { resultShow, sfx } from '../ui/fx';
import { showHelp } from '../ui/help';
import { icon } from '../ui/icons';

export function mountBh(root: HTMLElement) {
  const canvas = h('canvas');
  const stage = h('div', { class: 'stage' }, canvas);
  root.append(stage);
  let bh: BlackHole;
  try { bh = new BlackHole(canvas); }
  catch (e: any) {
    stage.append(h('div', { class: 'card', style: { margin: '20px', position: 'relative' } }, L('Die Singularität braucht WebGL2: ', 'The singularity needs WebGL2: ') + String(e?.message ?? e)));
    return;
  }
  const st = settings();
  bh.settings = { ...DEFAULT_SETTINGS, quality: st.bhQuality, scale: st.bhScale };
  const home = { dist: 34, yaw: 0.6, pitch: 0.17, fov: 60 };
  bh.cam = { ...home };

  // ---------------------------------------------------------------- Overlay
  const hud = h('div', { class: 'hud' });
  const chapter = h('div', { class: 'pill glass', style: { display: 'none' } });
  const testBtn = h('button', { class: 'btn primary', onclick: () => void runTest() }, icon('play'), L('Test · 60 s', 'Test · 60 s'));
  const setBtn = h('button', { class: 'btn', style: { flex: '0 0 auto' }, onclick: () => openSettings(), 'aria-label': L('Einstellungen', 'Settings') }, icon('settings'));
  const helpBtn = h('button', { class: 'btn', style: { flex: '0 0 auto', width: '52px' }, onclick: () => showHelp('bh') }, '?');
  const stopBtn = h('button', { class: 'btn stop', style: { display: 'none' }, onclick: () => { stopReq = true; } }, L('Abbrechen', 'Cancel'));
  const top = h('div', { class: 'overlay top' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, hud, chapter));
  const bottom = h('div', { class: 'overlay bottom' }, h('div', { class: 'row' }, testBtn, setBtn, helpBtn, stopBtn));
  stage.append(top, bottom);

  // ---------------------------------------------------------------- Bedienung (Finger)
  const pts = new Map<number, [number, number]>();
  let pinch = 0, lastTap = 0, testing = false, stopReq = false;
  canvas.addEventListener('pointerdown', e => {
    if (testing) return;
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    const now = performance.now();
    if (pts.size === 1 && now - lastTap < 300) { bh.cam = { ...home }; }
    lastTap = now;
  });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p || testing) return;
    if (pts.size === 1) {
      bh.cam.yaw += (e.clientX - p[0]) * 0.006;
      bh.cam.pitch = Math.max(-1.4, Math.min(1.4, bh.cam.pitch + (e.clientY - p[1]) * 0.006));
    }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) bh.cam.dist = Math.max(4, Math.min(90, bh.cam.dist * (pinch / d)));
      pinch = d;
    }
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); bh.cam.dist = Math.max(4, Math.min(90, bh.cam.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });

  // ---------------------------------------------------------------- Erkunden-Schleife
  let alive = true, t = 0, last = performance.now(), fps = 0, frames = 0, fpsT = last;
  const loop = (now: number) => {
    if (!alive) return;
    if (!testing) {
      const dt = Math.min(0.1, (now - last) / 1000);
      t += dt;
      if (!pts.size) bh.cam.yaw += dt * 0.02;              // langsames Kreisen, wenn niemand steuert
      bh.render(t);
      frames++;
      if (now - fpsT > 500) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; const [w, hh] = bh.internalSize; hud.textContent = `${F(fps, 0)} FPS · ${w}×${hh} · ${bh.gpu}`; }
    }
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // ---------------------------------------------------------------- Einstellungen
  function openSettings() {
    const s = bh.settings;
    const slider = (label: string, min: number, max: number, step: number, val: number, fmt: (v: number) => string, on: (v: number) => void) => {
      const out = h('span', { class: 'sub' }, fmt(val));
      const inp = h('input', { type: 'range', min, max, step, value: String(val), oninput: () => { const v = Number(inp.value); out.textContent = fmt(v); on(v); } });
      return h('div', { class: 'field' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, label), out), inp);
    };
    sheet(L('Einstellungen', 'Settings'),
      h('div', { class: 'stack', style: { gap: '12px' } },
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, L('Qualität (Schritte je Strahl)', 'Quality (steps per ray)')),
          seg<number>([[0, L('Niedrig', 'Low')], [1, L('Mittel', 'Medium')], [2, L('Hoch', 'High')]], s.quality, v => { s.quality = v; saveSettings({ bhQuality: v }); }).el),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, L('Auflösung', 'Resolution')),
          seg<number>([[0.35, '35 %'], [0.5, '50 %'], [0.75, '75 %'], [1, '100 %']], s.scale, v => { s.scale = v; saveSettings({ bhScale: v }); }).el),
        toggle(L('Doppler-Effekt', 'Doppler effect'), s.doppler, v => (s.doppler = v)),
        toggle(L('Akkretionsscheibe', 'Accretion disk'), s.disk, v => (s.disk = v)),
        toggle(L('Sterne', 'Stars'), s.stars, v => (s.stars = v)),
        slider(L('Drehung des Lochs (Kerr)', 'Spin of the hole (Kerr)'), 0, 0.49, 0.01, s.spin, v => (v < 0.005 ? L('keine', 'none') : `a = ${F(v * 2, 2)} M`), v => (s.spin = v)),
        slider(L('Jets', 'Jets'), 0, 2, 0.05, s.jets, v => (v === 0 ? L('aus', 'off') : F(v, 2)), v => (s.jets = v)),
        slider(L('Temperatur der Scheibe', 'Disk temperature'), 3000, 20000, 250, s.temp, v => `${N(v)} K`, v => (s.temp = v)),
        slider(L('Belichtung', 'Exposure'), 0.4, 3, 0.05, s.exposure, v => F(v, 2), v => (s.exposure = v)),
      ));
  }

  // ---------------------------------------------------------------- Testflug
  let hidden = false;
  const offHidden = onHidden(() => { if (testing) { hidden = true; stopReq = true; } });

  async function runTest() {
    testing = true; stopReq = false; hidden = false;
    sfx.start();
    const saved = { s: { ...bh.settings }, c: { ...bh.cam } };
    immersive(true);
    setBusy(true, L('Singularität', 'Singularity'));
    void stayAwake(true);
    testBtn.style.display = setBtn.style.display = helpBtn.style.display = 'none';
    stopBtn.style.display = '';
    chapter.style.display = '';
    bh.fixedRes = DEMO_RES;
    bh.settings.scale = 1;
    // Shader aufwärmen
    demoState(0, bh); bh.render(0); bh.sync();
    let rendered = 0, k = 1;
    const t0 = performance.now();
    let el = 0;
    while (el < DEMO_SECONDS && !stopReq) {
      // so viele Bilder wie die GPU schafft; nur das letzte wird angezeigt (unabhängig von 60/120 Hz)
      const tb = performance.now();
      for (let i = 0; i < k; i++) {
        const tt = Math.min(DEMO_SECONDS, (performance.now() - t0) / 1000);
        demoState(tt, bh);
        bh.render(tt, i === k - 1);
      }
      bh.sync();
      rendered += k;
      const dt = (performance.now() - tb) / 1000;
      if (dt < 0.02 && k < 32) k++; else if (dt > 0.04 && k > 1) k--;
      el = (performance.now() - t0) / 1000;
      const ch = [...DEMO_CHAPTERS].reverse().find(c => el >= c.t)!;
      const label = `${DEMO_CHAPTERS.indexOf(ch) + 1}/${DEMO_CHAPTERS.length} · ${L(ch.de, ch.en)}`;
      if (chapter.textContent !== label) { chapter.textContent = label; sfx.module(); }
      hud.textContent = `${F(rendered / el, 1)} FPS · ${Math.ceil(DEMO_SECONDS - el)} s · ${DEMO_RES[0]}×${DEMO_RES[1]}`;
      await yieldNow();
    }
    const fpsAvg = rendered / el;
    const pts = Math.round(fpsAvg * 100);
    const complete = !stopReq;
    bh.fixedRes = null;
    bh.settings = saved.s; bh.cam = saved.c;
    testing = false;
    immersive(false);
    setBusy(false);
    void stayAwake(false);
    testBtn.style.display = setBtn.style.display = helpBtn.style.display = '';
    stopBtn.style.display = 'none';
    chapter.style.display = 'none';
    if (!complete) {
      toast(hidden ? L('Test abgebrochen: Die App war im Hintergrund.', 'Test aborted: the app went to the background.') : L('Test abgebrochen.', 'Test cancelled.'));
      void buzz('error');
      return;
    }
    addScore({
      kind: 'bh', time: new Date().toISOString(), device: 'gpu', score: Math.round(fpsAvg * 10) / 10, unit: 'FPS', points: pts,
      durationS: Math.round(el), detail: `${DEMO_RES[0]}×${DEMO_RES[1]}`, model: `${deviceName()} · ${bh.gpu}`, version: VERSION, valid: true,
    });
    resultShow({
      title: L('Singularität · Testflug', 'Singularity · flight test'), value: pts, unit: L('Punkte', 'points'), kind: 'bh', device: `${deviceName()}`,
      lines: [[L('Ø Bilder pro Sekunde', 'Avg frames per second'), F(fpsAvg, 1)], [L('Auflösung', 'Resolution'), `${DEMO_RES[0]}×${DEMO_RES[1]}`], ['GPU', bh.gpu]],
    });
  }

  return () => { alive = false; stopReq = true; offHidden(); immersive(false); bh.dispose(); void stayAwake(false); };
}

