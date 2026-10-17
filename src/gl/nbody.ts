// N-Körper-Gravitationssimulation (alle Paare, O(N²)) auf der GPU (WebGL2, Float-Texturen) – Port von NBody.cs.
// Ein Zeitschritt = ein Zeichendurchgang mit zwei Ausgaben (Ort, Geschwindigkeit). Leistung: 20 Rechenoperationen je Kraft.
import { Prog, createGL, drawFullscreen, framebuffer, gpuName, hasFloatRT, texture } from './glutil';

export const EPS2 = 0.05;
export const FLOPS_PER_INTERACTION = 20;
export const SCENARIOS = [
  ['Galaxienkollision', 'Galaxy collision'],
  ['Schwarzes Loch + Galaxie', 'Black hole + galaxy'],
  ['Galaxienhaufen (6)', 'Galaxy cluster (6)'],
  ['Kalter Kollaps', 'Cold collapse'],
  ['Ring-Galaxie (Wagenrad)', 'Ring galaxy (cartwheel)'],
];

// ------------------------------------------------------------------------------------------- Anfangszustände
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

export function initBodies(N: number, scenario: number) {
  const pos = new Float32Array(N * 4), vel = new Float32Array(N * 4);
  const set = (i: number, x: number, y: number, z: number, m: number, vx: number, vy: number, vz: number, g: number) => {
    pos[4 * i] = x; pos[4 * i + 1] = y; pos[4 * i + 2] = z; pos[4 * i + 3] = m;
    vel[4 * i] = vx; vel[4 * i + 1] = vy; vel[4 * i + 2] = vz; vel[4 * i + 3] = g;
  };
  const rot = (v: number[], ax: number, az: number) => {
    const [x, y, z] = v;
    const y1 = y * Math.cos(ax) - z * Math.sin(ax), z1 = y * Math.sin(ax) + z * Math.cos(ax);
    return [x * Math.cos(az) - y1 * Math.sin(az), x * Math.sin(az) + y1 * Math.cos(az), z1];
  };
  const disk = (r: () => number, start: number, count: number, mass: number, scale: number, c: number[], v: number[],
    tx: number, tz: number, g: number, central = 0, thick = 0.1) => {
    const mi = mass / count;
    for (let k = 0; k < count; k++) {
      const rad = -Math.log(1 - r() * 0.985) * scale + 0.05, ang = r() * Math.PI * 2;
      let p = [rad * Math.cos(ang), (r() - 0.5) * thick * scale, rad * Math.sin(ang)];
      const menc = mass * (1 - Math.exp(-rad / scale) * (1 + rad / scale)) + central;
      const vv = Math.sqrt(menc / Math.sqrt(rad * rad + EPS2));
      let u = [-vv * Math.sin(ang), 0, vv * Math.cos(ang)];
      p = rot(p, tx, tz); u = rot(u, tx, tz);
      set(start + k, p[0] + c[0], p[1] + c[1], p[2] + c[2], mi, u[0] + v[0], u[1] + v[1], u[2] + v[2], g);
    }
  };
  switch (scenario) {
    case 1: {
      const r = rng(7);
      set(0, 0, 0, 0, 0.35, 0, 0, 0, 5);
      const bulge = Math.floor(N / 8);
      for (let k = 1; k <= bulge; k++) {
        const rad = 0.4 + 1.2 * Math.pow(r(), 0.7), th = Math.acos(2 * r() - 1), ph = r() * 2 * Math.PI;
        const v = Math.sqrt(0.35 / Math.sqrt(rad * rad + EPS2)) * 0.8;
        set(k, rad * Math.sin(th) * Math.cos(ph), rad * Math.cos(th) * 0.6, rad * Math.sin(th) * Math.sin(ph), 0.1 / bulge,
          -v * Math.sin(ph) + (r() - 0.5) * 0.2 * v, (r() - 0.5) * 0.3 * v, v * Math.cos(ph), 4);
      }
      disk(r, bulge + 1, N - bulge - 1, 0.55, 2.8, [0, 0, 0], [0, 0, 0], 0.25, 0.1, 0, 0.45, 0.05);
      break;
    }
    case 2: {
      const r = rng(11), g = 6, per = Math.floor(N / g);
      for (let k = 0; k < g; k++) {
        const count = k === g - 1 ? N - per * (g - 1) : per;
        const th = Math.acos(2 * r() - 1), ph = r() * 2 * Math.PI, d = 8 + 6 * r();
        const cx = d * Math.sin(th) * Math.cos(ph), cy = d * Math.cos(th) * 0.6, cz = d * Math.sin(th) * Math.sin(ph);
        disk(r, k * per, count, 1 / g, 0.9, [cx, cy, cz], [-cz * 0.012, (r() - 0.5) * 0.05, cx * 0.012], r() * 3, r() * 3, k);
      }
      break;
    }
    case 3: {
      const r = rng(5);
      for (let k = 0; k < N; k++) {
        const rad = 10 * Math.cbrt(r()), th = Math.acos(2 * r() - 1), ph = r() * 2 * Math.PI;
        const x = rad * Math.sin(th) * Math.cos(ph), y = rad * Math.cos(th), z = rad * Math.sin(th) * Math.sin(ph);
        set(k, x, y, z, 1 / N, -z * 0.004, 0, x * 0.004, rad < 5 ? 0 : 1);
      }
      break;
    }
    case 4: {
      const r = rng(3), intr = Math.floor(N / 6);
      disk(r, 0, N - intr, 0.75, 2.4, [0, 0, 0], [0, 0, 0], 0.35, 0, 0);
      for (let k = N - intr; k < N; k++) {
        const u = r() * 0.99;
        const rad = Math.min(0.6 / Math.sqrt(Math.pow(u, -2 / 3) - 1), 3);
        const th = Math.acos(2 * r() - 1), ph = r() * 2 * Math.PI;
        const p = rot([rad * Math.sin(th) * Math.cos(ph), rad * Math.cos(th), rad * Math.sin(th) * Math.sin(ph)], 0.35, 0);
        set(k, p[0], p[1] + 11 * Math.cos(0.35), p[2] + 11 * Math.sin(0.35), 0.25 / intr, 0, -0.55 * Math.cos(0.35), -0.55 * Math.sin(0.35), 1);
      }
      break;
    }
    default: {
      const r = rng(42);
      for (let i = 0; i < N; i++) {
        const g = i < N / 2 ? 0 : 1;
        const cx = g === 0 ? -6 : 6, cy = g === 0 ? -1.5 : 1.5, cvx = g === 0 ? 0.08 : -0.08, tilt = g === 0 ? 0.3 : -0.5;
        const rad = -Math.log(1 - r() * 0.98) * 1.2 + 0.05, ang = r() * Math.PI * 2;
        const x = rad * Math.cos(ang), y = rad * Math.sin(ang), z = (r() - 0.5) * 0.1;
        const menc = 0.5 * (1 - Math.exp(-rad / 1.2) * (1 + rad / 1.2));
        const v = Math.sqrt(menc / Math.sqrt(rad * rad + EPS2));
        let vx = -v * Math.sin(ang), vy = v * Math.cos(ang);
        if (g === 1) { vx = -vx; vy = -vy; }
        set(i, x + cx, y * Math.cos(tilt) - z * Math.sin(tilt) + cy, y * Math.sin(tilt) + z * Math.cos(tilt), 1 / N,
          vx + cvx, vy * Math.cos(tilt), vy * Math.sin(tilt), g);
      }
    }
  }
  return { pos, vel };
}

/** Beschleunigung von Körper i in doppelter Genauigkeit (Kontrolle). */
export function accelRef(pos: Float32Array, i: number) {
  const N = pos.length / 4;
  let rx = 0, ry = 0, rz = 0;
  for (let j = 0; j < N; j++) {
    const dx = pos[4 * j] - pos[4 * i], dy = pos[4 * j + 1] - pos[4 * i + 1], dz = pos[4 * j + 2] - pos[4 * i + 2];
    const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz + EPS2);
    const k = pos[4 * j + 3] * inv * inv * inv;
    rx += dx * k; ry += dy * k; rz += dz * k;
  }
  return [rx, ry, rz];
}

/** Gesamtenergie (kinetisch + potentiell). */
export function energy(pos: Float32Array, vel: Float32Array) {
  const N = pos.length / 4;
  let kin = 0, pot = 0;
  for (let i = 0; i < N; i++) {
    kin += 0.5 * pos[4 * i + 3] * (vel[4 * i] ** 2 + vel[4 * i + 1] ** 2 + vel[4 * i + 2] ** 2);
    const xi = pos[4 * i], yi = pos[4 * i + 1], zi = pos[4 * i + 2], mi = pos[4 * i + 3];
    for (let j = i + 1; j < N; j++) {
      const dx = pos[4 * j] - xi, dy = pos[4 * j + 1] - yi, dz = pos[4 * j + 2] - zi;
      pot -= (mi * pos[4 * j + 3]) / Math.sqrt(dx * dx + dy * dy + dz * dz + EPS2);
    }
  }
  return kin + pot;
}

// ------------------------------------------------------------------------------------------- GPU
const STEP_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uPos, uVel; uniform int uN, uW; uniform float uDt, uEps2;
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;
void main() {
  ivec2 me = ivec2(gl_FragCoord.xy);
  vec4 p = texelFetch(uPos, me, 0);
  vec3 acc = vec3(0.0);
  int rows = uN / uW;
  for (int y = 0; y < rows; ++y) {
    for (int x = 0; x < uW; ++x) {
      vec4 q = texelFetch(uPos, ivec2(x, y), 0);
      vec3 d = q.xyz - p.xyz;
      float inv = inversesqrt(dot(d, d) + uEps2);
      acc += d * (q.w * inv * inv * inv);
    }
  }
  vec4 v = texelFetch(uVel, me, 0);
  v.xyz += acc * uDt;
  p.xyz += v.xyz * uDt;
  oPos = p; oVel = v;
}`;

const DRAW_VS = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uPos, uVel; uniform int uW; uniform mat4 uMvp; uniform float uSize;
out vec3 vCol;
const vec3 COLS[6] = vec3[6](vec3(0.45,0.7,1.0), vec3(1.0,0.72,0.42), vec3(0.6,1.0,0.75), vec3(1.0,0.5,0.8), vec3(1.0,0.95,0.7), vec3(1.0,1.0,1.0));
void main() {
  ivec2 c = ivec2(gl_VertexID % uW, gl_VertexID / uW);
  vec4 p = texelFetch(uPos, c, 0);
  vec4 v = texelFetch(uVel, c, 0);
  gl_Position = uMvp * vec4(p.xyz, 1.0);
  float speed = length(v.xyz);
  vCol = COLS[int(v.w) % 6] * (0.55 + 0.9 * clamp(speed, 0.0, 1.2));
  gl_PointSize = int(v.w) == 5 ? uSize * 6.0 : uSize * clamp(3.0 / gl_Position.w, 0.6, 2.5);
}`;
const DRAW_FS = `#version 300 es
precision mediump float;
in vec3 vCol; out vec4 o;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a = exp(-dot(q, q) * 14.0);
  o = vec4(vCol * a * 0.35, 1.0);
}`;

export class NBodyGpu {
  readonly gl: WebGL2RenderingContext;
  readonly gpu: string;
  readonly W: number; readonly H: number;
  private step: Prog; private draw: Prog;
  private tp: WebGLTexture[] = []; private tv: WebGLTexture[] = []; private fb: WebGLFramebuffer[] = [];
  private cur = 0;
  dt = 0.01;
  steps = 0;
  yaw = 0.4; pitch = 0.5; dist = 26;

  constructor(readonly canvas: HTMLCanvasElement, readonly N: number, scenario: number) {
    this.gl = createGL(canvas);
    if (!hasFloatRT(this.gl)) throw new Error('Diese GPU kann nicht in Float-Texturen rechnen.|This GPU cannot render to float textures.');
    this.gpu = gpuName(this.gl);
    this.W = Math.min(N, 256); this.H = N / this.W;
    const { pos, vel } = initBodies(N, scenario);
    const gl = this.gl;
    for (let k = 0; k < 2; k++) {
      this.tp.push(texture(gl, this.W, this.H, gl.RGBA32F, gl.RGBA, gl.FLOAT, k === 0 ? pos : null));
      this.tv.push(texture(gl, this.W, this.H, gl.RGBA32F, gl.RGBA, gl.FLOAT, k === 0 ? vel : null));
      this.fb.push(framebuffer(gl, this.tp[k], this.tv[k]));
    }
    this.step = new Prog(gl, STEP_FS);
    this.draw = new Prog(gl, DRAW_FS, DRAW_VS);
    gl.bindVertexArray(gl.createVertexArray());
  }

  run(k: number) {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, this.W, this.H);
    this.step.use().i('uN', this.N).i('uW', this.W).f('uDt', this.dt).f('uEps2', EPS2);
    for (let s = 0; s < k; s++) {
      const src = this.cur, dst = 1 - src;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[dst]);
      this.step.tex('uPos', 0, this.tp[src]).tex('uVel', 1, this.tv[src]);
      drawFullscreen(gl);
      this.cur = dst;
    }
    this.steps += k;
  }

  /** Wartet auf die GPU (liest 1 Pixel). */
  sync() {
    const gl = this.gl, px = new Float32Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[this.cur]);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px);
  }

  read(): { pos: Float32Array; vel: Float32Array } {
    const gl = this.gl;
    const pos = new Float32Array(this.N * 4), vel = new Float32Array(this.N * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[this.cur]);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, pos);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, vel);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    return { pos, vel };
  }

  /** Kraft-Kontrolle: ein Schritt, Δv/dt gegen doppelt genaue Rechnung für 128 Körper. */
  verify(): { ok: boolean; err: number } {
    const a = this.read();
    this.run(1);
    const b = this.read();
    const r = rng(3);
    let worst = 0;
    for (let s = 0; s < 128; s++) {
      const i = Math.floor(r() * this.N);
      const ref = accelRef(a.pos, i);
      const got = [0, 1, 2].map(c => (b.vel[4 * i + c] - a.vel[4 * i + c]) / this.dt);
      const mag = Math.hypot(ref[0], ref[1], ref[2]);
      const err = Math.hypot(got[0] - ref[0], got[1] - ref[1], got[2] - ref[2]) / Math.max(mag, 1e-6);
      worst = Math.max(worst, mag > 1e-3 ? err : 0);
    }
    return { ok: worst < 5e-3, err: worst };
  }

  render() {
    const gl = this.gl, c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.02, 0.02, 0.035, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.draw.use().tex('uPos', 0, this.tp[this.cur]).tex('uVel', 1, this.tv[this.cur]).i('uW', this.W)
      .f('uSize', Math.max(1.5, 2.2 * dpr * Math.sqrt(16384 / this.N)));
    gl.uniformMatrix4fv(this.draw.u('uMvp'), false, mvp(this.yaw, this.pitch, this.dist, w / h));
    gl.drawArrays(gl.POINTS, 0, this.N);
    gl.disable(gl.BLEND);
  }

  dispose() { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
}

/** Perspektive × Blick auf den Ursprung (Spalten-Hauptordnung). */
export function mvp(yaw: number, pitch: number, dist: number, aspect: number): Float32Array {
  const cp = Math.cos(pitch);
  const eye = [dist * cp * Math.sin(yaw), dist * Math.sin(pitch), dist * cp * Math.cos(yaw)];
  const f = norm([-eye[0], -eye[1], -eye[2]]);
  const s = norm(cross(f, [0, 1, 0]));
  const u = cross(s, f);
  const view = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0,
    -dot(s, eye), -dot(u, eye), dot(f, eye), 1];
  const fov = 50 * Math.PI / 180, t = 1 / Math.tan(fov / 2), n = 0.1, fa = 500;
  const proj = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0];
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += proj[k * 4 + r] * view[c * 4 + k];
    o[c * 4 + r] = sum;
  }
  return o;
}
const norm = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
