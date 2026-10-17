// Seite „Primzahlen“: Benchmark (3 min / Kurztest 30 s), Unendlich (mit Checkpoint), Bereich (Primzahlen teilen).
import { L, N, rate, time } from '../core/i18n';
import { buzz, cores, deviceName, shareFile, stayAwake } from '../core/native';
import { onHidden, setBusy } from '../core/nav';
import { BENCH_SECONDS, Check, Live, PrimeRun, SHORT_SECONDS, WARMUP_SECONDS, points } from '../core/primes';
import { MAX_N } from '../core/sieve';
import { VERSION, addScore, checkpoint, saveCheckpoint, saveSettings, settings } from '../core/store';
import { checkBox, field, h, lineChart, log, progress, seg, select, tiles, toast, toggle } from '../ui/dom';
import { resultShow, sfx } from '../ui/fx';
import { PrimeVis } from '../ui/primevis';

const SEGMENTS: [number, string][] = [[1_000_000, '1 Mio.'], [2_000_000, '2 Mio.'], [4_000_000, '4 Mio.'], [10_000_000, '10 Mio.']];
const MAX_SAVE = 5_000_000;          // so viele Primzahlen höchstens in eine Datei

export function mountPrime(root: HTMLElement) {
  const st = settings();
  let mode = st.primeMode;
  let run: PrimeRun | null = null;
  let rates: number[] = [];

  // ---------------------------------------------------------------- Kopf: große Zahl
  const big = h('div', { class: 'big' }, '0');
  const bigLabel = h('div', { class: 'label' }, L('Punkte', 'Points'));
  const phase = h('div', { class: 'label', style: { marginTop: '6px' } }, L('Bereit', 'Ready'));
  const prog = progress();
  const hero = h('div', { class: 'hero' }, bigLabel, big, phase, h('div', { style: { marginTop: '12px' } }, prog.el));
  const T = {
    rate: L('Zahlen pro Sekunde', 'Numbers per second'), peak: L('Spitze', 'Peak'),
    checked: L('Geprüft bis', 'Checked up to'), count: L('Primzahlen gefunden', 'Primes found'),
    last: L('Letzte Primzahl', 'Last prime'), time: L('Zeit', 'Time'),
  };
  const tl = tiles([T.rate, T.peak, T.checked, T.count, T.last, T.time]);
  const chart = h('canvas', { class: 'vis', style: { height: '120px' } });
  const visCanvas = h('canvas', { class: 'vis', style: { height: '260px' } });
  const vis = new PrimeVis(visCanvas);
  let lastVis = 0;
  const lg = log();
  const chk = checkBox();

  // ---------------------------------------------------------------- Einstellungen
  const modeSeg = seg<typeof mode>([['benchmark', 'Benchmark'], ['unendlich', L('Unendlich', 'Endless')], ['bereich', L('Bereich', 'Range')]], mode, v => {
    mode = v; saveSettings({ primeMode: v }); updateMode();
  });
  const lenSeg = seg<number>([[0, L('Standard · 3:00', 'Standard · 3:00')], [1, L('Kurztest · 0:30', 'Quick · 0:30')]], st.shortTest ? 1 : 0, v => saveSettings({ shortTest: v === 1 }));
  const threadOpts: [number, string][] = [];
  for (let t = 1; t <= Math.max(cores(), st.threads); t++) threadOpts.push([t, `${t}`]);
  const thrSel = select(threadOpts, Math.min(st.threads, threadOpts.length), v => saveSettings({ threads: v }));
  const segSel = select(SEGMENTS, st.segment, v => saveSettings({ segment: v }));
  const fromIn = h('input', { type: 'text', inputmode: 'numeric', value: String(st.rangeFrom) });
  const toIn = h('input', { type: 'text', inputmode: 'numeric', value: String(st.rangeTo) });
  let savePrimes = false;
  const rangeBox = h('div', { class: 'stack', style: { gap: '10px' } },
    h('div', { class: 'grid2' }, field(L('Von', 'From'), fromIn), field(L('Bis', 'To'), toIn)),
    toggle(L('Primzahlen als Datei teilen', 'Share primes as file'), false, v => (savePrimes = v), L(`höchstens ${N(MAX_SAVE)} Primzahlen`, `at most ${N(MAX_SAVE)} primes`)));
  const cp = checkpoint();
  let resume = true;
  const endlessBox = h('div', null,
    toggle(L('Vom Checkpoint fortsetzen', 'Resume from checkpoint'), true, v => (resume = v),
      cp ? L(`weiter ab ${N(cp.nextStart)} (${N(cp.count)} Primzahlen)`, `continue from ${N(cp.nextStart)} (${N(cp.count)} primes)`) : L('noch kein Checkpoint', 'no checkpoint yet')));
  const benchBox = h('div', null, lenSeg.el);
  const settingsCard = h('div', { class: 'card stack', style: { gap: '12px' } },
    modeSeg.el, benchBox, endlessBox, rangeBox,
    h('div', { class: 'grid2' }, field(L('Threads (Kerne)', 'Threads (cores)'), thrSel), field(L('Segmentgröße', 'Segment size'), segSel)));

  const startBtn = h('button', { class: 'btn primary', onclick: () => start() }, L('Start', 'Start'));
  const stopBtn = h('button', { class: 'btn stop', disabled: true, onclick: () => run?.stop() }, L('Stopp', 'Stop'));

  function updateMode() {
    benchBox.hidden = mode !== 'benchmark';
    endlessBox.hidden = mode !== 'unendlich';
    rangeBox.hidden = mode !== 'bereich';
    bigLabel.textContent = mode === 'benchmark' ? L('Punkte', 'Points') : L('Primzahlen gefunden', 'Primes found');
  }
  updateMode();

  root.append(h('div', { class: 'stack' }, hero, h('div', { class: 'row' }, startBtn, stopBtn), visCanvas, tl.el, chart, chk.el, lg.el, settingsCard));

  // ---------------------------------------------------------------- Anzeige
  const showLive = (l: Live, pts: boolean) => {
    big.textContent = pts ? N(points(l.numbers)) : N(l.count);
    if (l.fraction >= 0) prog.set(l.fraction);
    tl.set(T.rate, rate(l.curRate || l.avgRate));
    tl.set(T.peak, rate(l.peakRate));
    tl.set(T.checked, N(l.numbers));
    tl.set(T.count, N(l.count));
    tl.set(T.last, N(l.last));
    tl.set(T.time, time(l.elapsed) + (isFinite(l.total) ? ' / ' + time(l.total) : ''));
    rates.push(l.curRate || l.avgRate);
    if (rates.length > 600) rates = rates.filter((_, i) => i % 2 === 0);
    lineChart(chart, rates, '#2f9bff', L('Mio. Zahlen/s', 'M numbers/s'));
    if (run) vis.setWorkers(run.perWorker);
    if (l.elapsed - lastVis > 0.6) { lastVis = l.elapsed; vis.setPosition(l.numbers); }
  };
  const onCheck = (c: Check) => { if (c.ok) sfx.check(); else sfx.fail(); flash(); return lg.add(`${L('Kontrolle', 'Check')} π(10^${Math.round(Math.log10(c.limit))}) = ${N(c.got)} ${c.ok ? '✓' : '✗ ' + L('erwartet', 'expected') + ' ' + N(c.expected)}`); };
  const flash = () => { hero.animate([{ boxShadow: '0 0 0 0 var(--good)' }, { boxShadow: '0 0 40px 6px var(--good)' }, { boxShadow: '0 0 0 0 var(--good)' }], { duration: 900 }); };

  function running(on: boolean, label = '') {
    startBtn.disabled = on; stopBtn.disabled = !on;
    vis.running = on;
    if (on) sfx.start();
    settingsCard.style.opacity = on ? '.5' : ''; settingsCard.style.pointerEvents = on ? 'none' : '';
    setBusy(on, label);
    void stayAwake(on);
  }

  let hiddenDuringRun = false;
  const offHidden = onHidden(() => { if (run) { hiddenDuringRun = true; run.kill(); } });

  async function start() {
    const s = settings();
    lg.clear(); chk.clear(); rates = []; tl.reset(); prog.set(0);
    hiddenDuringRun = false;
    try {
      if (mode === 'benchmark') await bench(s.threads, s.segment, s.shortTest);
      else if (mode === 'unendlich') await endless(s.threads, s.segment);
      else await range(s.threads, s.segment);
    } catch (e: any) {
      if (e?.message === 'cancelled') {
        lg.add(hiddenDuringRun ? L('Abgebrochen: Die App war im Hintergrund.', 'Aborted: the app went to the background.') : L('Abgebrochen.', 'Aborted.'));
        phase.textContent = L('Abgebrochen', 'Aborted');
      } else { lg.add('Fehler: ' + (e?.message ?? e)); phase.textContent = L('Fehler', 'Error'); }
    } finally {
      run = null;
      running(false);
    }
  }

  async function bench(threads: number, segSize: number, short: boolean) {
    running(true, 'Benchmark');
    run = new PrimeRun();
    phase.textContent = L(`Aufwärmen (${WARMUP_SECONDS} s) …`, `Warm-up (${WARMUP_SECONDS} s) …`);
    lg.add(L(`${deviceName()} · ${threads} Threads · Segment ${N(segSize)}`, `${deviceName()} · ${threads} threads · segment ${N(segSize)}`));
    const w = await run.run({ start: 0, end: null, seg: segSize, threads, seconds: WARMUP_SECONDS, phase: 'warmup', onLive: l => showLive(l, false), onCheck });
    if (w.aborted) { phase.textContent = L('Abgebrochen', 'Aborted'); return; }
    if (!w.checks.length || w.checks.some(c => !c.ok)) throw new Error(L('Aufwärm-Kontrolle fehlgeschlagen – Ergebnis wäre falsch.', 'Warm-up check failed – the result would be wrong.'));
    const dur = short ? SHORT_SECONDS : BENCH_SECONDS;
    rates = [];
    phase.textContent = short ? L(`Kurztest: ${dur} s (wird nicht gewertet)`, `Quick test: ${dur} s (not counted)`) : L(`Benchmark: ${time(dur)} ab 2`, `Benchmark: ${time(dur)} from 2`);
    run = new PrimeRun();
    const r = await run.run({ start: 0, end: null, seg: segSize, threads, seconds: dur, phase: 'bench', onLive: l => showLive(l, true), onCheck });
    const avg = r.numbers / r.elapsed / 1e6;
    const reasons: string[] = [];
    if (r.aborted) reasons.push(L('abgebrochen', 'aborted'));
    if (short) reasons.push(L('Kurztest', 'quick test'));
    if (!r.checks.some(c => c.limit === 1e9)) reasons.push(L('10^9 nicht erreicht', '10^9 not reached'));
    const bad = r.checks.filter(c => !c.ok);
    if (bad.length) reasons.push(L('Kontrollwert falsch', 'check value wrong'));
    const valid = reasons.length === 0;
    const pts = points(r.numbers);
    big.textContent = N(pts);
    prog.set(1);
    tl.set(T.time, time(r.elapsed));
    tl.set(T.rate, rate(avg) + ' Ø');
    phase.textContent = valid ? L('Fertig – gültiger Lauf', 'Done – valid run') : L('Fertig – nicht gewertet: ', 'Done – not counted: ') + reasons.join(', ');
    chk.set(`${r.checks.filter(c => c.ok).length} / ${r.checks.length} ${L('Kontrollwerte π(10^k) korrekt', 'check values π(10^k) correct')}`, bad.length === 0);
    lg.add(L(`Ergebnis: ${N(pts)} Punkte · Ø ${rate(avg)} Zahlen/s · Spitze ${rate(r.peak)}`, `Result: ${N(pts)} points · avg ${rate(avg)} numbers/s · peak ${rate(r.peak)}`));
    if (valid) {
      addScore({
        kind: 'prime', time: new Date().toISOString(), device: 'cpu', threads, score: Math.round(avg * 10) / 10, unit: L('Mio. Zahlen/s', 'M numbers/s'),
        points: Math.round(pts), durationS: Math.round(r.elapsed * 10) / 10, numbers: r.numbers, peak: Math.round(r.peak * 10) / 10,
        detail: `${threads} Threads, ${L('bis', 'up to')} ${N(r.numbers)}`, model: deviceName(), version: VERSION, valid,
      });
    } else void buzz('error');
    if (!r.aborted)
      resultShow({
        title: short ? L('Primzahlen · Kurztest', 'Primes · quick test') : L('Primzahl-Benchmark', 'Prime benchmark'),
        value: Math.round(pts), unit: valid ? L('Punkte', 'points') : L('Punkte (nicht gewertet)', 'points (not counted)'), kind: short ? 'prime-short' : 'prime', device: deviceName(),
        lines: [[L('Ø Zahlen pro Sekunde', 'Avg numbers per second'), rate(avg)], [L('Spitze', 'Peak'), rate(r.peak)], [L('Geprüft bis', 'Checked up to'), N(r.numbers)],
          [L('Primzahlen', 'Primes'), N(r.count)], [L('Kontrollen', 'Checks'), `${r.checks.filter(c => c.ok).length} / ${r.checks.length} ✓`]],
      });
  }

  async function endless(threads: number, segSize: number) {
    running(true, L('Unendlich', 'Endless'));
    let start = 0, count0 = 0, last0 = 0;
    const c = checkpoint();
    if (resume && c) { start = c.nextStart; count0 = c.count; last0 = c.lastPrime; lg.add(L(`Checkpoint geladen: weiter ab ${N(start)}`, `Checkpoint loaded: continuing from ${N(start)}`)); }
    phase.textContent = L('Unendlich – bis Stopp', 'Endless – until stopped');
    run = new PrimeRun();
    let lastSave = 0;
    const save = (l: Live) => saveCheckpoint({ nextStart: l.numbers, count: count0 + l.count, lastPrime: l.last || last0, updated: new Date().toISOString() });
    const r = await run.run({
      start, end: null, seg: segSize, threads, phase: 'endless', onCheck,
      onLive: l => {
        showLive({ ...l, count: count0 + l.count, last: l.last || last0 }, false);
        if (l.elapsed - lastSave > 15) { lastSave = l.elapsed; save(l); }
      },
    });
    saveCheckpoint({ nextStart: r.hi, count: count0 + r.count, lastPrime: r.last || last0, updated: new Date().toISOString() });
    big.textContent = N(count0 + r.count);
    phase.textContent = L(`Gestoppt bei ${N(r.hi)} – Checkpoint gespeichert`, `Stopped at ${N(r.hi)} – checkpoint saved`);
    lg.add(L(`${N(r.hi - start)} Zahlen in ${time(r.elapsed)} geprüft, Ø ${rate((r.hi - start) / r.elapsed / 1e6)}/s`, `${N(r.hi - start)} numbers checked in ${time(r.elapsed)}, avg ${rate((r.hi - start) / r.elapsed / 1e6)}/s`));
  }

  async function range(threads: number, segSize: number) {
    const a = Math.max(0, Math.floor(Number(fromIn.value.replace(/[^\d]/g, '')) || 0));
    const b = Math.floor(Number(toIn.value.replace(/[^\d]/g, '')) || 0) + 1;
    if (!(b > a)) { toast(L('„Bis“ muss ≥ „Von“ sein.', '"To" must be ≥ "From".')); return; }
    if (b > MAX_N) { toast(L(`Obergrenze max. ${N(MAX_N)}`, `Upper limit max. ${N(MAX_N)}`)); return; }
    saveSettings({ rangeFrom: a, rangeTo: b - 1 });
    running(true, L('Bereich', 'Range'));
    phase.textContent = L(`Bereich ${N(a)} – ${N(b - 1)}`, `Range ${N(a)} – ${N(b - 1)}`);
    const chunks: string[] = [];
    let saved = 0;
    run = new PrimeRun();
    const r = await run.run({
      start: a, end: b, seg: segSize, threads, phase: 'range', wantPrimes: savePrimes, onLive: l => showLive(l, false),
      onPrimes: list => {
        if (saved >= MAX_SAVE) return;
        const n = Math.min(list.length, MAX_SAVE - saved);
        let s = '';
        for (let i = 0; i < n; i++) s += list[i] + '\n';
        chunks.push(s); saved += n;
      },
    });
    big.textContent = N(r.count);
    prog.set(r.hi >= b ? 1 : (r.hi - a) / (b - a));
    phase.textContent = r.hi >= b ? L('Fertig', 'Done') : L(`Gestoppt bei ${N(r.hi)}`, `Stopped at ${N(r.hi)}`);
    lg.add(L(`${N(r.count)} Primzahlen zwischen ${N(a)} und ${N(Math.min(b, r.hi) - 1)} · ${time(r.elapsed)}`, `${N(r.count)} primes between ${N(a)} and ${N(Math.min(b, r.hi) - 1)} · ${time(r.elapsed)}`));
    if (savePrimes && saved > 0) {
      if (saved >= MAX_SAVE) lg.add(L(`Datei auf ${N(MAX_SAVE)} Primzahlen gekürzt.`, `File truncated to ${N(MAX_SAVE)} primes.`));
      await shareFile(`primes_${a}_${b - 1}.txt`, chunks.join(''), L('Primzahlen', 'Primes'));
    }
  }

  return () => { offHidden(); run?.kill(); vis.dispose(); void stayAwake(false); };
}

