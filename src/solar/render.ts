// Sonnensystem – WebGL2-Darstellung (Handy-Fassung des Desktop-Renderers Shaders/Solar.hlsl).
// Kamerabezogen: alle Orte werden in doppelter Genauigkeit relativ zur Kamera gerechnet und erst dann zu float.
// Reihenfolge ohne Tiefenpuffer: Himmel → Sterne → Bahnen/Wolke → Körper von hinten nach vorn → Leuchtpunkte.
import { createGL, program } from '../gl/glutil';
import { BODIES, Body, Surf } from './catalog';
import { AU, Deg, V } from './math';
import { frame } from './ephem';

const U = 1000;                        // GPU-Einheit: 1000 km

// ------------------------------------------------------------------ Shader
const SKY_VS = `#version 300 es
out vec2 vNdc;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vNdc = p; gl_Position = vec4(p, 0.0, 1.0); }`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vNdc; out vec4 o;
uniform vec3 uR, uU, uF; uniform vec2 uTan; uniform mat3 uGal; uniform sampler2D uSky; uniform float uSkyB;
void main() {
  vec3 d = normalize(uF + uR * vNdc.x * uTan.x + uU * vNdc.y * uTan.y);
  vec3 g = uGal * d;
  float gl = atan(g.y, g.x), gb = asin(clamp(g.z, -1.0, 1.0));
  vec3 c = texture(uSky, vec2(0.5 - gl / 6.2831853, 0.5 - gb / 3.1415927)).rgb;
  o = vec4(c * c * uSkyB, 1.0);            // Bild ist gammakodiert: quadrieren ≈ linear, dann gedämpft
}`;

const PT_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC;
uniform mat4 uVP; uniform float uSize, uDir;
out vec4 vC;
void main() {
  vec4 p = uVP * vec4(aP, 1.0 - uDir);      // uDir = 1: reine Richtung (Sterne, unendlich fern)
  gl_Position = uDir > 0.5 ? p.xyww : p;
  gl_PointSize = uSize * aC.a;
  vC = aC;
}`;
const PT_FS = `#version 300 es
precision highp float;
in vec4 vC; out vec4 o; uniform float uSoft;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float a = uSoft > 0.5 ? exp(-r2 * 3.5) : 1.0;
  o = vec4(vC.rgb * a, 0.0);
}`;

const LN_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in float aA;
uniform mat4 uVP; out float vA;
void main() { gl_Position = uVP * vec4(aP, 1.0); vA = aA; }`;
const LN_FS = `#version 300 es
precision highp float;
in float vA; out vec4 o; uniform vec4 uC;
void main() { o = vec4(uC.rgb * uC.a * vA, uC.a * vA); }`;

const QUAD_VS = `#version 300 es
uniform vec4 uQ;           // Mitte (NDC) und Halbgröße (NDC)
out vec2 vNdc;
void main() { vec2 c = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) - 1.0; c = vec2(gl_VertexID == 1 || gl_VertexID == 3 ? 1.0 : -1.0, gl_VertexID >= 2 ? 1.0 : -1.0);
  vec2 p = uQ.xy + c * uQ.zw; vNdc = p; gl_Position = vec4(p, 0.0, 1.0); }`;

const GLOW_FS = `#version 300 es
precision highp float;
in vec2 vNdc; out vec4 o; uniform vec4 uQ; uniform vec3 uC; uniform float uCore;
void main() {
  vec2 q = (vNdc - uQ.xy) / uQ.zw; float r = length(q);
  if (r > 1.0) discard;
  float a = exp(-r * r * 9.0) * 0.9 + pow(max(0.0, 1.0 - r), 3.0) * 0.35;
  a += uCore * smoothstep(0.18, 0.0, r);
  o = vec4(uC * a, 0.0);
}`;

const BODY_FS = `#version 300 es
precision highp float;
in vec2 vNdc; out vec4 o;
uniform vec3 uR, uU, uF; uniform vec2 uTan;
uniform vec3 uOc;          // Kamera − Körpermitte, in Körperradien (Welt)
uniform mat3 uBasis;       // Spalten: Nullmeridian, Nordpol, Osten (Welt)
uniform vec3 uAxes;        // Halbachsen relativ (x Nullmeridian, y Pol, z Osten)
uniform vec3 uSun;         // Richtung zur Sonne (Welt)
uniform float uSunAng;     // Winkelradius der Sonne vom Körper aus
uniform vec4 uOcc[2];      // Verdecker: Mitte (in Körperradien) und Radius
uniform int uType, uTex, uVar; uniform float uSeed, uExpo, uAlb, uTime;
uniform vec3 uC1, uC2;
uniform vec4 uAtmo;        // Farbe, Dicke (Körperradien)
uniform vec4 uRing;        // innen, außen (Körperradien), Art, –
uniform sampler2D uMap, uNight, uClouds, uRingTex;
uniform int uSunBody; uniform float uRed;

float h31(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.07 + 3.1; a *= .5; } return s; }
float lum(vec3 c) { return dot(c, vec3(.299, .587, .114)); }

// Anteil der sichtbaren Sonnenscheibe (Halbschatten) bei einem Verdecker mit Winkelradius rb im Winkelabstand d
float occl(vec3 p, vec4 oc) {
  vec3 toO = oc.xyz - p; float dist = length(toO);
  if (dist < 1e-4 || dot(toO, uSun) <= 0.) return 1.;
  float d = acos(clamp(dot(toO / dist, uSun), -1., 1.)), rb = asin(clamp(oc.w / dist, 0., 1.)), rs = uSunAng;
  if (d >= rs + rb) return 1.;
  if (d <= rb - rs) return 0.;                               // total
  if (d <= rs - rb) return 1. - (rb * rb) / (rs * rs);       // ringförmig
  float x = (d - abs(rs - rb)) / (rs + rb - abs(rs - rb));    // Übergang (weich genähert)
  float full = rb > rs ? 0. : 1. - (rb * rb) / (rs * rs);
  return mix(full, 1., smoothstep(0., 1., x));
}

vec3 tex2(sampler2D t, vec3 s) { float lat = asin(clamp(s.y, -1., 1.)), lon = atan(s.z, s.x); return texture(t, vec2(.5 + lon / 6.2831853, .5 - lat / 3.1415927)).rgb; }

vec3 procedural(vec3 s, inout float spec, out vec3 emis) {
  emis = vec3(0);
  float n1 = fbm(s * 2.2 + uSeed), n2 = fbm(s * 7. + uSeed * 1.7);
  vec3 c = uC1;
  if (uType == 5) {                                                      // Gasriese: Bänder nach Breite, Wirbel
    float b = s.y * (6. + float(uVar) * 2.) + (fbm(s * vec3(3., 18., 3.) + uSeed) - .5) * 1.6;
    c = mix(uC1, uC2, .5 + .5 * sin(b * 3.1)); c *= .9 + .2 * n2;
  } else if (uType == 6) { c = mix(uC1, uC2, .5 + .5 * sin(s.y * 9. + n1 * 2.)) * (.95 + .08 * n2); }
  else if (uType == 7 || uType == 14) { c = mix(uC1, uC2, smoothstep(.35, .8, n1)) * (.92 + .16 * n2); }       // Eis
  else if (uType == 8) { c = mix(uC1, uC2, smoothstep(.45, .75, n1)); c = mix(c, vec3(.15, .1, .05), smoothstep(.72, .8, n2) * .8); emis = vec3(1., .4, .1) * smoothstep(.78, .84, n2) * .3; }
  else if (uType == 9) { c = mix(uC1, uC2, n1) * .95; }                                                       // Titan-Dunst
  else if (uType == 10) { c = mix(uC1, vec3(.95, .9, .85), .6); float l = abs(fract(fbm(s * 3. + uSeed) * 6.) - .5); c = mix(c, uC2, smoothstep(.08, .0, l) * .8); }
  else if (uType == 11) { c = mix(uC2, uC1, smoothstep(.4, .6, n1)); float heart = smoothstep(.55, .35, length(s - normalize(vec3(.6, .05, .8)))); c = mix(c, vec3(.95, .92, .88), heart); }
  else if (uType == 13) { c = uC1 * (.7 + .5 * n2); }                                                         // Kometenkern
  else if (uType == 15) { c = mix(uC2, uC1, smoothstep(-.25, .25, -s.z + (n1 - .5) * .4)); }                  // Iapetus zweifarbig
  else if (uType == 16) { c = mix(uC1, uC2, smoothstep(.4, .7, n1)) * (.9 + .2 * n2); }
  else { c = mix(uC2, uC1, smoothstep(.3, .75, n1)); c *= .8 + .35 * n2; float cr = smoothstep(.62, .7, fbm(s * 14. + uSeed * 3.)); c *= 1. - cr * .25; }
  return c;
}

void main() {
  vec3 d = normalize(uF + uR * vNdc.x * uTan.x + uU * vNdc.y * uTan.y);
  // Strahl ins Körpersystem (Ellipsoid → Einheitskugel)
  vec3 ob = transpose(uBasis) * uOc, db = transpose(uBasis) * d;
  vec3 oe = ob / uAxes, de = db / uAxes;
  float a = dot(de, de), b = dot(oe, de);
  // nächster Punkt des Strahls zum Mittelpunkt – genauer als b² − c bei großen Abständen
  float t0 = -b / a; vec3 pc = oe + de * t0; float h = 1. - dot(pc, pc);
  vec4 col = vec4(0);
  float tHit = 1e30;
  if (h > 0. && t0 > 0.) {
    float t = t0 - sqrt(h / a);
    if (t > 0.) {
      tHit = t;
      vec3 se = oe + de * t;                       // Einheitskugel
      vec3 s = normalize(se);                      // Richtung (Körper)
      vec3 nb = normalize(se / uAxes);             // Normale (Körper, Ellipsoid)
      vec3 n = uBasis * nb, p = uBasis * (se * uAxes);
      float ndl = dot(n, uSun);
      if (uSunBody == 1) {
        float mu = max(dot(n, -d), 0.);
        vec3 c = vec3(1., .93, .78) * (1. - .55 * (1. - pow(mu, .6)));
        c *= .92 + .12 * fbm(s * 40. + uTime * .02);
        col = vec4(c * 1.9, 1.);
      } else {
        float spec = 0.; vec3 emis = vec3(0); vec3 c;
        if (uTex == 1) {
          c = tex2(uMap, s);
          if (uType == 3) {                                                // Erde: Wolken, Stadtlichter, Meeresglanz
            float cl = clamp(lum(tex2(uClouds, s)) * 1.25, 0., 1.);
            float ocean = clamp((c.b - max(c.r, c.g) * .9) * 12., 0., 1.) * (1. - smoothstep(.08, .2, lum(c)));
            spec = ocean * (1. - cl);
            emis = tex2(uNight, s) * (1. - cl) * .9 * smoothstep(.05, -.15, ndl);
            c = mix(c * 1.15, vec3(.95, .95, .97), cl);
          }
        } else c = procedural(s, spec, emis);
        float sh = 1.;
        for (int k = 0; k < 2; k++) if (uOcc[k].w > 0.) sh *= occl(p, uOcc[k]);
        // Ringschatten auf dem Planeten
        if (uRing.y > 0.) { vec3 sb = transpose(uBasis) * uSun; if (abs(sb.y) > 1e-4) { float tr = -(se * uAxes).y / sb.y; if (tr > 0.) { vec3 q = se * uAxes + sb * tr; float rr = length(q.xz); if (rr > uRing.x && rr < uRing.y) sh *= 1. - .7 * texture(uRingTex, vec2((rr - uRing.x) / (uRing.y - uRing.x), .5)).a; } } }
        float dif = max(ndl, 0.) * sh;
        vec3 lit = c * (dif * 1.05 + .012);
        // Kernschatten der Erde: Licht, das durch die Erdatmosphäre gebrochen wird, färbt den Mond kupferrot
        lit += c * vec3(.30, .085, .03) * uRed * (1. - sh) * smoothstep(-.1, .3, ndl);
        vec3 hv = normalize(uSun - d);
        lit += spec * pow(max(dot(n, hv), 0.), 60.) * .6 * sh;
        lit += emis;
        // Atmosphäre am Rand (tagseitig)
        if (uAtmo.w > 0.) { float rim = pow(1. - max(dot(n, -d), 0.), 3.); lit = mix(lit, uAtmo.rgb * smoothstep(-.25, .35, ndl), rim * min(1., uAtmo.w * 8.) * .7); }
        col = vec4(lit * uExpo, 1.);
      }
    }
  }
  // Atmosphärensaum neben der Scheibe
  if (col.a == 0. && uAtmo.w > 0. && t0 > 0.) {
    float r = sqrt(max(dot(pc, pc), 0.)), x = (r - 1.) / uAtmo.w;
    if (x > 0. && x < 1.) { vec3 pw = uBasis * (pc * uAxes); float lt = smoothstep(-.3, .5, dot(normalize(pw), uSun)); float g = pow(1. - x, 2.2) * lt * .55; col = vec4(uAtmo.rgb * g * uExpo, g); }
  }
  // Ringe: Schnitt mit der Äquatorebene
  if (uRing.y > 0. && abs(db.y) > 1e-6) {
    float tr = -ob.y / db.y;
    if (tr > 0. && tr < tHit) {
      vec3 q = ob + db * tr; float rr = length(q.xz);
      if (rr > uRing.x && rr < uRing.y) {
        float u = (rr - uRing.x) / (uRing.y - uRing.x);
        vec4 rt = texture(uRingTex, vec2(u, .5));
        float alpha = uRing.z == 1. ? rt.a : (uRing.z == 4. ? .12 : .35) * smoothstep(0., .1, u) * smoothstep(1., .9, u) * (.5 + .5 * sin(u * 60.));
        vec3 rc = uRing.z == 1. ? rt.rgb * 1.2 : vec3(.55, .58, .62);
        vec3 qw = uBasis * q;
        // Planetenschatten auf dem Ring
        float tb = -dot(qw, uSun); vec3 cl = qw + uSun * tb; float shadow = (tb > 0. && length(cl) < 1.) ? .05 : 1.;
        vec3 rl = rc * (.25 + .75 * abs(dot(uSun, uBasis[1]))) * shadow * uExpo;
        col = vec4(rl * alpha + col.rgb * (1. - alpha), alpha + col.a * (1. - alpha));
      }
    }
  }
  if (col.a <= 0.) discard;
  vec3 c = col.rgb; c = c / (1. + c * .35);          // sanfte Kompression (hell bleibt hell, nichts brennt aus)
  o = vec4(c, col.a);
}`;

// ------------------------------------------------------------------ Hilfen
const mat4 = (a: number[]) => new Float32Array(a);
function perspective(fovY: number, asp: number, near: number, far: number) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function mul4(a: number[], b: number[]) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function loadTex(gl: WebGL2RenderingContext, url: string, onload?: () => void, wrap = true): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([90, 90, 90, 255]));
  const im = new Image();
  im.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    onload?.();
  };
  im.src = url;
  return t;
}
/** Äquatorial → galaktisch (J2000), danach Ekliptik → Äquator vorgeschaltet: ergibt Ekliptik → galaktisch. */
function eclToGal(): Float32Array {
  const G = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.44482963, 0.7469822445], [-0.867666149, -0.1980763734, 0.4559837762]];
  const e = 23.43928 * Deg, c = Math.cos(e), s = Math.sin(e);
  const E = [[1, 0, 0], [0, c, -s], [0, s, c]];                 // Ekliptik → Äquator
  const M = G.map(row => [0, 1, 2].map(j => row[0] * E[0][j] + row[1] * E[1][j] + row[2] * E[2][j]));
  return new Float32Array([M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]]);  // spaltenweise
}
function bvColor(bv: number): [number, number, number] {
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const x = Math.min(1, Math.max(0, (t - 3000) / 9000));
  return [1, 0.72 + 0.28 * Math.min(1, x * 1.6), 0.45 + 0.6 * x].map(v => Math.min(1, v)) as [number, number, number];
}

export interface Camera { pos: V; right: V; up: V; fwd: V; fovY: number }
export interface DrawBody { b: Body; pos: V; occ: { pos: V; R: number }[]; sunVis: number }
export interface LineSet { pts: Float32Array; alpha: Float32Array; color: [number, number, number, number] }

const TEX: Record<string, string> = { Merkur: '2k_mercury', Venus: '2k_venus_atmosphere', Erde: '2k_earth_daymap', Mond: '2k_moon', Mars: '2k_mars', Jupiter: '2k_jupiter', Saturn: '2k_saturn', Uranus: '2k_uranus', Neptun: '2k_neptune' };

export class SolarRender {
  readonly gl: WebGL2RenderingContext;
  private sky: WebGLProgram; private pts: WebGLProgram; private ln: WebGLProgram; private glow: WebGLProgram; private body: WebGLProgram;
  private loc = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private skyTex: WebGLTexture; private tex = new Map<string, WebGLTexture>(); private night: WebGLTexture; private clouds: WebGLTexture; private ringTex: WebGLTexture;
  private starBuf: WebGLBuffer; private starCount = 0; private starVao: WebGLVertexArrayObject;
  private dotVao: WebGLVertexArrayObject; private dotPos: WebGLBuffer; private dotCol: WebGLBuffer; private dotCount = 0;
  private lnVao: WebGLVertexArrayObject; private lnPos: WebGLBuffer; private lnA: WebGLBuffer;
  private gal = eclToGal();
  dpr = 1; w = 1; h = 1;
  onTexture: () => void = () => {};

  constructor(readonly canvas: HTMLCanvasElement, base: string) {
    const gl = this.gl = createGL(canvas, { alpha: false, antialias: false });
    this.sky = program(gl, SKY_VS, SKY_FS);
    this.pts = program(gl, PT_VS, PT_FS);
    this.ln = program(gl, LN_VS, LN_FS);
    this.glow = program(gl, QUAD_VS, GLOW_FS);
    this.body = program(gl, QUAD_VS, BODY_FS);
    const cb = () => this.onTexture();
    this.skyTex = loadTex(gl, `${base}tex/4k_milky_way.jpg`, cb);
    for (const [n, f] of Object.entries(TEX)) this.tex.set(n, loadTex(gl, `${base}tex/${f}.jpg`, cb));
    this.night = loadTex(gl, `${base}tex/2k_earth_nightmap.jpg`, cb);
    this.clouds = loadTex(gl, `${base}tex/2k_earth_clouds.jpg`, cb);
    this.ringTex = loadTex(gl, `${base}tex/2k_saturn_ring_alpha.png`, cb, false);
    // Sterne
    this.starVao = gl.createVertexArray()!; this.starBuf = gl.createBuffer()!;
    void fetch(`${base}tex/bsc5.bin`).then(r => r.arrayBuffer()).then(buf => this.setStars(new Float32Array(buf))).catch(() => {});
    // Wolke + Linien
    this.dotVao = gl.createVertexArray()!; this.dotPos = gl.createBuffer()!; this.dotCol = gl.createBuffer()!;
    this.lnVao = gl.createVertexArray()!; this.lnPos = gl.createBuffer()!; this.lnA = gl.createBuffer()!;
  }

  private u(p: WebGLProgram, n: string) {
    let m = this.loc.get(p); if (!m) { m = new Map(); this.loc.set(p, m); }
    if (!m.has(n)) m.set(n, this.gl.getUniformLocation(p, n));
    return m.get(n)!;
  }

  private setStars(raw: Float32Array) {
    const gl = this.gl, n = raw.length / 4, data = new Float32Array(n * 7);
    const e = 23.43928 * Deg, c = Math.cos(e), s = Math.sin(e);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const ra = raw[i * 4] * Deg, dec = raw[i * 4 + 1] * Deg, mag = raw[i * 4 + 2], bv = raw[i * 4 + 3];
      if (mag > 6.2) continue;
      const x = Math.cos(dec) * Math.cos(ra), y = Math.cos(dec) * Math.sin(ra), z = Math.sin(dec);
      const [r, g, b] = bvColor(bv), bright = Math.min(1.6, Math.pow(10, -0.4 * (mag - 1.2))) * 0.9 + 0.12;
      data.set([x, y * c + z * s, -y * s + z * c, r * bright, g * bright, b * bright, Math.min(1, 0.45 + 0.13 * (6.2 - mag))], k * 7); k++;
    }
    this.starCount = k;
    gl.bindVertexArray(this.starVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, k * 7), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    this.onTexture();
  }

  /** Kleinkörper: Farben einmalig (Größe im Alpha), Orte je Aktualisierung. */
  setDots(col: Float32Array, size: Float32Array, count: number) {
    const gl = this.gl, c = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { c[i * 4] = col[i * 3]; c[i * 4 + 1] = col[i * 3 + 1]; c[i * 4 + 2] = col[i * 3 + 2]; c[i * 4 + 3] = Math.min(1, 0.55 + Math.log10(1 + size[i]) * 0.25); }
    gl.bindVertexArray(this.dotVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dotCol); gl.bufferData(gl.ARRAY_BUFFER, c, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dotPos); gl.bufferData(gl.ARRAY_BUFFER, count * 12, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.dotCount = count;
  }
  updateDots(pos: Float32Array) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.dotPos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos); }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = Math.max(1, Math.round(r.width * this.dpr)); this.h = Math.max(1, Math.round(r.height * this.dpr));
    if (this.canvas.width !== this.w || this.canvas.height !== this.h) { this.canvas.width = this.w; this.canvas.height = this.h; }
  }

  /** Bildschirmposition (CSS-Pixel) eines Punkts relativ zur Kamera; null hinter der Kamera. */
  project(cam: Camera, p: V): [number, number, number] | null {
    const r = p.sub(cam.pos), z = r.dot(cam.fwd);
    if (z <= 0) return null;
    const th = Math.tan(cam.fovY / 2), asp = this.w / this.h;
    const x = r.dot(cam.right) / (z * th * asp), y = r.dot(cam.up) / (z * th);
    return [(x * 0.5 + 0.5) * this.w / this.dpr, (0.5 - y * 0.5) * this.h / this.dpr, z];
  }
  /** Projizierter Radius in CSS-Pixeln. */
  pxRadius(cam: Camera, dist: number, R: number) { return R / Math.max(dist, R * 1.0001) / Math.tan(cam.fovY / 2) * (this.h / this.dpr) / 2; }

  draw(cam: Camera, o: { jd: number; time: number; bodies: DrawBody[]; points: { pos: V; col: [number, number, number]; size: number }[]; lines: LineSet[]; dots: boolean; skyB: number; expo: number }) {
    const gl = this.gl;
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.DEPTH_TEST);
    const th = Math.tan(cam.fovY / 2), asp = this.w / this.h;
    const R = cam.right, Up = cam.up, F = cam.fwd;
    // Blick-Projektion (Kamera im Ursprung, Einheit U)
    const view = [R.x, Up.x, -F.x, 0, R.y, Up.y, -F.y, 0, R.z, Up.z, -F.z, 0, 0, 0, 0, 1];
    const vp = mul4(perspective(cam.fovY, asp, 1e-5, 1e9), view);
    // Himmel
    gl.disable(gl.BLEND);
    gl.useProgram(this.sky);
    gl.uniform3f(this.u(this.sky, 'uR'), R.x, R.y, R.z); gl.uniform3f(this.u(this.sky, 'uU'), Up.x, Up.y, Up.z); gl.uniform3f(this.u(this.sky, 'uF'), F.x, F.y, F.z);
    gl.uniform2f(this.u(this.sky, 'uTan'), th * asp, th);
    gl.uniformMatrix3fv(this.u(this.sky, 'uGal'), false, this.gal);
    gl.uniform1f(this.u(this.sky, 'uSkyB'), o.skyB);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.skyTex); gl.uniform1i(this.u(this.sky, 'uSky'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    // Sterne (additiv)
    gl.blendFunc(gl.ONE, gl.ONE);
    if (this.starCount) {
      gl.useProgram(this.pts);
      gl.uniformMatrix4fv(this.u(this.pts, 'uVP'), false, mat4(vp));
      gl.uniform1f(this.u(this.pts, 'uSize'), 2.6 * this.dpr); gl.uniform1f(this.u(this.pts, 'uDir'), 1); gl.uniform1f(this.u(this.pts, 'uSoft'), 1);
      gl.bindVertexArray(this.starVao); gl.drawArrays(gl.POINTS, 0, this.starCount);
    }
    // Kleinkörper
    if (o.dots && this.dotCount) {
      gl.useProgram(this.pts);
      gl.uniformMatrix4fv(this.u(this.pts, 'uVP'), false, mat4(vp));
      gl.uniform1f(this.u(this.pts, 'uSize'), 1.7 * this.dpr); gl.uniform1f(this.u(this.pts, 'uDir'), 0); gl.uniform1f(this.u(this.pts, 'uSoft'), 0);
      gl.bindVertexArray(this.dotVao); gl.drawArrays(gl.POINTS, 0, this.dotCount);
    }
    // Bahnen
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.ln);
    gl.uniformMatrix4fv(this.u(this.ln, 'uVP'), false, mat4(vp));
    gl.bindVertexArray(this.lnVao);
    for (const l of o.lines) {
      if (l.pts.length < 6) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lnPos); gl.bufferData(gl.ARRAY_BUFFER, l.pts, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lnA); gl.bufferData(gl.ARRAY_BUFFER, l.alpha, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
      gl.uniform4f(this.u(this.ln, 'uC'), ...l.color);
      gl.drawArrays(gl.LINE_STRIP, 0, l.pts.length / 3);
    }
    gl.bindVertexArray(null);
    // Körper (hinten → vorn)
    const sorted = [...o.bodies].sort((a, b) => b.pos.sub(cam.pos).len2 - a.pos.sub(cam.pos).len2);
    gl.useProgram(this.body);
    const bu = (n: string) => this.u(this.body, n);
    gl.uniform3f(bu('uR'), R.x, R.y, R.z); gl.uniform3f(bu('uU'), Up.x, Up.y, Up.z); gl.uniform3f(bu('uF'), F.x, F.y, F.z);
    gl.uniform2f(bu('uTan'), th * asp, th);
    gl.uniform1f(bu('uTime'), o.time);
    gl.uniform1i(bu('uMap'), 1); gl.uniform1i(bu('uNight'), 2); gl.uniform1i(bu('uClouds'), 3); gl.uniform1i(bu('uRingTex'), 4);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.night);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.clouds);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.ringTex);
    for (const d of sorted) {
      const b = d.b, rel = d.pos.sub(cam.pos), dist = rel.len;
      const ext = Math.max(1 + (b.atmoH > 0 ? b.atmoH / b.R * 1.6 : 0), b.ringOut > 0 ? b.ringOut / b.R : 1) * Math.max(b.ax, b.ay, b.az);
      const pr = this.project(cam, d.pos);
      // Sichtbar? Winkel zwischen Blickrichtung und Körpermitte gegen Bildwinkel (Diagonale) + Winkelradius.
      // Die Mitte kann hinter der Kamera liegen, während die Scheibe das halbe Bild füllt (Start vom Boden aus).
      const angR = Math.asin(Math.min(1, b.R * ext / dist)) * 1.08;
      if (dist > b.R * ext * 1.05) {
        const off = Math.acos(Math.max(-1, Math.min(1, rel.dot(cam.fwd) / dist)));
        if (off - angR > Math.atan(th * Math.hypot(1, asp)) + 0.02) continue;
      }
      // Viereck: bei Nähe oder großer Scheibe Vollbild, sonst Kreis um den projizierten Mittelpunkt
      let qx = 0, qy = 0, qw = 1.05, qh = 1.05;
      if (pr && dist > b.R * ext * 1.5 && angR < 0.5) {
        qx = (pr[0] * this.dpr / this.w) * 2 - 1; qy = 1 - (pr[1] * this.dpr / this.h) * 2;
        qh = Math.tan(angR) / th * 1.15; qw = qh / asp;
        if (qw * this.w < 1.5) continue;
      }
      gl.uniform4f(bu('uQ'), qx, qy, qw, qh);
      const oc = cam.pos.sub(d.pos).div(b.R);
      gl.uniform3f(bu('uOc'), oc.x, oc.y, oc.z);
      const [ex, ey, ez] = frame(b.index, o.jd);
      gl.uniformMatrix3fv(bu('uBasis'), false, new Float32Array([ex.x, ex.y, ex.z, ey.x, ey.y, ey.z, ez.x, ez.y, ez.z]));
      const flat = 1 - b.flat;
      gl.uniform3f(bu('uAxes'), b.ax, b.ay * flat, b.az);
      const toSun = d.pos.neg(), sd = toSun.len;
      const sun = sd > 0 ? toSun.div(sd) : new V(0, 0, 1);
      gl.uniform3f(bu('uSun'), sun.x, sun.y, sun.z);
      gl.uniform1f(bu('uSunAng'), Math.asin(Math.min(1, 695700 / Math.max(sd, 695701))));
      const occ = new Float32Array(8);
      d.occ.slice(0, 2).forEach((q, k) => { const r = q.pos.sub(d.pos).div(b.R); occ.set([r.x, r.y, r.z, q.R / b.R], k * 4); });
      gl.uniform4fv(bu('uOcc[0]'), occ);
      gl.uniform1f(bu('uRed'), d.occ.slice(0, 2).some(q => Math.abs(q.R - 6371) < 30) ? 1 : 0);
      gl.uniform1i(bu('uType'), b.surf); gl.uniform1i(bu('uVar'), b.variant); gl.uniform1f(bu('uSeed'), b.seed);
      gl.uniform1i(bu('uSunBody'), b.index === 0 ? 1 : 0);
      gl.uniform3f(bu('uC1'), ...b.col1); gl.uniform3f(bu('uC2'), ...b.col2);
      gl.uniform1f(bu('uExpo'), o.expo);
      gl.uniform4f(bu('uAtmo'), ...b.atmoCol, b.atmoH > 0 ? Math.min(0.25, b.atmoH / b.R) : 0);
      gl.uniform4f(bu('uRing'), b.ringIn / b.R, b.ringOut / b.R, b.ringKind, 0);
      const t = this.tex.get(b.name);
      gl.uniform1i(bu('uTex'), t ? 1 : 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t ?? this.skyTex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // Leuchtpunkte (ferne Körper, Sonnenglanz)
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.glow);
    for (const p of o.points) {
      const pr = this.project(cam, p.pos);
      if (!pr) continue;
      const qx = (pr[0] * this.dpr / this.w) * 2 - 1, qy = 1 - (pr[1] * this.dpr / this.h) * 2;
      const s = p.size * this.dpr / this.h * 2;
      gl.uniform4f(this.u(this.glow, 'uQ'), qx, qy, s / asp, s);
      gl.uniform3f(this.u(this.glow, 'uC'), ...p.col);
      gl.uniform1f(this.u(this.glow, 'uCore'), p.size < 20 ? 1 : 0.4);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  /** Linienzug relativ zur Kamera (Einheit U). */
  static line(pts: V[], cam: V, color: [number, number, number, number], fadeTail = false): LineSet {
    const a = new Float32Array(pts.length * 3), al = new Float32Array(pts.length);
    pts.forEach((p, i) => { a[i * 3] = (p.x - cam.x) / U; a[i * 3 + 1] = (p.y - cam.y) / U; a[i * 3 + 2] = (p.z - cam.z) / U; al[i] = fadeTail ? Math.pow(i / Math.max(1, pts.length - 1), 1.5) : 1; });
    return { pts: a, alpha: al, color };
  }
}

export const UNIT = U;
export { AU };
void Surf;
