// Entwickler-Werkzeug: rendert das App-Icon mit dem echten Schwarzen-Loch-Renderer und legt alle
// Icon- und Startbild-Größen für Android und iOS ab (über den /__save-Endpunkt des Vite-Dev-Servers).
// Aufruf: npm run dev, dann http://localhost:5174/tools/icons.html öffnen.
import { BlackHole } from '../src/gl/blackhole';

const log = (s: string) => { document.getElementById('log')!.textContent += '\n' + s; };

// ---------------------------------------------------------------- PNG ohne Alphakanal (App Store verlangt das)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
async function deflate(data: Uint8Array) {
  const s = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function pngRGB(c: HTMLCanvasElement): Promise<Blob> {
  const w = c.width, h = c.height;
  const px = c.getContext('2d')!.getImageData(0, 0, w, h).data;
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) raw[y * (1 + w * 3) + 1 + x * 3 + k] = px[(y * w + x) * 4 + k];
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Blob([sig, chunk('IHDR', ihdr), chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0))], { type: 'image/png' });
}
const pngRGBA = (c: HTMLCanvasElement) => new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/png'));

async function save(path: string, blob: Blob) {
  const r = await fetch('/__save?path=' + encodeURIComponent(path), { method: 'POST', body: blob });
  if (!r.ok) throw new Error(path + ': ' + r.status);
  log('✓ ' + path);
}

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------------------------------------------------------------- Motiv rendern
async function renderMaster(size: number): Promise<HTMLCanvasElement> {
  const gl = canvas(size, size);
  const dpr = window.devicePixelRatio || 1;
  gl.style.cssText = `position:fixed;left:0;top:0;width:${size / dpr}px;height:${size / dpr}px;opacity:0`;
  document.body.append(gl);
  const bh = new BlackHole(gl);
  bh.fixedRes = [size, size];
  bh.settings = { ...bh.settings, quality: 2, temp: 6600, exposure: 0.95, stars: true, doppler: true, disk: true, jets: 0, spin: 0 };
  bh.cam = { dist: 38, yaw: 0.9, pitch: 0.1, fov: 30 };
  const out = canvas(size, size);
  bh.render(3.0);
  bh.sync();
  out.getContext('2d')!.drawImage(gl, 0, 0);
  bh.dispose();
  gl.remove();
  return out;
}

function scaled(src: HTMLCanvasElement, w: number, h: number, frac: number, bg = '#000', round = false) {
  const c = canvas(w, h);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  if (round) { g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); g.clip(); }
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const s = Math.min(w, h) * frac;
  if (frac < 1) { g.save(); g.beginPath(); g.arc(w / 2, h / 2, s / 2, 0, Math.PI * 2); g.clip(); }
  g.drawImage(src, (w - s) / 2, (h - s) / 2, s, s);
  if (frac < 1) g.restore();
  return c;
}

async function main() {
  log('Rendere Motiv …');
  const master = await renderMaster(1024);
  document.body.append(master);
  master.style.width = '256px';
  // iOS
  await save('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', await pngRGB(scaled(master, 1024, 1024, 1)));
  for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
    await save('ios/App/App/Assets.xcassets/Splash.imageset/' + n, await pngRGB(scaled(master, 2732, 2732, 0.22, '#0e0f12')));
  // Android
  const dens: [string, number][] = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
  for (const [d, k] of dens) {
    const base = 'android/app/src/main/res/mipmap-' + d + '/';
    await save(base + 'ic_launcher.png', await pngRGBA(scaled(master, 48 * k, 48 * k, 1)));
    await save(base + 'ic_launcher_round.png', await pngRGBA(scaled(master, 48 * k, 48 * k, 1, '#000', true)));
    await save(base + 'ic_launcher_foreground.png', await pngRGBA(scaled(master, 108 * k, 108 * k, 1)));
  }
  const splash: [string, number, number][] = [
    ['drawable', 480, 320], ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480], ['drawable-land-xhdpi', 1280, 720],
    ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280], ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800],
    ['drawable-port-xhdpi', 720, 1280], ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920],
  ];
  for (const [d, w, h] of splash) await save(`android/app/src/main/res/${d}/splash.png`, await pngRGB(scaled(master, w, h, 0.3, '#0e0f12')));
  // Store-Grafiken
  await save('resources/icon-1024.png', await pngRGB(scaled(master, 1024, 1024, 1)));
  await save('resources/playstore-icon-512.png', await pngRGB(scaled(master, 512, 512, 1)));
  log('FERTIG');
}

main().catch(e => log('FEHLER: ' + e.message));
