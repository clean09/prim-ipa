// KI-Leistung auf der GPU (WebGL2):
//  • Matrix-Durchsatz C = A·B in FP32 (highp) und FP16 (mediump, auf Handy-GPUs echte Halbgenauigkeit).
//    Werte aus {−1, 0, 1} → Ergebnis exakt, wird stichprobenartig geprüft.
//  • Bildgenerierung: CPPN – jedes Pixel läuft durch ein voll verbundenes neuronales Netz (Port von NeuralArt.cs).
import { Prog, createGL, drawFullscreen, framebuffer, gpuName, hasFloatRT, texture } from './glutil';

const gemmFs = (prec: 'highp' | 'mediump') => `#version 300 es
precision ${prec} float; precision highp int; precision ${prec} sampler2D;
uniform sampler2D uA, uBt; uniform int uK4;
out vec4 o;
void main() {
  int jx = int(gl_FragCoord.x), i = int(gl_FragCoord.y);
  vec4 acc = vec4(0.0);
  for (int k = 0; k < uK4; ++k) {
    vec4 a = texelFetch(uA, ivec2(k, i), 0);
    acc.x += dot(a, texelFetch(uBt, ivec2(k, 4 * jx + 0), 0));
    acc.y += dot(a, texelFetch(uBt, ivec2(k, 4 * jx + 1), 0));
    acc.z += dot(a, texelFetch(uBt, ivec2(k, 4 * jx + 2), 0));
    acc.w += dot(a, texelFetch(uBt, ivec2(k, 4 * jx + 3), 0));
  }
  o = acc;
}`;

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; };
}

export interface GemmResult { gflops: number; ok: boolean; seconds: number; passes: number }

export class GemmGpu {
  readonly gl: WebGL2RenderingContext;
  readonly gpu: string;
  constructor(canvas: HTMLCanvasElement) {
    this.gl = createGL(canvas);
    if (!hasFloatRT(this.gl)) throw new Error('Diese GPU kann nicht in Float-Texturen rechnen.|This GPU cannot render to float textures.');
    this.gpu = gpuName(this.gl);
    this.gl.bindVertexArray(this.gl.createVertexArray());
  }

  /** Läuft `seconds` Sekunden; ruft zwischendurch onRate(GFLOPS) auf. */
  async run(n: number, fp16: boolean, seconds: number, onRate: (g: number, f: number) => void, stop: () => boolean): Promise<GemmResult> {
    const gl = this.gl;
    const A = new Float32Array(n * n), B = new Float32Array(n * n);
    const r = lcg(12345);
    for (let i = 0; i < n * n; i++) A[i] = (r() % 3) - 1;
    for (let i = 0; i < n * n; i++) B[i] = (r() % 3) - 1;
    const Bt = new Float32Array(n * n);
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) Bt[j * n + k] = B[k * n + j];
    const k4 = n / 4;
    const [ifmt, type] = fp16 ? [gl.RGBA16F, gl.FLOAT] : [gl.RGBA32F, gl.FLOAT];
    const tA = texture(gl, k4, n, ifmt, gl.RGBA, type, A);
    const tB = texture(gl, k4, n, ifmt, gl.RGBA, type, Bt);
    const tC = texture(gl, k4, n, ifmt, gl.RGBA, gl.FLOAT, null);
    const fb = framebuffer(gl, tC);
    const prog = new Prog(gl, gemmFs(fp16 ? 'mediump' : 'highp'));
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, k4, n);
    prog.use().tex('uA', 0, tA).tex('uBt', 1, tB).i('uK4', k4);
    const sync = () => { const px = new Float32Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px); };
    drawFullscreen(gl); sync();                                  // Warm-up (Shader übersetzen)
    let passes = 0, batch = 1;
    const t0 = performance.now();
    let el = 0;
    while (el < seconds && !stop()) {
      const tb = performance.now();
      for (let b = 0; b < batch; b++) drawFullscreen(gl);
      sync();
      passes += batch;
      const dt = (performance.now() - tb) / 1000;
      if (dt < 0.05) batch = Math.min(batch * 2, 256); else if (dt > 0.15 && batch > 1) batch >>= 1;
      el = (performance.now() - t0) / 1000;
      onRate((2 * n * n * n * passes) / el / 1e9, Math.min(1, el / seconds));
      await new Promise(res => setTimeout(res, 0));             // Oberfläche nicht einfrieren
    }
    // Kontrolle: 64 zufällige Einträge
    const C = new Float32Array(n * n);
    gl.readPixels(0, 0, k4, n, gl.RGBA, gl.FLOAT, C);
    const rr = lcg(77);
    let ok = true;
    for (let s = 0; s < 64; s++) {
      const i = rr() % n, j = rr() % n;
      let ref = 0;
      for (let k = 0; k < n; k++) ref += A[i * n + k] * B[k * n + j];
      if (C[i * n + j] !== ref) ok = false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    [tA, tB, tC].forEach(t => gl.deleteTexture(t)); gl.deleteFramebuffer(fb); prog.dispose();
    return { gflops: (2 * n * n * n * passes) / el / 1e9, ok, seconds: el, passes };
  }

  dispose() { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
}

// ------------------------------------------------------------------------------------------- Bildgenerierung (CPPN)
export const CPPN_IN = 20, CPPN_HIDDEN = 16, CPPN_DEPTH = 6;
// Merkmale: x, y, r, sin/cos(kπx), sin/cos(kπy) für k = 1..4, 1 (Bias) → 20

const CPPN_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uW;        // Zeilen: Gewichte je Schicht, 4 Ausgänge je Texel
uniform vec2 uRes; uniform float uTime, uAspect;
out vec4 o;
vec4 W(int row, int g) { return texelFetch(uW, ivec2(g, row), 0); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float x = (uv.x * 2.0 - 1.0) * uAspect, y = uv.y * 2.0 - 1.0;
  float f[20];
  f[0] = x; f[1] = y; f[2] = sqrt(x * x + y * y);
  for (int k = 1; k <= 4; ++k) {
    float a = float(k) * 3.14159265;
    f[2 + k] = sin(a * x + uTime * 0.3 * float(k)); f[6 + k] = cos(a * x);
    f[10 + k] = sin(a * y); f[14 + k] = cos(a * y - uTime * 0.2 * float(k));
  }
  f[19] = 1.0;
  vec4 h[4];
  // Schicht 0: 20 Eingänge → 16
  for (int g = 0; g < 4; ++g) {
    vec4 s = vec4(0.0);
    for (int i = 0; i < 20; ++i) s += f[i] * W(i, g);
    h[g] = tanh(clamp(s, -9.0, 9.0));
  }
  int row = 20;
  for (int l = 1; l < ${CPPN_DEPTH}; ++l) {
    vec4 n[4];
    for (int g = 0; g < 4; ++g) {
      vec4 s = W(row + 16, g);           // Bias-Zeile
      for (int q = 0; q < 4; ++q) {
        s += h[q].x * W(row + 4 * q, g) + h[q].y * W(row + 4 * q + 1, g) + h[q].z * W(row + 4 * q + 2, g) + h[q].w * W(row + 4 * q + 3, g);
      }
      n[g] = tanh(clamp(s, -9.0, 9.0));
    }
    h = n;
    row += 17;
  }
  vec4 s = W(row + 16, 0);
  for (int q = 0; q < 4; ++q)
    s += h[q].x * W(row + 4 * q, 0) + h[q].y * W(row + 4 * q + 1, 0) + h[q].z * W(row + 4 * q + 2, 0) + h[q].w * W(row + 4 * q + 3, 0);
  vec3 c = 1.0 / (1.0 + exp(-s.rgb));
  o = vec4(c, 1.0);
}`;

/** Ops je Pixel (Multiplikation + Addition = 2) */
export const CPPN_FLOPS_PER_PIXEL = 2 * (CPPN_IN * CPPN_HIDDEN + (CPPN_DEPTH - 1) * (CPPN_HIDDEN + 1) * CPPN_HIDDEN + (CPPN_HIDDEN + 1) * 3);

export class NeuralArt {
  readonly gl: WebGL2RenderingContext;
  readonly gpu: string;
  private prog: Prog;
  private wTex: WebGLTexture;
  readonly weights: Float32Array;          // Zeilen × 16 (4 Texel je Zeile)
  readonly rows: number;
  private target: WebGLTexture | null = null; private fb: WebGLFramebuffer | null = null; private tw = 0; private th = 0;

  constructor(readonly canvas: HTMLCanvasElement, seed: number) {
    this.gl = createGL(canvas, { preserveDrawingBuffer: false });
    this.gpu = gpuName(this.gl);
    this.rows = CPPN_IN + (CPPN_DEPTH - 1) * 17 + 17;
    this.weights = new Float32Array(this.rows * 16);
    let s = (seed * 2654435761) >>> 0;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
    for (let i = 0; i < CPPN_IN; i++) for (let j = 0; j < 16; j++) this.weights[i * 16 + j] = gauss() * (i < 3 ? 1.6 : 0.9);
    let row = CPPN_IN;
    for (let l = 1; l <= CPPN_DEPTH; l++) {
      for (let i = 0; i < 17; i++) for (let j = 0; j < 16; j++) this.weights[(row + i) * 16 + j] = gauss() * (i === 16 ? 0.3 : 1.25 / 2);
      row += 17;
    }
    const gl = this.gl;
    this.wTex = texture(gl, 4, this.rows, gl.RGBA32F, gl.RGBA, gl.FLOAT, this.weights);
    this.prog = new Prog(gl, CPPN_FS);
    gl.bindVertexArray(gl.createVertexArray());
  }

  /** Ein Bild in w×h rechnen (in eigenen Puffer, wenn offscreen) und anzeigen. */
  render(time: number, scale = 1) {
    const gl = this.gl, c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(c.clientWidth * dpr * scale), h = Math.round(c.clientHeight * dpr * scale);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    this.prog.use().tex('uW', 0, this.wTex).f('uRes', w, h).f('uTime', time).f('uAspect', w / h);
    drawFullscreen(gl);
    return w * h;
  }

  /** Offscreen-Durchsatz (feste 512×512), ohne Bildschirm-Takt. */
  renderOffscreen(time: number, count: number) {
    const gl = this.gl;
    if (!this.target) {
      this.tw = 512; this.th = 512;
      this.target = texture(gl, 512, 512, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      this.fb = framebuffer(gl, this.target);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, this.tw, this.th);
    this.prog.use().tex('uW', 0, this.wTex).f('uRes', this.tw, this.th).f('uAspect', 1);
    for (let i = 0; i < count; i++) { this.prog.f('uTime', time + i * 0.001); drawFullscreen(gl); }
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return this.tw * this.th * count;
  }

  /** Kontrolle: 64 Pixel des Offscreen-Bildes (Zeit t) in doppelter Genauigkeit nachrechnen. */
  verify(time: number): { ok: boolean; maxErr: number } {
    const gl = this.gl;
    this.renderOffscreen(time, 1);
    const img = new Uint8Array(512 * 512 * 4);
    gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, img);
    let worst = 0;
    let s = 99;
    for (let k = 0; k < 64; k++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const px = s % 512, py = (s >>> 9) % 512;
      const ref = this.pixelRef((px + 0.5) / 512, (py + 0.5) / 512, time, 1);
      for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(img[(py * 512 + px) * 4 + c] / 255 - ref[c]));
    }
    return { ok: worst < 4 / 255, maxErr: worst };
  }

  pixelRef(u: number, v: number, time: number, aspect: number): number[] {
    const W = this.weights;
    const x = (u * 2 - 1) * aspect, y = v * 2 - 1;
    const f = new Array(20).fill(0);
    f[0] = x; f[1] = y; f[2] = Math.hypot(x, y);
    for (let k = 1; k <= 4; k++) {
      const a = k * Math.PI;
      f[2 + k] = Math.sin(a * x + time * 0.3 * k); f[6 + k] = Math.cos(a * x);
      f[10 + k] = Math.sin(a * y); f[14 + k] = Math.cos(a * y - time * 0.2 * k);
    }
    f[19] = 1;
    let h = new Array(16).fill(0).map((_, j) => Math.tanh(f.reduce((s, fi, i) => s + fi * W[i * 16 + j], 0)));
    let row = 20;
    for (let l = 1; l < CPPN_DEPTH; l++) {
      h = new Array(16).fill(0).map((_, j) => { let s = W[(row + 16) * 16 + j]; for (let i = 0; i < 16; i++) s += h[i] * W[(row + i) * 16 + j]; return Math.tanh(s); });
      row += 17;
    }
    return [0, 1, 2].map(j => { let s = W[(row + 16) * 16 + j]; for (let i = 0; i < 16; i++) s += h[i] * W[(row + i) * 16 + j]; return 1 / (1 + Math.exp(-s)); });
  }

  dispose() { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
}
