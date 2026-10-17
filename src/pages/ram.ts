// Seite „Neutronenstern“: Arbeitsspeicher – Bandbreite (Materiestrom), Latenz (Lichtlaufzeit), Stabilität (Dichte).
import { F, L, N, time } from '../core/i18n';
import { buzz, cores, deviceName, memoryGB, stayAwake } from '../core/native';
import { onHidden, setBusy } from '../core/nav';
import { MathPool, isCancel } from '../core/pool';
import { VERSION, addScore } from '../core/store';
import { checkBox, field, fitCanvas, h, log, progress, select, tiles, toast } from '../ui/dom';

const BLOCK = 32 << 20;

export function mountRam(root: HTMLElement) {
  let pool: MathPool | null = null, stop = false, hidden = false;
  let densitySecs = 60, densityMB = 512;
  // Anzeige-Zustand für den Pulsar
  const vis = { stage: 'idle' as 'idle' | 'read' | 'write' | 'copy' | 'lat' | 'dens', gbps: 0, blocks: [] as number[] };
  const T = { read: L('Lesen', 'Read'), write: L('Schreiben', 'Write'), copy: L('Kopieren', 'Copy'), lat: L('Latenz', 'Latency'), dens: L('Dichte geprüft', 'Density verified'), err: L('Fehler', 'Errors') };
  const tl = tiles([T.read, T.write, T.copy, T.lat, T.dens, T.err]);
  const prog = progress();
  const status = h('div', { class: 'label', style: { marginTop: '6px' } }, L('Bereit', 'Ready'));
  const big = h('div', { class: 'big' }, '–');
  const chk = checkBox();
  const lg = log();
  const canvas = h('canvas', { class: 'vis', style: { height: '260px' } });
  const startBtn = h('button', { class: 'btn primary', onclick: () => void run() }, L('Start', 'Start'));
  const stopBtn = h('button', { class: 'btn stop', disabled: true, onclick: () => { stop = true; pool?.cancel(); } }, L('Stopp', 'Stop'));
  const mem = memoryGB();
  const settingsCard = h('div', { class: 'card stack', style: { gap: '10px' } },
    h('div', { class: 'grid2' },
      field(L('Dichte-Test', 'Density test'), select<number>([[0, L('aus (nur messen)', 'off (measure only)')], [60, L('1 Minute', '1 minute')], [180, L('3 Minuten', '3 minutes')], [600, L('10 Minuten', '10 minutes')]], densitySecs, v => (densitySecs = v))),
      field(L('Speichermenge', 'Memory amount'), select<number>([[256, '256 MB'], [512, '512 MB'], [1024, '1 GB'], [1536, L('1,5 GB', '1.5 GB')]], densityMB, v => (densityMB = v)))),
    h('div', { class: 'muted small' }, (mem ? L(`Gerät meldet ≥ ${mem} GB Arbeitsspeicher. `, `Device reports ≥ ${mem} GB of memory. `) : '') +
      L('Apps dürfen nur einen Teil belegen – bei zu viel beendet das System die App.', 'Apps may only use part of it – too much and the system closes the app.')));

  root.append(h('div', { class: 'stack' },
    h('div', { class: 'hero ram' }, h('div', { class: 'label' }, L('Lesebandbreite', 'Read bandwidth')), big, status, h('div', { style: { marginTop: '12px' } }, prog.el)),
    h('div', { class: 'row' }, startBtn, stopBtn), canvas, tl.el, chk.el, lg.el, settingsCard));

  // ---------------------------------------------------------------- Pulsar
  let alive = true;
  let ang = 0, lastT = performance.now();
  const draw = (now: number) => {
    if (!alive) return;
    const dt = (now - lastT) / 1000; lastT = now;
    const [g, w, hh] = fitCanvas(canvas);
    g.fillStyle = '#05060a'; g.fillRect(0, 0, w, hh);
    const cx = w / 2, cy = hh / 2 + (vis.blocks.length ? -20 : 0), R = Math.min(w, hh) * 0.12;
    const speed = vis.stage === 'idle' ? 0.4 : 1 + Math.min(vis.gbps, 60) / 6;
    ang += dt * speed;
    // Strahlen
    const col = vis.stage === 'write' ? '255,168,38' : vis.stage === 'copy' ? '176,124,255' : vis.stage === 'lat' ? '255,90,82' : vis.stage === 'dens' ? '52,199,123' : '61,214,196';
    for (const s of [0, Math.PI]) {
      const a = ang + s, len = Math.max(w, hh);
      const gr = g.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.5);
      gr.addColorStop(0, `rgba(${col},.75)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a - 0.12) * len, cy + Math.sin(a - 0.12) * len * 0.5);
      g.lineTo(cx + Math.cos(a + 0.12) * len, cy + Math.sin(a + 0.12) * len * 0.5);
      g.closePath(); g.fill();
    }
    // Magnetfeld-Ringe
    g.strokeStyle = `rgba(${col},.18)`; g.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { g.beginPath(); g.ellipse(cx, cy, R * (1.6 + k * 0.7), R * (0.6 + k * 0.25), ang * 0.2, 0, Math.PI * 2); g.stroke(); }
    // Stern
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 2.2);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, `rgba(${col},.9)`); rg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R * 2.2, 0, Math.PI * 2); g.fill();
    // Blöcke des Dichte-Tests
    if (vis.blocks.length) {
      const n = vis.blocks.length, bw = Math.min(14, (w - 20) / n);
      vis.blocks.forEach((s, i) => {
        g.fillStyle = s === 3 ? '#ff5a52' : s === 2 ? '#34c77b' : s === 1 ? '#2f9bff' : '#23252c';
        g.fillRect(10 + i * bw, hh - 22, Math.max(1, bw - 2), 12);
      });
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  const offHidden = onHidden(() => { if (startBtn.disabled) { hidden = true; stop = true; pool?.cancel(); } });

  async function run() {
    stop = false; hidden = false;
    startBtn.disabled = true; stopBtn.disabled = false;
    settingsCard.style.opacity = '.5'; settingsCard.style.pointerEvents = 'none';
    setBusy(true, L('Neutronenstern', 'Neutron star')); void stayAwake(true);
    tl.reset(); lg.clear(); chk.clear(); prog.set(0); big.textContent = '–'; vis.blocks = [];
    const n = cores();
    pool = new MathPool(n);
    const res: Record<string, number> = {};
    let errors = 0, verified = 0, densityDone = false;
    try {
      const perWorker = 32 << 20;
      lg.add(L(`${deviceName()} · ${n} Threads · ${N((perWorker * n) >> 20)} MB Puffer`, `${deviceName()} · ${n} threads · ${N((perWorker * n) >> 20)} MB buffer`));
      const steps: ['read' | 'write' | 'copy', string][] = [['read', T.read], ['write', T.write], ['copy', T.copy]];
      let k = 0;
      for (const [op, title] of steps) {
        vis.stage = op;
        status.textContent = L(`Materiestrom · ${title}`, `Matter stream · ${title}`);
        const rs: any[] = await Promise.all(Array.from({ length: n }, (_, i) => pool!.runOn(i, { type: 'ram-bw', bytes: perWorker, op, seconds: 2.5 })));
        const gbps = rs.reduce((s, r) => s + r.bytes / r.seconds, 0) / 1e9;
        res[op] = gbps; vis.gbps = gbps;
        tl.set(title, `${F(gbps, 1)} GB/s`);
        if (op === 'read') big.textContent = `${F(gbps, 1)} GB/s`;
        prog.set(++k / 5);
      }
      vis.stage = 'lat';
      status.textContent = L('Lichtlaufzeit · Latenz', 'Light travel time · latency');
      const lat: any = await pool.runOn(0, { type: 'ram-lat', entries: 16 << 20, hops: 4_000_000 });
      res.lat = lat.ns;
      tl.set(T.lat, `${F(lat.ns, 1)} ns`);
      prog.set(4 / 5);
      lg.add(L(`Lesen ${F(res.read, 1)} GB/s · Schreiben ${F(res.write, 1)} GB/s · Kopieren ${F(res.copy, 1)} GB/s · Latenz ${F(res.lat, 1)} ns`, `Read ${F(res.read, 1)} GB/s · write ${F(res.write, 1)} GB/s · copy ${F(res.copy, 1)} GB/s · latency ${F(res.lat, 1)} ns`));
      // Puffer der Bandbreitenmessung freigeben
      pool.dispose(); pool = new MathPool(n);

      if (densitySecs > 0 && !stop) {
        vis.stage = 'dens';
        const blocks = Math.max(n, Math.floor((densityMB << 20) / BLOCK));
        const per = Array.from({ length: n }, (_, i) => Math.floor(blocks / n) + (i < blocks % n ? 1 : 0));
        vis.blocks = new Array(blocks).fill(0);
        lg.add(L(`Dichte: ${N(blocks)} Blöcke à 32 MB, ${time(densitySecs)}`, `Density: ${N(blocks)} blocks of 32 MB, ${time(densitySecs)}`));
        const t0 = performance.now();
        let pass = 0;
        while (!stop && (performance.now() - t0) / 1000 < densitySecs) {
          status.textContent = L(`Dichte · Durchgang ${pass + 1} · ${time((performance.now() - t0) / 1000)} / ${time(densitySecs)}`, `Density · pass ${pass + 1} · ${time((performance.now() - t0) / 1000)} / ${time(densitySecs)}`);
          const rs: any[] = await Promise.all(per.map((b, i) => pool!.runOn(i, { type: 'ram-density', blocks: b, blockBytes: BLOCK, pass })));
          let off = 0;
          rs.forEach((r, i) => { r.states.forEach((s: number, j: number) => (vis.blocks[off + j] = Math.max(vis.blocks[off + j] === 3 ? 3 : 0, s))); off += per[i]; if (r.errors) lg.add(L(`Fehler: ${r.firstError}`, `Error: ${r.firstError}`)); });
          errors += rs.reduce((s, r) => s + r.errors, 0);
          verified += rs.reduce((s, r) => s + r.verified, 0);
          const got = rs.reduce((s, r) => s + r.blocks, 0);
          if (pass === 0 && got < blocks) lg.add(L(`Nur ${N(got)} von ${N(blocks)} Blöcken belegbar – Speicher des Geräts begrenzt.`, `Only ${N(got)} of ${N(blocks)} blocks could be allocated – device memory is limited.`));
          tl.set(T.dens, `${F(verified / 1e9, 1)} GB`);
          tl.set(T.err, N(errors));
          prog.set(0.8 + 0.2 * Math.min(1, (performance.now() - t0) / 1000 / densitySecs));
          pass++;
        }
        densityDone = !stop;
      } else densityDone = true;
      prog.set(1);
      vis.stage = 'idle';
      status.textContent = stop ? L('Gestoppt', 'Stopped') : L('Fertig', 'Done');
      tl.set(T.err, N(errors));
      const ok = errors === 0;
      chk.set(densitySecs > 0
        ? (ok ? L(`${F(verified / 1e9, 1)} GB geschrieben und fehlerfrei zurückgelesen ✓`, `${F(verified / 1e9, 1)} GB written and read back without errors ✓`) : L(`${N(errors)} Speicherfehler gefunden!`, `${N(errors)} memory errors found!`))
        : L('Nur Messung (kein Dichte-Test)', 'Measurement only (no density test)'), ok);
      if (!stop && ok && densityDone) {
        addScore({
          kind: 'ram', time: new Date().toISOString(), device: 'ram', threads: n, score: Math.round(res.read * 10) / 10, unit: 'GB/s',
          detail: L(`Schreiben ${F(res.write, 1)} · Kopieren ${F(res.copy, 1)} GB/s · Latenz ${F(res.lat, 1)} ns`, `write ${F(res.write, 1)} · copy ${F(res.copy, 1)} GB/s · latency ${F(res.lat, 1)} ns`),
          model: deviceName(), version: VERSION, valid: true,
        });
        toast(L('Ergebnis gespeichert', 'Result saved'));
        void buzz('success');
      } else if (!ok) void buzz('error');
    } catch (e: any) {
      status.textContent = isCancel(e) ? L('Abgebrochen', 'Aborted') : L('Fehler', 'Error');
      if (hidden) lg.add(L('Die App war im Hintergrund – Lauf abgebrochen.', 'The app went to the background – run aborted.'));
      else if (!isCancel(e)) lg.add(String(e?.message ?? e));
    } finally {
      vis.stage = 'idle';
      pool?.dispose(); pool = null;
      startBtn.disabled = false; stopBtn.disabled = true;
      settingsCard.style.opacity = ''; settingsCard.style.pointerEvents = '';
      setBusy(false); void stayAwake(false);
    }
  }

  return () => { alive = false; stop = true; offHidden(); pool?.dispose(); void stayAwake(false); };
}
