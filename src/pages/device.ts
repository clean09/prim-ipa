// Seite „Geräte-Check“: Gerät erkennen, Röntgenansicht, Gesamtprüfung aller Bauteile mit Gesamtpunkten und Rang.
import { DeviceProfile, batteryHealth, detectDevice, liveHw } from '../core/devices';
import { openModule } from '../ui/modules';
import { F, L, N, rate } from '../core/i18n';
import { stayAwake } from '../core/native';
import { onHidden, setBusy } from '../core/nav';
import { MathPool } from '../core/pool';
import { PrimeRun } from '../core/primes';
import { VERSION, addScore, scores } from '../core/store';
import { GemmGpu } from '../gl/ai';
import { BlackHole, demoState } from '../gl/blackhole';
import { h, toast, yieldNow } from '../ui/dom';
import { rankFor, resultShow, sfx } from '../ui/fx';
import { Module, XRay } from '../ui/xray';

/** Bezugswerte = 1000 Punkte je Kategorie (etwa ein Mittelklasse-Handy). */
const REF = { cpu1: 600, cpuN: 1300, gpu: 10, ai: 150, ram: 8, storage: 300 };

interface Step { id: string; mod: Module | Module[]; title: () => string; run: (s: StepCtx) => Promise<string> }
interface StepCtx { xr: XRay; dev: DeviceProfile; res: Record<string, number>; stopped: () => boolean; info: HTMLElement }

export function mountDevice(root: HTMLElement) {
  let stop = false, hidden = false;
  let liveTimer = 0;
  const wrap = h('div', { class: 'stack' });
  root.append(wrap);
  const offHidden = onHidden(() => { hidden = true; stop = true; });

  const loading = h('div', { class: 'card', style: { textAlign: 'center' } }, L('Gerät wird erkannt …', 'Detecting device …'));
  wrap.append(loading);

  void detectDevice().then(dev => {
    loading.remove();
    const xr = new XRay(dev);
    xr.scan(true);
    sfx.module();
    setTimeout(() => xr.scan(false), 1800);

    const spec = h('dl', { class: 'spec' });
    const row = (k: string, v: string | undefined) => { if (v) spec.append(h('dt', null, k), h('dd', null, v)); };
    row(L('Gerät', 'Device'), dev.name);
    row(L('System', 'OS'), dev.os.replace(/^android/, 'Android').replace(/^ios/, 'iOS'));
    row('Chip', dev.soc.name + (dev.soc.node ? ` (${dev.soc.node})` : ''));
    row(L('CPU-Kerne', 'CPU cores'), dev.clusters.map(c => `${c.count}× ${c.ghz ? F(c.ghz, 2) + ' GHz' : ''} ${c.label}`.replace(/\s+/g, ' ').trim()).join(' + '));
    row('GPU', dev.soc.gpu !== 'GPU' ? dev.soc.gpu : dev.gpuRenderer);
    row(L('KI-Einheit', 'AI unit'), dev.soc.npu);
    row(L('Arbeitsspeicher', 'Memory'), dev.ramGB ? `${F(dev.ramGB, 1)} GB` : undefined);
    row(L('Speicher', 'Storage'), dev.storageGB ? `${N(dev.storageGB)} GB (${N(dev.storageFreeGB ?? 0)} GB ${L('frei', 'free')})` : undefined);
    row('Display', dev.screen ? `${dev.screen.w}×${dev.screen.h}${dev.screen.hz ? ` · ${Math.round(dev.screen.hz)} Hz` : ''}${dev.screen.hdr ? ' · HDR' : ''}` : undefined);
    row(L('Kameras', 'Cameras'), dev.cams ? `${dev.cams.back} ${L('hinten', 'back')} · ${dev.cams.front} ${L('vorne', 'front')}` : undefined);
    row(L('Sensoren', 'Sensors'), dev.sensors?.length ? dev.sensors.map(sensorName).join(', ') : undefined);
    const b = dev.battery;
    row(L('Akkuzustand', 'Battery health'), b?.healthPct != null ? L(`≈ ${N(b.healthPct)} % (${N(b.estMah!)} von ${N(b.designMah!)} mAh)`, `≈ ${N(b.healthPct)} % (${N(b.estMah!)} of ${N(b.designMah!)} mAh)`) : undefined);
    row(L('Ladezyklen', 'Charge cycles'), b?.cycles != null ? N(b.cycles) : undefined);
    row(L('Akku', 'Battery'), b?.level != null ? `${b.level} %${b.tempC != null ? ` · ${F(b.tempC, 1)} °C` : ''}${b.charging ? L(' · lädt', ' · charging') : ''}` : undefined);
    if (b?.healthPct != null) xr.setBatteryLabel(L(`Zustand ≈ ${N(b.healthPct)} %`, `Health ≈ ${N(b.healthPct)} %`));
    let checking = false;
    xr.onTap(m => { if (!checking) openModule(m, dev); });
    if (!dev.native) spec.append(h('dt', { style: { gridColumn: '1 / -1', color: 'var(--muted)', fontSize: '12.5px' } },
      L('Detailwerte (Taktraten, Akku-Temperatur, Kameras) liefert die Android-App direkt vom System.', 'Detailed values (clock speeds, battery temperature, cameras) come straight from the system in the Android app.')));

    const best = scores().filter(e => e.kind === 'device' && e.valid).sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
    const startBtn = h('button', { class: 'btn primary block', onclick: () => void runCheck() }, L('Gesamtprüfung starten', 'Start full check'));
    const stopBtn = h('button', { class: 'btn stop block', style: { display: 'none' }, onclick: () => { stop = true; } }, L('Abbrechen', 'Cancel'));
    const stepsEl = h('div', { class: 'steps' });
    const live = h('div', { style: { display: 'none' } });
    const cats = h('div', { class: 'card stack', style: { display: 'none', gap: '10px' } });
    wrap.append(
      xr.el, h('div', { class: 'xray-hint' }, L('Tippe auf ein Bauteil für Live-Werte und Tests', 'Tap a component for live values and tests')),
      startBtn, stopBtn, live, h('div', { class: 'card' }, stepsEl), cats,
      h('div', { class: 'card' }, h('h2', null, dev.name), spec,
        best ? h('p', { class: 'muted small', style: { marginTop: '10px' } }, L(`Bestes Ergebnis: ${N(best.points ?? 0)} Punkte (${rankFor('device', best.points ?? 0).name})`, `Best result: ${N(best.points ?? 0)} points (${rankFor('device', best.points ?? 0).name})`)) : null),
    );

    const STEPS: Step[] = [
      { id: 'cpu1', mod: 'cpu', title: () => L('CPU · Einzelkern', 'CPU · single core'), run: async s => {
        s.xr.setCoreLoad(1);
        const r = await new PrimeRun().run({ start: 0, end: null, seg: 2_000_000, threads: 1, seconds: 6, phase: 'bench', onLive: () => {} });
        s.res.cpu1 = r.numbers / r.elapsed / 1e6;
        return rate(s.res.cpu1) + '/s';
      } },
      { id: 'cpuN', mod: ['cpu', 'thermal'], title: () => L(`CPU · alle ${dev.cores} Kerne`, `CPU · all ${dev.cores} cores`), run: async s => {
        s.xr.setCoreLoad(new Array(dev.cores).fill(1));
        startLive(s.xr, dev);
        const r = await new PrimeRun().run({ start: 0, end: null, seg: 4_000_000, threads: dev.cores, seconds: 8, phase: 'bench', onLive: () => {} });
        stopLive();
        s.res.cpuN = r.numbers / r.elapsed / 1e6;
        return rate(s.res.cpuN) + '/s';
      } },
      { id: 'gpu', mod: 'gpu', title: () => L('GPU · Raytracing (Schwarzes Loch)', 'GPU · ray tracing (black hole)'), run: async s => {
        const c = h('canvas', { class: 'vis', style: { height: '150px' } });
        s.info.replaceChildren(c); s.info.style.display = '';
        const bh = new BlackHole(c);
        bh.fixedRes = [640, 360];
        try {
          demoState(14, bh); bh.render(14); bh.sync();
          let frames = 0;
          const t0 = performance.now();
          while (performance.now() - t0 < 7000 && !s.stopped()) {
            const t = 12 + (performance.now() - t0) / 1000;
            for (let i = 0; i < 2; i++) { demoState(t, bh); bh.render(t, i === 1); }
            bh.sync(); frames += 2;
            await yieldNow();
          }
          s.res.gpu = frames / ((performance.now() - t0) / 1000);
        } finally { bh.dispose(); s.info.style.display = 'none'; s.info.replaceChildren(); }
        return `${F(s.res.gpu, 1)} FPS`;
      } },
      { id: 'ai', mod: ['npu', 'gpu'], title: () => L('KI · Matrix-Rechenwerk (FP16)', 'AI · matrix engine (FP16)'), run: async s => {
        const off = document.createElement('canvas'); off.width = off.height = 1;
        const g = new GemmGpu(off);
        try { const r = await g.run(1024, true, 5, () => {}, s.stopped); s.res.ai = r.gflops; if (!r.ok) throw new Error(L('Rechenfehler im Matrixtest', 'Matrix test produced wrong results')); }
        finally { g.dispose(); }
        return `${N(s.res.ai)} GFLOPS`;
      } },
      { id: 'ram', mod: 'ram', title: () => L('Arbeitsspeicher · Bandbreite + Latenz', 'Memory · bandwidth + latency'), run: async s => {
        const pool = new MathPool(dev.cores);
        try {
          const rs: any[] = await Promise.all(Array.from({ length: dev.cores }, (_, i) => pool.runOn(i, { type: 'ram-bw', bytes: 16 << 20, op: 'read', seconds: 2 })));
          s.res.ram = rs.reduce((a, r) => a + r.bytes / r.seconds, 0) / 1e9;
          const lat: any = await pool.runOn(0, { type: 'ram-lat', entries: 8 << 20, hops: 2_000_000 });
          s.res.lat = lat.ns;
        } finally { pool.dispose(); }
        return `${F(s.res.ram, 1)} GB/s · ${F(s.res.lat, 0)} ns`;
      } },
      { id: 'storage', mod: 'storage', title: () => L('Speicher · Schreiben + Lesen', 'Storage · write + read'), run: async s => {
        s.res.storage = await storageTest();
        return `${N(s.res.storage)} MB/s`;
      } },
      { id: 'display', mod: 'display', title: () => L('Display · Bildwiederholrate', 'Display · refresh rate'), run: async s => {
        s.res.hz = await measureHz();
        return `${N(s.res.hz)} Hz${dev.screen?.hz ? ` / ${Math.round(dev.screen.hz)} Hz` : ''}`;
      } },
      { id: 'battery', mod: 'battery', title: () => L('Akku', 'Battery'), run: async s => {
        await wait(900);
        const l = await liveHw();
        const b: any = l?.battery ?? dev.battery;
        if (b?.level != null) s.xr.setBattery(b.level);
        const hp = l?.battery ? batteryHealth({ ...l.battery, designMah: l.battery.designMah ?? dev.battery?.designMah }).pct : dev.battery?.healthPct;
        if (hp != null) s.res.battery = hp;
        const parts = [hp != null ? L(`Zustand ≈ ${N(hp)} %`, `health ≈ ${N(hp)} %`) : null, b?.tempC != null ? `${F(b.tempC, 1)} °C` : null].filter(Boolean);
        return parts.length ? parts.join(' · ') : b?.level != null ? `${b.level} %` : L('keine Daten', 'no data');
      } },
      { id: 'cams', mod: ['cams', 'sensors'], title: () => L('Kameras + Sensoren', 'Cameras + sensors'), run: async () => {
        await wait(900);
        return `${dev.cams ? dev.cams.back + dev.cams.front : '–'} · ${dev.sensors?.length ?? '–'}`;
      } },
      { id: 'thermal', mod: ['cpu', 'thermal'], title: () => L('Hitze-Drosselung', 'Thermal throttling'), run: async s => {
        s.xr.setCoreLoad(1);
        const r = await new PrimeRun().run({ start: 0, end: null, seg: 2_000_000, threads: 1, seconds: 3, phase: 'bench', onLive: () => {} });
        const now = r.numbers / r.elapsed / 1e6;
        s.res.throttle = Math.max(0, (1 - now / s.res.cpu1) * 100);
        const l = await liveHw();
        const st = l?.thermal?.status;
        return `${F(100 - s.res.throttle, 0)} %${st != null ? ` · ${thermalName(st)}` : ''}`;
      } },
    ];

    const stepEls = STEPS.map(st => {
      const v = h('span', { class: 'v' });
      const el = h('div', { class: 'st' }, h('span', { class: 'dot' }), st.title(), v);
      stepsEl.append(el);
      return { el, v };
    });

    async function runCheck() {
      stop = false; hidden = false; checking = true;
      startBtn.style.display = 'none'; stopBtn.style.display = '';
      cats.style.display = 'none';
      xr.el.classList.add('checking');
      root.scrollTo({ top: 0, behavior: 'smooth' });
      setBusy(true, L('Geräte-Check', 'Device check'));
      void stayAwake(true);
      sfx.start();
      const res: Record<string, number> = {};
      const ctx: StepCtx = { xr, dev, res, stopped: () => stop, info: live };
      stepEls.forEach(e => { e.el.className = 'st'; e.v.textContent = ''; });
      let failed = '';
      try {
        for (let i = 0; i < STEPS.length && !stop; i++) {
          const st = STEPS[i];
          stepEls[i].el.className = 'st now';
          xr.setActive(st.mod, st.title().toUpperCase());
          sfx.module();
          stepEls[i].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const v = await st.run(ctx);
          xr.setCoreLoad(0);
          stepEls[i].el.className = 'st ok';
          stepEls[i].v.textContent = v;
          (Array.isArray(st.mod) ? st.mod : [st.mod]).forEach(m => xr.setDone(m));
          sfx.check();
        }
      } catch (e: any) { failed = String(e?.message ?? e); }
      finally {
        stopLive();
        xr.setActive(null); xr.setCoreLoad(0);
        xr.el.classList.remove('checking');
        checking = false;
        startBtn.style.display = ''; stopBtn.style.display = 'none';
        setBusy(false); void stayAwake(false);
      }
      if (stop || failed) {
        toast(hidden ? L('Abgebrochen: Die App war im Hintergrund.', 'Aborted: the app went to the background.') : failed || L('Abgebrochen.', 'Cancelled.'));
        sfx.fail();
        return;
      }
      // Punkte: je Kategorie 1000 = Bezugsgerät; gesamt = geometrisches Mittel
      const cat: [string, string, number][] = [
        ['cpu1', L('Einzelkern', 'Single core'), res.cpu1 / REF.cpu1], ['cpuN', L('Mehrkern', 'Multi core'), res.cpuN / REF.cpuN],
        ['gpu', 'GPU', res.gpu / REF.gpu], ['ai', L('KI', 'AI'), res.ai / REF.ai], ['ram', 'RAM', res.ram / REF.ram],
        ['storage', L('Speicher', 'Storage'), res.storage / REF.storage],
      ];
      const main = cat.slice(0, 5);
      const total = Math.round(1000 * Math.exp(main.reduce((s, [, , r]) => s + Math.log(Math.max(r, 1e-3)), 0) / main.length));
      cats.replaceChildren(h('h2', null, L('Ergebnis nach Bereichen', 'Result by area')));
      const maxR = Math.max(...cat.map(c => c[2]), 1.5);
      cat.forEach(([, name, r]) => {
        const bar = h('div');
        cats.append(h('div', { class: 'catbar' }, h('span', null, name), h('div', { class: 'bar' }, bar), h('b', null, N(r * 1000))));
        requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = `${Math.min(100, (r / maxR) * 100)}%`)));
      });
      cats.append(h('p', { class: 'muted small' }, L('1.000 Punkte je Bereich ≈ Handy der Mittelklasse. Gesamt = Mittel aus CPU, GPU, KI und RAM.', '1,000 points per area ≈ mid-range phone. Total = mean of CPU, GPU, AI and RAM.')));
      cats.style.display = '';
      addScore({
        kind: 'device', time: new Date().toISOString(), device: 'all', score: total, unit: L('Punkte', 'points'), points: total,
        detail: `${dev.soc.name}`, model: dev.name, version: VERSION, valid: true,
      });
      resultShow({
        title: L('Geräte-Check', 'Device check'), value: total, unit: L('Gesamtpunkte', 'total points'), kind: 'device', device: dev.name,
        lines: [
          [L('CPU Einzelkern', 'CPU single core'), rate(res.cpu1) + '/s'], [L('CPU Mehrkern', 'CPU multi core'), rate(res.cpuN) + '/s'],
          ['GPU', `${F(res.gpu, 1)} FPS`], [L('KI (FP16)', 'AI (FP16)'), `${N(res.ai)} GFLOPS`], ['RAM', `${F(res.ram, 1)} GB/s`],
        ],
      });
    }
  });

  // Live-Taktraten je Kern (Android): Kerne glühen nach echter Auslastung
  function startLive(xr: XRay, dev: DeviceProfile) {
    stopLive();
    const maxF = dev.maxFreqKHz ?? [];
    // Zeichnung: schnellste Kerne zuerst → CPU-Indizes nach Maximaltakt sortieren
    const order = maxF.map((f, i) => [f, i]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    liveTimer = window.setInterval(async () => {
      const l = await liveHw();
      const cur = l?.curFreqKHz;
      if (!cur || !order.length || cur.every(f => f <= 0)) { xr.setCoreLoad(new Array(dev.cores).fill(0).map(() => 0.75 + Math.random() * 0.25)); return; }
      xr.setCoreLoad(order.map(i => (cur[i] > 0 && maxF[i] > 0 ? cur[i] / maxF[i] : 0.9)));
    }, 350);
  }
  function stopLive() { if (liveTimer) { clearInterval(liveTimer); liveTimer = 0; } }

  return () => { stop = true; stopLive(); offHidden(); void stayAwake(false); };
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Schreiben + Lesen über IndexedDB (der Weg, den App-Daten gehen): 16 × 4 MB, mit Prüfsumme. */
async function storageTest(): Promise<number> {
  const db: IDBDatabase = await new Promise((res, rej) => {
    const r = indexedDB.open('primsieb-io', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('b');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const blk = 4 << 20, n = 16;
  const data = new Uint8Array(blk);
  for (let i = 0; i < blk; i += 4096) data[i] = (i / 4096) & 255;
  const tx = (mode: IDBTransactionMode, f: (s: IDBObjectStore) => void) => new Promise<void>((res, rej) => {
    const t = db.transaction('b', mode); f(t.objectStore('b')); t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
  const t0 = performance.now();
  await tx('readwrite', s => { for (let i = 0; i < n; i++) s.put(new Blob([data]), i); });
  let ok = true;
  for (let i = 0; i < n; i++) {
    const b: Blob = await new Promise(res => { const r = db.transaction('b').objectStore('b').get(i); r.onsuccess = () => res(r.result); });
    const back = new Uint8Array(await b.arrayBuffer());
    if (back[4096 * 7] !== 7) ok = false;
  }
  const secs = (performance.now() - t0) / 1000;
  await tx('readwrite', s => s.clear());
  db.close();
  if (!ok) throw new Error(L('Speichertest: Daten fehlerhaft zurückgelesen', 'Storage test: data read back incorrectly'));
  return (2 * n * blk) / secs / 1e6;
}

async function measureHz(): Promise<number> {
  const times: number[] = [];
  await new Promise<void>(res => {
    const f = (t: number) => { times.push(t); if (times.length < 90 && (times.length < 2 || t - times[0] < 1500)) requestAnimationFrame(f); else res(); };
    requestAnimationFrame(f);
    setTimeout(res, 2500);
  });
  if (times.length < 3) return 0;
  const d = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  return Math.round(1000 / d[Math.floor(d.length / 2)]);
}

const sensorName = (s: string) => ({
  accel: L('Beschleunigung', 'accelerometer'), gyro: L('Gyroskop', 'gyroscope'), magnet: L('Kompass', 'compass'), baro: L('Barometer', 'barometer'),
  proximity: L('Näherung', 'proximity'), light: L('Licht', 'light'), steps: L('Schritte', 'steps'),
} as Record<string, string>)[s] ?? s;

const thermalName = (s: number) => [L('kühl', 'cool'), L('leicht warm', 'light'), L('warm', 'moderate'), L('heiß', 'severe'), L('kritisch', 'critical'), L('Notfall', 'emergency'), L('Abschaltung', 'shutdown')][s] ?? '';
