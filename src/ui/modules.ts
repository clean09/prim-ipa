// Interaktive Bauteil-Ansichten (Antippen in der Röntgenansicht): Live-Takt je Kern, Live-Akku, Wasserwaage,
// Pixel- und Touchtest fürs Display, Infos zu den übrigen Bauteilen.
import { DeviceProfile, batteryHealth, liveHw } from '../core/devices';
import { F, L, N } from '../core/i18n';
import { buzz } from '../core/native';
import { fitCanvas, h, sheet } from './dom';
import { sfx } from './fx';
import type { Module } from './xray';

const healthName = (s?: number) => s == null ? '' : ({ 2: L('gut', 'good'), 3: L('überhitzt', 'overheated'), 4: L('defekt', 'dead'), 5: L('Überspannung', 'over voltage'), 7: L('zu kalt', 'cold') } as Record<number, string>)[s] ?? '';

export function openModule(mod: Module, dev: DeviceProfile) {
  sfx.tap();
  switch (mod) {
    case 'cpu': case 'thermal': return cpuSheet(dev);
    case 'battery': return batterySheet(dev);
    case 'sensors': return levelSheet();
    case 'display': return displaySheet(dev);
    default: return infoSheet(mod, dev);
  }
}

// ------------------------------------------------------------------------------------------- CPU live
function cpuSheet(dev: DeviceProfile) {
  const bars = h('div', { class: 'livebars' });
  const info = h('p', { class: 'muted small' });
  let alive = true;
  const close = sheet(`CPU · ${dev.soc.name}`, h('p', { class: 'sub' },
    dev.clusters.map(c => `${c.count}× ${c.ghz ? F(c.ghz, 2) + ' GHz ' : ''}${c.label}`).join(' + ')), bars, info);
  const maxF = dev.maxFreqKHz ?? [];
  const order = maxF.map((f, i) => [f, i]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  const rows = order.map(i => {
    const fill = h('div'); const val = h('b', null, '–');
    const ghz = maxF[i] / 1e6;
    fill.style.background = ghz >= (maxF[order[0]] / 1e6) - 0.05 ? '#ffcf5a' : ghz > 2 ? '#ff9f43' : '#3dd6c4';
    bars.append(h('div', { class: 'lb' }, h('span', null, `CPU ${i}`), h('div', { class: 'bar' }, fill), val));
    return { i, fill, val };
  });
  if (!rows.length) { info.textContent = L('Live-Taktraten gibt es in der Android-App.', 'Live clock speeds are available in the Android app.'); return; }
  info.textContent = L('Aktueller Takt je Kern, zweimal pro Sekunde aktualisiert. Im Leerlauf takten die Kerne herunter – starte zum Vergleich einen Test.', 'Current clock per core, updated twice per second. Idle cores clock down – start a test to compare.');
  const tick = async () => {
    if (!alive || !document.body.contains(bars)) return;
    const l = await liveHw();
    rows.forEach(r => {
      const f = l?.curFreqKHz?.[r.i] ?? -1;
      r.fill.style.width = f > 0 ? `${Math.min(100, (f / maxF[r.i]) * 100)}%` : '0';
      r.val.textContent = f > 0 ? `${F(f / 1e6, 2)} GHz` : L('aus', 'off');
    });
    setTimeout(tick, 500);
  };
  void tick();
  void close;
  alive = true;
}

// ------------------------------------------------------------------------------------------- Akku live
function batterySheet(dev: DeviceProfile) {
  const box = h('dl', { class: 'spec' });
  const note = h('p', { class: 'muted small', style: { marginTop: '10px' } },
    L('Der Zustand ist eine Schätzung: aktueller Ladezähler ÷ Ladestand, verglichen mit der Werkskapazität. Am genauesten bei 50–100 % Ladung und ohne Ladegerät.',
      'Health is an estimate: current charge counter ÷ charge level, compared with the factory capacity. Most accurate at 50–100 % charge and unplugged.'));
  sheet(L('Akku', 'Battery'), box, note);
  const render = (b: any) => {
    const hh = batteryHealth(b ?? {});
    const rows: [string, string | undefined][] = [
      [L('Zustand (geschätzt)', 'Health (estimated)'), hh.pct != null ? `≈ ${N(hh.pct)} %` : L('nicht ermittelbar', 'not available')],
      [L('Kapazität jetzt', 'Capacity now'), hh.est ? `≈ ${N(hh.est)} mAh` : undefined],
      [L('Werkskapazität', 'Factory capacity'), b?.designMah ? `${N(b.designMah)} mAh` : undefined],
      [L('Ladezyklen', 'Charge cycles'), b?.cycles != null ? N(b.cycles) : undefined],
      [L('Ladestand', 'Charge level'), b?.level != null ? `${b.level} %` : undefined],
      [L('Temperatur', 'Temperature'), b?.tempC != null ? `${F(b.tempC, 1)} °C` : undefined],
      [L('Spannung', 'Voltage'), b?.voltage > 0 ? `${F(b.voltage / 1000, 2)} V` : undefined],
      [L('Strom', 'Current'), b?.currentUA ? `${N(Math.abs(b.currentUA) > 20000 ? b.currentUA / 1000 : b.currentUA)} mA` : undefined],
      [L('Status', 'Status'), [healthName(b?.health), b?.plugged ? L('lädt', 'charging') : L('entlädt', 'discharging')].filter(Boolean).join(' · ')],
      [L('Technik', 'Technology'), b?.technology],
    ];
    box.replaceChildren(...rows.filter(r => r[1]).flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v!)]));
  };
  render(dev.battery ? { ...dev.battery, plugged: dev.battery.charging } : null);
  const tick = async () => {
    if (!document.body.contains(box)) return;
    const l = await liveHw();
    if (l?.battery) render({ ...l.battery, designMah: l.battery.designMah ?? dev.battery?.designMah });
    setTimeout(tick, 1000);
  };
  void tick();
}

// ------------------------------------------------------------------------------------------- Wasserwaage
function levelSheet() {
  const c = h('canvas', { class: 'vis', style: { height: '300px' } });
  const read = h('div', { class: 'big', style: { textAlign: 'center', fontSize: '28px' } }, '0,0°');
  const startBtn = h('button', { class: 'btn primary block' }, L('Sensoren starten', 'Start sensors'));
  sheet(L('Sensoren · Wasserwaage', 'Sensors · spirit level'),
    h('p', { class: 'sub' }, L('Leg das Handy flach hin: Die Blase zeigt die Neigung, gemessen mit Beschleunigungssensor und Gyroskop.', 'Lay the phone flat: the bubble shows the tilt, measured with the accelerometer and gyroscope.')),
    c, read, startBtn);
  let x = 0, y = 0, tx = 0, ty = 0, running = false, wasLevel = false;
  const onMotion = (e: DeviceMotionEvent) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null || g.z == null) return;
    // Neigung in Grad (x = links/rechts, y = vor/zurück)
    tx = Math.atan2(g.x, Math.hypot(g.y, g.z)) * 180 / Math.PI;
    ty = Math.atan2(g.y, Math.hypot(g.x, g.z)) * 180 / Math.PI;
  };
  const draw = () => {
    if (!document.body.contains(c)) { removeEventListener('devicemotion', onMotion); return; }
    x += (tx - x) * 0.18; y += (ty - y) * 0.18;
    const [g, w, hh] = fitCanvas(c);
    g.fillStyle = '#05070c'; g.fillRect(0, 0, w, hh);
    const cx = w / 2, cy = hh / 2, R = Math.min(w, hh) / 2 - 14;
    const tilt = Math.hypot(x, y);
    const level = tilt < 1;
    g.strokeStyle = 'rgba(127,208,255,.35)'; g.lineWidth = 1.5;
    for (const r of [R, R * 0.66, R * 0.33, 14]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    const k = R / 30;                                   // 30° = Rand
    const bx = cx - Math.max(-30, Math.min(30, x)) * k, by = cy + Math.max(-30, Math.min(30, y)) * k;
    const col = level ? '#34c77b' : tilt < 5 ? '#ffcf5a' : '#5fd2ff';
    const gr = g.createRadialGradient(bx - 6, by - 6, 2, bx, by, 26);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(bx, by, 26, 0, Math.PI * 2); g.fill();
    read.textContent = running ? `${F(tilt, 1)}°${level ? ' ✓' : ''}` : '–';
    read.style.color = level ? 'var(--good)' : '';
    if (level && !wasLevel && running) { void buzz('light'); sfx.check(); }
    wasLevel = level;
    requestAnimationFrame(draw);
  };
  const start = async () => {
    const DM = DeviceMotionEvent as any;
    if (typeof DM?.requestPermission === 'function') {
      try { if ((await DM.requestPermission()) !== 'granted') return; } catch { return; }
    }
    addEventListener('devicemotion', onMotion);
    running = true; startBtn.remove();
  };
  startBtn.onclick = () => void start();
  // Android braucht keine Erlaubnis → direkt starten
  if (typeof (DeviceMotionEvent as any)?.requestPermission !== 'function') void start();
  requestAnimationFrame(draw);
}

// ------------------------------------------------------------------------------------------- Display
function displaySheet(dev: DeviceProfile) {
  const close = sheet(L('Display', 'Display'),
    h('p', { class: 'sub' }, dev.screen ? `${dev.screen.w}×${dev.screen.h}${dev.screen.hz ? ` · ${Math.round(dev.screen.hz)} Hz` : ''}${dev.screen.hdr ? ' · HDR' : ''}` : ''),
    h('div', { class: 'stack', style: { gap: '10px' } },
      h('button', { class: 'btn primary block', onclick: () => { close(); pixelTest(); } }, L('Pixeltest (Farben, tote Pixel)', 'Pixel test (colours, dead pixels)')),
      h('button', { class: 'btn block', onclick: () => { close(); touchTest(); } }, L('Touchtest (ganze Fläche abmalen)', 'Touch test (paint the whole surface)'))));
}

function fullscreen(tip: string) {
  const el = h('div', { class: 'fs', 'data-fs': '1' });
  const done = () => { el.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  (el as any).close = done;
  const bar = h('div', { class: 'fs-bar' }, h('button', { class: 'fs-btn', onclick: (e: Event) => { e.stopPropagation(); done(); } }, L('✕ Fertig', '✕ Done')));
  el.append(bar, h('div', { class: 'tip' }, tip));
  // nach unten wischen beendet (iPhone hat keine Zurück-Taste)
  let y0 = -1, x0 = 0;
  el.addEventListener('touchstart', e => { if (e.touches.length === 1) { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; } else y0 = -1; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (y0 < 0) return;
    const dy = e.changedTouches[0].clientY - y0, dx = Math.abs(e.changedTouches[0].clientX - x0);
    if (dy > 120 && dx < 80 && !el.dataset.paint) done();
    y0 = -1;
  }, { passive: true });
  document.body.append(el);
  el.requestFullscreen?.().catch(() => {});
  return { el, done, bar };
}

function pixelTest() {
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#808080', 'linear-gradient(90deg,#000,#fff)', 'linear-gradient(90deg,red,yellow,lime,cyan,blue,magenta,red)'];
  const names = [L('Rot', 'Red'), L('Grün', 'Green'), L('Blau', 'Blue'), L('Weiß', 'White'), L('Schwarz', 'Black'), L('Grau', 'Grey'), L('Verlauf', 'Gradient'), L('Spektrum', 'Spectrum')];
  const { el, bar } = fullscreen(L('Rechts tippen = weiter · links = zurück · nach unten wischen = beenden', 'Tap right = next · left = back · swipe down = exit'));
  let i = 0;
  const label = h('span', { class: 'fs-lbl' });
  const prev = h('button', { class: 'fs-btn', onclick: (e: Event) => { e.stopPropagation(); step(-1); } }, '‹');
  const next = h('button', { class: 'fs-btn', onclick: (e: Event) => { e.stopPropagation(); step(1); } }, '›');
  bar.prepend(prev, label, next);
  const show = () => { el.style.background = colors[i]; label.textContent = `${i + 1}/${colors.length} · ${names[i]}`; };
  const step = (d: number) => { i = (i + d + colors.length) % colors.length; show(); sfx.tap(); };
  show();
  el.addEventListener('click', e => step(e.clientX < innerWidth / 2 ? -1 : 1));
  // Bedienleiste nach 2,5 s ausblenden (sonst verdeckt sie Pixel), bei Berührung wieder zeigen
  let hideT = 0;
  const wake = () => { bar.classList.remove('dim'); clearTimeout(hideT); hideT = window.setTimeout(() => bar.classList.add('dim'), 2500); };
  el.addEventListener('pointerdown', wake);
  wake();
}

function touchTest() {
  const { el } = fullscreen(L('Mal mit dem Finger alle Kästchen an – bleibt eins dunkel, reagiert die Stelle nicht.', 'Paint every square with your finger – a square that stays dark means that spot does not respond.'));
  el.dataset.paint = '1';
  const c = h('canvas', { style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } });
  el.prepend(c);
  const [g, w, hh] = fitCanvas(c);
  const cell = Math.max(28, Math.min(w, hh) / 12);
  const cols = Math.ceil(w / cell), rows = Math.ceil(hh / cell);
  const hit = new Uint8Array(cols * rows);
  let count = 0, fingers = 0, maxFingers = 0;
  const status = h('div', { class: 'tip', style: { bottom: 'auto', top: 'calc(24px + var(--safe-top))' } });
  el.append(status);
  const draw = () => {
    g.fillStyle = '#05070c'; g.fillRect(0, 0, w, hh);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      g.fillStyle = hit[r * cols + q] ? 'rgba(52,199,123,.75)' : 'rgba(127,208,255,.08)';
      g.fillRect(q * cell + 1, r * cell + 1, cell - 2, cell - 2);
    }
    status.textContent = L(`${Math.round((count / hit.length) * 100)} % geprüft · max. ${maxFingers} Finger gleichzeitig`, `${Math.round((count / hit.length) * 100)} % tested · max ${maxFingers} fingers at once`);
  };
  const mark = (x: number, y: number) => {
    const q = Math.floor(x / cell), r = Math.floor(y / cell);
    if (q < 0 || r < 0 || q >= cols || r >= rows) return;
    const k = r * cols + q;
    if (!hit[k]) { hit[k] = 1; count++; if (count === hit.length) { sfx.success(); void buzz('success'); } }
  };
  el.addEventListener('touchstart', e => { fingers = e.touches.length; maxFingers = Math.max(maxFingers, fingers); for (const t of e.touches) mark(t.clientX, t.clientY); draw(); }, { passive: true });
  el.addEventListener('touchmove', e => { for (const t of e.touches) mark(t.clientX, t.clientY); draw(); }, { passive: true });
  el.addEventListener('pointermove', e => { if (e.buttons) { mark(e.clientX, e.clientY); draw(); } });
  draw();
}

// ------------------------------------------------------------------------------------------- übrige Bauteile
function infoSheet(mod: Module, dev: DeviceProfile) {
  const t: Record<string, [string, string]> = {
    gpu: [`GPU · ${dev.soc.gpu}`, L('Die Grafikeinheit rechnet Tausende Pixel gleichzeitig – hier testet PrimSieb sie mit Raytracing durch die gekrümmte Raumzeit eines Schwarzen Lochs.', 'The graphics unit computes thousands of pixels at once – PrimSieb tests it by ray tracing through a black hole\'s curved spacetime.')],
    npu: [`${L('KI-Einheit', 'AI unit')} · ${dev.soc.npu ?? 'NPU'}`, L('Spezialrechenwerk für neuronale Netze. Apps können es nur über Hersteller-Schnittstellen nutzen; der KI-Test misst daher die Matrix-Leistung der GPU in halber Genauigkeit (FP16).', 'Special engine for neural networks. Apps can only use it through vendor interfaces, so the AI test measures the GPU\'s half-precision (FP16) matrix throughput.')],
    ram: [`RAM · ${dev.ramGB ? F(dev.ramGB, 1) + ' GB' : ''}`, L('Arbeitsspeicher (LPDDR) sitzt direkt neben oder auf dem Chip. Der Neutronenstern-Test misst Bandbreite, Latenz und Stabilität.', 'Memory (LPDDR) sits right next to or on top of the chip. The neutron star test measures bandwidth, latency and stability.')],
    storage: [`${L('Speicher', 'Storage')} · ${dev.storageGB ? N(dev.storageGB) + ' GB' : 'UFS'}`, dev.storageFreeGB != null ? L(`${N(dev.storageFreeGB)} GB frei.`, `${N(dev.storageFreeGB)} GB free.`) : ''],
    cams: [L('Kameras', 'Cameras'), dev.cams ? L(`${dev.cams.back} Kameras hinten, ${dev.cams.front} vorne.`, `${dev.cams.back} back cameras, ${dev.cams.front} front.`) : ''],
    modem: [L('Funk', 'Radio'), L('Mobilfunk-Modem, WLAN und Bluetooth – PrimSieb nutzt sie nur für die freiwillige weltweite Bestenliste.', 'Cellular modem, Wi-Fi and Bluetooth – PrimSieb only uses them for the optional worldwide leaderboard.')],
  };
  const [title, text] = t[mod] ?? [mod, ''];
  sheet(title, h('p', null, text));
}
