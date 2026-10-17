// Startseite: redaktionell wie die Desktop-Startseite (Benchmarks · Simulationen · Spiele · System & Ergebnisse) –
// großer Titel, Laufband mit echten Kennzahlen, Gerätekarte mit Röntgenbild, Sternenleben als lebendiges Titelbild.
import { L, N, F } from '../core/i18n';
import { cores, deviceName, memoryGB } from '../core/native';
import { go } from '../core/nav';
import { ScoreEntry, VERSION, scores, settings } from '../core/store';
import { levelOf } from '../games/progress';
import { gpuName } from '../gl/glutil';
import { h } from '../ui/dom';
import { detectDevice } from '../core/devices';
import { XRay } from '../ui/xray';
import { rankFor } from '../ui/fx';
import { icon } from '../ui/icons';
import { SpaceKind, spaceStyle } from '../ui/cosmos';
import { maskTitle, countUp, spotlight } from '../ui/motion';
import { StellarModel } from '../star/model';
import { StarView } from '../star/render';
import { reducedMotion } from '../core/theme';

let gpuCache = '';
function gpu() {
  if (gpuCache) return gpuCache;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    gpuCache = gl ? gpuName(gl) : L('ohne WebGL2', 'no WebGL2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { gpuCache = '–'; }
  return gpuCache;
}

const best = (kind: ScoreEntry['kind'], key: (e: ScoreEntry) => number) => {
  const l = scores().filter(e => e.valid && e.kind === kind);
  return l.length ? l.reduce((a, b) => (key(b) > key(a) ? b : a)) : null;
};

export function mountHome(root: HTMLElement) {
  const prime = best('prime', e => e.points ?? 0), bh = best('bh', e => e.points ?? 0), ai = best('ai', e => e.score);
  const devBest = best('device', e => e.points ?? 0);
  const mem = memoryGB();
  let n = 0;
  const row = (art: [SpaceKind, number], title: string, sub: string, value: string, unit: string, target: string) => {
    const el = h('div', { class: 'ed', style: spaceStyle(art[0], art[1]) as any, onclick: () => go(target) },
      h('div', { class: 'art' }),
      h('span', { class: 'n' }, String(++n).padStart(2, '0')),
      h('div', { class: 't' }, h('b', null, title), h('small', null, sub)),
      value ? h('div', { class: 'v' }, h('b', null, value), unit) : h('span', { class: 'go' }, icon('arrow')));
    el.addEventListener('pointerdown', () => el.classList.add('hot'));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => setTimeout(() => el.classList.remove('hot'), 220)));
    return el;
  };
  const sec = (no: string, title: string, note: string) =>
    h('div', { class: 'sec-h' }, h('span', { class: 'n' }, `(${no})`), h('h2', null, title), h('small', null, note));

  // ---------------------------------------------------------------- Titel
  const date = new Date().toLocaleDateString(L('de-DE', 'en-GB'), { day: '2-digit', month: 'short', year: 'numeric' });
  const title = maskTitle('Prim Sieb .', 'h-title');
  const hero = h('section', { class: 'h-hero' },
    h('div', { class: 'h-k' }, h('span', null, L('(00) — Übersicht', '(00) — Overview')), h('span', null, date)),
    title,
    h('p', { class: 'h-lead' }, L('Benchmarks, Simulationen und Spiele – ', 'Benchmarks, simulations and games – '),
      h('b', null, L('alles rechnet offline auf diesem Gerät.', 'everything runs offline on this device.'))));

  // ---------------------------------------------------------------- Laufband (echte Werte)
  const facts = [
    `${L('Kerne', 'Cores')} <b>${cores()}</b>`, `GPU <b>${gpu()}</b>`, mem ? `RAM <b>≥ ${mem} GB</b>` : '',
    devBest ? `${L('Geräte-Check', 'Device check')} <b>${N(devBest.points ?? 0)}</b>` : '',
    prime ? `${L('Primzahlen', 'Primes')} <b>${N(prime.points ?? 0)}</b>` : '',
    `π(10⁹) <b>50 847 534</b>`, `M<sub>127</sub> <b>${L('prim', 'prime')}</b>`, `PrimSieb <b>${VERSION}</b>`,
  ].filter(Boolean).map(s => `<span>${s}</span>`).join('');
  const marquee = h('div', { class: 'marquee' }, h('div', { html: facts + facts }));

  // ---------------------------------------------------------------- Gerät
  const xrayBox = h('div');
  const devName = h('div', { class: 'nm' }, deviceName());
  const kv = h('dl', { class: 'kv' }, h('dt', null, 'CPU'), h('dd', null, `${cores()} ${L('Kerne', 'cores')}`), h('dt', null, 'GPU'), h('dd', null, gpu()));
  const pts = h('div', { class: 'big', style: { fontSize: '34px', marginTop: '12px' } }, '–');
  const rk = devBest ? rankFor('device', devBest.points ?? 0) : null;
  const devCard = h('div', { class: 'hero devc', onclick: () => go('device') },
    h('div', { style: { minWidth: '0' } },
      h('div', { class: 'lbl' }, L('Dein Gerät', 'Your device')), devName, kv,
      devBest ? h('div', null, pts, h('div', { class: 'label', style: { color: rk!.color } }, `${L('Punkte', 'points')} · ${rk!.name}`))
        : h('div', { class: 'badge', style: { marginTop: '12px' } }, L('Noch nicht geprüft → Check starten', 'Not tested yet → start check'))),
    xrayBox);
  if (devBest) countUp(pts, devBest.points ?? 0, v => N(v));
  void detectDevice().then(d => {
    devName.textContent = d.name;
    kv.innerHTML = '';
    kv.append(h('dt', null, 'SoC'), h('dd', null, d.soc.name), h('dt', null, 'GPU'), h('dd', null, d.soc.gpu !== 'GPU' ? d.soc.gpu : d.gpuRenderer),
      d.ramGB ? h('dt', null, 'RAM') : '', d.ramGB ? h('dd', null, `${Math.round(d.ramGB)} GB`) : '');
    const xr = new XRay(d);
    xr.el.style.padding = '2px';
    xrayBox.append(xr.el);
    xr.scan(true);
    setTimeout(() => xr.scan(false), 1600);
  });

  // ---------------------------------------------------------------- Sternenleben als Titelbild (echter Renderer, die Sonne)
  const fc = h('canvas');
  const feat = h('div', { class: 'feat', onclick: () => go('star') },
    fc, h('span', { class: 'new' }, L('NEU · 4.0', 'NEW · 4.0')),
    h('span', { class: 'k' }, L('Simulation', 'Simulation')),
    h('b', null, L('Sternen­leben', 'Star life')),
    h('small', null, L('Von der Gaswolke bis zur Supernova – innen steuert außen.', 'From gas cloud to supernova – the inside drives the outside.')),
    h('span', { class: 'cta' }, icon('arrow')));
  spotlight(feat);
  let view: StarView | null = null, alive = true;
  try {
    view = new StarView(fc);
    view.scale = 0.5; view.sunRing = false;
    const model = new StellarModel({ m: 1 });
    const k = model.segs.findIndex(s => s.name === 'Hauptreihe');
    const st = model.at(k + 0.4);
    const t0 = performance.now();
    let last = 0;
    const loop = (now: number) => {
      if (!alive || !view) return;
      if (now - last > 40 && !document.hidden) { last = now; view.render(model, st, (now - t0) / 1000 + 20); }
      if (!reducedMotion()) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } catch { /* ohne WebGL2 bleibt das Motiv dunkel */ }

  const lv = settings().game ? levelOf((settings().game as any).xp ?? 0).level : 0;
  root.append(h('div', { class: 'stack' },
    hero, marquee, devCard, feat,
    sec('01', 'Benchmarks', L('CPU · GPU · RAM', 'CPU · GPU · RAM')),
    h('div', { class: 'ed-list' },
      row(['cluster', 220], L('Primzahlen', 'Primes'), L('Sieb des Eratosthenes auf allen Kernen', 'Sieve of Eratosthenes on all cores'), prime ? N(prime.points ?? 0) : '', L('Punkte', 'points'), 'prime'),
      row(['galaxy', 270], L('KI-Leistung', 'AI performance'), L('Matrix-Durchsatz FP16/FP32, Bildgenerierung', 'Matrix throughput FP16/FP32, image generation'), ai ? F(ai.score, 0) : '', 'GFLOPS', 'ai'),
      row(['pulsar', 175], L('Neutronenstern', 'Neutron star'), L('Arbeitsspeicher: Bandbreite und Latenz', 'Memory: bandwidth and latency'), '', '', 'ram')),
    sec('02', L('Simulationen', 'Simulations'), 'WebGL2'),
    h('div', { class: 'ed-list' },
      row(['sun', 30], L('Sternenleben', 'Star life'), L('Masse wählen, Leben vorspulen, ins Innere schneiden', 'Pick a mass, scrub through its life, cut inside'), '', '', 'star'),
      row(['blackhole', 28], L('Singularität', 'Singularity'), L('Raytracing durch gekrümmte Raumzeit', 'Ray tracing through curved spacetime'), bh ? N(bh.points ?? 0) : '', L('Punkte', 'points'), 'bh'),
      row(['nebula', 130], L('Mathe-Labor', 'Math lab'), 'π · Fibonacci · N-Körper · Collatz', '', '', 'lab')),
    sec('03', L('Spiele', 'Games'), lv ? `Level ${lv}` : ''),
    h('div', { class: 'ed-list' },
      row(['ringed', 330], L('Primzahl-Spiele', 'Prime games'), L('Jagd · Blitz · Planetenspalter · Mathe-Profi · π', 'Hunt · Blitz · Splitter · Math pro · π'), lv ? String(lv) : '', 'Level', 'games')),
    sec('04', L('System & Ergebnisse', 'System & results'), ''),
    h('div', { class: 'ed-list' },
      row(['nebula', 195], L('Geräte-Check', 'Device check'), L('Jedes Bauteil prüfen, Röntgenansicht', 'Test every component, x-ray view'), devBest ? N(devBest.points ?? 0) : '', L('Punkte', 'points'), 'device'),
      row(['constellation', 225], L('Bestenliste', 'Leaderboard'), L('Meine und weltweite Ergebnisse', 'Mine and worldwide results'), String(scores().filter(e => e.valid).length || ''), L('Einträge', 'entries'), 'board'),
      row(['comet', 40], L('Zahl prüfen', 'Check a number'), 'Miller-Rabin · Lucas-Lehmer', '', '', 'check'),
      row(['moon', 220], L('Einstellungen', 'Settings'), L('5 Designs, Bewegung, Sprache, Ton', '5 designs, motion, language, sound'), '', '', 'info')),
    h('p', { class: 'muted small mono', style: { textAlign: 'center', marginTop: '18px' } },
      L('Für faire Werte: Handy kühl halten, nicht laden.', 'For fair results: keep the phone cool and unplugged.'))));
  return () => { alive = false; view?.dispose(); };
}
