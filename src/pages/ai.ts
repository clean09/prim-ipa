// Seite „KI-Leistung“: Matrix-Durchsatz (GPU FP16 / FP32, CPU FP32) und neuronale Bildgenerierung.
import { F, L, N } from '../core/i18n';
import { buzz, cores, deviceName, stayAwake } from '../core/native';
import { onHidden, setBusy } from '../core/nav';
import { MathPool, isCancel } from '../core/pool';
import { VERSION, addScore } from '../core/store';
import { CPPN_FLOPS_PER_PIXEL, GemmGpu, NeuralArt } from '../gl/ai';
import { checkBox, h, log, progress, seg, tiles, yieldNow } from '../ui/dom';
import { resultShow, sfx } from '../ui/fx';

const fmtFlops = (g: number) => (g >= 1000 ? `${F(g / 1000, 2)} TFLOPS` : `${F(g, g < 10 ? 2 : 0)} GFLOPS`);

export function mountAi(root: HTMLElement) {
  let stop = false, hidden = false, pool: MathPool | null = null, gemm: GemmGpu | null = null;
  const big = h('div', { class: 'big' }, '–');
  const sub = h('div', { class: 'label' }, L('KI-Score (FP16-Matrix-Durchsatz der GPU)', 'AI score (GPU FP16 matrix throughput)'));
  const status = h('div', { class: 'label', style: { marginTop: '6px' } }, L('Bereit', 'Ready'));
  const prog = progress('ai');
  const T = { fp16: 'GPU FP16', fp32: 'GPU FP32', cpu: L(`CPU FP32 (${cores()} Kerne)`, `CPU FP32 (${cores()} cores)`), ratio: L('FP16 / FP32', 'FP16 / FP32') };
  const tl = tiles([T.fp16, T.fp32, T.cpu, T.ratio]);
  const chk = checkBox();
  const lg = log();
  let seconds = 8;
  const durSeg = seg<number>([[4, L('Kurz', 'Short')], [8, 'Standard'], [20, L('Lang', 'Long')]], seconds, v => (seconds = v), 'ai');
  const startBtn = h('button', { class: 'btn ai', onclick: () => void run() }, L('Matrix-Test starten', 'Start matrix test'));
  const stopBtn = h('button', { class: 'btn stop', disabled: true, onclick: () => { stop = true; pool?.cancel(); } }, L('Stopp', 'Stop'));

  // ---------------------------------------------------------------- Bildgenerierung
  const art = h('canvas', { class: 'vis', style: { height: '300px' } });
  let motif = 1 + Math.floor(Math.random() * 9999);
  let na: NeuralArt | null = null;
  let artAlive = true;
  const artInfo = h('div', { class: 'sub small' });
  const newArt = () => {
    na?.dispose();
    const fresh = art.cloneNode() as HTMLCanvasElement;
    artCanvas.replaceWith(fresh);
    artCanvas = fresh;
    try { na = new NeuralArt(fresh, motif); artInfo.textContent = L(`Motiv #${motif} · ${na.gpu}`, `Motif #${motif} · ${na.gpu}`); }
    catch (e: any) { artInfo.textContent = String(e?.message ?? e); na = null; }
  };
  let artCanvas = art;
  const artTiles = tiles([L('Pixel pro Sekunde', 'Pixels per second'), 'GFLOPS', L('Prüfung', 'Check'), L('Netz', 'Network')]);
  const motifBtn = h('button', { class: 'btn', onclick: () => { motif = 1 + Math.floor(Math.random() * 9999); newArt(); } }, L('Neues Motiv', 'New motif'));
  const measureBtn = h('button', { class: 'btn ai', onclick: () => void measureArt() }, L('Messen', 'Measure'));
  let t0 = performance.now();
  const artLoop = () => {
    if (!artAlive) return;
    if (na && !measuring) na.render((performance.now() - t0) / 1000, 0.6);
    requestAnimationFrame(artLoop);
  };
  let measuring = false;

  root.append(h('div', { class: 'stack' },
    h('div', { class: 'hero ai' }, sub, big, status, h('div', { style: { marginTop: '12px' } }, prog.el)),
    h('div', { class: 'card stack', style: { gap: '10px' } }, h('span', { class: 'lbl' }, L('Dauer je Test', 'Duration per test')), durSeg.el, h('div', { class: 'row' }, startBtn, stopBtn)),
    tl.el, chk.el, lg.el,
    h('div', { class: 'card stack', style: { gap: '10px' } },
      h('h2', null, L('Bildgenerierung', 'Image generation')),
      h('p', { class: 'sub small' }, L('Ein neuronales Netz (6 Schichten, 16 Neuronen) berechnet die Farbe jedes Pixels – auf der GPU, 60-mal pro Sekunde.', 'A neural network (6 layers, 16 neurons) computes every pixel\'s colour – on the GPU, 60 times per second.')),
      art, artInfo, h('div', { class: 'row' }, motifBtn, measureBtn)),
    artTiles.el));
  newArt();
  requestAnimationFrame(artLoop);

  const offHidden = onHidden(() => { if (startBtn.disabled) { hidden = true; stop = true; pool?.cancel(); } });

  async function run() {
    stop = false; hidden = false;
    sfx.start();
    startBtn.disabled = true; stopBtn.disabled = false; durSeg.enable(false);
    setBusy(true, L('KI-Leistung', 'AI performance')); void stayAwake(true);
    tl.reset(); lg.clear(); chk.clear(); prog.set(0); big.textContent = '–';
    const res: Record<string, { g: number; ok: boolean }> = {};
    try {
      const off = document.createElement('canvas');
      off.width = off.height = 1;
      gemm = new GemmGpu(off);
      lg.add(`GPU: ${gemm.gpu}`);
      const parts: [string, boolean, number][] = [['fp16', true, 1024], ['fp32', false, 1024]];
      let idx = 0;
      for (const [name, fp16, n] of parts) {
        if (stop) break;
        status.textContent = L(`GPU ${name.toUpperCase()}: ${n}×${n}-Matrizen …`, `GPU ${name.toUpperCase()}: ${n}×${n} matrices …`);
        const r = await gemm.run(n, fp16, seconds, (g, f) => { tl.set(name === 'fp16' ? T.fp16 : T.fp32, fmtFlops(g)); prog.set((idx + f) / 3); if (fp16) big.textContent = N(g); }, () => stop);
        res[name] = { g: r.gflops, ok: r.ok };
        tl.set(name === 'fp16' ? T.fp16 : T.fp32, fmtFlops(r.gflops));
        lg.add(`GPU ${name.toUpperCase()}: ${fmtFlops(r.gflops)} · ${N(r.passes)} ${L('Durchläufe', 'passes')} · ${L('Ergebnis', 'result')} ${r.ok ? L('exakt ✓', 'exact ✓') : L('falsch ✗', 'wrong ✗')}`);
        idx++;
      }
      gemm.dispose(); gemm = null;
      if (!stop) {
        status.textContent = L(`CPU FP32 auf ${cores()} Kernen …`, `CPU FP32 on ${cores()} cores …`);
        pool = new MathPool(cores());
        const n = 384, rows = Math.ceil(n / pool.size);
        let tick = 0;
        const timer = setInterval(() => prog.set((2 + Math.min(1, (tick++ * 0.25) / seconds)) / 3), 250);
        const rs: any[] = await Promise.all(Array.from({ length: pool.size }, (_, i) => pool!.run({ type: 'gemm', n, seconds, row0: i * rows, rows: Math.max(0, Math.min(rows, n - i * rows)) })));
        clearInterval(timer);
        const flops = rs.reduce((s, r) => s + r.flops / r.seconds, 0) / 1e9;
        res.cpu = { g: flops, ok: rs.every(r => r.ok) };
        tl.set(T.cpu, fmtFlops(flops));
        lg.add(`CPU FP32: ${fmtFlops(flops)} · ${res.cpu.ok ? L('exakt ✓', 'exact ✓') : L('falsch ✗', 'wrong ✗')}`);
        pool.dispose(); pool = null;
      }
      prog.set(1);
      if (res.fp16 && res.fp32) tl.set(T.ratio, `${F(res.fp16.g / res.fp32.g, 2)}×`);
      const ok = Object.values(res).every(r => r.ok);
      const complete = !stop && !!res.fp16 && !!res.fp32 && !!res.cpu;
      status.textContent = complete ? L('Fertig', 'Done') : L('Abgebrochen', 'Aborted');
      if (hidden) lg.add(L('Die App war im Hintergrund – Lauf abgebrochen.', 'The app went to the background – run aborted.'));
      if (Object.keys(res).length) chk.set(ok ? L('Alle Ergebnisse exakt (Werte aus {−1, 0, 1}, 64 Stichproben je Test) ✓', 'All results exact (values from {−1, 0, 1}, 64 samples per test) ✓') : L('Rechenfehler gefunden!', 'Calculation errors found!'), ok);
      if (complete && ok) {
        big.textContent = N(res.fp16.g);
        addScore({
          kind: 'ai', time: new Date().toISOString(), device: 'gpu', score: Math.round(res.fp16.g * 10) / 10, unit: 'GFLOPS', points: Math.round(res.fp16.g),
          precision: 'FP16', detail: `FP32 ${fmtFlops(res.fp32.g)}, CPU ${fmtFlops(res.cpu.g)}`, model: `${deviceName()} · ${lgGpu(lg)}`, version: VERSION, valid: true,
        });
        resultShow({
          title: L('KI-Leistung', 'AI performance'), value: Math.round(res.fp16.g), unit: 'GFLOPS · FP16', kind: 'ai', device: deviceName(),
          lines: [['GPU FP16', fmtFlops(res.fp16.g)], ['GPU FP32', fmtFlops(res.fp32.g)], [L('CPU FP32', 'CPU FP32'), fmtFlops(res.cpu.g)]],
        });
      }
    } catch (e: any) {
      status.textContent = isCancel(e) ? L('Abgebrochen', 'Aborted') : L('Fehler', 'Error');
      if (!isCancel(e)) lg.add(String(e?.message ?? e));
    } finally {
      gemm?.dispose(); gemm = null;
      pool?.dispose(); pool = null;
      startBtn.disabled = false; stopBtn.disabled = true; durSeg.enable(true);
      setBusy(false); void stayAwake(false);
    }
  }

  async function measureArt() {
    if (!na || measuring) return;
    measuring = true; measureBtn.disabled = true;
    try {
      const v = na.verify(1.234);
      let px = 0, batch = 2;
      const ts = performance.now();
      while (performance.now() - ts < 4000) {
        const tb = performance.now();
        px += na.renderOffscreen((tb - ts) / 1000, batch);
        if (performance.now() - tb < 30) batch++;
        await yieldNow();
      }
      const secs = (performance.now() - ts) / 1000;
      artTiles.set(L('Pixel pro Sekunde', 'Pixels per second'), `${F(px / secs / 1e6, 1)} ${L('Mio.', 'M')}`);
      artTiles.set('GFLOPS', F((px / secs) * CPPN_FLOPS_PER_PIXEL / 1e9, 0));
      artTiles.set(L('Prüfung', 'Check'), v.ok ? '✓' : `✗ ${F(v.maxErr * 255, 1)}/255`);
      artTiles.set(L('Netz', 'Network'), `${N(CPPN_FLOPS_PER_PIXEL)} ${L('Ops/Pixel', 'ops/pixel')}`);
    } finally { measuring = false; measureBtn.disabled = false; }
  }

  return () => { artAlive = false; stop = true; offHidden(); na?.dispose(); gemm?.dispose(); pool?.dispose(); void stayAwake(false); };
}

function lgGpu(lg: ReturnType<typeof log>) {
  const m = /GPU: (.*)/.exec(lg.el.textContent ?? '');
  return m ? m[1].split('\n')[0] : 'GPU';
}
