// Seite „Mathe-Labor“: π, Fibonacci (+ Fibonacci-Primzahlen), N-Körper (GPU/CPU), Collatz.
import { FIB_PRIME_KNOWN } from '../core/bigmath';
import { F, L, N, rate, time, tr } from '../core/i18n';
import { buzz, cores, deviceName, shareFile, stayAwake } from '../core/native';
import { onHidden, setBusy } from '../core/nav';
import { MathPool, isCancel } from '../core/pool';
import { VERSION, ScoreEntry, addScore } from '../core/store';
import { EPS2, FLOPS_PER_INTERACTION, NBodyGpu, SCENARIOS, accelRef, energy, initBodies, mvp } from '../gl/nbody';
import { Prog, createGL } from '../gl/glutil';
import { barChart, checkBox, field, fitCanvas, h, log, progress, seg, select, tiles, toast, toggle, yieldNow } from '../ui/dom';
import { showHelp } from '../ui/help';

type Task = 'pi' | 'fib' | 'nbody' | 'collatz';
let lastTask: Task = 'pi';

export function mountLab(root: HTMLElement) {
  let pool: MathPool | null = null;
  const getPool = () => (pool ??= new MathPool(cores()));
  let stopFn: (() => void) | null = null;
  let cleanupVis: (() => void) | null = null;
  let hiddenAbort = false;

  const body = h('div', { class: 'stack' });
  const taskSeg = seg<Task>([['pi', 'π'], ['fib', 'Fibonacci'], ['nbody', L('N-Körper', 'N-body')], ['collatz', 'Collatz']], lastTask, t => { lastTask = t; build(); });
  const helpLink = h('button', { class: 'btn', style: { minHeight: '40px', padding: '8px 14px', fontSize: '14px' }, onclick: () => showHelp(lastTask) }, L('Was ist das?', 'What is this?'));
  root.append(h('div', { class: 'stack' }, taskSeg.el, body));

  const offHidden = onHidden(() => { if (stopFn) { hiddenAbort = true; stopFn(); } });

  // gemeinsame Bausteine je Aufgabe
  function frame(titles: string[], settingsEl: HTMLElement, vis: HTMLElement | null, onStart: (ui: Ui) => Promise<void>) {
    const tl = tiles(titles);
    const prog = progress();
    const status = h('div', { class: 'sub small' }, L('Bereit', 'Ready'));
    const lg = log();
    const chk = checkBox();
    const startBtn = h('button', { class: 'btn primary' }, L('Start', 'Start'));
    const stopBtn = h('button', { class: 'btn stop', disabled: true, onclick: () => stopFn?.() }, L('Stopp', 'Stop'));
    const ui: Ui = { tl, prog, status, lg, chk };
    startBtn.onclick = async () => {
      startBtn.disabled = true; stopBtn.disabled = false; taskSeg.enable(false);
      settingsEl.style.opacity = '.5'; settingsEl.style.pointerEvents = 'none';
      tl.reset(); prog.set(0); lg.clear(); chk.clear(); hiddenAbort = false;
      setBusy(true, L('Mathe-Labor', 'Math lab')); void stayAwake(true);
      try { await onStart(ui); }
      catch (e: any) {
        if (isCancel(e) || e?.message === 'stopped') { status.textContent = L('Abgebrochen', 'Aborted'); if (hiddenAbort) lg.add(L('Die App war im Hintergrund – Lauf abgebrochen.', 'The app went to the background – run aborted.')); }
        else { status.textContent = L('Fehler', 'Error'); lg.add(tr(String(e?.message ?? e))); }
      } finally {
        stopFn = null;
        startBtn.disabled = false; stopBtn.disabled = true; taskSeg.enable(true);
        settingsEl.style.opacity = ''; settingsEl.style.pointerEvents = '';
        setBusy(false); void stayAwake(false);
      }
    };
    body.append(
      h('div', { class: 'card stack', style: { gap: '10px' } }, settingsEl, h('div', { class: 'row' }, startBtn, stopBtn), prog.el, status),
      tl.el, vis ?? '', chk.el, lg.el, h('div', null, helpLink));
  }

  function build() {
    cleanupVis?.(); cleanupVis = null;
    body.innerHTML = '';
    ({ pi: buildPi, fib: buildFib, nbody: buildNBody, collatz: buildCollatz } as Record<Task, () => void>)[lastTask]();
  }

  // ------------------------------------------------------------------------------------------- π
  function buildPi() {
    let digits = 100_000, save = false;
    const settingsEl = h('div', { class: 'stack', style: { gap: '8px' } },
      field(L('Nachkommastellen', 'Decimal digits'), select<number>([[10_000, '10.000'], [100_000, '100.000'], [1_000_000, L('1 Million', '1 million')], [2_000_000, L('2 Millionen', '2 million')]].map(([v, l]) => [v as number, isEnLabel(l as string)]), digits, v => (digits = v))),
      toggle(L('Ziffern als Datei teilen', 'Share digits as file'), false, v => (save = v)));
    const walk = h('canvas', { class: 'vis', style: { height: '240px' } });
    const freq = h('canvas', { class: 'vis', style: { height: '110px' } });
    const T = { time: L('Rechenzeit', 'Time'), rate: L('Stellen pro Sekunde', 'Digits per second'), digits: L('Stellen', 'Digits'), check: L('Prüfung', 'Check') };
    frame([T.time, T.rate, T.digits, T.check], settingsEl, h('div', { class: 'stack', style: { gap: '10px' } }, walk, freq), async ui => {
      const p = getPool();
      stopFn = () => p.cancel();
      ui.lg.add(L(`π auf ${N(digits)} Nachkommastellen (Chudnovsky) …`, `π to ${N(digits)} decimal digits (Chudnovsky) …`));
      const phases: Record<string, string> = { series: L('Reihe (Binary Splitting)', 'Series (binary splitting)'), sqrt: L('Wurzel √10005 (Newton)', 'Square root √10005 (Newton)'), div: L('Division', 'Division'), digits: L('Ziffern', 'Digits') };
      const r: any = await p.run({ type: 'pi', digits }, (f, ph) => { ui.prog.set(f); ui.status.textContent = phases[ph] ?? ph; });
      let ok = r.verified;
      if (digits === 1_000_000) {
        const tail = r.fraction.endsWith('5779458151');
        ui.lg.add(L(`Bekannte Endziffern der 1. Million „…5779458151“: ${tail ? '✓' : '✗'}`, `Known last digits of the first million "…5779458151": ${tail ? '✓' : '✗'}`));
        ok &&= tail;
      }
      ui.prog.set(1);
      ui.status.textContent = L('Fertig', 'Done');
      ui.tl.set(T.time, `${F(r.seconds, 2)} s`);
      ui.tl.set(T.rate, rate(digits / r.seconds / 1e6));
      ui.tl.set(T.digits, N(digits));
      ui.tl.set(T.check, ok ? L('✓ korrekt', '✓ correct') : L('✗ Fehler', '✗ error'));
      const n = Math.min(digits, 10_000);
      ui.chk.set(ok ? L(`Ganzteil 3 ✓, erste ${N(n)} Stellen = Machin-Formel ✓`, `Integer part 3 ✓, first ${N(n)} digits = Machin formula ✓`) : L('Kontrolle fehlgeschlagen!', 'Check failed!'), ok);
      ui.lg.add(`3,${r.fraction.slice(0, 50)}…`);
      ui.lg.add(`…${r.fraction.slice(-50)}`);
      const counts = new Array(10).fill(0);
      for (let i = 0; i < r.fraction.length; i++) counts[r.fraction.charCodeAt(i) - 48]++;
      barChart(freq, counts, counts.map((_, i) => String(i)), '#2f9bff', digits / 10);
      drawPiWalk(walk, r.fraction);
      if (ok) save1({ kind: 'pi', device: 'cpu', threads: 1, score: round(digits / r.seconds / 1e6, 3), unit: L('Mio. Stellen/s', 'M digits/s'), durationS: round(r.seconds, 3), numbers: digits, detail: `${N(digits)} ${L('Stellen', 'digits')}` });
      if (save) await shareFile(`pi_${digits}.txt`, '3.' + r.fraction, 'π');
    });
  }

  // ------------------------------------------------------------------------------------------- Fibonacci
  function buildFib() {
    let task: 'fib' | 'prime' = 'fib', n = 1_000_000, limit = 5000, save = false;
    const nSel = field('n', select<number>([[100_000, 'F(100.000)'], [1_000_000, 'F(1 Mio.)'], [10_000_000, 'F(10 Mio.)'], [30_000_000, 'F(30 Mio.)']].map(([v, l]) => [v as number, isEnLabel(l as string)]), n, v => (n = v)));
    const limSel = field(L('Suche bis Index n', 'Search up to index n'), select<number>([[1000, '1.000'], [5000, '5.000'], [12000, '12.000'], [30000, '30.000']].map(([v, l]) => [v as number, isEnLabel(l as string)]), limit, v => (limit = v)));
    const saveTg = toggle(L('Zahl als Datei teilen', 'Share number as file'), false, v => (save = v));
    limSel.hidden = true;
    const settingsEl = h('div', { class: 'stack', style: { gap: '8px' } },
      seg<'fib' | 'prime'>([['fib', L('F(n) berechnen', 'Compute F(n)')], ['prime', L('Fibonacci-Primzahlen', 'Fibonacci primes')]], task, v => { task = v; nSel.hidden = v !== 'fib'; saveTg.hidden = v !== 'fib'; limSel.hidden = v !== 'prime'; }).el,
      nSel, limSel, saveTg);
    const sun = h('canvas', { class: 'vis', style: { height: '260px' } });
    let found: number[] = [];
    const drawSun = () => drawSunflower(sun, found);
    requestAnimationFrame(drawSun);
    const T = { time: L('Rechenzeit', 'Time'), digits: L('Stellen', 'Digits'), rate: L('Stellen pro Sekunde', 'Digits per second'), check: L('Prüfung', 'Check'), found: L('Gefunden', 'Found'), tested: L('Getestete Indizes', 'Indices tested') };
    frame([T.time, T.digits, T.rate, T.check], settingsEl, sun, async ui => {
      const p = getPool();
      stopFn = () => p.cancel();
      if (task === 'fib') {
        ui.tl.relabel(T.digits, T.digits); ui.tl.relabel(T.rate, T.rate);
        ui.lg.add(L(`F(${N(n)}) per Fast Doubling …`, `F(${N(n)}) by fast doubling …`));
        const r: any = await p.run({ type: 'fib', n, keep: save }, f => { ui.prog.set(f); ui.status.textContent = L('Rechnet …', 'Computing …'); });
        ui.prog.set(1); ui.status.textContent = L('Fertig', 'Done');
        ui.tl.set(T.time, `${F(r.seconds, 3)} s`); ui.tl.set(T.digits, N(r.digitCount)); ui.tl.set(T.rate, rate(r.digitCount / Math.max(r.seconds, 1e-6) / 1e6));
        ui.tl.set(T.check, r.verified ? L('✓ korrekt', '✓ correct') : L('✗ Fehler', '✗ error'));
        ui.chk.set(r.verified ? L('F(n) mod 3 Primzahlen (61 Bit) ✓, Stellenzahl ≈ n·log₁₀φ ✓', 'F(n) mod 3 primes (61 bit) ✓, digit count ≈ n·log₁₀φ ✓') : L('Kontrolle fehlgeschlagen!', 'Check failed!'), r.verified);
        ui.lg.add(L(`F(${N(n)}) hat ${N(r.digitCount)} Stellen`, `F(${N(n)}) has ${N(r.digitCount)} digits`));
        ui.lg.add(L('Anfang: ', 'Start: ') + r.head + '…');
        ui.lg.add(L('Ende:   …', 'End:   …') + r.tail);
        if (r.verified) save1({ kind: 'fib', device: 'cpu', threads: 1, score: round(r.digitCount / Math.max(r.seconds, 1e-6) / 1e6, 3), unit: L('Mio. Stellen/s', 'M digits/s'), durationS: round(r.seconds, 3), numbers: n, detail: `F(${N(n)}), ${N(r.digitCount)} ${L('Stellen', 'digits')}` });
        if (save && r.value) await shareFile(`fibonacci_${n}.txt`, r.value, 'Fibonacci');
      } else {
        // Indizes: 4 und alle Primzahlen ≥ 3 (F(a) teilt F(ab) → sonst nie prim); große zuerst verteilen
        const comp = new Uint8Array(limit + 1);
        const idx: number[] = [4];
        for (let i = 2; i <= limit; i++) { if (comp[i]) continue; if (i >= 3) idx.push(i); for (let j = i * i; j <= limit; j += i) comp[j] = 1; }
        idx.sort((a, b) => b - a);
        const chunks: number[][] = [];
        for (let i = 0; i < idx.length; i += 8) chunks.push(idx.slice(i, i + 8));
        ui.tl.relabel(T.digits, T.found); ui.tl.relabel(T.rate, L('Per Teilertest ausgeschlossen', 'Ruled out by divisor test'));
        ui.lg.add(L(`Suche Fibonacci-Primzahlen F(n) bis n = ${N(limit)} auf ${p.size} Threads …`, `Searching Fibonacci primes F(n) up to n = ${N(limit)} on ${p.size} threads …`));
        const t0 = performance.now();
        let done = 0, trial = 0;
        found = [];
        await Promise.all(chunks.map(c => p.run({ type: 'fibprimes', indices: c, bound: 2_000_000 }).then((r: any) => {
          done += r.tested; trial += r.trial;
          for (const [fn, d] of r.found) { found.push(fn); ui.lg.add(L(`Fibonacci-Primzahl: F(${N(fn)}) mit ${N(d)} Stellen`, `Fibonacci prime: F(${N(fn)}) with ${N(d)} digits`)); }
          ui.prog.set(done / idx.length);
          ui.status.textContent = `${N(done)} / ${N(idx.length)} ${L('Indizes', 'indices')}`;
          ui.tl.set(T.time, `${F((performance.now() - t0) / 1000, 1)} s`);
          ui.tl.set(T.digits, String(found.length));
          drawSun();
        })));
        const secs = (performance.now() - t0) / 1000;
        found.sort((a, b) => a - b);
        const expected = FIB_PRIME_KNOWN.filter(k => k <= limit);
        const ok = JSON.stringify(found) === JSON.stringify(expected);
        ui.prog.set(1); ui.status.textContent = L('Fertig', 'Done');
        ui.tl.set(T.time, `${F(secs, 1)} s`); ui.tl.set(T.digits, String(found.length));
        ui.tl.set(T.rate, N(trial));
        ui.tl.set(T.check, ok ? L('✓ korrekt', '✓ correct') : L('✗ Fehler', '✗ error'));
        ui.chk.set(ok ? L(`alle ${expected.length} bekannten Fibonacci-Primzahlen bis n = ${N(limit)} gefunden, keine falschen ✓ (OEIS A001605)`, `all ${expected.length} known Fibonacci primes up to n = ${N(limit)} found, no false ones ✓ (OEIS A001605)`)
          : L(`Abweichung von OEIS A001605! erwartet ${expected.join(', ')}`, `Mismatch with OEIS A001605! expected ${expected.join(', ')}`), ok);
        ui.lg.add(L('Indizes: ', 'Indices: ') + found.join(', '));
        drawSun();
        if (ok) save1({ kind: 'fibprime', device: 'cpu', threads: p.size, score: round(secs, 2), unit: 's', durationS: round(secs, 2), numbers: limit, detail: L(`bis n = ${N(limit)}, ${found.length} gefunden`, `up to n = ${N(limit)}, ${found.length} found`) });
      }
    });
  }

  // ------------------------------------------------------------------------------------------- N-Körper
  function buildNBody() {
    let dev: 'gpu' | 'cpu' = 'gpu', nG = 8192, nC = 2048, secs = 30, scene = 0;
    const cam = { yaw: 0.4, pitch: 0.5, dist: 26 };
    const nGpu = field(L('Körper', 'Bodies'), select<number>([[2048, '2.048'], [4096, '4.096'], [8192, '8.192'], [16384, '16.384'], [32768, '32.768']].map(([v, l]) => [v as number, isEnLabel(l as string)]), nG, v => (nG = v)));
    const nCpu = field(L('Körper', 'Bodies'), select<number>([[1024, '1.024'], [2048, '2.048'], [4096, '4.096']].map(([v, l]) => [v as number, isEnLabel(l as string)]), nC, v => (nC = v)));
    nCpu.hidden = true;
    const settingsEl = h('div', { class: 'stack', style: { gap: '8px' } },
      seg<'gpu' | 'cpu'>([['gpu', 'GPU'], ['cpu', L('CPU (alle Kerne)', 'CPU (all cores)')]], dev, v => { dev = v; nGpu.hidden = v !== 'gpu'; nCpu.hidden = v !== 'cpu'; }).el,
      h('div', { class: 'grid2' }, h('div', null, nGpu, nCpu), field(L('Dauer', 'Duration'), select<number>([[15, '15 s'], [30, '30 s'], [60, '60 s'], [0, L('endlos', 'endless')]], secs, v => (secs = v)))),
      field(L('Szenario', 'Scenario'), select<number>(SCENARIOS.map((s, i) => [i, L(s[0], s[1])]), scene, v => (scene = v))));
    // jeder Lauf bekommt eine frische Leinwand (ein verlorener WebGL-Kontext lässt sich nicht neu anlegen)
    let canvas = h('canvas', { class: 'vis', style: { height: '340px' } });
    const freshCanvas = () => { const f = canvas.cloneNode() as HTMLCanvasElement; canvas.replaceWith(f); canvas = f; orbitControls(f, cam); return f; };
    const T = { gflops: 'GFLOPS', forces: L('Kräfte pro Sekunde', 'Forces per second'), steps: L('Zeitschritte', 'Time steps'), energy: L('Energie-Abweichung', 'Energy drift') };
    // Kamera (Finger): drehen + zoomen
    orbitControls(canvas, cam);
    let preview: (() => void) | null = drawPreview(canvas, cam, () => scene);
    cleanupVis = () => preview?.();
    frame([T.gflops, T.forces, T.steps, T.energy], settingsEl, canvas, async ui => {
      preview?.(); preview = null;
      cleanupVis?.(); cleanupVis = null;
      if (dev === 'gpu') await nbodyGpu(ui, freshCanvas(), cam, nG, secs, scene);
      else await nbodyCpu(ui, freshCanvas(), cam, nC, secs, scene);
    });

    async function nbodyGpu(ui: Ui, c: HTMLCanvasElement, cam: Cam, n: number, seconds: number, sc: number) {
      const sim = new NBodyGpu(c, n, sc);
      cleanupVis = () => sim.dispose();
      let stop = false;
      stopFn = () => { stop = true; };
      ui.lg.add(L(`N-Körper „${L(SCENARIOS[sc][0], SCENARIOS[sc][1])}“: ${N(n)} Körper auf der GPU (${sim.gpu}) …`, `N-body "${SCENARIOS[sc][1]}": ${N(n)} bodies on the GPU (${sim.gpu}) …`));
      const v = sim.verify();
      ui.lg.add(L(`Kraft-Kontrolle (128 Körper gegen double): max. Fehler ${v.err.toExponential(1)} ${v.ok ? '✓' : '✗'}`, `Force check (128 bodies vs double): max error ${v.err.toExponential(1)} ${v.ok ? '✓' : '✗'}`));
      const doEnergy = n <= 8192;
      let e0 = 0;
      if (doEnergy) { const s0 = sim.read(); e0 = energy(s0.pos, s0.vel); }
      sim.steps = 0;
      const t0 = performance.now();
      let k = 1, el = 0, lastShow = -1;
      const endless = seconds === 0;
      while (!stop && (endless || el < seconds)) {
        const tb = performance.now();
        sim.run(k);
        sim.sync();
        const dt = (performance.now() - tb) / 1000;
        if (dt < 0.012 && k < 64) k *= 2; else if (dt > 0.04 && k > 1) k >>= 1;
        el = (performance.now() - t0) / 1000;
        if (el - lastShow < 1 / 60) { await yieldNow(); continue; }
        lastShow = el;
        sim.yaw = cam.yaw; sim.pitch = cam.pitch; sim.dist = cam.dist;
        sim.render();
        await yieldNow();
        const ips = (n * n * sim.steps) / el;
        ui.prog.set(endless ? (el % 60) / 60 : el / seconds);
        ui.status.textContent = endless ? L(`Endlos · ${time(el)}`, `Endless · ${time(el)}`) : `${L('Simulation', 'Simulation')} · ${Math.floor(el)} / ${seconds} s`;
        ui.tl.set(T.gflops, N((ips * FLOPS_PER_INTERACTION) / 1e9));
        ui.tl.set(T.forces, rate(ips / 1e6));
        ui.tl.set(T.steps, N(sim.steps));
      }
      const total = (performance.now() - t0) / 1000;
      const gflops = ((n * n * sim.steps) / total) * FLOPS_PER_INTERACTION / 1e9;
      let drift = 0;
      if (doEnergy) {
        ui.status.textContent = L('Energie-Kontrolle', 'Energy check');
        await yieldNow();
        const s1 = sim.read();
        drift = Math.abs((energy(s1.pos, s1.vel) - e0) / e0) * 100;
        ui.tl.set(T.energy, `${F(drift, 3)} %`);
      } else ui.tl.set(T.energy, L('n. geprüft', 'not checked'));
      const ok = v.ok && drift < 1;
      const full = !stop && !endless;
      ui.prog.set(1); ui.status.textContent = stop ? L('Gestoppt', 'Stopped') : L('Fertig', 'Done');
      ui.chk.set(L(`Kräfte ✓ (Fehler ${v.err.toExponential(1)})`, `Forces ✓ (error ${v.err.toExponential(1)})`) + (doEnergy ? L(`, Energieerhaltung ${drift < 1 ? '✓' : '✗'} (${F(drift, 3)} %)`, `, energy conservation ${drift < 1 ? '✓' : '✗'} (${F(drift, 3)} %)`) : L(', Energie bei > 8.192 Körpern nicht geprüft', ', energy not checked above 8,192 bodies')), ok);
      ui.lg.add(L(`Ergebnis: ${N(gflops)} GFLOPS, ${N(sim.steps)} Schritte in ${F(total, 1)} s`, `Result: ${N(gflops)} GFLOPS, ${N(sim.steps)} steps in ${F(total, 1)} s`));
      if (ok && full) save1({ kind: 'nbody', device: 'gpu', score: round(gflops, 1), unit: 'GFLOPS', durationS: round(total, 1), numbers: n, model: sim.gpu, detail: `${N(n)} ${L('Körper', 'bodies')}, ${L(SCENARIOS[sc][0], SCENARIOS[sc][1])}` });
      // weiter anzeigen, bis die Seite verlassen wird
      let alive = true;
      const loop = () => { if (!alive) return; sim.yaw = cam.yaw; sim.pitch = cam.pitch; sim.dist = cam.dist; sim.render(); requestAnimationFrame(loop); };
      loop();
      cleanupVis = () => { alive = false; sim.dispose(); };
    }

    async function nbodyCpu(ui: Ui, c: HTMLCanvasElement, cam: Cam, n: number, seconds: number, sc: number) {
      const p = getPool();
      const { pos, vel } = initBodies(n, sc);
      const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), m = new Float32Array(n);
      const vx = new Float32Array(n), vy = new Float32Array(n), vz = new Float32Array(n);
      for (let i = 0; i < n; i++) { x[i] = pos[4 * i]; y[i] = pos[4 * i + 1]; z[i] = pos[4 * i + 2]; m[i] = pos[4 * i + 3]; vx[i] = vel[4 * i]; vy[i] = vel[4 * i + 1]; vz[i] = vel[4 * i + 2]; }
      let stop = false;
      stopFn = () => { stop = true; };
      ui.lg.add(L(`N-Körper: ${N(n)} Körper auf ${p.size} CPU-Kernen …`, `N-body: ${N(n)} bodies on ${p.size} CPU cores …`));
      for (let i = 0; i < p.size; i++) await p.runOn(i, { type: 'nbody-init', x, y, z, mass: m, eps2: EPS2 });
      const parts = p.size, chunk = Math.ceil(n / parts), dt = 0.01;
      const accel = async () => {
        const ax = new Float32Array(n), ay = new Float32Array(n), az = new Float32Array(n);
        await Promise.all(Array.from({ length: parts }, (_, k) => p.runOn(k, { type: 'nbody-acc', x, y, z, i0: k * chunk, i1: Math.min(n, (k + 1) * chunk) }).then((r: any) => {
          ax.set(r.ax, r.i0); ay.set(r.ay, r.i0); az.set(r.az, r.i0);
        })));
        return [ax, ay, az];
      };
      // Kraft-Kontrolle
      const [ax0, ay0, az0] = await accel();
      let worst = 0;
      for (let s = 0; s < 64; s++) {
        const i = (s * 7919) % n;
        const ref = accelRef(pos, i);
        const mag = Math.hypot(ref[0], ref[1], ref[2]);
        worst = Math.max(worst, Math.hypot(ax0[i] - ref[0], ay0[i] - ref[1], az0[i] - ref[2]) / Math.max(mag, 1e-6));
      }
      const fok = worst < 5e-3;
      ui.lg.add(L(`Kraft-Kontrolle: max. Fehler ${worst.toExponential(1)} ${fok ? '✓' : '✗'}`, `Force check: max error ${worst.toExponential(1)} ${fok ? '✓' : '✗'}`));
      const packed = () => { const P = new Float32Array(n * 4), V = new Float32Array(n * 4); for (let i = 0; i < n; i++) { P[4 * i] = x[i]; P[4 * i + 1] = y[i]; P[4 * i + 2] = z[i]; P[4 * i + 3] = m[i]; V[4 * i] = vx[i]; V[4 * i + 1] = vy[i]; V[4 * i + 2] = vz[i]; V[4 * i + 3] = vel[4 * i + 3]; } return [P, V]; };
      const [P0, V0] = packed();
      const e0 = energy(P0, V0);
      const view = new PointView(c, n);
      cleanupVis = () => view.dispose();
      const t0 = performance.now();
      let steps = 0, el = 0, lastDraw = 0;
      const endless = seconds === 0;
      while (!stop && (endless || el < seconds)) {
        const [ax, ay, az] = await accel();
        for (let i = 0; i < n; i++) { vx[i] += ax[i] * dt; vy[i] += ay[i] * dt; vz[i] += az[i] * dt; x[i] += vx[i] * dt; y[i] += vy[i] * dt; z[i] += vz[i] * dt; }
        steps++;
        el = (performance.now() - t0) / 1000;
        const ips = (n * n * steps) / el;
        if (el - lastDraw > 1 / 30) {
          lastDraw = el;
          view.draw(x, y, z, vel, cam);
          ui.prog.set(endless ? (el % 60) / 60 : el / seconds);
          ui.status.textContent = endless ? L(`Endlos · ${time(el)}`, `Endless · ${time(el)}`) : `${L('Simulation', 'Simulation')} · ${Math.floor(el)} / ${seconds} s`;
          ui.tl.set(T.gflops, F((ips * FLOPS_PER_INTERACTION) / 1e9, 1));
          ui.tl.set(T.forces, rate(ips / 1e6));
          ui.tl.set(T.steps, N(steps));
        }
        await yieldNow();
      }
      const total = (performance.now() - t0) / 1000;
      const gflops = ((n * n * steps) / total) * FLOPS_PER_INTERACTION / 1e9;
      const [P1, V1] = packed();
      const drift = Math.abs((energy(P1, V1) - e0) / e0) * 100;
      ui.tl.set(T.energy, `${F(drift, 3)} %`);
      const ok = fok && drift < 1, full = !stop && !endless;
      ui.prog.set(1); ui.status.textContent = stop ? L('Gestoppt', 'Stopped') : L('Fertig', 'Done');
      ui.chk.set(L(`Kräfte ${fok ? '✓' : '✗'}, Energieerhaltung ${drift < 1 ? '✓' : '✗'} (${F(drift, 3)} %)`, `Forces ${fok ? '✓' : '✗'}, energy conservation ${drift < 1 ? '✓' : '✗'} (${F(drift, 3)} %)`), ok);
      ui.lg.add(L(`Ergebnis: ${F(gflops, 1)} GFLOPS, ${N(steps)} Schritte`, `Result: ${F(gflops, 1)} GFLOPS, ${N(steps)} steps`));
      if (ok && full) save1({ kind: 'nbody', device: 'cpu', threads: p.size, score: round(gflops, 2), unit: 'GFLOPS', durationS: round(total, 1), numbers: n, detail: `${N(n)} ${L('Körper', 'bodies')}, CPU` });
    }
  }

  // ------------------------------------------------------------------------------------------- Collatz
  const RECORDS: [number, number, number][] = [
    [1_000_000, 837_799, 524], [10_000_000, 8_400_511, 685], [100_000_000, 63_728_127, 949],
    [1_000_000_000, 670_617_279, 986], [10_000_000_000, 9_780_657_630, 1132],
  ];
  function buildCollatz() {
    let secs = 60;
    const settingsEl = h('div', { class: 'stack', style: { gap: '8px' } },
      field(L('Dauer', 'Duration'), select<number>([[30, '30 s'], [60, '60 s'], [180, '3 min'], [0, L('endlos', 'endless')]], secs, v => (secs = v))),
      h('div', { class: 'muted small' }, L(`Alle Startwerte ab 1, verteilt auf ${cores()} Kerne.`, `All start values from 1, spread over ${cores()} cores.`)));
    const hist = h('canvas', { class: 'vis', style: { height: '150px' } });
    const T = { upto: L('Geprüft bis', 'Checked up to'), rate: L('Startwerte pro Sekunde', 'Start values per second'), best: L('Längste Folge', 'Longest sequence'), checks: L('Kontrollen', 'Checks') };
    frame([T.upto, T.rate, T.best, T.checks], settingsEl, hist, async ui => {
      const p = getPool();
      let stop = false;
      stopFn = () => { stop = true; };
      const BINS = 1024;
      const histo = new Float64Array(BINS);
      let next = 2, best = 0, bestN = 1, ordered = 2, overflows = 0;
      const recordLog: [number, number][] = [[1, 0]];
      const pending = new Map<number, any>();
      const batch = 1 << 19;
      const t0 = performance.now();
      let el = 0, shownChecks = 0, lastUi = 0;
      const endless = secs === 0;
      const checks: [number, boolean, number, number][] = [];
      const take = () => {
        let count = batch;
        for (const [lim] of RECORDS) if (next < lim && next + count > lim) { count = lim - next; break; }
        const s = next; next += count;
        return [s, count] as const;
      };
      const process = () => {
        while (pending.has(ordered)) {
          const r = pending.get(ordered); pending.delete(ordered);
          for (let i = 0; i < BINS; i++) histo[i] += r.hist[i];
          overflows += r.overflows;
          if (r.best > best) { best = r.best; bestN = r.bestN; recordLog.push([bestN, best]); if (bestN > 1000) ui.lg.add(L(`Neuer Rekord: ${N(bestN)} braucht ${best} Schritte`, `New record: ${N(bestN)} takes ${best} steps`)); }
          ordered = r.start + r.count;
          for (; shownChecks < RECORDS.length && ordered >= RECORDS[shownChecks][0]; shownChecks++) {
            const [lim, rn, rs] = RECORDS[shownChecks];
            let b: [number, number] = [0, 0];
            for (const rec of recordLog) if (rec[0] < lim && rec[1] > b[1]) b = rec;
            const ok = b[0] === rn && b[1] === rs;
            checks.push([lim, ok, b[0], b[1]]);
            ui.lg.add(L(`Kontrolle < ${N(lim)}: ${N(b[0])} mit ${b[1]} Schritten ${ok ? '✓' : `✗ erwartet ${N(rn)}/${rs}`}`, `Check < ${N(lim)}: ${N(b[0])} with ${b[1]} steps ${ok ? '✓' : `✗ expected ${N(rn)}/${rs}`}`));
          }
        }
      };
      const worker = async () => {
        while (!stop && (endless || (performance.now() - t0) / 1000 < secs)) {
          const [s, count] = take();
          const r = await p.run({ type: 'collatz', start: s, count, bins: BINS });
          pending.set(s, r);
          process();
          el = (performance.now() - t0) / 1000;
          if (el - lastUi > 0.2) {
            lastUi = el;
            ui.prog.set(endless ? (el % 60) / 60 : el / secs);
            ui.status.textContent = endless ? L(`Endlos · ${time(el)}`, `Endless · ${time(el)}`) : `${Math.floor(el)} / ${secs} s`;
            ui.tl.set(T.upto, N(ordered - 1));
            ui.tl.set(T.rate, rate((ordered - 2) / el / 1e6));
            ui.tl.set(T.best, L(`${best} Schritte`, `${best} steps`));
            ui.tl.set(T.checks, checks.length ? `${checks.filter(c => c[1]).length} / ${checks.length} ${checks.every(c => c[1]) ? '✓' : '✗'}` : '–');
            drawHist(hist, histo);
          }
        }
      };
      await Promise.all(Array.from({ length: p.size }, worker));
      process();
      const total = (performance.now() - t0) / 1000;
      const rt = (ordered - 2) / total / 1e6;
      const ok = checks.length >= 2 && checks.every(c => c[1]);
      ui.prog.set(1); ui.status.textContent = stop ? L('Gestoppt', 'Stopped') : L('Fertig', 'Done');
      ui.tl.set(T.upto, N(ordered - 1)); ui.tl.set(T.rate, rate(rt));
      drawHist(hist, histo);
      ui.chk.set(L(`${checks.filter(c => c[1]).length} von ${checks.length} Rekord-Kontrollen ✓`, `${checks.filter(c => c[1]).length} of ${checks.length} record checks ✓`) + (overflows ? L(`, ${N(overflows)} Überläufe exakt nachgerechnet`, `, ${N(overflows)} overflows recomputed exactly`) : ''), ok);
      ui.lg.add(L(`Ergebnis: bis ${N(ordered - 1)} geprüft, ${rate(rt)} Startwerte/s – alle Folgen endeten bei 1.`, `Result: checked up to ${N(ordered - 1)}, ${rate(rt)} start values/s – every sequence ended at 1.`));
      if (ok && !stop && !endless) save1({ kind: 'collatz', device: 'cpu', threads: p.size, score: round(rt, 1), unit: L('Mio. Startwerte/s', 'M start values/s'), durationS: round(total, 1), numbers: ordered - 1, detail: L(`bis ${N(ordered - 1)}, Rekord ${N(bestN)} (${best} Schritte)`, `up to ${N(ordered - 1)}, record ${N(bestN)} (${best} steps)`) });
    });
  }

  build();
  return () => { offHidden(); stopFn?.(); cleanupVis?.(); pool?.dispose(); void stayAwake(false); };
}

interface Ui { tl: ReturnType<typeof tiles>; prog: ReturnType<typeof progress>; status: HTMLElement; lg: ReturnType<typeof log>; chk: ReturnType<typeof checkBox> }
type Cam = { yaw: number; pitch: number; dist: number };

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
/** „1.000“ → „1,000“ im Englischen; „Mio.“ → „M“ */
const isEnLabel = (s: string) => L(s, s.replace(/\./g, ',').replace(' Mio,', ' M').replace(' Mio.', ' M'));

function save1(e: Omit<ScoreEntry, 'time' | 'version' | 'valid' | 'model'> & { model?: string }) {
  addScore({ model: deviceName(), ...e, time: new Date().toISOString(), version: VERSION, valid: true });
  toast(L('Ergebnis gespeichert', 'Result saved'));
  void buzz('success');
}

// ------------------------------------------------------------------------------------------- Bilder
function drawPiWalk(c: HTMLCanvasElement, digits: string) {
  const [g, w, hh] = fitCanvas(c);
  g.fillStyle = '#08090b'; g.fillRect(0, 0, w, hh);
  const n = Math.min(digits.length, 200_000);
  const xs = new Float32Array(n + 1), ys = new Float32Array(n + 1);
  let x = 0, y = 0, minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (let i = 0; i < n; i++) {
    const a = ((digits.charCodeAt(i) - 48) / 10) * Math.PI * 2;
    x += Math.cos(a); y += Math.sin(a);
    xs[i + 1] = x; ys[i + 1] = y;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const s = Math.min((w - 16) / (maxX - minX || 1), (hh - 16) / (maxY - minY || 1));
  const ox = (w - (maxX - minX) * s) / 2 - minX * s, oy = (hh - (maxY - minY) * s) / 2 - minY * s;
  g.lineWidth = 0.8;
  const segs = 60;
  for (let k = 0; k < segs; k++) {
    const a = Math.floor((k / segs) * n), b = Math.floor(((k + 1) / segs) * n);
    g.strokeStyle = `hsl(${200 + (k / segs) * 140}, 90%, ${55 + (k / segs) * 10}%)`;
    g.beginPath(); g.moveTo(ox + xs[a] * s, oy + ys[a] * s);
    for (let i = a + 1; i <= b; i++) g.lineTo(ox + xs[i] * s, oy + ys[i] * s);
    g.stroke();
  }
}

function drawSunflower(c: HTMLCanvasElement, primes: number[]) {
  const [g, w, hh] = fitCanvas(c);
  g.fillStyle = '#08090b'; g.fillRect(0, 0, w, hh);
  const n = 900, golden = Math.PI * (3 - Math.sqrt(5));
  const R = Math.min(w, hh) / 2 - 10, cx = w / 2, cy = hh / 2;
  const set = new Set(primes);
  for (let i = 1; i <= n; i++) {
    const r = Math.sqrt(i / n) * R, a = i * golden;
    const isP = set.has(i);
    g.fillStyle = isP ? '#ffd166' : `hsla(${30 + (i / n) * 20}, 70%, ${35 + (i / n) * 25}%, .9)`;
    g.beginPath(); g.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), isP ? 4.5 : 1.2 + (i / n) * 2.2, 0, Math.PI * 2); g.fill();
  }
  if (primes.length) { g.fillStyle = '#a3a8b3'; g.font = '12px system-ui'; g.fillText(L('gelb: Index einer Fibonacci-Primzahl', 'yellow: index of a Fibonacci prime'), 10, hh - 10); }
}

function drawHist(c: HTMLCanvasElement, histo: Float64Array) {
  let maxI = 0;
  for (let i = 0; i < histo.length; i++) if (histo[i] > 0) maxI = i;
  const bins = 64, w = Math.max(1, Math.ceil((maxI + 1) / bins));
  const data: number[] = [];
  for (let b = 0; b * w <= maxI; b++) { let s = 0; for (let i = b * w; i < (b + 1) * w && i < histo.length; i++) s += histo[i]; data.push(s); }
  barChart(c, data, null, '#3dd6c4');
  const g = c.getContext('2d')!;
  g.fillStyle = '#a3a8b3'; g.font = '12px system-ui';
  g.fillText(L(`Verteilung der Schrittzahlen (0 … ${maxI})`, `Distribution of step counts (0 … ${maxI})`), 8, 16);
}

// ------------------------------------------------------------------------------------------- Kamera + Punktansicht
function orbitControls(el: HTMLElement, cam: Cam) {
  const pts = new Map<number, [number, number]>();
  let pinch = 0;
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); });
  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1) {
      cam.yaw -= (e.clientX - p[0]) * 0.008;
      cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + (e.clientY - p[1]) * 0.008));
    }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) cam.dist = Math.max(3, Math.min(120, cam.dist * (pinch / d)));
      pinch = d;
    }
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.max(3, Math.min(120, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
}

/** Startbild des gewählten Szenarios (WebGL, Punkte aus der CPU). */
function drawPreview(c: HTMLCanvasElement, cam: Cam, scene: () => number) {
  let alive = true, view: PointView | null = null, sc = -1, data: ReturnType<typeof initBodies> | null = null;
  const x = new Float32Array(4096), y = new Float32Array(4096), z = new Float32Array(4096);
  const loop = () => {
    if (!alive) return;
    try {
      if (!view) view = new PointView(c, 4096);
      if (sc !== scene()) {
        sc = scene(); data = initBodies(4096, sc);
        for (let i = 0; i < 4096; i++) { x[i] = data.pos[4 * i]; y[i] = data.pos[4 * i + 1]; z[i] = data.pos[4 * i + 2]; }
      }
      view.draw(x, y, z, data!.vel, cam);
    } catch { alive = false; return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => { alive = false; view?.dispose(); };
}

class PointView {
  private gl: WebGL2RenderingContext; private prog: Prog; private buf: WebGLBuffer; private data: Float32Array;
  constructor(readonly c: HTMLCanvasElement, readonly n: number) {
    this.gl = createGL(c);
    this.prog = new Prog(this.gl, `#version 300 es
precision mediump float; in vec3 vCol; out vec4 o;
void main() { vec2 q = gl_PointCoord - 0.5; o = vec4(vCol * exp(-dot(q, q) * 14.0) * 0.4, 1.0); }`, `#version 300 es
in vec4 aP; uniform mat4 uMvp; uniform float uSize; out vec3 vCol;
const vec3 COLS[6] = vec3[6](vec3(0.45,0.7,1.0), vec3(1.0,0.72,0.42), vec3(0.6,1.0,0.75), vec3(1.0,0.5,0.8), vec3(1.0,0.95,0.7), vec3(1.0,1.0,1.0));
void main() { gl_Position = uMvp * vec4(aP.xyz, 1.0); vCol = COLS[int(aP.w) % 6]; gl_PointSize = int(aP.w) == 5 ? uSize * 6.0 : uSize * clamp(3.0 / gl_Position.w, 0.6, 2.5); }`);
    this.buf = this.gl.createBuffer()!;
    this.data = new Float32Array(n * 4);
    const gl = this.gl;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const loc = gl.getAttribLocation(this.prog.p, 'aP');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
  }
  draw(x: Float32Array, y: Float32Array, z: Float32Array, vel: Float32Array, cam: Cam) {
    const gl = this.gl, c = this.c, d = this.data;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(c.clientWidth * dpr), hh = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    for (let i = 0; i < this.n; i++) { d[4 * i] = x[i]; d[4 * i + 1] = y[i]; d[4 * i + 2] = z[i]; d[4 * i + 3] = vel[4 * i + 3]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
    gl.viewport(0, 0, w, hh);
    gl.clearColor(0.02, 0.02, 0.035, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    this.prog.use().f('uSize', Math.max(1.5, 2.2 * dpr * Math.sqrt(4096 / this.n)));
    gl.uniformMatrix4fv(this.prog.u('uMvp'), false, mvp(cam.yaw, cam.pitch, cam.dist, w / hh));
    gl.drawArrays(gl.POINTS, 0, this.n);
  }
  dispose() { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
}
