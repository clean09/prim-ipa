// Singularität: Renderer (Raytracing in interner Auflösung → Bloom → Tonemapping auf den Bildschirm).
import { BLUR_FS, BRIGHT_FS, COMPOSITE_FS, TRACE_FS } from './blackhole.glsl';
import { Prog, createGL, drawFullscreen, framebuffer, gpuName, gpuSync, hasFloatRT, noise3D, texture } from './glutil';

export interface BhSettings {
  doppler: boolean; disk: boolean; stars: boolean; jets: number; spin: number;
  temp: number; quality: number; scale: number; density: number; glow: number; exposure: number;
}

export const DEFAULT_SETTINGS: BhSettings = {
  doppler: true, disk: true, stars: true, jets: 0, spin: 0, temp: 6200, quality: 1, scale: 0.5, density: 1, glow: 1, exposure: 0.85,
};

export interface Camera { dist: number; yaw: number; pitch: number; fov: number; roll?: number }

const QUALITY_STEPS = [110, 170, 260];

function iscoKerr(a: number): number {
  const M = 0.5, s = Math.min(Math.abs(a) / M, 0.998);
  const z1 = 1 + Math.cbrt(1 - s * s) * (Math.cbrt(1 + s) + Math.cbrt(1 - s));
  const z2 = Math.sqrt(3 * s * s + z1 * z1);
  return M * (3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2)));
}

export class BlackHole {
  readonly gl: WebGL2RenderingContext;
  readonly gpu: string;
  private trace: Prog; private bright: Prog; private blur: Prog; private comp: Prog;
  private noise: WebGLTexture;
  private hdr!: WebGLTexture; private hdrFb!: WebGLFramebuffer;
  private bl: WebGLTexture[] = []; private blFb: WebGLFramebuffer[] = [];
  private w = 0; private h = 0; private bw = 0; private bh = 0;
  readonly floatRT: boolean;
  settings: BhSettings = { ...DEFAULT_SETTINGS };
  cam: Camera = { dist: 34, yaw: 0.6, pitch: 0.17, fov: 60 };
  /** Feste interne Auflösung (Benchmark) statt Bildschirm × scale. */
  fixedRes: [number, number] | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = createGL(canvas);
    this.gpu = gpuName(this.gl);
    this.floatRT = hasFloatRT(this.gl);
    this.trace = new Prog(this.gl, TRACE_FS);
    this.bright = new Prog(this.gl, BRIGHT_FS);
    this.blur = new Prog(this.gl, BLUR_FS);
    this.comp = new Prog(this.gl, COMPOSITE_FS);
    this.noise = noise3D(this.gl, 64);
    this.gl.bindVertexArray(this.gl.createVertexArray());
  }

  private ensureTargets() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(2, Math.round(this.canvas.clientWidth * dpr)), ch = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    let w: number, h: number;
    if (this.fixedRes) {
      // feste Pixelzahl, Seitenverhältnis wie der Bildschirm
      const px = this.fixedRes[0] * this.fixedRes[1], asp = cw / ch;
      h = Math.round(Math.sqrt(px / asp)); w = Math.round(h * asp);
    } else {
      // Skalierung bezogen auf CSS-Pixel × min(dpr, 2) – auf hochauflösenden Displays sonst unnötig teuer
      const base = Math.min(dpr, 2) / dpr;
      w = Math.max(16, Math.round(cw * base * this.settings.scale));
      h = Math.max(16, Math.round(ch * base * this.settings.scale));
    }
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    if (this.hdr) { gl.deleteTexture(this.hdr); gl.deleteFramebuffer(this.hdrFb); this.bl.forEach(t => gl.deleteTexture(t)); this.blFb.forEach(f => gl.deleteFramebuffer(f)); }
    const fmt = this.floatRT ? [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT] : [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE];
    this.hdr = texture(gl, w, h, fmt[0], fmt[1], fmt[2], null, gl.LINEAR);
    this.hdrFb = framebuffer(gl, this.hdr);
    this.bw = Math.max(8, w >> 2); this.bh = Math.max(8, h >> 2);
    this.bl = []; this.blFb = [];
    if (this.floatRT)
      for (let i = 0; i < 2; i++) {
        const t = texture(gl, this.bw, this.bh, fmt[0], fmt[1], fmt[2], null, gl.LINEAR);
        this.bl.push(t); this.blFb.push(framebuffer(gl, t));
      }
  }

  get internalSize() { return [this.w, this.h] as const; }

  /** Ein Bild rechnen und anzeigen. */
  render(time: number, present = true) {
    const gl = this.gl, s = this.settings, c = this.cam;
    this.ensureTargets();
    // Kamera auf einer Kugel um das Loch, Blick zum Zentrum
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const pos = [c.dist * cp * Math.sin(c.yaw), c.dist * sp, -c.dist * cp * Math.cos(c.yaw)];
    const f = norm([-pos[0], -pos[1], -pos[2]]);
    let r = norm(cross(f, [0, 1, 0]));
    let u = cross(r, f);
    if (c.roll) {
      const cr = Math.cos(c.roll), sr = Math.sin(c.roll);
      const r2 = [r[0] * cr + u[0] * sr, r[1] * cr + u[1] * sr, r[2] * cr + u[2] * sr];
      u = [u[0] * cr - r[0] * sr, u[1] * cr - r[1] * sr, u[2] * cr - r[2] * sr];
      r = r2;
    }
    const kerr = s.spin > 0.005;
    const flags = (s.doppler ? 1 : 0) | (s.disk ? 2 : 0) | (s.stars ? 4 : 0) | (kerr ? 16 : 0);
    const a = kerr ? s.spin : 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFb);
    gl.viewport(0, 0, this.w, this.h);
    this.trace.use()
      .f('uCamPos', pos[0], pos[1], pos[2]).f('uCamF', f[0], f[1], f[2]).f('uCamR', r[0], r[1], r[2]).f('uCamU', u[0], u[1], u[2])
      .f('uTanHalf', tanHalf(c.fov, this.w / this.h)).f('uAspect', this.w / this.h).f('uTime', time).f('uTemp', s.temp)
      .f('uRes', this.w, this.h).i('uMaxSteps', QUALITY_STEPS[s.quality] ?? 170).i('uFlags', flags).i('uQuality', s.quality)
      .f('uSpin', a).f('uRin', kerr ? iscoKerr(a) : 3.0).f('uRplus', 0.5 + Math.sqrt(Math.max(0.25 - a * a, 0)))
      .f('uEscape', Math.max(c.dist * 1.15, 32)).f('uJet', s.jets).f('uDensity', s.density).f('uGlow', s.glow)
      .tex('uNoise', 0, this.noise, gl.TEXTURE_3D);
    drawFullscreen(gl);

    if (this.floatRT) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blFb[0]);
      gl.viewport(0, 0, this.bw, this.bh);
      this.bright.use().tex('uSrc', 0, this.hdr).f('uTexel', 1 / this.w, 1 / this.h);
      drawFullscreen(gl);
      for (let k = 0; k < 2; k++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blFb[1]);
        this.blur.use().tex('uSrc', 0, this.bl[0]).f('uDir', (1 + k) / this.bw, 0);
        drawFullscreen(gl);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blFb[0]);
        this.blur.use().tex('uSrc', 0, this.bl[1]).f('uDir', 0, (1 + k) / this.bh);
        drawFullscreen(gl);
      }
    }
    if (!present) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.comp.use().tex('uHdr', 0, this.hdr).tex('uBloom', 1, this.bl[0] ?? this.hdr)
      .f('uExposure', s.exposure).f('uBloomAmt', 0.8).f('uTime', time % 100).i('uHasBloom', this.floatRT ? 1 : 0);
    drawFullscreen(gl);
  }

  sync() { gpuSync(this.gl); }

  dispose() {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}

/** Hochformat: Breite des Bildfelds festhalten (~75°), sonst wäre das Loch auf dem Handy viel zu groß. */
function tanHalf(fov: number, aspect: number) {
  const t = Math.tan((fov * Math.PI) / 360);
  return aspect >= 1 ? t : (t * 1.3) / Math.max(aspect, 0.4);
}

function norm(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a: number[], b: number[]) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

// ------------------------------------------------------------------------------------------- Testflug
// 60 s in fünf Kapiteln. Punkte = Ø gerechnete Bilder pro Sekunde × 100 (in fester Auflösung 960×540,
// unabhängig von der Bildwiederholrate des Displays – es werden so viele Bilder gerechnet, wie die GPU schafft).
export const DEMO_SECONDS = 60;
export const DEMO_RES: [number, number] = [960, 540];

export interface DemoChapter { t: number; de: string; en: string }
export const DEMO_CHAPTERS: DemoChapter[] = [
  { t: 0, de: 'Anflug', en: 'Approach' },
  { t: 12, de: 'Umlaufbahn', en: 'Orbit' },
  { t: 24, de: 'Durch die Scheibe', en: 'Through the disk' },
  { t: 36, de: 'Das Loch rotiert (Kerr)', en: 'The hole spins (Kerr)' },
  { t: 48, de: 'Jets und Rückzug', en: 'Jets and retreat' },
];

const smooth = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

export function demoState(t: number, bh: BlackHole) {
  const s = bh.settings, c = bh.cam;
  s.doppler = true; s.disk = true; s.stars = true; s.quality = 1; s.temp = 6200 + 1900 * smooth(36, 44, t); s.exposure = 0.85; s.density = 1; s.glow = 1;
  // Abstand: 70 → 28 (Anflug), Umlauf bei 26, Tauchgang durch die Scheibe auf 14, zurück auf 26, Rückzug auf 53
  c.dist = 70 - 42 * smooth(0, 12, t) - 2 * smooth(12, 24, t) - 12 * smooth(24, 30, t) + 12 * smooth(32, 36, t) + 27 * smooth(48, 60, t);
  c.yaw = 0.3 + t * 0.07 + 0.9 * smooth(12, 24, t);
  // Neigung: leicht über der Scheibe, dann hindurch (von oben nach unten), dann wieder darüber
  c.pitch = 0.22 - 0.06 * smooth(12, 24, t) - 0.36 * smooth(24, 30, t) + 0.32 * smooth(30, 36, t) + 0.1 * smooth(48, 60, t);
  c.fov = 60;
  c.roll = 0.12 * Math.sin(t * 0.3) * smooth(12, 48, t) * (1 - smooth(48, 56, t));
  s.spin = 0.48 * smooth(36, 42, t);
  s.jets = 1.4 * smooth(46, 52, t);
}
