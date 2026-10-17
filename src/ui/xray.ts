// Röntgenansicht des Geräts (SVG): Platine mit SoC (echte Kern-Cluster), GPU, KI-Einheit, RAM, Speicher, Akku, Kameras,
// Sensoren, Display. Das gerade getestete Modul leuchtet auf, Datenströme laufen zwischen SoC und Modul.
import { L } from '../core/i18n';
import type { DeviceProfile } from '../core/devices';

export type Module = 'cpu' | 'gpu' | 'npu' | 'ram' | 'storage' | 'battery' | 'display' | 'cams' | 'sensors' | 'modem' | 'thermal';

const CLUSTER_COLORS = ['#ffcf5a', '#ff9f43', '#3dd6c4', '#5fb0ff'];

export class XRay {
  readonly el: HTMLDivElement;
  private svg!: SVGSVGElement;
  private cores: SVGRectElement[] = [];
  private batFill: SVGRectElement | null = null;
  private batText: SVGTextElement | null = null;
  private status!: SVGTextElement;

  constructor(readonly dev: DeviceProfile) {
    this.el = document.createElement('div');
    this.el.className = 'xray';
    this.el.innerHTML = dev.form === 'pc' ? this.pc() : this.phone();
    this.svg = this.el.querySelector('svg')!;
    this.cores = [...this.svg.querySelectorAll<SVGRectElement>('.core')];
    this.batFill = this.svg.querySelector('#bat-fill');
    this.batText = this.svg.querySelector('#bat-text');
    this.status = this.svg.querySelector('#xr-status')!;
    if (dev.battery?.level != null) this.setBattery(dev.battery.level);
  }

  /** Antippen eines Bauteils */
  onTap(f: (m: Module) => void) {
    this.svg.querySelectorAll<SVGGElement>('.m').forEach(g => g.addEventListener('click', e => { e.stopPropagation(); f(g.dataset.m as Module); }));
  }

  /** Text im Akku (z. B. Zustand statt Ladestand). */
  setBatteryLabel(t: string) { if (this.batText) this.batText.textContent = t; }

  /** Modul hervorheben (null = alle normal). */
  setActive(mods: Module | Module[] | null, label = '') {
    const list = mods == null ? [] : Array.isArray(mods) ? mods : [mods];
    this.svg.classList.toggle('focus', list.length > 0);
    this.svg.querySelectorAll<SVGGElement>('.m').forEach(g => g.classList.toggle('on', list.includes(g.dataset.m as Module)));
    this.svg.querySelectorAll<SVGPathElement>('.flow').forEach(p => p.classList.toggle('run', list.includes(p.dataset.m as Module)));
    this.status.textContent = label;
  }

  /** Markiert ein Modul als geprüft (grüner Haken). */
  setDone(mod: Module, ok = true) {
    const g = this.svg.querySelector<SVGGElement>(`.m[data-m="${mod}"]`);
    g?.classList.add(ok ? 'done' : 'bad');
  }

  /** Last je Kern 0…1 (Farbe/Leuchten). Einzelkern-Test: nur ein Kern. */
  setCoreLoad(load: number[] | number) {
    this.cores.forEach((r, i) => {
      const v = typeof load === 'number' ? (i === 0 ? load : 0) : load[i] ?? 0;
      r.style.setProperty('--load', String(Math.max(0, Math.min(1, v))));
      r.classList.toggle('hot', v > 0.05);
    });
  }

  setBattery(level: number) {
    if (!this.batFill) return;
    const full = Number(this.batFill.dataset.h);
    const hh = (full * Math.max(0, Math.min(100, level))) / 100;
    this.batFill.setAttribute('height', String(hh));
    this.batFill.setAttribute('y', String(Number(this.batFill.dataset.y) + full - hh));
    this.batFill.style.fill = level < 20 ? '#ff5a52' : level < 50 ? '#ffa826' : '#34c77b';
    if (this.batText) this.batText.textContent = `${Math.round(level)} %`;
  }

  /** Einscann-Animation (beim Erkennen). */
  scan(on: boolean) { this.svg.classList.toggle('scanning', on); }

  // ----------------------------------------------------------------------------------------- Handy / Tablet
  private phone(): string {
    const d = this.dev;
    const tablet = d.form === 'tablet';
    const W = tablet ? 440 : 300, H = tablet ? 600 : 600;
    const pad = 14, r = tablet ? 26 : 38;
    const inner = { x: pad + 10, y: pad + 10, w: W - 2 * pad - 20, h: H - 2 * pad - 20 };
    // SoC-Bereich
    const socW = tablet ? 150 : 132, socH = tablet ? 132 : 122;
    const socX = W / 2 - socW / 2 + (tablet ? 0 : 6), socY = tablet ? 120 : 132;
    const clusters = d.clusters.length ? d.clusters : [{ count: d.cores, ghz: 0, label: 'Kerne' }];
    const total = clusters.reduce((s, c) => s + c.count, 0) || d.cores;
    const gap = 3;
    const cs = total > 10 ? 11 : 13;
    const perRow = Math.max(2, Math.floor((socW - 20 - 46) / (cs + gap)));
    let coresSvg = '';
    let idx = 0, row = 0, col = 0;
    const cx0 = socX + 10, cy0 = socY + 26;
    clusters.forEach((c, ci) => {
      for (let k = 0; k < c.count; k++) {
        if (col >= perRow) { col = 0; row++; }
        const x = cx0 + col * (cs + gap), y = cy0 + row * (cs + gap);
        coresSvg += `<rect class="core" data-i="${idx}" x="${x}" y="${y}" width="${cs}" height="${cs}" rx="2.5" style="--c:${CLUSTER_COLORS[ci % 4]}"/>`;
        idx++; col++;
      }
      if (ci < clusters.length - 1 && col > 0 && col + clusters[ci + 1].count > perRow) { col = 0; row++; }
    });
    const cpuH = (row + 1) * (cs + gap) + 6;
    const cpuW = perRow * (cs + gap) + 8;
    const gx = cx0 + cpuW + 4, gw = socX + socW - 10 - gx;
    const gpuBox = `<rect x="${gx}" y="${cy0 - 4}" width="${gw}" height="${cpuH * 0.62}" rx="4" class="blk"/>` +
      Array.from({ length: 12 }, (_, i) => `<rect x="${gx + 5 + (i % 4) * ((gw - 10) / 4)}" y="${cy0 + 2 + Math.floor(i / 4) * 9}" width="${(gw - 10) / 4 - 3}" height="6" rx="1" class="gcell"/>`).join('');
    const npuY = cy0 - 4 + cpuH * 0.62 + 5;
    const npuBox = `<rect x="${gx}" y="${npuY}" width="${gw}" height="${Math.max(20, cy0 + cpuH - npuY - 2)}" rx="4" class="blk"/>`;
    const socName = esc(d.soc.name), node = d.soc.node ? ` · ${d.soc.node}` : '';
    // RAM neben/unter dem SoC
    const ramGB = d.ramGB ? Math.round(d.ramGB) : null;
    const ramY = socY + socH + 12;
    const ramChips = [0, 1].map(i => `<rect x="${socX + i * (socW / 2 + 3)}" y="${ramY}" width="${socW / 2 - 3}" height="30" rx="4" class="chip"/>
      <text x="${socX + i * (socW / 2 + 3) + socW / 4 - 1.5}" y="${ramY + 19}" class="lbl c">LPDDR</text>`).join('');
    // Speicher + Modem links vom SoC
    const stoX = inner.x + 8, stoY = socY + 6;
    const stoW = socX - stoX - 12;
    // Akku
    const batY = ramY + 50, batH = H - pad - 74 - batY, batX = inner.x + 16, batW = inner.w - 32;
    // Kameras
    const cams = this.cams(W, socY);
    // Sensoren rechts oben
    const sx = W - pad - 46;
    const sensorCount = d.sensors?.length ?? 4;
    const sensors = Array.from({ length: Math.min(6, Math.max(3, sensorCount)) }, (_, i) =>
      `<rect x="${sx + (i % 2) * 16}" y="${socY + 8 + Math.floor(i / 2) * 16}" width="12" height="12" rx="2" class="chip small"/>`).join('');

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <pattern id="pcb" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" class="grid"/></pattern>
  <linearGradient id="scanG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5fd2ff" stop-opacity="0"/><stop offset=".5" stop-color="#5fd2ff" stop-opacity=".55"/><stop offset="1" stop-color="#5fd2ff" stop-opacity="0"/></linearGradient>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g class="m" data-m="display"><rect x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" rx="${r}" class="body"/>
  <rect x="${pad + 5}" y="${pad + 5}" width="${W - 2 * pad - 10}" height="${H - 2 * pad - 10}" rx="${r - 5}" class="glass"/>
  <text x="${W / 2}" y="${pad + 22}" class="lbl c dim">${L('Display', 'Display')}${d.screen ? ` · ${d.screen.w}×${d.screen.h}${d.screen.hz ? ` · ${Math.round(d.screen.hz)} Hz` : ''}` : ''}</text></g>
<rect x="${inner.x}" y="${inner.y + 20}" width="${inner.w}" height="${inner.h - 40}" rx="${r - 14}" fill="url(#pcb)" class="board"/>
<!-- Leiterbahnen / Datenströme -->
<path class="flow" data-m="ram" d="M${socX + socW / 2} ${socY + socH} V${ramY}"/>
<path class="flow" data-m="storage" d="M${socX} ${socY + 40} H${stoX + stoW}"/>
<path class="flow" data-m="battery" d="M${socX + socW / 2} ${ramY + 30} V${batY}"/>
<path class="flow" data-m="display" d="M${socX + socW} ${socY + 20} H${W - pad - 6}"/>
<path class="flow" data-m="cams" d="M${socX + 20} ${socY} V${socY - 26}"/>
<path class="flow" data-m="sensors" d="M${socX + socW} ${socY + 60} H${sx}"/>
<path class="flow" data-m="gpu" d="M${socX + socW / 2} ${socY + socH} V${ramY}"/>
<path class="flow" data-m="npu" d="M${socX + socW / 2} ${socY + socH} V${ramY}"/>
<g class="m" data-m="thermal"><rect x="${socX - 10}" y="${socY - 10}" width="${socW + 20}" height="${socH + 20}" rx="10" class="vapor"/></g>
<g class="m" data-m="cpu">
  <rect x="${socX}" y="${socY}" width="${socW}" height="${socH}" rx="8" class="soc"/>
  <text x="${socX + socW / 2}" y="${socY + 15}" class="lbl c strong">${socName}</text>
  <text x="${socX + socW / 2}" y="${socY + socH - 8}" class="lbl c dim">${d.cores} ${L('Kerne', 'cores')}${node}</text>
  ${coresSvg}
</g>
<g class="m" data-m="gpu">${gpuBox}<text x="${gx + gw / 2}" y="${cy0 + cpuH * 0.62 - 9}" class="lbl c tiny">GPU</text></g>
<g class="m" data-m="npu">${npuBox}<text x="${gx + gw / 2}" y="${npuY + 13}" class="lbl c tiny">${esc(d.soc.npu ?? 'KI')}</text></g>
<g class="m" data-m="ram">${ramChips}<text x="${socX + socW / 2}" y="${ramY + 42}" class="lbl c dim">${ramGB ? `${ramGB} GB ` : ''}RAM</text></g>
<g class="m" data-m="storage"><rect x="${stoX}" y="${stoY}" width="${stoW}" height="44" rx="5" class="chip"/>
  <text x="${stoX + stoW / 2}" y="${stoY + 20}" class="lbl c">UFS</text>
  <text x="${stoX + stoW / 2}" y="${stoY + 33}" class="lbl c tiny dim">${d.storageGB ? `${Math.round(d.storageGB)} GB` : L('Speicher', 'Storage')}</text></g>
<g class="m" data-m="modem"><rect x="${stoX}" y="${stoY + 54}" width="${stoW}" height="32" rx="5" class="chip"/>
  <text x="${stoX + stoW / 2}" y="${stoY + 74}" class="lbl c tiny">5G · WLAN</text></g>
<g class="m" data-m="sensors">${sensors}<text x="${sx + 14}" y="${socY + 8 + Math.ceil(Math.min(6, Math.max(3, sensorCount)) / 2) * 16 + 10}" class="lbl c tiny dim">${L('Sensoren', 'Sensors')}</text></g>
${cams}
<g class="m" data-m="battery">
  <rect x="${batX}" y="${batY}" width="${batW}" height="${batH}" rx="14" class="bat"/>
  <rect id="bat-fill" x="${batX + 6}" y="${batY + 6}" data-y="${batY + 6}" data-h="${batH - 12}" width="${batW - 12}" height="${batH - 12}" rx="10" class="batfill"/>
  <text x="${W / 2}" y="${batY + batH / 2 - 4}" class="lbl c strong big">${L('Akku', 'Battery')}</text>
  <text id="bat-text" x="${W / 2}" y="${batY + batH / 2 + 16}" class="lbl c"></text>
</g>
<rect x="${W / 2 - 22}" y="${H - pad - 4}" width="44" height="6" rx="3" class="port"/>
<rect class="scanbar" x="${pad}" y="0" width="${W - 2 * pad}" height="70" fill="url(#scanG)"/>
<text id="xr-status" x="${W / 2}" y="${H - pad - 20}" class="lbl c status"></text>
</svg>`;
  }

  private cams(W: number, socY: number): string {
    const d = this.dev, back = Math.max(1, Math.min(4, d.cams?.back ?? 2));
    const lens = (x: number, y: number, rr: number) => `<circle cx="${x}" cy="${y}" r="${rr}" class="lens"/><circle cx="${x}" cy="${y}" r="${rr * 0.45}" class="lens-in"/>`;
    let out = '', labelY = 0;
    const top = socY - 70;
    if (d.soc.vendor === 'google' || /pixel/i.test(d.name)) {
      // Kameraleiste quer über die Rückseite
      out = `<rect x="34" y="${top}" width="${W - 68}" height="46" rx="23" class="cambar"/>` +
        Array.from({ length: back }, (_, i) => lens(70 + i * 40, top + 23, 14)).join('') + `<circle cx="${W - 70}" cy="${top + 23}" r="5" class="flash"/>`;
      labelY = top + 58;
    } else if (d.maker === 'Apple') {
      const pts = back >= 3 ? [[0, 0], [0, 1], [1, 0.5]] : back === 2 ? [[0, 0], [0, 1]] : [[0, 0]];
      out = `<rect x="34" y="${top - 24}" width="88" height="88" rx="24" class="cambar"/>` + pts.map(([cx, cy]) => lens(58 + cx * 40, top - 2 + cy * 42, 16)).join('');
      labelY = top + 76;
    } else {
      // senkrechte Reihe (Samsung u. a.)
      out = Array.from({ length: back }, (_, i) => lens(56, top - 20 + i * 36, 15)).join('');
      labelY = top - 16;
    }
    return `<g class="m" data-m="cams">${out}<text x="${d.soc.vendor === 'google' || /pixel/i.test(d.name) || d.maker === 'Apple' ? W / 2 : 80}" y="${labelY}" class="lbl ${d.soc.vendor === 'google' || /pixel/i.test(d.name) || d.maker === 'Apple' ? 'c' : ''} tiny dim">${back} ${L('Kameras', 'cameras')}${d.cams?.front ? ` + ${d.cams.front} ${L('vorne', 'front')}` : ''}</text></g>`;
  }

  // ----------------------------------------------------------------------------------------- PC (Browser-Version)
  private pc(): string {
    const d = this.dev, W = 440, H = 520;
    const n = Math.min(d.cores, 24), per = n > 12 ? 6 : 4;
    let cores = '';
    for (let i = 0; i < n; i++) cores += `<rect class="core" x="${150 + (i % per) * 22}" y="${130 + Math.floor(i / per) * 22}" width="17" height="17" rx="3" style="--c:${CLUSTER_COLORS[0]}"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs><pattern id="pcb" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" class="grid"/></pattern>
<linearGradient id="scanG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5fd2ff" stop-opacity="0"/><stop offset=".5" stop-color="#5fd2ff" stop-opacity=".55"/><stop offset="1" stop-color="#5fd2ff" stop-opacity="0"/></linearGradient></defs>
<g class="m" data-m="display"><rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="16" class="body"/></g>
<rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="10" fill="url(#pcb)" class="board"/>
<path class="flow" data-m="ram" d="M290 170 H330"/><path class="flow" data-m="gpu" d="M210 270 V330"/><path class="flow" data-m="storage" d="M140 200 H100"/>
<g class="m" data-m="thermal"><rect x="120" y="90" width="180" height="180" rx="14" class="vapor"/></g>
<g class="m" data-m="cpu"><rect x="130" y="100" width="160" height="160" rx="10" class="soc"/><text x="210" y="120" class="lbl c strong">CPU · ${d.cores} Threads</text>${cores}</g>
<g class="m" data-m="ram">${[0, 1, 2, 3].map(i => `<rect x="${340 + i * 18}" y="60" width="12" height="230" rx="3" class="chip"/>`).join('')}<text x="372" y="306" class="lbl c dim">RAM</text></g>
<g class="m" data-m="gpu"><rect x="40" y="330" width="${W - 80}" height="90" rx="10" class="blk"/>
  ${Array.from({ length: 24 }, (_, i) => `<rect x="${56 + (i % 12) * 28}" y="${346 + Math.floor(i / 12) * 26}" width="22" height="18" rx="2" class="gcell"/>`).join('')}
  <text x="${W / 2}" y="440" class="lbl c">${esc(d.soc.gpu || d.gpuRenderer)}</text></g>
<g class="m" data-m="npu"><rect x="40" y="250" width="70" height="40" rx="6" class="blk"/><text x="75" y="275" class="lbl c tiny">KI</text></g>
<g class="m" data-m="storage"><rect x="40" y="160" width="60" height="80" rx="6" class="chip"/><text x="70" y="204" class="lbl c tiny">SSD</text></g>
<rect class="scanbar" x="10" y="0" width="${W - 20}" height="70" fill="url(#scanG)"/>
<text id="xr-status" x="${W / 2}" y="${H - 30}" class="lbl c status"></text>
</svg>`;
  }
}

const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
